import { browser } from 'wxt/browser';
import {
  SET_SPEED,
  START,
  STATUS,
  STOP,
  type ScrollRequest,
  type ScrollStatus,
} from '@/scroll/protocol';

/** Built by WXT from the unlisted controller entrypoint. */
export const CONTROLLER_SCRIPT = '/scroll-controller.js' as const;

/**
 * Pages no script can be injected into. Chrome's own pages and the Web Store
 * are closed to every extension, and a control that looks available on them is
 * a control that fails without saying why.
 */
const BLOCKED_SCHEME = /^(?:chrome|chrome-extension|about|devtools|view-source|edge|moz-extension):/i;
const WEB_STORE = /^https?:\/\/(?:chromewebstore\.google\.com|chrome\.google\.com\/webstore)/i;

export function canScrollPage(url: string): boolean {
  if (url === '') return false;
  return !BLOCKED_SCHEME.test(url) && !WEB_STORE.test(url);
}

async function ask(tabId: number, request: ScrollRequest): Promise<ScrollStatus | null> {
  try {
    const reply = (await browser.tabs.sendMessage(tabId, request)) as ScrollStatus | undefined;
    return reply ?? null;
  } catch {
    // No receiving end: this tab has no controller in it yet. Not an error — it
    // is the ordinary state of every tab until the first press.
    return null;
  }
}

/**
 * The tab's status, without putting a controller in it.
 *
 * Deliberately does not inject. The popup asks this every time it opens, and a
 * status read that installed a controller would leave one in every page the
 * popup was ever opened on — which is the everywhere-content-script this
 * extension is shaped to avoid, arrived at by accident.
 */
export function readTabStatus(tabId: number): Promise<ScrollStatus | null> {
  return ask(tabId, { type: STATUS });
}

/**
 * Sends a request, installing the controller first if the tab has none.
 *
 * Ping-then-inject rather than inject-then-send, so a pinned site — which
 * already has a controller from its content script — is never injected into at
 * all. The controller is idempotent anyway; this just means the common case
 * does no work.
 */
async function command(tabId: number, request: ScrollRequest): Promise<ScrollStatus | null> {
  const answered = await ask(tabId, request);
  if (answered !== null) return answered;

  try {
    await browser.scripting.executeScript({ target: { tabId }, files: [CONTROLLER_SCRIPT] });
  } catch {
    return null;
  }
  return ask(tabId, request);
}

export function startTab(tabId: number, speed: number): Promise<ScrollStatus | null> {
  return command(tabId, { type: START, speed });
}

/**
 * Stop never injects: a tab with no controller is already stopped, and
 * installing one in order to tell it to do nothing is the wrong shape of work.
 */
export function stopTab(tabId: number): Promise<ScrollStatus | null> {
  return ask(tabId, { type: STOP });
}

/** Speed changes reach a running tab; on one that never started there is nothing to retune. */
export function setTabSpeed(tabId: number, speed: number): Promise<ScrollStatus | null> {
  return ask(tabId, { type: SET_SPEED, speed });
}

/**
 * The tab the reader means: the active one, which is the page the popup is
 * hanging over.
 *
 * The exception is the popup opened as an ordinary tab — which a reader can do,
 * and which a test harness has to do, since nothing outside Chrome can click a
 * toolbar button. `tabs.getCurrent` is what tells the two apart: an extension
 * page running in a real popup is not in a tab and gets nothing back, while one
 * running in a tab gets that tab. Reading the url instead would not work, since
 * Chrome reports no url for our own pages without the broad `tabs` permission
 * this extension refuses to ask for.
 *
 * An active tab that cannot be scrolled is still the answer. Quietly scrolling
 * some other tab instead of saying "not this page" would be worse than the
 * disappointment it avoids.
 */
export async function resolveTargetTab(): Promise<{ id?: number; url?: string } | null> {
  const self = await browser.tabs.getCurrent();
  if (self === undefined) {
    const [active] = await browser.tabs.query({ active: true, currentWindow: true });
    return active ?? null;
  }

  const others = (await browser.tabs.query({})).filter((tab) => tab.id !== self.id);
  if (others.length === 0) return null;
  return others.reduce((newest, tab) =>
    (tab.lastAccessed ?? 0) > (newest.lastAccessed ?? 0) ? tab : newest,
  );
}

/**
 * Start a tab, or stop it if it is already going.
 *
 * What the keyboard shortcut does. The status read comes first and does not
 * inject, so a shortcut pressed on a tab that has never been scrolled reaches
 * `startTab`, which installs the controller — and one pressed on a tab that is
 * scrolling stops it without any of that.
 */
export async function toggleTab(tabId: number, speed: number): Promise<ScrollStatus | null> {
  const status = await readTabStatus(tabId);
  return status?.running === true ? stopTab(tabId) : startTab(tabId, speed);
}
