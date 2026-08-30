/**
 * What, on this page, is the thing that scrolls.
 *
 * Usually the document, and if that were always true this module would not
 * exist. It is not: plenty of app-shell layouts pin `body` to the viewport and
 * scroll an inner pane instead, and on those `window.scrollTo` does nothing at
 * all — a silent failure that looks exactly like the extension being broken.
 *
 * The fallback asks the page the only question with a defensible answer: what
 * is under the middle of the screen, and can *it* scroll? Enumerating every
 * element and reading its computed overflow is the thorough version, and costs
 * a style resolution per element on a page that may have thousands.
 */

/** Under this, a scrollable range is rounding rather than somewhere to go. */
const MIN_SCROLLABLE_PX = 4;

export type Scroller = {
  position(): number;
  /** The furthest it can scroll: its full height less what is on screen. */
  max(): number;
  scrollTo(top: number): void;
  /** False once the element has been unmounted, so the caller can re-resolve. */
  alive(): boolean;
};

function range(element: Element): number {
  return element.scrollHeight - element.clientHeight;
}

function documentScroller(): Scroller {
  const doc = document.scrollingElement ?? document.documentElement;
  return {
    position: () => window.scrollY,
    max: () => range(doc),
    // `instant` rather than the default, and it has to be spelled out: a page
    // whose CSS sets `scroll-behavior: smooth` would otherwise animate every
    // one of these, leaving the real position lagging the target on every
    // frame — which the step function would read, correctly, as somebody else
    // scrolling. The crawl would then pause itself forever on exactly the sites
    // that opted into smoothness.
    scrollTo: (top) => window.scrollTo({ top, behavior: 'instant' }),
    alive: () => true,
  };
}

function elementScroller(element: Element): Scroller {
  return {
    position: () => element.scrollTop,
    max: () => range(element),
    scrollTo: (top) => element.scrollTo({ top, behavior: 'instant' }),
    alive: () => element.isConnected,
  };
}

/** The nearest ancestor of `from` with somewhere to scroll to, if any. */
function scrollableAncestor(from: Element | null): Element | null {
  for (let node = from; node !== null; node = node.parentElement) {
    if (range(node) < MIN_SCROLLABLE_PX) continue;
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') return node;
  }
  return null;
}

/** The scroller for this page, or null when nothing on it can scroll. */
export function resolveScroller(): Scroller | null {
  const doc = document.scrollingElement ?? document.documentElement;
  if (range(doc) >= MIN_SCROLLABLE_PX) return documentScroller();

  const middle = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
  const inner = scrollableAncestor(middle);
  return inner === null ? null : elementScroller(inner);
}
