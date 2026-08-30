import { browser } from 'wxt/browser';
import { patternMatches, type PinCandidate } from './patterns';

/**
 * Pinning: the one thing in Coast that asks Chrome for anything.
 *
 * A pin is three facts held together — a granted origin, a registered content
 * script, and a stored record — and the work here is keeping them agreeing.
 * They can disagree without the extension being involved at all: a reader can
 * revoke site access from `chrome://extensions`, and registrations persist
 * across restarts whether or not the permission behind them survived. So every
 * operation is written to be safe to repeat, and `reconcilePins` exists to make
 * the three agree again from whatever state they are in.
 */

const KEY = 'pins';

/** Built by WXT from the unlisted panel entrypoint, and registered per pin. */
const PANEL_SCRIPT = 'panel.js';

export type Pin = {
  /** The Chrome match pattern that was granted. */
  pattern: string;
  /** The host or domain it covers, for showing to the reader. */
  host: string;
  subdomains: boolean;
};

export type PinOutcome = 'pinned' | 'declined' | 'failed';

/**
 * A registration id derived from the pattern, so the same pin always claims the
 * same id and re-registering is an update rather than a duplicate.
 */
function scriptId(pattern: string): string {
  return `coast-${pattern.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

async function writePins(pins: Pin[]): Promise<void> {
  await browser.storage.local.set({ [KEY]: pins });
}

export async function readPins(): Promise<Pin[]> {
  try {
    const stored = await browser.storage.local.get(KEY);
    const pins = stored[KEY];
    if (!Array.isArray(pins)) return [];
    return pins.filter(
      (pin): pin is Pin =>
        typeof (pin as Pin | null)?.pattern === 'string' && typeof (pin as Pin).host === 'string',
    );
  } catch {
    return [];
  }
}

async function register(pattern: string): Promise<void> {
  const id = scriptId(pattern);
  // Registering an id Chrome already holds throws, and on a repeated pin that
  // is not a failure — it is the state we wanted.
  await browser.scripting.unregisterContentScripts({ ids: [id] }).catch(() => undefined);
  await browser.scripting.registerContentScripts([
    {
      id,
      js: [PANEL_SCRIPT],
      matches: [pattern],
      runAt: 'document_idle',
      // Without this the panel would vanish on the next browser restart, which
      // is exactly when a reader would not connect it to anything they did.
      persistAcrossSessions: true,
    },
  ]);
}

/**
 * Ask for one origin and, if the reader agrees, start showing the panel there.
 *
 * The permission comes first and everything else follows from it: a pin the
 * reader declined must leave nothing at all behind, which is easiest to
 * guarantee by not having created anything yet.
 */
export async function pinSite(candidate: PinCandidate): Promise<PinOutcome> {
  let granted = false;
  try {
    granted = await browser.permissions.request({ origins: [candidate.pattern] });
  } catch {
    return 'failed';
  }
  if (!granted) return 'declined';

  try {
    await register(candidate.pattern);
  } catch {
    // Hand back what was just granted rather than keeping access we cannot use.
    await browser.permissions.remove({ origins: [candidate.pattern] }).catch(() => undefined);
    return 'failed';
  }

  const pins = await readPins();
  const others = pins.filter((pin) => pin.pattern !== candidate.pattern);
  await writePins([
    ...others,
    { pattern: candidate.pattern, host: candidate.host, subdomains: candidate.subdomains },
  ]);
  return 'pinned';
}

/**
 * Stop showing the panel on a site, and give its permission back.
 *
 * Handing the permission back matters more than it looks: it is what keeps
 * `chrome://extensions` honest about which sites Coast can reach. Keeping the
 * grant "just in case they re-pin" would make that list quietly wrong.
 */
export async function unpinSite(pattern: string): Promise<void> {
  await browser.scripting
    .unregisterContentScripts({ ids: [scriptId(pattern)] })
    .catch(() => undefined);
  await browser.permissions.remove({ origins: [pattern] }).catch(() => undefined);
  const pins = await readPins();
  await writePins(pins.filter((pin) => pin.pattern !== pattern));
}

/** The pin covering this page, if any. */
export async function pinFor(url: string): Promise<Pin | null> {
  const pins = await readPins();
  return pins.find((pin) => patternMatches(pin.pattern, url)) ?? null;
}

/**
 * Make the three halves of every pin agree again.
 *
 * They drift apart without the extension being involved: a reader can revoke a
 * site from `chrome://extensions`, and registrations survive restarts on their
 * own terms. The permission is treated as the truth, because it is the only one
 * of the three the reader controls directly — a record or a registration
 * without it is a claim the browser has already refused.
 */
export async function reconcilePins(): Promise<void> {
  const pins = await readPins();
  const kept: Pin[] = [];

  for (const pin of pins) {
    const granted = await browser.permissions
      .contains({ origins: [pin.pattern] })
      .catch(() => false);
    if (granted) kept.push(pin);
  }

  const wanted = new Map(kept.map((pin) => [scriptId(pin.pattern), pin]));
  const existing = await browser.scripting.getRegisteredContentScripts().catch(() => []);
  const existingIds = new Set(existing.map((script) => script.id));

  // Anything of ours Chrome is still running that no pin asks for. Scoped to
  // our own id prefix so a stray registration from something else is left alone.
  const stale = [...existingIds].filter((id) => id.startsWith('coast-') && !wanted.has(id));
  if (stale.length > 0) {
    await browser.scripting.unregisterContentScripts({ ids: stale }).catch(() => undefined);
  }

  for (const [id, pin] of wanted) {
    if (existingIds.has(id)) continue;
    await register(pin.pattern).catch(() => undefined);
  }

  if (kept.length !== pins.length) await writePins(kept);
}

/**
 * Watch for access being revoked from the browser's own UI.
 *
 * Registered synchronously, in the worker's first turn, because Chrome delivers
 * the event that woke a worker only to listeners that were already there.
 */
export function watchRevokedPermissions(): void {
  browser.permissions.onRemoved.addListener(() => {
    void reconcilePins();
  });
}

/** The scheme-and-host half of a match pattern, which is all Chrome grants. */
function originOf(pattern: string): string {
  return /^([^:]+:\/\/[^/]+)\//.exec(pattern)?.[1] ?? pattern;
}

/**
 * Change what an existing pin covers.
 *
 * Whether the reader sees a dialog is not decided here — it is asked of Chrome,
 * which is the only thing that knows what it has already granted. Widening to a
 * new domain prompts; narrowing to a path inside an origin already granted does
 * not, because Chrome grants whole origins and there is nothing new to ask for.
 *
 * The old origin is handed back only when the pin actually moved to a different
 * one. Giving it back after a narrowing would revoke the very access the
 * narrowed pin still needs.
 */
export async function changePin(oldPattern: string, next: PinCandidate): Promise<PinOutcome> {
  const already = await browser.permissions
    .contains({ origins: [next.pattern] })
    .catch(() => false);

  if (!already) {
    const granted = await browser.permissions
      .request({ origins: [next.pattern] })
      .catch(() => false);
    if (!granted) return 'declined';
  }

  try {
    await browser.scripting
      .unregisterContentScripts({ ids: [scriptId(oldPattern)] })
      .catch(() => undefined);
    await register(next.pattern);
  } catch {
    return 'failed';
  }

  if (originOf(oldPattern) !== originOf(next.pattern)) {
    await browser.permissions.remove({ origins: [oldPattern] }).catch(() => undefined);
  }

  const pins = await readPins();
  await writePins(
    pins.map((pin) =>
      pin.pattern === oldPattern
        ? { pattern: next.pattern, host: next.host, subdomains: next.subdomains }
        : pin,
    ),
  );
  return 'pinned';
}
