import { installController } from '@/scroll/controller';
import { createPanel } from '@/panel/mount';
import { saveSpeed } from '@/lib/settings';

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
  });

  controller.subscribe((status) => panel.render(status));
  panel.render(controller.status());
});
