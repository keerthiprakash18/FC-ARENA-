// UI regression checks. API data is intercepted; no production account is used.
// Run after build with a local production server listening on 127.0.0.1:3000.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { collectedDailyFixture, emptyExperience } from './daily-rewards-fixtures.mjs';
import { phaseData, tournament } from './phase-ui-fixtures.mjs';
const origin = process.env.SMOKE_WEB_ORIGIN || 'http://127.0.0.1:3000';
const output = process.env.SMOKE_OUTPUT || mkdtempSync(join(tmpdir(), 'fcarena-ui-'));
const axeScript = process.env.AXE_CORE_SCRIPT;
mkdirSync(output, {recursive:true});
const errors = [], results = [], accessibility = [];
const reviewPaths = new Set([
  '/dashboard', '/profile', '/career', '/leaderboards', '/tournaments',
  '/tournaments/ui-test/standings', '/tournaments/phase3/wizard/setup', '/tournaments/phase3/fixtures',
  '/matches/result-test', '/league-war', '/league-war/phase3', '/awards',
  '/notifications', '/arena-talk', '/admin/system',
]);
const themes = ['luxury-gold', 'classic-blue', 'city-sky', 'london-red', 'mersey-red', 'madrid-royal', 'catalan-nights', 'munich-red', 'paris-night', 'milan-blue', 'milan-red', 'turin-mono'];

async function checkDesign(page, path, width) {
  const screenshot = path.replaceAll('/', '_');
  const html = page.locator('html');
  const original = await html.evaluate(element => ({theme:element.dataset.theme,mode:element.dataset.mode}));
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.id = 'contrast-measurement';
    style.nonce = document.querySelector('script[nonce]')?.nonce ?? '';
    style.textContent = '*, *::before, *::after { transition: none !important; }';
    document.head.append(style);
  });
  const failures = await page.evaluate(themes => {
    const root = document.documentElement;
    const states = [];
    for (const theme of themes) for (const mode of ['light', 'dark']) {
      root.dataset.theme = theme;
      root.dataset.mode = mode;
      if (root.scrollWidth > innerWidth + 1) states.push({theme,mode,scrollWidth:root.scrollWidth});
    }
    return states;
  }, themes);
  assert.deepEqual(failures, [], `${path} ${width}: theme layout overflow`);

  for (const mode of ['light', 'dark']) {
    await html.evaluate((element, {theme,mode}) => {
      element.dataset.theme = theme;
      element.dataset.mode = mode;
    }, {theme:original.theme,mode});
    if (mode === 'dark') {
      await page.screenshot({path:`${output}/${screenshot}-dark-${width}.png`,fullPage:true,animations:'disabled'});
    }
    const violations = await page.evaluate(async () => (await window.axe.run(document, {
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
    })).violations.map(rule => ({
      id: rule.id, impact: rule.impact,
      nodes: rule.nodes.map(node => ({target: node.target, reason: node.failureSummary})),
    })));
    accessibility.push({path,width,mode,violations});
  }
  await html.evaluate((element, {theme,mode}) => {
    element.dataset.theme = theme;
    element.dataset.mode = mode;
    document.getElementById('contrast-measurement').remove();
  }, original);
}

