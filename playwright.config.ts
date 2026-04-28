import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    headless: true,
    baseURL: 'http://localhost:4321',
  },
  webServer: {
    command: 'node e2e/server.mjs',
    url: 'http://localhost:4321',
    reuseExistingServer: false,
    timeout: 10_000,
    stdout: 'pipe',
  },
  reporter: [['list'], ['html', { open: 'never' }]],
});
