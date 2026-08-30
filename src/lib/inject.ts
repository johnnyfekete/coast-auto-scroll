import { browser } from 'wxt/browser';

/** Built by WXT from the unlisted panel entrypoint. */
export const PANEL_SCRIPT = '/panel.js' as const;

/**
 * Put the panel into a tab straight away.
 *
 * A registration only takes effect on the next load, and a reader who has just
 * pressed "Pin on page" is looking at the page they pinned. Waiting for a
 * reload would make the button look as though it had done nothing.
 */
export async function injectPanel(tabId: number): Promise<void> {
  await browser.scripting
    .executeScript({ target: { tabId }, files: [PANEL_SCRIPT] })
    .catch(() => undefined);
}
