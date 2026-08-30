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
    name: 'Coast — Auto Scroll for Reading',
    short_name: 'Coast',
    description:
      'Scrolls the page for you at a speed you set. Installs with no permissions — pin a site and it asks for that one site.',
    permissions: ['activeTab', 'scripting', 'storage'],
    optional_host_permissions: ['*://*/*'],
    action: {},
  },
});
