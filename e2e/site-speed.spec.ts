import { expect, scrollTop, test, EXTENSION_ID } from './fixtures';
import type { Page } from '@playwright/test';

/** How far the page travels in a fixed time, from a standing start. */
async function travelIn(page: Page, ms: number): Promise<number> {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  const before = await scrollTop(page);
  await page.waitForTimeout(ms);
  return (await scrollTop(page)) - before;
}

test.describe('a pinned site keeps its own speed', () => {
  test('the speed set on a pinned site is still there next visit', async ({
    context,
    origin,
    openPopup,
  }) => {
    const article = await context.newPage();
    await article.goto(`${origin}/tall.html`);

    const popup = await openPopup();
    await popup.getByTestId('pin').click();
    await expect(popup.getByTestId('pin-state')).toBeVisible();

    await popup.getByTestId('speed').fill('800');
    await popup.getByTestId('speed').dispatchEvent('pointerup');
    const chosen = await popup.getByTestId('readout').textContent();
    await popup.close();

    const reopened = await openPopup();
    await expect(reopened.getByTestId('readout')).toHaveText(chosen ?? '');
  });

  test('and it does not become the speed everywhere else', async ({
    context,
    origin,
    openPopup,
  }) => {
    const article = await context.newPage();
    await article.goto(`${origin}/tall.html`);

    const popup = await openPopup();
    await popup.getByTestId('pin').click();
    await expect(popup.getByTestId('pin-state')).toBeVisible();
    await popup.getByTestId('speed').fill('800');
    await popup.getByTestId('speed').dispatchEvent('pointerup');
    await popup.close();

    // The settings page shows the default, which nothing on a pinned site
    // should have touched.
    const options = await context.newPage();
    await options.goto(`chrome-extension://${EXTENSION_ID}/options.html`);
    await expect(options.getByTestId('default-speed-readout')).toHaveText('20 px/s');
  });

  test('the page really does scroll at the site’s own speed', async ({
    context,
    origin,
    openPopup,
  }) => {
    const article = await context.newPage();
    await article.goto(`${origin}/tall.html`);

    const popup = await openPopup();
    await popup.getByTestId('pin').click();
    await expect(popup.getByTestId('pin-state')).toBeVisible();
    await popup.getByTestId('speed').fill('900');
    await popup.getByTestId('speed').dispatchEvent('pointerup');
    await popup.close();

    // Reloaded, so the speed comes from storage rather than from the press.
    await article.reload();
    await expect(article.locator('[data-coast="panel"]')).toHaveCount(1);
    await article.getByRole('button', { name: 'Start scrolling' }).click();

    // Far more than the 20 px/s default would manage in a second and a half.
    expect(await travelIn(article, 1_500)).toBeGreaterThan(100);
  });
});
