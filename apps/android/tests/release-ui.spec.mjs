import { expect, test } from '@playwright/test';
import { career, checkLayout, createUiContext, user } from './phase-ui-harness.mjs';
import { phaseData } from './phase-ui-fixtures.mjs';

test('Cup Center searches the selected league by name and code', async ({ browser, baseURL }, testInfo) => {
  const template = phaseData['/api/leagues/phase3/tournaments'].tournaments[0];
  const tournaments = [
    { ...template, id: 'cup-alpha', name: 'Alpha Cup', code: 'AE1', status: 'ACTIVE' },
    { ...template, id: 'cup-beta', name: 'Beta Cup', code: 'BE2', status: 'ACTIVE' },
  ];
  const { context, page, errors, mutations } = await createUiContext(browser, {
    direct: true,
    width: testInfo.project.use.viewport.width,
    overrides: { '/api/leagues/phase3/tournaments': { tournaments } },
  });

  try {
    await page.goto(`${baseURL}/tournaments`);
    const search = page.getByRole('searchbox', { name: 'Search tournaments' });
    await expect(page.getByRole('heading', { name: 'Alpha Cup' })).toBeVisible();
    await search.fill(' be2 ');
    await expect(page.getByRole('heading', { name: 'Beta Cup' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Alpha Cup' })).toHaveCount(0);
    await search.fill('no matching cup');
    await expect(page.getByRole('heading', { name: 'No matching tournaments' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(page.getByRole('heading', { name: 'Alpha Cup' })).toBeVisible();
    await checkLayout(page, 'Cup Center search');
    expect(errors).toEqual([]);
    expect(mutations).toEqual([]);
  } finally {
    await context.close();
  }
});

test('profile sections reach the saved opponent contact controls by keyboard', async ({ browser, baseURL }, testInfo) => {
  const profile = {
    ...career.profile,
    fullName: user.fullName,
    email: user.email,
    phoneNumber: null,
    joinedAt: '2026-01-01T12:00:00Z',
    whatsappNumber: null,
    whatsappShareEnabled: false,
  };
  const { context, page, errors, mutations } = await createUiContext(browser, {
    direct: true,
    width: testInfo.project.use.viewport.width,
    overrides: { '/api/players/me/career': { ...career, profile } },
  });

  try {
    await page.goto(`${baseURL}/profile`);
    const nav = page.getByRole('navigation', { name: 'Profile sections' });
    const contactLink = nav.getByRole('link', { name: 'Opponent contact' });
    await contactLink.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#profile-opponent-contact$/);
    const contact = page.getByRole('region', { name: 'Opponent WhatsApp contact' });
    await expect(contact).toBeFocused();
    await expect(contact.getByText('Private', { exact: true })).toBeVisible();
    await expect(contact.getByRole('checkbox')).not.toBeChecked();
    await checkLayout(page, 'Player profile navigation');
    expect(errors).toEqual([]);
    expect(mutations).toEqual([]);
  } finally {
    await context.close();
  }
});

test('admin queue reset restores the default authorized pending review filters', async ({ browser, baseURL }, testInfo) => {
  const requests = [];
  const { context, page, errors, mutations } = await createUiContext(browser, {
    direct: true,
    width: testInfo.project.use.viewport.width,
    overrides: {
      '/api/admin/results': (route, headers) => {
        requests.push(new URL(route.request().url()).search);
        return route.fulfill({ headers, json: { success: true, data: {
          submissions: [], total: 0, page: 1, pageSize: 10,
          tournaments: [{ id: 'cup-alpha', name: 'Alpha Cup', leagueId: 'phase3', league: { name: 'Arena League' } }],
        }, error: null } });
      },
    },
  });

  try {
    await page.goto(`${baseURL}/admin/results`);
    await expect(page.getByRole('heading', { name: 'All caught up' })).toBeVisible();
    // Filters are collapsed by default to prioritize pending result review.
    const filterDisclosure = page.locator('details').filter({ hasText: 'Review filters' });
    await filterDisclosure.locator('summary').click();
    await expect(filterDisclosure).toHaveAttribute('open', '');
    const status = page.getByRole('combobox', { name: 'Review status' });
    const league = page.getByRole('combobox', { name: 'Review league' });
    const tournament = page.getByRole('combobox', { name: 'Review tournament' });
    await status.selectOption('CONFIRMED');
    await league.selectOption('phase3');
    await tournament.selectOption('cup-alpha');
    await expect.poll(() => requests.at(-1)).toContain('tournamentId=cup-alpha');
    await page.getByRole('button', { name: 'Reset filters' }).click();
    await expect(page.getByRole('heading', { name: 'All caught up' })).toBeVisible();
    await expect(status).toHaveValue('PENDING_VERIFICATION');
    await expect(league).toHaveValue('');
    await expect(tournament).toHaveValue('');
    expect(requests.at(-1)).toBe('?status=PENDING_VERIFICATION&page=1');
    await checkLayout(page, 'Admin results filters');
    expect(errors).toEqual([]);
    expect(mutations).toEqual([]);
  } finally {
    await context.close();
  }
});
