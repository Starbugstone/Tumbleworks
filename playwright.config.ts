import { PHONE } from './tests/fixtures/viewports';
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 240_000,
  fullyParallel: false,
  reporter: 'list',
  outputDir: 'output/current/playwright',
  use: {
    baseURL: process.env.TUMBLEWORKS_URL ?? 'http://game-server:5180',
    ...devices['Pixel 7'],
    viewport: PHONE,
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'game', testIgnore: /performance\.spec\.ts/ },
    // Frame timings beside other busy browsers measure the contention, so the budget runs alone, after the rest.
    { name: 'performance', testMatch: /performance\.spec\.ts/, dependencies: ['game'] },
  ],
});
