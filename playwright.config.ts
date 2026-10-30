import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  fullyParallel: false,
  reporter: 'list',
  outputDir: 'output/playwright',
  use: {
    baseURL: process.env.TUMBLEWORKS_URL ?? 'http://dev:5180',
    ...devices['Pixel 7'],
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
    trace: 'retain-on-failure',
  },
});
