import { expect, test } from './fixtures';

/** Pins the site the page is on, and waits for the panel to arrive. */
async function pin(article: import('@playwright/test').Page, openPopup: () => Promise<import('@playwright/test').Page>) {
  const popup = await openPopup();
  await popup.getByTestId('pin').click();
  await expect(article.locator('[data-coast="panel"]')).toHaveCount(1);
  await popup.close();
}

test.describe('unpinning', () => {
  test('the menu takes the panel away', async ({ context, origin, openPopup }) => {
    const article = await context.newPage();
    await article.goto(`${origin}/tall.html`);
    await pin(article, openPopup);

    await article.getByRole('button', { name: 'More' }).click();
    await article.getByRole('button', { name: 'Unpin from this site' }).click();

    await expect(article.locator('[data-coast="panel"]')).toHaveCount(0);
  });

  test('and it stays away on the next visit', async ({ context, origin, openPopup }) => {
    const article = await context.newPage();
    await article.goto(`${origin}/tall.html`);
    await pin(article, openPopup);

    await article.getByRole('button', { name: 'More' }).click();
    await article.getByRole('button', { name: 'Unpin from this site' }).click();
    await expect(article.locator('[data-coast="panel"]')).toHaveCount(0);

    await article.reload();
    await expect(article.locator('[data-coast="panel"]')).toHaveCount(0);
  });

  test('the popup offers to pin it again', async ({ context, origin, openPopup }) => {
    const article = await context.newPage();
    await article.goto(`${origin}/tall.html`);
    await pin(article, openPopup);

    await article.getByRole('button', { name: 'More' }).click();
    await article.getByRole('button', { name: 'Unpin from this site' }).click();
    await expect(article.locator('[data-coast="panel"]')).toHaveCount(0);

    const popup = await openPopup();
    await expect(popup.getByTestId('pin')).toBeVisible();
  });

  test('the menu opens the settings page', async ({ context, origin, openPopup }) => {
    const article = await context.newPage();
    await article.goto(`${origin}/tall.html`);
    await pin(article, openPopup);

    await article.getByRole('button', { name: 'More' }).click();
    const opened = context.waitForEvent('page');
    await article.getByRole('button', { name: 'Settings' }).click();

    const settings = await opened;
    expect(settings.url()).toContain('options.html');
  });
});
