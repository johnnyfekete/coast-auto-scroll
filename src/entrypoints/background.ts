import { browser } from 'wxt/browser';
import { pinFor, reconcilePins, unpinSite, watchRevokedPermissions, type Pin } from '@/pins/pins';
import { isPinRequest, OPEN_OPTIONS, UNPIN, type PinRequest } from '@/pins/protocol';
import { injectPanel } from '@/lib/inject';

/**
 * The worker exists for two things the rest of the extension cannot do for
 * itself, and deliberately nothing else. No crawl runs here: the popup and the
 * panel talk to the page directly, and a worker in the middle would only add a
 * hop that Chrome can kill mid-press.
 *
 * Both listeners are registered in the first synchronous turn, because Chrome
 * delivers the event that *woke* a worker only to listeners that were already
 * there. Anything registered after an await misses the message that started it.
 */
export default defineBackground(() => {
  watchRevokedPermissions();

  browser.runtime.onMessage.addListener((message: unknown) => {
    if (!isPinRequest(message)) return undefined;
    const request = message as PinRequest;

    if (request.type === OPEN_OPTIONS) {
      void browser.runtime.openOptionsPage();
      return Promise.resolve(true);
    }

    if (request.type === UNPIN) {
      // The panel says which page it is on; which pin covers that page is the
      // worker's to work out, so the panel never has to remember what it was
      // pinned as.
      return pinFor(request.url).then(async (pin) => {
        if (pin === null) return false;
        await unpinSite(pin.pattern);
        return true;
      });
    }

    return undefined;
  });

  showPanelOnNewlyPinnedTabs();

  // Storage, registrations and permissions can each change while no worker is
  // alive. This is the pass that makes them agree again.
  void reconcilePins();
});

/**
 * Show the panel on tabs that are already open when a site is pinned.
 *
 * A registration only takes effect on the next load, and the reader who just
 * pressed "Pin on page" is looking at the page they pinned — so something has
 * to inject into it now. That something is the worker rather than the popup:
 * the popup is closed the instant the reader looks back at the page, and work
 * still in flight there goes with it.
 *
 * Watching storage rather than being told also means it covers the tabs the
 * reader was not looking at. Three tabs of the same site all get the panel.
 */
function showPanelOnNewlyPinnedTabs(): void {
  browser.storage.local.onChanged.addListener((changes) => {
    const change = changes['pins'];
    if (change === undefined) return;

    const before = new Set(
      (Array.isArray(change.oldValue) ? change.oldValue : []).map((pin: Pin) => pin.pattern),
    );
    const added = (Array.isArray(change.newValue) ? change.newValue : []).filter(
      (pin: Pin) => !before.has(pin.pattern),
    );

    for (const pin of added) {
      void browser.tabs
        .query({ url: pin.pattern })
        .then((tabs) => {
          for (const tab of tabs) {
            if (tab.id !== undefined) void injectPanel(tab.id);
          }
        })
        .catch(() => undefined);
    }
  });
}