async function dragDrawer(page, from, to, afterMove) {
  const session = await page.context().newCDPSession(page);
  try {
    const touch = x => [{ x, y: 240, id: 1 }];
    await session.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:touch(from)});
    for (let step = 1; step <= 6; step++) {
      await session.send('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:touch(from + (to - from) * step / 6)});
    }
    await afterMove();
    await session.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
  } finally {
    await session.detach();
  }
}
const user = { id: 'smoke', fullName: 'Android Scroll Validation Long Player Name', email: 'smoke@example.invalid', role: 'PLAYER', status: 'ACTIVE', themePreference: 'CLASSIC_BLUE', player: { playerCode: 'TEST01', profileImageUrl: null, identity: { inGameName: 'LongAndroidPlayerNameForLayoutValidation', gameUid: '123', isVerified: true } } };
const career = { profile: { ...user.player, primaryLeague: null, secondaryLeague: null }, lifetimeStatistics: { matches: 20, wins: 10, draws: 5, losses: 5, goalsFor: 40, goalsAgainst: 20, goalDifference: 20, winRate: 50, form: ['W','D','L'], tournaments: 2, achievements: 0 }, matchHistory: [], tournamentHistory: [], leagueHistory: [], achievements: [] };
async function prepare(page) {
  page.on('pageerror', (error) => errors.push(error.message));
  // All app content comes from this checkout. All API calls are fixtures;
  // never log into or mutate production. URL origin remains the real HTTPS
  // origin so Android allowlisting and same-origin SPA links are exercised.
  await page.context().route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/')) {
      let data;
      switch (url.pathname) {
        case '/api/auth/refresh': data = { accessToken: 'smoke-only', expiresIn: 3600 }; break;
        case '/api/auth/me': data = { user }; break;
        case '/api/auth/preferences/dashboard': data = { preferences: { hiddenSections: [] } }; break;
        case '/api/experience/me/check-in': data = collectedDailyFixture(); break;
        case '/api/experience/me': data = emptyExperience; break;
        case '/api/players/me/career': data = career; break;
        case '/api/players/me/dashboard': data = { career, memberships: [], tournaments: [], fixtures: [] }; break;
        case '/api/leagues/my': data = { leagues: [] }; break;
        case '/api/tournaments/phase3': data = { tournament: {...tournament, isLeagueAdmin:user.role === 'SUPER_ADMIN'} }; break;
        case '/api/tournaments/ui-test/standings': data = {tournament: {name:'Arena Championship'}, standings: [{position:1,registrationId:'team1',entryName:'Manchester Champions With A Very Long Name',played:10,wins:7,draws:2,losses:1,goalsFor:23,goalsAgainst:11,goalDifference:12,points:23,form:'WWDLW'}]}; break;
        case '/api/tournaments/ui-test/groups': data = {groups:[{id:'g1',name:'Group A',position:1,entries:[{id:'team1',entryName:'Manchester Champions With A Very Long Name',members:[]}]}]}; break;
        case '/api/tournaments/ui-test/my-statistics': data={statistic:null}; break;
        case '/api/leagues/invite-test': data = {league:{id:'invite-test',name:'Arena Test League',code:'TEST-123',region:'India',members:2,maxMembers:20,pendingApplications:0,membershipType:'PRIMARY',adminRole:'OWNER',canManageMembers:true,creator:{id:'smoke',fullName:'Test Admin'}}}; break;
        case '/api/leagues/invite-test/invites':
          assert.equal(route.request().method(), 'POST');
          data = { token: 'a'.repeat(48), expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString() }; break;
        case '/api/leagues/invite-test/tournaments': data = {tournaments:[]}; break;
        case '/api/matches/result-test': data = {match:{id:'result-test',matchCode:'M-TEST',status:'SCHEDULED',isLeagueAdmin:false,isParticipant:true,participantSide:'HOME',readiness:{homeReadyAt:null,awayReadyAt:null,homeReady:false,awayReady:false,bothReady:false},schedule:{scheduledAt:'2027-01-01T12:00:00Z',estimatedDeadlineAt:null,matchDurationMinutes:15},tournament:{id:'ui-test',name:'Arena Cup',mode:'SOLO',format:'ROUND_ROBIN'},league:{id:'invite-test',name:'Arena Test League',code:'TEST-123'},fixture:{id:'f1',fixtureCode:'F1',roundName:'Round 1',roundNumber:1,matchday:1,status:'SCHEDULED',scheduledAt:'2027-01-01T12:00:00Z',venue:null,home:{id:'home',entryName:'Home Player',members:[{id:'smoke',fullName:'Home Player'}]},away:{id:'away',entryName:'Away Player',members:[{id:'opponent',fullName:'Away Player'}]},homeSource:null,awaySource:null}}}; break;
        case '/api/matches/result-test/events': return route.fulfill({body:'event: connected\ndata: {"type":"connected"}\n\n',headers:{'content-type':'text/event-stream','access-control-allow-origin':'https://fcarena.in','access-control-allow-credentials':'true'}});
        case '/api/matches/result-test/results': data={isLeagueAdmin:false,canVerifyResult:false,confirmedResultSubmissionId:null,submissions:[]}; break;
        case '/api/matches/result-test/ocr/latest': data={extraction:null}; break;
        case '/api/league-wars': data = { wars: [] }; break;
        case '/api/league-wars/rankings': data = { leagueRankings: [], playerRankings: [] }; break;
        case '/api/arena-talk/context': data = {
          leagues: [], canModerate: false,
          policy: { audienceNote: 'Public FC ARENA discussions' },
        }; break;
        case '/api/arena-talk/posts': data = { posts: [], nextCursor: null }; break;
        case '/api/awards/overview': data = {
          currentBallon: null, trophyCabinet: {},
          myTournamentAwards: [], mySeasonalAwards: [],
          activeAwardTournaments: [], recentSeasonalWinners: [],
        }; break;
        case '/api/notifications': data = { notifications: [], unreadCount: 0 }; break;
        case '/api/admin/ops/system': data = {
          status:'HEALTHY', checkedAt:new Date().toISOString(),
          runtime: { environment:'staging-smoke', node:'24', uptimeSeconds:86400,
            memory:{rssMb:64,heapUsedMb:40,heapTotalMb:90} },
          database:{connected:true,latencyMs:12}, auth:{activeSessions:12},
          push:{configured:false,devices:0,pendingDeliveries:0,failedDeliveries:0},
          moderation:{openDisputes:1,pendingResults:2},
          backup:{reportingConfigured:true,healthy:true,ageHours:3,
            latest:null,latestSuccess:null,latestFailure:null},
        }; break;
        case '/api/admin/ops/telemetry': data = {
          enabled:true, source:'staging-mocked-anonymous-histograms', droppedSamples:0,
          days:[{day:'2026-11-12',metrics:{
            API_MS:{samples:12,p75UpperBound:100,p95UpperBound:250,unit:'ms'},
            LCP:{samples:10,p75UpperBound:2000,p95UpperBound:5000,unit:'ms'},
            API_5XX:{events:0},
          }}],
        }; break;
        case '/api/matches/result-test/scheduling': data = { enabled: false, proposals: [] }; break;
        case '/api/telemetry/web-vitals': data = { accepted: true }; break;
        default:
          data = phaseData[url.pathname];
          if (!data) { errors.push(`Unmocked API: ${url.pathname}`); return route.abort(); }
      }
      return route.fulfill({ json: { success: true, data, error: null }, headers: { 'access-control-allow-origin': 'https://fcarena.in', 'access-control-allow-credentials': 'true' } });
    }
    if (url.hostname === 'fcarena.in') {
      try {
        const response = await fetch(`${origin}${url.pathname}${url.search}`, { headers: { ...route.request().headers(), host: new URL(origin).host } });
        const headers = Object.fromEntries(response.headers);
        delete headers['content-encoding']; delete headers['transfer-encoding']; delete headers['content-length'];
        return route.fulfill({ status: response.status, headers, body: Buffer.from(await response.arrayBuffer()) });
      } catch (error) { errors.push(String(error)); return route.abort(); }
    }
    errors.push(`Unexpected network request: ${url.origin}${url.pathname}`);
    return route.abort();
  });
}

