import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    // End-to-end tests are Playwright's, and it has its own runner.
    exclude: ['**/node_modules/**', '**/e2e/**', '**/.output/**'],
  },
});
