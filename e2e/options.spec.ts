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
