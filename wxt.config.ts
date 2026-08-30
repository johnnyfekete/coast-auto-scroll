import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

/**
 * The permission list is the product, not a detail of it.
 *
 * There are no `host_permissions` here and there never will be. The popup
 * reaches the page it is standing on through `activeTab`, granted by the
 * toolbar click itself and expiring on the next navigation; a pinned site is
 * granted one origin at a time, at the moment the reader pins it, through
 * `permissions.request` at runtime. That is why `optional_host_permissions` is
 * `*://*\/*` — it is not a grant, it is the set of origins Chrome will *let* a
 * reader grant later, one dialog at a time.
 *
 * The visible consequence is that installing Coast shows no permission warning
 * at all, and `chrome://extensions` reports "On specific sites" listing exactly
 * the sites that were pinned.
 */
/** Public half of a throwaway keypair; pins the extension id for tests only. */
const E2E_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2jAV09r1ilgYA/t5ILYgxnLd+CltvjNku5hSEXmjMcz0jn4bzhELsRaH5X/smns1OAat2kNCYErl4Rj6dl+Kgcogvtv6T2FWSDCexH4yIr+jovIlUFc8qa/9Y/sEo2xXM5XxKH80DAGc2ApvDFysVt8WYOZr7xo+Cf/25WTpYvAnl7fNpksKp6V7yHwpMjrPIWwSscNHtlHSpTRqh4+5gwOUKlBNA5IuKT48ajBo4aCtozaohcTXTp11aZYBdIADLrC+9eW/mvLzvWcZ7MKC7ur87LHp++8SyBDeVcfs9mROGTQ9/I3rqksHagl+SMVG59F++VEP83xCwrNb3xizcQIDAQAB';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
    // Vite emits <link rel="modulepreload"> for shared chunks; extension pages
    // load off local disk, so there is no round trip for the hint to save and
    // Chrome warns about the unused preload. Nothing changes but the warning.
    build: { modulePreload: false },
  }),
  manifest: {
    /**
     * Only set for end-to-end runs, and only so the extension's id is the same
     * every time: nothing outside Chrome can click a toolbar button, so the
     * tests reach the popup by its `chrome-extension://` URL and need to know
     * the id in advance. It is deliberately absent from a real build, where the
     * Web Store assigns the key itself.
     */
    ...(process.env.COAST_E2E === '1'
      ? {
          key: E2E_KEY,
          /**
           * `activeTab` is granted by a toolbar click, and nothing outside
           * Chrome can perform one — so under test the popup would have access
           * to no tab at all, and every test would fail for a reason that has
           * nothing to do with what it is testing. Granting the origins up
           * front stands in for the click.
           *
           * The cost is honest and worth stating: end-to-end runs do not
           * exercise the `activeTab` grant itself, nor the permission dialog.
           * Both of those live in the fake-browser tests instead.
           */
          host_permissions: ['<all_urls>'],
        }
      : {}),
    name: 'Coast — Auto Scroll for Reading',
    short_name: 'Coast',
    description:
      'Scrolls the page for you at a speed you set. Installs with no permissions — pin a site and it asks for that one site.',
    permissions: ['activeTab', 'scripting', 'storage'],
    optional_host_permissions: ['*://*/*'],
    action: {},
    /**
     * No `suggested_key`, deliberately. A default binding is how an extension
     * collides with the shortcut a reader already uses for something else, and
     * Chrome silently drops the loser — so it is left unset and the settings
     * page points at chrome://extensions/shortcuts.
     */
    commands: {
      'toggle-scroll': { description: 'Toggle auto scroll on this page' },
    },
  },
});
