import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

async function pinAndGetPanel(article: Page, openPopup: () => Promise<Page>) {
  const popup = await openPopup();
  await popup.getByTestId('pin').click();
  await expect(article.locator('[data-coast="panel"]')).toHaveCount(1);
  await popup.close();
}

/** Where the panel's box is on screen, read from the page itself. */
function panelBox(page: Page) {
  return page.evaluate(() => {
    const host = document.querySelector('[data-coast="panel"]');
    const panel = host?.shadowRoot?.querySelector('.panel');
    const rect = panel?.getBoundingClientRect();
    return rect === undefined ? null : { left: rect.left, top: rect.top };
  });
}

/** Drags the panel by its background, which is the only part that moves it. */
async function dragPanel(page: Page, by: { x: number; y: number }) {
  const start = await page.evaluate(() => {
    const host = document.querySelector('[data-coast="panel"]');
    const panel = host?.shadowRoot?.querySelector('.panel');
    const rect = panel!.getBoundingClientRect();
    // The far right of the pill is background rather than a control: the last
    // control is the menu button, and there is padding beyond it.
    return { x: rect.right - 3, y: rect.top + rect.height / 2 };
  });

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + by.x, start.y + by.y, { steps: 10 });
  await page.mouse.up();
}

test.describe('moving the panel', () => {
  test('it goes where it is dragged', async ({ context, origin, openPopup }) => {
    const article = await context.newPage();
    await article.goto(`${origin}/tall.html`);
    await pinAndGetPanel(article, openPopup);

    const before = await panelBox(article);
    await dragPanel(article, { x: -220, y: -160 });
    const after = await panelBox(article);

    expect(after!.left).toBeLessThan(before!.left - 150);
    expect(after!.top).toBeLessThan(before!.top - 100);
  });

  test('and it is still there after a reload', async ({ context, origin, openPopup }) => {
    const article = await context.newPage();
    await article.goto(`${origin}/tall.html`);
    await pinAndGetPanel(article, openPopup);

    await dragPanel(article, { x: -220, y: -160 });
    const moved = await panelBox(article);

    await article.reload();
    await expect(article.locator('[data-coast="panel"]')).toHaveCount(1);
    await expect.poll(async () => (await panelBox(article))?.left).toBeCloseTo(moved!.left, 0);
  });

  test('adjusting the speed does not move it', async ({ context, origin, openPopup }) => {
    const article = await context.newPage();
    await article.goto(`${origin}/tall.html`);
    await pinAndGetPanel(article, openPopup);

    const before = await panelBox(article);

    const slider = await article.evaluate(() => {
      const host = document.querySelector('[data-coast="panel"]');
      const input = host!.shadowRoot!.querySelector('input')!;
      const rect = input.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
    await article.mouse.move(slider.x, slider.y);
    await article.mouse.down();
    await article.mouse.move(slider.x + 30, slider.y, { steps: 5 });
    await article.mouse.up();

    expect(await panelBox(article)).toEqual(before);
  });
});
