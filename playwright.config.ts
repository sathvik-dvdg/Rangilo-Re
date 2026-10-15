import { defineConfig } from '@playwright/test';

/**
 * Deploy smoke test (tests/smoke/deploy.spec.ts), run by deploy.yml against a live
 * environment: BASE_URL=https://staging.garbaconnect.online npx playwright test
 *
 * HTTP requests only, no browser, so no browser download is needed. Vitest ignores
 * *.spec.ts; these never run in `npm test`.
 */
const baseURL = process.env.BASE_URL;
if (!baseURL) throw new Error('Set BASE_URL to the deployment to test, e.g. https://staging.garbaconnect.online');

export default defineConfig({
  testDir: './tests/smoke',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  // Right after a rollout the first requests can land on a warming instance.
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL,
    // A plain, honest client name: middleware.ts refuses blank and scanner user agents.
    userAgent: 'GarbaConnect-deploy-smoke/1.0',
  },
});
