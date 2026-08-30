import { browser } from 'wxt/browser';
import { installController } from '@/scroll/controller';
import { createPanel } from '@/panel/mount';
import { readSettings, savePanelPosition, saveSpeed, watchSettings } from '@/lib/settings';
import { OPEN_OPTIONS, UNPIN } from '@/pins/protocol';

/**
 * The control on a pinned site.
 *
 * Unlisted rather than a content script with `matches` in the manifest, because
 * where it runs is not known at build time — it runs wherever the reader has
 * pinned, and that list is registered at runtime with
 * `scripting.registerContentScripts`. A manifest entry would mean declaring the
 * sites up front, which is the thing this extension exists not to do.
 *
 * It is also injected directly into the current tab the moment a pin is made,
 * so the panel appears without a reload; both paths land here, and the guard
 * below is what makes the second one harmless.
 */
export default defineUnlistedScript(() => {
  if (document.querySelector('[data-coast="panel"]') !== null) return;

  const controller = installController();
  const panel = createPanel({
    onToggle: () => {
      const status = controller.status();
      if (status.running) controller.stop();
      else controller.start();
    },
    onSpeed: (speed) => controller.setSpeed(speed),
    onCommit: (speed) => void saveSpeed(speed),
    onMove: (position) => void savePanelPosition(position),

    // A content script can call neither `permissions` nor `scripting`, so this
    // is a request rather than an action. The worker works out which pin covers
    // this page; the panel only knows which page it is on.
    onUnpin: () => {
      void browser.runtime
        .sendMessage({ type: UNPIN, url: location.href })
        .then((removed) => {
          if (removed === true) {
            controller.stop();
            panel.destroy();
          }
        })
        .catch(() => undefined);
    },
    onSettings: () => {
      void browser.runtime.sendMessage({ type: OPEN_OPTIONS }).catch(() => undefined);
    },
  });

  controller.subscribe((status) => panel.render(status));
  panel.render(controller.status());

  void readSettings().then((settings) => panel.place(settings.panelPosition));
  // One position for every site, so a panel moved in one tab moves in the rest
  // of them too rather than waiting for each to be reloaded.
  watchSettings((settings) => panel.place(settings.panelPosition));
});
