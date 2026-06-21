import { defineConfig, devices } from '@playwright/test';

// The production build is served under the GitHub Pages base path
// (`/arena-fight/`). `vite preview` honours that base, so the suite must
// navigate to the based URL. NODE_ENV=production is forced in the webServer
// command so the base is deterministic for both build and preview.
const PORT = 4173;
const BASE_PATH = '/arena-fight/';
const BASE_URL = `http://localhost:${PORT}${BASE_PATH}`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'e2e-results/junit.xml' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `NODE_ENV=production npm run build && NODE_ENV=production npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
