import type { ScrollStatus } from '@/scroll/protocol';
import { formatSpeed, fractionToSpeed, speedToFraction } from '@/scroll/speed';
import { clampPosition, DEFAULT_POSITION, positionFromDrag, type Position } from './position';

/**
 * The control that sits on a pinned page.
 *
 * A fixed-position host appended to `document.body`, inside a shadow root. It
 * never queries the site's own markup and never inserts itself into it, which
 * is the whole reason it survives: class names are build-hashed and change
 * between deploys, sites re-render and reconcile away anything they find in
 * their tree, and a control anchored to a heading is a control that disappears
 * the week the site is redesigned. Standing beside the page instead of inside
 * it means there is nothing to lose.
 *
 * `all: initial` on the host, plus the shadow boundary, is what stops the
 * site's stylesheet reaching in — and stops ours reaching out.
 */

const ACCENT = '#FF9B21';

/**
 * The slider is an integer input mapped onto the speed curve rather than a
 * float input over speeds. A range input's steps are linear whatever its
 * bounds, so putting speeds on it directly would crowd every readable speed
 * into the first few pixels of the track.
 */
const SLIDER_STEPS = 1000;

const STYLE = `
:host { all: initial; }

.panel {
  position: fixed;
  z-index: 2147483000;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 14px 7px 7px;
  border-radius: 999px;
  background: rgba(20, 18, 16, 0.88);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4);
  font: 600 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  color: #fff;
  -webkit-font-smoothing: antialiased;
  /* The background is the drag handle. The controls inside it are not, which is
     what keeps a speed adjustment from also moving the panel. */
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.panel.dragging { cursor: grabbing; }
.panel[hidden] { display: none; }

/* Dark glass in both themes, unlike the extension's own pages. This floats over
   content whose colour is unknown, and a panel that follows the reader's theme
   disappears against half the web. */

.toggle {
  flex: none;
  width: 30px; height: 30px;
  padding: 0; border: 0; border-radius: 50%;
  background: ${ACCENT};
  color: #1a1206;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.toggle:hover { background: #FFB055; }
.toggle:disabled {
  background: rgba(255, 255, 255, 0.16);
  color: rgba(255, 255, 255, 0.38);
  cursor: default;
}

input[type="range"] {
  -webkit-appearance: none; appearance: none;
  width: 104px; height: 4px; margin: 0;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.24);
  cursor: pointer;
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 13px; height: 13px; border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}
input[type="range"]:disabled { opacity: 0.4; cursor: default; }

/* Tabular figures and a fixed width, so the panel does not breathe in and out
   as the number changes under the thumb. */
.readout {
  flex: none;
  min-width: 56px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.76);
}
.readout.off { color: rgba(255, 255, 255, 0.42); }

.more {
  flex: none;
  width: 22px; height: 22px;
  padding: 0; border: 0; border-radius: 6px;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.more:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }

/* Unpin sits behind a menu rather than beside the play button on purpose:
   undoing a mis-click costs a permission dialog, which is more than a stray
   press should ever cost. */
.menu {
  position: absolute;
  right: 8px;
  bottom: calc(100% + 8px);
  min-width: 168px;
  padding: 4px;
  border-radius: 10px;
  background: rgba(28, 25, 22, 0.97);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
}
.menu[hidden] { display: none; }
.menu button {
  border: 0; background: transparent;
  padding: 8px 10px;
  border-radius: 6px;
  text-align: left;
  font: inherit;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.86);
  cursor: pointer;
}
.menu button:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
`;

export type PanelHandlers = {
  onToggle: () => void;
  /** Remove the pin for the site the panel is standing on. */
  onUnpin: () => void;
  onSettings: () => void;
  /** Fires continuously while the thumb moves. */
  onSpeed: (speed: number) => void;
  /** Fires once, when the thumb is let go. The one that writes to storage. */
  onCommit: (speed: number) => void;
  /** Fires once, when the panel is dropped somewhere new. */
  onMove: (position: Position) => void;
};

export type Panel = {
  render: (status: ScrollStatus) => void;
  /** Put the panel somewhere, holding it inside the viewport. */
  place: (position: Position) => void;
  destroy: () => void;
};

