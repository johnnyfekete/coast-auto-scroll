import { browser } from 'wxt/browser';
import { clampSpeed, DEFAULT_SPEED_PX_PER_S } from '@/scroll/speed';
import { DEFAULT_POSITION, type Position } from '@/panel/position';
import type { ManualScroll } from '@/scroll/step';

/**
 * Everything Coast remembers, and the only module that touches
 * `chrome.storage`.
 *
 * `storage.local` rather than `storage.sync`, deliberately. Syncing would send
 * the list of sites a reader pinned off their machine, which cuts against the
 * permission model the whole extension is built on — and a pin arriving on a
 * second machine, where its origin was never granted, would be silently dead
 * with nothing on screen to explain why.
 */

const KEY = 'settings';

export type Settings = {
  /** The speed used where nothing more specific is remembered. */
  speed: number;
  /**
   * Where the on-page panel sits, shared by every site. See `position.ts` for
   * why it is one position rather than one per site.
   */
  panelPosition: Position;
  /** What a manual scroll does: pause and carry on, or end the crawl. */
  manualScroll: ManualScroll;
};

const DEFAULTS: Settings = {
  speed: DEFAULT_SPEED_PX_PER_S,
  panelPosition: DEFAULT_POSITION,
  // Pausing, because with `stop` a nudge of the scrollbar costs a trip back to
  // the popup — a punishment for having touched the page you are reading.
  manualScroll: 'pause',
};

function toPosition(stored: unknown): Position {
  const value = stored as Partial<Position> | null | undefined;
  if (typeof value?.right !== 'number' || typeof value?.bottom !== 'number') {
    return DEFAULTS.panelPosition;
  }
  // Held inside the viewport by whoever draws it, not here: this module has no
  // window to measure, and a position is only wrong relative to one.
  return { right: value.right, bottom: value.bottom };
}

function toSettings(stored: unknown): Settings {
  const value = stored as
    | { speed?: unknown; panelPosition?: unknown; manualScroll?: unknown }
    | null
    | undefined;
  return {
    speed: typeof value?.speed === 'number' ? clampSpeed(value.speed) : DEFAULTS.speed,
    panelPosition: toPosition(value?.panelPosition),
    manualScroll: value?.manualScroll === 'stop' ? 'stop' : DEFAULTS.manualScroll,
  };
}

/**
 * Read fresh every time rather than cached at startup: a page stays open across
 * a change made in another tab, and a cached answer goes stale in both
 * directions.
 */
export async function readSettings(): Promise<Settings> {
  try {
    const stored = await browser.storage.local.get(KEY);
    return toSettings(stored[KEY]);
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveSpeed(speed: number): Promise<void> {
  const settings = await readSettings();
  await browser.storage.local.set({ [KEY]: { ...settings, speed: clampSpeed(speed) } });
}

export async function savePanelPosition(panelPosition: Position): Promise<void> {
  const settings = await readSettings();
  await browser.storage.local.set({ [KEY]: { ...settings, panelPosition } });
}

export async function saveManualScroll(manualScroll: ManualScroll): Promise<void> {
  const settings = await readSettings();
  await browser.storage.local.set({ [KEY]: { ...settings, manualScroll } });
}

/** Calls `cb` whenever settings change, and returns the unsubscribe. */
export function watchSettings(cb: (settings: Settings) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>) => {
    const change = changes[KEY];
    if (change === undefined) return;
    cb(toSettings(change.newValue));
  };
  browser.storage.local.onChanged.addListener(listener);
  return () => browser.storage.local.onChanged.removeListener(listener);
}
