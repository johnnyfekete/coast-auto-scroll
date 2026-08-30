import { expect, scrollTop, test } from './fixtures';

/** Fast enough that the bottom of a short page arrives in well under a second. */
const FAST = '1000';

test.describe('the end of the page', () => {
  test('a page that has ended stops the crawl', async ({ context, origin, openPopup }) => {
    const article = await context.newPage();
    await article.goto(`${origin}/short.html`);

    const popup = await openPopup();
    await popup.getByTestId('speed').fill(FAST);
    await popup.getByTestId('toggle').click();

    // It reaches the bottom, waits there, and gives up.
    await article.waitForTimeout(5_000);
    const resting = await scrollTop(article);
    await article.waitForTimeout(1_000);
    expect(await scrollTop(article)).toBe(resting);

    // And says so: a popup opened now offers to start, not to stop.
    await popup.close();
    const reopened = await openPopup();
    await expect(reopened.getByTestId('toggle')).toHaveAttribute('aria-label', 'Start scrolling');
  });

  test('a page that keeps growing keeps scrolling', async ({ context, origin, openPopup }) => {
    const feed = await context.newPage();
    await feed.goto(`${origin}/growing.html`);

    const popup = await openPopup();
    await popup.getByTestId('speed').fill(FAST);
    await popup.getByTestId('toggle').click();

    // Well past the stall window. The crawl is still going, because the bottom
    // kept moving away from it.
    await feed.waitForTimeout(5_000);
    const reached = await scrollTop(feed);
    await feed.waitForTimeout(1_500);
    expect(await scrollTop(feed)).toBeGreaterThan(reached);
  });
});
