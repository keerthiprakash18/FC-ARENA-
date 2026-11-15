import { expect, test } from '@playwright/test';
import { career, createUiContext } from './phase-ui-harness.mjs';

test('a signed-out dashboard launch reaches the keyboard-accessible sign-in form', async ({ page, baseURL }) => {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== baseURL) return route.abort();
    if (url.pathname === '/api/auth/refresh') {
      return route.fulfill({ status: 401, json: { success: false, error: 'Please sign in.' } });
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 204 });
    return route.continue();
  });

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  const identifier = page.getByRole('textbox', { name: 'Email or Game Name' });
  await expect(identifier).toBeVisible();
  await identifier.focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
});

test('a delayed authenticated dashboard shows the loading layout and hands off to the dashboard', async ({ browser }, testInfo) => {
  let releaseDashboard;
  const responseReady = new Promise(resolve => { releaseDashboard = resolve; });
  const { context, page, errors, mutations } = await createUiContext(browser, {
    width: testInfo.project.use.viewport.width,
    reducedMotion: testInfo.project.use.reducedMotion ?? 'no-preference',
    direct: true,
    native: testInfo.project.name.startsWith('mobile'),
    overrides: {
      '/api/players/me/dashboard': async (route, headers) => {
        await responseReady;
        return route.fulfill({ headers, json: {
          success: true,
          data: { career, memberships: [], tournaments: [], fixtures: [] },
          error: null,
        } });
      },
    },
  });

  try {
    await page.goto(new URL('/dashboard', testInfo.project.use.baseURL).href);
    const loading = page.getByRole('status').filter({ hasText: 'Loading Home...' });
    await expect(loading).toBeVisible();
    await expect(loading.locator('.fc-home-loading-hero')).toBeVisible();
    await expect(loading.locator('.fc-home-loading-match')).toBeVisible();
    await expect(loading.getByRole('link')).toHaveCount(0);
    if (testInfo.project.use.reducedMotion === 'reduce') {
      const skeleton = loading.locator('.fc-skeleton').first();
      expect(await skeleton.evaluate(element => getComputedStyle(element, '::after').animationName)).toBe('none');
    }

    releaseDashboard();
    await expect(loading).toBeHidden();
    await expect(page.getByRole('link', { name: /Join a League/ }).first()).toBeVisible();
    expect(errors).toEqual([]);
    expect(mutations).toEqual([]);
  } finally {
    releaseDashboard();
    await context.close();
  }
});

test('the dashboard exposes recovery when its API is unavailable', async ({ browser }, testInfo) => {
  let healthy = false;
  const { context, page, errors, mutations } = await createUiContext(browser, {
    width: testInfo.project.use.viewport.width,
    direct: true,
    native: testInfo.project.name.startsWith('mobile'),
    overrides: {
      '/api/players/me/dashboard': (route, headers) => healthy
        ? route.fulfill({ headers, json: { success: true, data: { career, memberships: [], tournaments: [], fixtures: [] }, error: null } })
        : route.fulfill({ headers, status: 503, json: { success: false, message: 'Service unavailable' } }),
    },
  });

  try {
    await page.goto(new URL('/dashboard', testInfo.project.use.baseURL).href);
    await expect(page.getByRole('heading', { name: 'Dashboard unavailable' })).toBeVisible();
    await expect(page.getByText('Loading Home...', { exact: true })).toHaveCount(0);

    healthy = true;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('link', { name: /Join a League/ }).first()).toBeVisible();
    expect(errors).toEqual([]);
    expect(mutations).toEqual([]);
  } finally {
    await context.close();
  }
});
