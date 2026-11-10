import { defineConfig } from '@playwright/test';
const channel = process.env.PLAYWRIGHT_CHROMIUM_CHANNEL;
if (channel && !['msedge', 'chrome'].includes(channel)) throw new Error('Unsupported Chromium channel');
export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1, retries: 0, forbidOnly: !!process.env.CI,
  timeout: 60000, expect: { timeout: 10000 },
  reporter: [['list'], ['json', { outputFile: 'test-results/browser-results.json' }], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4318', browserName: 'chromium', ...(channel ? { channel } : {}), viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'node scripts/e2e-server.mjs', url: 'http://127.0.0.1:4318/api/health', reuseExistingServer: false, timeout: 60000 }
});
