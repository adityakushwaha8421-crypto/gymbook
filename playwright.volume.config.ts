import { defineConfig, devices } from '@playwright/test'

/**
 * Volume tests (`npm run test:volume`). They run against the production build, because the
 * development build of React is several times slower and would make the timings meaningless.
 */
export default defineConfig({
  testDir: './e2e-volume',
  // Its own folder: the normal test run writes traces to test-results and each run clears its folder first.
  outputDir: './test-results-volume',
  timeout: 90 * 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.VOLUME_BASE_URL ?? 'http://localhost:4174',
    // The offline cache would hide real load times.
    serviceWorkers: 'block',
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // VOLUME_BASE_URL points the test at a build that is already being served (used to compare two builds).
  webServer: process.env.VOLUME_BASE_URL
    ? undefined
    : {
        command: 'npm run build && npm run preview -- --port 4174 --strictPort',
        // A made-up client ID switches the Google Drive backup on; the test answers for Google itself.
        env: { VITE_GOOGLE_CLIENT_ID: 'gymbook-tests.apps.googleusercontent.com' },
        url: 'http://localhost:4174',
        reuseExistingServer: true,
        timeout: 180_000,
      },
})
