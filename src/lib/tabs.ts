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
