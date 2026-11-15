import { defineConfig, devices } from '@playwright/test';

const origin = new URL(process.env.SMOKE_WEB_ORIGIN || 'http://127.0.0.1:3000');
if (origin.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)) {
  throw new Error('Startup web tests require a loopback web server.');
}

export default defineConfig({
  testMatch: 'startup-web.spec.mjs',
  use: {
    baseURL: origin.origin,
    serviceWorkers: 'block',
    launchOptions: { executablePath: process.env.CHROMIUM_PATH },
  },
  projects: [
    { name: 'desktop', use: devices['Desktop Chrome'] },
    { name: 'mobile-reduced-motion', use: { ...devices['Pixel 7'], reducedMotion: 'reduce' } },
  ],
});
