import { installController } from '@/scroll/controller';

/**
 * Puts the scroll controller into a tab, on demand.
 *
 * Unlisted rather than a content script matching every site: a script idling in
 * every page you open, in order to be used when you press a button in the
 * popup, is exactly the cost this extension exists to refuse. The popup injects
 * it only after asking the tab and getting no answer, and `installController`
 * is idempotent besides — so a pinned page, which already has a controller from
 * its own content script, never grows a second one.
 */
export default defineUnlistedScript(() => {
  installController();
});
