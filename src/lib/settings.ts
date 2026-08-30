import { browser } from 'wxt/browser';
import { clampSpeed, DEFAULT_SPEED_PX_PER_S } from '@/scroll/speed';

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
};

const DEFAULTS: Settings = {
  speed: DEFAULT_SPEED_PX_PER_S,
};

function toSettings(stored: unknown): Settings {
  const speed = (stored as { speed?: unknown } | null | undefined)?.speed;
  return {
    speed: typeof speed === 'number' ? clampSpeed(speed) : DEFAULTS.speed,
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
