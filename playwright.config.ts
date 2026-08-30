import { defineConfig } from '@playwright/test';

/**
 * The extension is tested as a real extension in a real Chrome, because the
 * half of it that matters — the animation loop, the panel, the pages — is
 * invisible to a unit test. What is verified here is that a page actually
 * moved.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI === 'true' ? 'github' : 'list',
  // Extensions need a persistent context, which the fixtures build; there is no
  // shared browser to configure here.
  use: { actionTimeout: 10_000 },
  timeout: 60_000,
});