const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH || undefined,args:['--no-sandbox']});
try {
  for (const width of [360,375,390,412,430,768,1440]) {
    const context=await browser.newContext({viewport:{width,height:850},serviceWorkers:'block',hasTouch:width < 1024});
    if (axeScript) await context.addInitScript({path:axeScript});
    const page=await context.newPage();
    await prepare(page);
    await context.addInitScript(()=>localStorage.setItem('fc-arena-theme-preference','LUXURY_GOLD'));
    // Mock the user's saved selection consistently with the initial theme.
    user.themePreference='LUXURY_GOLD';
    for (const path of ['/login','/register','/forgot-password','/reset-password','/dashboard','/leagues','/tournaments','/fixtures','/profile','/settings','/career','/experience','/leaderboards','/league-war','/awards','/notifications','/arena-talk','/admin/system','/tournaments/ui-test/standings','/leagues/invite-test','/matches/result-test','/tournaments/phase3/wizard/setup','/tournaments/phase3/fixtures','/league-war/phase3']) {
      user.role = path.startsWith('/admin/') || path.includes('/wizard/') ? 'SUPER_ADMIN' : 'PLAYER';
      await page.goto('https://fcarena.in'+path);
      await page.locator(['/login','/register','/forgot-password','/reset-password'].includes(path) ? '.auth-form' : '.fc-main').waitFor();
      // The shell mounts before authenticated reads finish. Measure the loaded
      // content after skeletons settle, while still failing a stalled loader.
      await page.waitForFunction(() => !document.querySelector('.fc-skeleton'));
      if (path === '/dashboard' && width < 1024) {
        const tabs = page.locator('.theme-bottom-nav a');
        assert.equal(await tabs.count(), 5, 'Dashboard mobile navigation must have five tabs');
        const widths = await tabs.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().width));
        assert(Math.max(...widths) - Math.min(...widths) <= 1.5, `Dashboard ${width}: mobile tabs are uneven ${JSON.stringify(widths)}`);
      }
      if(['/login','/register','/forgot-password','/reset-password'].includes(path)) assert.equal(await page.locator('.field label').evaluateAll(labels=>labels.filter(label=>!label.control).length),0,'Every auth field label must target an input');
      if(path.includes('standings')) await page.getByText('Group A',{exact:true}).waitFor();
      if (path.includes('/wizard/')) await page.getByRole('navigation', {name:'Tournament builder steps'}).waitFor();
      if (path === '/tournaments/phase3/fixtures') await page.getByRole('navigation', {name:'Tournament sections'}).waitFor();
      if (path === '/league-war/phase3') await page.getByRole('group', {name:'League War scoreboard'}).waitFor();
      if (path === '/admin/system') {
        await page.getByText('Historical performance · last 7 days').waitFor();
        await page.getByRole('table',{name:'Daily API timings, client LCP, HTTP 5xx'}).waitFor();
        assert(await page.getByText('Redis history enabled').isVisible());
      }
      if(path === '/leagues/invite-test') {
        await page.getByRole('button',{name:'Show invite QR',exact:true}).click();
        await page.getByAltText('Scan to join Arena Test League').waitFor();
        assert((await page.getByAltText('Scan to join Arena Test League').getAttribute('src')).startsWith('data:image/png;base64,'));
      }
      if(path === '/matches/result-test') {
        await page.getByText('Match Room active',{exact:true}).waitFor();
        assert.equal(await page.locator('#result-update').getAttribute('open'),null);
        assert(await page.locator('#result-entry input[name="homeScore"]').isVisible());
        const reminder=page.waitForEvent('download');
        await page.getByRole('button',{name:'Add calendar reminder'}).click();
        assert.equal((await reminder).suggestedFilename(),'fc-arena-match.ics');
      }
      const metrics=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,animations:document.getAnimations().filter(a=>a.effect?.getTiming().iterations===Infinity).length}));
      if(metrics.scrollWidth>width+1) { console.log(await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width,text:e.textContent?.slice(0,60)})))); await page.screenshot({path:output+'/overflow.png',fullPage:true,animations:'disabled'}); }
      assert(metrics.scrollWidth<=width+1,`${path} ${width}: horizontal overflow ${metrics.scrollWidth}`);
      assert.equal(metrics.animations,0,`${path}: idle continuous animation`);
      if (path === '/league-war' && width === 390) {
        const filters = page.getByRole('group', {name: 'Filter League Wars by status'});
        const buttons = filters.locator('button');
        assert.equal(await buttons.count(), 4, 'All four League War filters must be reachable');
        const bounds = await buttons.evaluateAll((nodes) =>
          nodes.map((node) => {
            const rect = node.getBoundingClientRect();
            return {left: rect.left, right: rect.right, height: rect.height};
          }),
        );
        assert(
          bounds.every((rect) => rect.left >= 0 && rect.right <= width + 1 && rect.height >= 44),
          'League War filter labels should be fully visible and touch targets at least 44px: ' + JSON.stringify(bounds),
        );
      }
      if(path.includes('standings')) {
        assert.equal(await page.locator('.fc-compact-standings-table').isVisible(),width<640);
        assert(await page.getByText('Manchester Champions With A Very Long Name',{exact:true}).count()>0);
      }
      if (width === 390 || width === 1440) {
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        await page.screenshot({path:output+'/'+path.replaceAll('/','_')+'-'+width+'.png',fullPage:true,animations:'disabled'});
      }
      if (axeScript && (width === 390 || width === 1440) && reviewPaths.has(path)) {
        await checkDesign(page, path, width);
      }
      results.push({path,width,...metrics});
    }
    // Display mode, route navigation, and browser back remain functional.
    await page.goto('https://fcarena.in/dashboard');
    await page.locator('.fc-main').waitFor();
    await page.getByRole('button',{name:'Switch to Dark Mode'}).click();
    assert.equal(await page.locator('html').getAttribute('data-mode'),'dark');
    if(width===390||width===1440)await page.screenshot({path:output+'/dark-'+width+'.png',fullPage:true,animations:'disabled'});
    if(width<1024){
      await page.getByRole('navigation',{name:'Primary navigation'}).locator('a[href="/fixtures"]').click();
      await page.waitForURL('**/fixtures');
      await page.goBack(); await page.waitForURL('**/dashboard');
    }
    // Older installations can still have a saved locale when they upgrade.
    await page.evaluate(() => localStorage.setItem('fc-arena-ui-language', 'ta'));
    await page.reload();
    await page.locator('.fc-main').waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'),'en');
    if (width < 1024) {
      assert.equal(await page.locator('.theme-bottom-nav a').count(),5);
      assert.equal(await page.locator('.theme-bottom-nav').getByText('Home',{exact:true}).count(),1);
      const trigger = page.getByRole('button', {name: 'Open navigation menu'});
      await trigger.click();
      const menu = page.getByRole('dialog', {name: 'FC Arena navigation'});
      await menu.waitFor({state: 'visible'});
      assert.equal(await menu.getByRole('link', {name: 'Dashboard', exact: true}).getAttribute('aria-current'), 'page');
      if (width === 390) {
        await menu.screenshot({path:output+'/navigation-drawer-390.png',animations:'disabled'});
      }
      await page.keyboard.press('Escape');
      await menu.waitFor({state: 'hidden'});
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Open navigation menu');
      if (width === 390) {
        await page.emulateMedia({reducedMotion:'no-preference'});
        await trigger.click();
        await page.waitForFunction(() => Math.abs(document.querySelector('dialog[open]').getBoundingClientRect().left) < 1);
        await dragDrawer(page, 255, 55, async () => {
          assert((await menu.boundingBox()).x < -120, 'Drawer must track the finger before release');
        });
        await menu.waitFor({state:'hidden'});
        assert.equal(new URL(page.url()).pathname, '/dashboard');
      }
    }
    await page.goto('https://fcarena.in/settings');
    await page.getByRole('heading', {name: 'Settings', exact: true}).waitFor();
    assert.equal(await page.getByRole('group',{name:'App language'}).count(),0);
    assert.equal(await page.locator('html').getAttribute('lang'),'en');
    await context.close();
    console.log('PASS UI width '+width);
  }
  assert.deepEqual(errors,[]);
  writeFileSync(output+'/results.json',JSON.stringify({results,errors,accessibility},null,2));
  if (axeScript) {
    assert(accessibility.length > 0, 'The requested accessibility scans must run');
    assert.deepEqual(accessibility.filter(({violations}) => violations.length > 0), []);
    console.log('PASS '+accessibility.length+' axe accessibility scans');
  }
  console.log('PASS '+results.length+' route/viewport checks');
} finally {await browser.close();}
