import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';

const HERE = dirname(fileURLToPath(import.meta.url));
const BUILD = join(HERE, '..', '.output', 'chrome-mv3');

/**
 * Fixed because the build used for these tests pins the extension's key. The
 * toolbar button cannot be clicked from outside Chrome, so the popup is reached
 * by its own URL — which means its id has to be known in advance.
 */
export const EXTENSION_ID = 'kmiaffpldgkngbcnoodkdciaalolhdlb';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

/**
 * Pages are served over http rather than opened as files, because an extension
 * has no access to `file://` — a test page loaded that way would fail for a
 * reason that has nothing to do with what is being tested.
 */
async function startServer(): Promise<{ origin: string; close: () => Promise<void> }> {
  const root = join(HERE, 'pages');
  const server: Server = createServer((request, response) => {
    const path = normalize(new URL(request.url ?? '/', 'http://localhost').pathname);
    void readFile(join(root, path))
      .then((body) => {
        const extension = path.slice(path.lastIndexOf('.'));
        response.writeHead(200, { 'content-type': TYPES[extension] ?? 'text/plain' });
        response.end(body);
      })
      .catch(() => {
        response.writeHead(404).end('not found');
      });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  return {
    origin: `http://localhost:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        // Keep-alive connections from the pages under test would otherwise hold
        // `close` open until they time out, and teardown would outlast the test.
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

export const test = base.extend<{
  context: BrowserContext;
  origin: string;
  /** The popup, opened as a page. Nothing can click a toolbar button. */
  openPopup: () => Promise<Page>;
}>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    // Extensions only load in a persistent context, and only on the `chromium`
    // channel is that headless.
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${BUILD}`, `--load-extension=${BUILD}`],
    });
    await use(context);
    await context.close();
  },

  origin: async ({}, use) => {
    const server = await startServer();
    await use(server.origin);
    await server.close();
  },

  openPopup: async ({ context }, use) => {
    await use(async () => {
      const popup = await context.newPage();
      await popup.goto(`chrome-extension://${EXTENSION_ID}/popup.html`);
      // The popup reads storage and asks the tab for its status before it can
      // draw a usable control; waiting for the button to settle is waiting for
      // that round trip rather than for a fixed delay.
      await popup.getByTestId('toggle').waitFor();
      return popup;
    });
  },
});

export const expect = test.expect;

/** How far the page has scrolled, in pixels. */
export function scrollTop(page: Page): Promise<number> {
  return page.evaluate(() => window.scrollY);
}
