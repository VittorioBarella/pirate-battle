import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-repot', open: 'never'}],
  ],

  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  
  projects:[
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900},
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],

  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
    timeout: 60_000,
  },
})