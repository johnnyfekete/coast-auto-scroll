import { expect, test, EXTENSION_ID } from './fixtures';
import type { Page } from '@playwright/test';

function openOptions(context: import('@playwright/test').BrowserContext): Promise<Page> {
  return context.newPage().then(async (page) => {
    await page.goto(`chrome-extension://${EXTENSION_ID}/options.html`);
    return page;
  });
}

test.describe('the settings page', () => {
  test('explains how to pin when nothing is pinned', async ({ context }) => {
    const options = await openOptions(context);
    await expect(options.getByTestId('no-pins')).toContainText('Pin on page');
  });

  test('lists a site that was pinned', async ({ context, origin, openPopup }) => {
    const article = await context.newPage();
    await article.goto(`${origin}/tall.html`);
    const popup = await openPopup();
    await popup.getByTestId('pin').click();
    await expect(article.locator('[data-coast="panel"]')).toHaveCount(1);
    await popup.close();

    const options = await openOptions(context);
    // The row shows the pattern in an editable field, which is the thing a
    // reader would widen or narrow.
    await expect(options.getByLabel('Pattern for localhost')).toHaveValue('*://localhost/*');
  });

  test('unpinning a row takes the panel off the page', async ({ context, origin, openPopup }) => {
    const article = await context.newPage();
    await article.goto(`${origin}/tall.html`);
    const popup = await openPopup();
    await popup.getByTestId('pin').click();
    await expect(article.locator('[data-coast="panel"]')).toHaveCount(1);
    await popup.close();

    const options = await openOptions(context);
    await options.getByTestId('unpin').click();
    await expect(options.getByTestId('no-pins')).toBeVisible();

    await article.reload();
    await expect(article.locator('[data-coast="panel"]')).toHaveCount(0);
  });

  test('the default speed is remembered', async ({ context }) => {
    const options = await openOptions(context);
    await options.getByTestId('default-speed').fill('600');
    await options.getByTestId('default-speed').dispatchEvent('pointerup');
    const chosen = await options.getByTestId('default-speed-readout').textContent();

    await options.reload();
    await expect(options.getByTestId('default-speed-readout')).toHaveText(chosen ?? '');
  });

  test('says no shortcut is set until one is', async ({ context }) => {
    const options = await openOptions(context);
    await expect(options.getByText('No shortcut set.')).toBeVisible();
  });
});

test.describe('the keyboard shortcut', () => {
  test('is declared, and ships with nothing bound to it', async ({ context }) => {
    // Chrome offers no way to assign a binding from outside its own settings
    // UI, so what a bound key does is not reachable from here. What is
    // reachable — and what actually breaks in the wild — is the command being
    // missing or arriving with a default that collides with something.
    const options = await openOptions(context);
    const commands = await options.evaluate(() => chrome.commands.getAll());

    expect(commands.map((command) => command.name)).toContain('toggle-scroll');
    expect(commands.find((command) => command.name === 'toggle-scroll')?.shortcut).toBe('');
  });
});
