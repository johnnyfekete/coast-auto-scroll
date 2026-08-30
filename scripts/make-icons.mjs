import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Renders the icon SVG to the PNG sizes Chrome asks for.
 *
 * Through the browser Playwright already installs, rather than an image
 * toolchain: it is the one renderer this project is guaranteed to have, and it
 * rasterises the gradient exactly as the browser showing the icon will.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const SIZES = [16, 32, 48, 96, 128];

const svg = await readFile(join(HERE, 'icon.svg'), 'utf8');
const out = join(HERE, '..', 'public', 'icon');
await mkdir(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

for (const size of SIZES) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0">${svg.replace(/width="128" height="128"/, `width="${size}" height="${size}"`)}</body>`,
  );
  const png = await page.locator('svg').screenshot({ omitBackground: true });
  await writeFile(join(out, `${size}.png`), png);
  console.log(`icon/${size}.png`);
}

await browser.close();
