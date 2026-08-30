import { expect, scrollTop, test } from './fixtures';

test.describe('pinning a site', () => {
  test('the panel appears straight away, without a reload', async ({
    context,
    origin,
    openPopup,
  }) => {
    const article = await context.newPage();
    await article.goto(`${origin}/tall.html`);
    await expect(article.locator('[data-coast="panel"]')).toHaveCount(0);

    const popup = await openPopup();
    await popup.getByTestId('pin').click();

    await expect(article.locator('[data-coast="panel"]')).toHaveCount(1);
  });

  test('a single-label host offers no choice to make', async ({ context, origin, openPopup }) => {
    const article = await context.newPage();
    await article.goto(`${origin}/tall.html`);

    const popup = await openPopup();
    // localhost has nothing to widen to, so pinning it is one button.
    await expect(popup.getByTestId('pin-scope')).toHaveCount(0);
    await expect(popup.getByTestId('pin')).toBeVisible();
  });

  test('the popup says the site is pinned', async ({ context, origin, openPopup }) => {
    const article = await context.newPage();
    await article.goto(`${origin}/tall.html`);

    const popup = await openPopup();
    await popup.getByTestId('pin').click();
    await expect(popup.getByTestId('pin-state')).toContainText('localhost');

    // And still says so the next time it is opened.
    await popup.close();
    const reopened = await openPopup();
    await expect(reopened.getByTestId('pin-state')).toContainText('localhost');
  });

  test('the panel is there again on a fresh load', async ({ context, origin, openPopup }) => {
    const article = await context.newPage();
    await article.goto(`${origin}/tall.html`);

    const popup = await openPopup();
    await popup.getByTestId('pin').click();
    await expect(article.locator('[data-coast="panel"]')).toHaveCount(1);

    // This one comes from the registration rather than the injection.
    await article.reload();
    await expect(article.locator('[data-coast="panel"]')).toHaveCount(1);
  });

  test('the panel scrolls the page', async ({ context, origin, openPopup }) => {
    const article = await context.newPage();
    await article.goto(`${origin}/tall.html`);

    const popup = await openPopup();
    await popup.getByTestId('pin').click();
    await popup.close();

    await article.getByRole('button', { name: 'Start scrolling' }).click();
    await expect.poll(() => scrollTop(article), { timeout: 5_000 }).toBeGreaterThan(0);
  });

  test('the panel and the popup drive one crawl, not two', async ({
    context,
    origin,
    openPopup,
  }) => {
    const article = await context.newPage();
    await article.goto(`${origin}/tall.html`);

    const popup = await openPopup();
    await popup.getByTestId('pin').click();

    await article.getByRole('button', { name: 'Start scrolling' }).click();
    await expect.poll(() => scrollTop(article), { timeout: 5_000 }).toBeGreaterThan(0);

    // The panel is showing what the popup would show, because there is one
    // controller in the page and both are talking to it.
    await expect(article.getByRole('button', { name: 'Stop scrolling' })).toHaveCount(1);
  });
});
