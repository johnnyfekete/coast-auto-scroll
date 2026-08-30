import { expect, scrollTop, test, EXTENSION_ID } from './fixtures';

test.describe('what a manual scroll does', () => {
  test('by default it pauses and carries on from where you left it', async ({
    context,
    origin,
    openPopup,
  }) => {
    const article = await context.newPage();
    await article.goto(`${origin}/tall.html`);

    const popup = await openPopup();
    await popup.getByTestId('toggle').click();
    await expect.poll(() => scrollTop(article), { timeout: 5_000 }).toBeGreaterThan(0);

    await article.evaluate(() => window.scrollTo({ top: 5_000, behavior: 'instant' }));
    await expect.poll(() => scrollTop(article), { timeout: 5_000 }).toBeGreaterThan(5_000);
  });

  test('set to stop, a manual scroll ends the crawl', async ({ context, origin, openPopup }) => {
    const options = await context.newPage();
    await options.goto(`chrome-extension://${EXTENSION_ID}/options.html`);
    await options.getByTestId('manual-stop').check();
    await options.close();

    const article = await context.newPage();
    await article.goto(`${origin}/tall.html`);

    const popup = await openPopup();
    await popup.getByTestId('toggle').click();
    await expect.poll(() => scrollTop(article), { timeout: 5_000 }).toBeGreaterThan(0);

    await article.evaluate(() => window.scrollTo({ top: 5_000, behavior: 'instant' }));
    await article.waitForTimeout(1_500);

    const resting = await scrollTop(article);
    await article.waitForTimeout(1_000);
    expect(await scrollTop(article)).toBe(resting);

    // And the control says so rather than looking as though it is still going.
    await popup.close();
    const reopened = await openPopup();
    await expect(reopened.getByTestId('toggle')).toHaveAttribute('aria-label', 'Start scrolling');
  });
});
