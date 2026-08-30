import { expect, scrollTop, test } from './fixtures';

test.describe('scrolling a page from the popup', () => {
  test('the page actually moves', async ({ context, origin, openPopup }) => {
    const article = await context.newPage();
    await article.goto(`${origin}/tall.html`);
    expect(await scrollTop(article)).toBe(0);

    const popup = await openPopup();
    await popup.getByTestId('toggle').click();

    // A second of a default 20 px/s crawl is around twenty pixels. The
    // assertion is only that the page moved at all, so it does not encode the
    // default speed.
    await expect.poll(() => scrollTop(article), { timeout: 5_000 }).toBeGreaterThan(0);
  });

  test('pressing it again stops the page where it is', async ({ context, origin, openPopup }) => {
    const article = await context.newPage();
    await article.goto(`${origin}/tall.html`);

    const popup = await openPopup();
    const toggle = popup.getByTestId('toggle');
    await toggle.click();
    await expect.poll(() => scrollTop(article), { timeout: 5_000 }).toBeGreaterThan(0);

    await toggle.click();
    const stopped = await scrollTop(article);

    await article.waitForTimeout(1_000);
    expect(await scrollTop(article)).toBe(stopped);
  });

  test('a faster speed travels further in the same time', async ({ context, origin, openPopup }) => {
    async function travelled(speedFraction: number): Promise<number> {
      const article = await context.newPage();
      await article.goto(`${origin}/tall.html`);
      const popup = await openPopup();

      await popup.getByTestId('speed').fill(String(speedFraction));
      await popup.getByTestId('speed').dispatchEvent('pointerup');
      await popup.getByTestId('toggle').click();
      await article.waitForTimeout(1_500);

      const distance = await scrollTop(article);
      await popup.close();
      await article.close();
      return distance;
    }

    const slow = await travelled(0);
    const fast = await travelled(700);
    expect(fast).toBeGreaterThan(slow * 2);
  });

  test('scrolling it yourself pauses the crawl, which then carries on from there', async ({
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

    // It resumes from where the reader put it rather than from where it was
    // before, which is the whole point of adopting their position.
    await expect.poll(() => scrollTop(article), { timeout: 5_000 }).toBeGreaterThan(5_000);
  });

  test('the popup shows a tab that is already scrolling', async ({
    context,
    origin,
    openPopup,
  }) => {
    const article = await context.newPage();
    await article.goto(`${origin}/tall.html`);

    const first = await openPopup();
    await first.getByTestId('toggle').click();
    await expect.poll(() => scrollTop(article), { timeout: 5_000 }).toBeGreaterThan(0);
    await first.close();

    const second = await openPopup();
    await expect(second.getByTestId('toggle')).toHaveAttribute('aria-label', 'Stop scrolling');
  });

  test('the chosen speed is still there next time the popup opens', async ({
    context,
    origin,
    openPopup,
  }) => {
    const article = await context.newPage();
    await article.goto(`${origin}/tall.html`);

    const first = await openPopup();
    await first.getByTestId('speed').fill('500');
    await first.getByTestId('speed').dispatchEvent('pointerup');
    const chosen = await first.getByTestId('readout').textContent();
    await first.close();

    const second = await openPopup();
    await expect(second.getByTestId('readout')).toHaveText(chosen ?? '');
  });
});