export function createPanel(handlers: PanelHandlers): Panel {
  const host = document.createElement('div');
  host.dataset.coast = 'panel';
  const root = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = STYLE;

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.style.right = `${DEFAULT_POSITION.right}px`;
  panel.style.bottom = `${DEFAULT_POSITION.bottom}px`;
  panel.innerHTML = `
    <button class="toggle" type="button" part="toggle" aria-label="Start scrolling">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"></svg>
    </button>
    <input type="range" min="0" max="${SLIDER_STEPS}" step="1" aria-label="Scroll speed">
    <span class="readout"></span>
    <button class="more" type="button" aria-label="More" aria-expanded="false">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
        <circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>
      </svg>
    </button>
    <div class="menu" hidden>
      <button type="button" data-action="unpin">Unpin from this site</button>
      <button type="button" data-action="settings">Settings</button>
    </div>
  `;

  const toggle = panel.querySelector('.toggle') as HTMLButtonElement;
  const glyph = panel.querySelector('.toggle svg') as SVGElement;
  const slider = panel.querySelector('input') as HTMLInputElement;
  const readout = panel.querySelector('.readout') as HTMLSpanElement;
  const more = panel.querySelector('.more') as HTMLButtonElement;
  const menu = panel.querySelector('.menu') as HTMLDivElement;
  const unpin = panel.querySelector('[data-action="unpin"]') as HTMLButtonElement;
  const settings = panel.querySelector('[data-action="settings"]') as HTMLButtonElement;

  root.append(style, panel);
  document.body.appendChild(host);

  let dragging = false;
  let position: Position = DEFAULT_POSITION;

  function place(next: Position) {
    position = clampPosition(next, viewportSize(), panelSize());
    panel.style.right = `${position.right}px`;
    panel.style.bottom = `${position.bottom}px`;
  }

  function viewportSize() {
    return { width: window.innerWidth, height: window.innerHeight };
  }

  function panelSize() {
    const rect = panel.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }

  function speedFromSlider(): number {
    return fractionToSpeed(Number(slider.value) / SLIDER_STEPS);
  }

  // Every pointer and key event the panel handles stops here. Sites listen on
  // the way up for their own click and keyboard behaviour, and neither "start
  // scrolling" nor "a bit faster" should also be one of those.
  const swallow = (event: Event) => event.stopPropagation();
  for (const type of ['pointerdown', 'pointerup', 'click', 'dblclick', 'keydown', 'keyup', 'wheel']) {
    panel.addEventListener(type, swallow);
  }

  toggle.addEventListener('click', () => handlers.onToggle());

  // Dragging starts on the panel's own background only. A pointerdown that
  // landed on a control belongs to that control — a slider you cannot adjust
  // without also moving the panel is worse than one that cannot be moved.
  let drag: { pointerId: number; from: Position; startX: number; startY: number } | null = null;

  panel.addEventListener('pointerdown', (event) => {
    if (event.target !== panel) return;
    drag = { pointerId: event.pointerId, from: position, startX: event.clientX, startY: event.clientY };
    panel.classList.add('dragging');
    panel.setPointerCapture(event.pointerId);
  });

  panel.addEventListener('pointermove', (event) => {
    if (drag === null || event.pointerId !== drag.pointerId) return;
    place(
      positionFromDrag(
        drag.from,
        { x: event.clientX - drag.startX, y: event.clientY - drag.startY },
        viewportSize(),
        panelSize(),
      ),
    );
  });

  function endDrag(event: PointerEvent) {
    if (drag === null || event.pointerId !== drag.pointerId) return;
    drag = null;
    panel.classList.remove('dragging');
    panel.releasePointerCapture(event.pointerId);
    // One write per drop, rather than one per pixel of the drag.
    handlers.onMove(position);
  }
  panel.addEventListener('pointerup', endDrag);
  panel.addEventListener('pointercancel', endDrag);

  // A window that narrowed while the panel sat near an edge would otherwise
  // leave it hanging outside the viewport.
  window.addEventListener('resize', () => place(position));

  function closeMenu() {
    menu.hidden = true;
    more.setAttribute('aria-expanded', 'false');
  }

  more.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    more.setAttribute('aria-expanded', String(!menu.hidden));
  });
  unpin.addEventListener('click', () => {
    closeMenu();
    handlers.onUnpin();
  });
  settings.addEventListener('click', () => {
    closeMenu();
    handlers.onSettings();
  });
  // A click anywhere else closes it. The listener is on the document rather
  // than the panel because that is where the clicks it cares about land.
  document.addEventListener('pointerdown', (event) => {
    if (!menu.hidden && !panel.contains(event.target as Node)) closeMenu();
  });

  slider.addEventListener('pointerdown', () => {
    dragging = true;
  });
  slider.addEventListener('input', () => {
    const speed = speedFromSlider();
    readout.textContent = formatSpeed(speed);
    handlers.onSpeed(speed);
  });
  // `change` rather than `input` for the write: `input` fires on every pixel of
  // the drag, and a storage write per pixel is a hundred writes for one choice.
  slider.addEventListener('change', () => {
    dragging = false;
    handlers.onCommit(speedFromSlider());
  });

  return {
    render(status) {
      toggle.disabled = !status.scrollable;
      toggle.setAttribute('aria-label', status.running ? 'Stop scrolling' : 'Start scrolling');
      glyph.innerHTML = status.running
        ? '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>'
        : '<path d="M8 5l11 7-11 7z"/>';

      slider.disabled = !status.scrollable;
      readout.textContent = formatSpeed(status.speed);
      readout.classList.toggle('off', !status.running);
      // Never while the thumb is under a finger: the status echoes back a
      // moment after each input, and writing it in would make the thumb fight
      // the pointer.
      if (!dragging) slider.value = String(Math.round(speedToFraction(status.speed) * SLIDER_STEPS));
    },
    place,
    destroy() {
      host.remove();
    },
  };
}
