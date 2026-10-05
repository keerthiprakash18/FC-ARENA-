// UI regression checks. API data is intercepted; no production account is used.
// Run after build with a local production server listening on 127.0.0.1:3000.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
const output = process.env.SMOKE_OUTPUT || '/tmp/fcarena-ui';
mkdirSync(output, {recursive:true});
const errors = [], results = [];
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
        case '/api/players/me/career': data = career; break;
        case '/api/players/me/dashboard': data = { career, memberships: [], tournaments: [], fixtures: [] }; break;
        case '/api/leagues/my': data = { leagues: [] }; break;
        case '/api/tournaments/ui-test/standings': data = {tournament: {name:'Arena Championship'}, standings: [{position:1,registrationId:'team1',entryName:'Manchester Champions With A Very Long Name',played:10,wins:7,draws:2,losses:1,goalsFor:23,goalsAgainst:11,goalDifference:12,points:23,form:'WWDLW'}]}; break;
        case '/api/tournaments/ui-test/groups': data = {groups:[{id:'g1',name:'Group A',position:1,entries:[{id:'team1',entryName:'Manchester Champions With A Very Long Name',members:[]}]}]}; break;
        case '/api/tournaments/ui-test/my-statistics': data={statistic:null}; break;
        case '/api/leagues/invite-test': data = {league:{id:'invite-test',name:'Arena Test League',code:'TEST-123',region:'India',members:2,maxMembers:20,pendingApplications:0,membershipType:'PRIMARY',adminRole:null,creator:{id:'smoke',fullName:'Test Admin'}}}; break;
        case '/api/leagues/invite-test/tournaments': data = {tournaments:[]}; break;
        case '/api/matches/result-test': data = {match:{id:'result-test',matchCode:'M-TEST',status:'SCHEDULED',isLeagueAdmin:false,isParticipant:true,participantSide:'HOME',readiness:{homeReadyAt:null,awayReadyAt:null,homeReady:false,awayReady:false,bothReady:false},schedule:{scheduledAt:'2027-01-01T12:00:00Z',estimatedDeadlineAt:null,matchDurationMinutes:15},tournament:{id:'ui-test',name:'Arena Cup',mode:'SOLO',format:'ROUND_ROBIN'},league:{id:'invite-test',name:'Arena Test League',code:'TEST-123'},fixture:{id:'f1',fixtureCode:'F1',roundName:'Round 1',roundNumber:1,matchday:1,status:'SCHEDULED',scheduledAt:'2027-01-01T12:00:00Z',venue:null,home:{id:'home',entryName:'Home Player',members:[{id:'smoke',fullName:'Home Player'}]},away:{id:'away',entryName:'Away Player',members:[{id:'opponent',fullName:'Away Player'}]},homeSource:null,awaySource:null}}}; break;
        case '/api/matches/result-test/events': return route.fulfill({body:'event: connected\ndata: {"type":"connected"}\n\n',headers:{'content-type':'text/event-stream','access-control-allow-origin':'https://fcarena.in','access-control-allow-credentials':'true'}});
        case '/api/matches/result-test/results': data={isLeagueAdmin:false,canVerifyResult:false,confirmedResultSubmissionId:null,submissions:[]}; break;
        case '/api/matches/result-test/ocr/latest': data={extraction:null}; break;
        case '/api/notifications': data = { notifications: [], unreadCount: 0 }; break;
        default: errors.push(`Unmocked API: ${url.pathname}`); return route.abort();
      }
      return route.fulfill({ json: { success: true, data, error: null }, headers: { 'access-control-allow-origin': 'https://fcarena.in', 'access-control-allow-credentials': 'true' } });
    }
    if (url.hostname === 'fcarena.in') {
      try {
        const response = await fetch(`http://127.0.0.1:3000${url.pathname}${url.search}`, { headers: { ...route.request().headers(), host: 'localhost:3000' } });
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
    const context=await browser.newContext({viewport:{width,height:850},serviceWorkers:'block'});
    const page=await context.newPage();
    await prepare(page);
    await context.addInitScript(()=>localStorage.setItem('fc-arena-theme-preference','LUXURY_GOLD'));
    // Mock the user's saved selection consistently with the initial theme.
    user.themePreference='LUXURY_GOLD';
    for (const path of ['/login','/register','/forgot-password','/reset-password','/dashboard','/leagues','/tournaments','/fixtures','/profile','/career','/tournaments/ui-test/standings','/leagues/invite-test','/matches/result-test']) {
      await page.goto('https://fcarena.in'+path);
      await page.locator(['/login','/register','/forgot-password','/reset-password'].includes(path) ? '.auth-form' : '.fc-main').waitFor();
      if(['/login','/register','/forgot-password','/reset-password'].includes(path)) assert.equal(await page.locator('.field label').evaluateAll(labels=>labels.filter(label=>!label.control).length),0,'Every auth field label must target an input');
      if(path.includes('standings')) await page.getByText('Group A',{exact:true}).waitFor();
      if(path === '/leagues/invite-test') {
        await page.getByRole('button',{name:'Show QR',exact:true}).click();
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
      if(path.includes('standings')) {
        assert.equal(await page.locator('.fc-mobile-standings').isVisible(),width<640);
        assert(await page.getByText('Manchester Champions With A Very Long Name',{exact:true}).count()>0);
      }
      if(width===390||width===1440) await page.screenshot({path:output+'/'+path.replaceAll('/','_')+'-'+width+'.png',fullPage:true,animations:'disabled'});
      results.push({path,width,...metrics});
    }
    // Display mode, route navigation, and browser back remain functional.
    await page.goto('https://fcarena.in/dashboard');
    await page.locator('.fc-main').waitFor();
    await page.getByRole('button',{name:'Switch to Dark Mode'}).click();
    assert.equal(await page.locator('html').getAttribute('data-mode'),'dark');
    if(width===390||width===1440)await page.screenshot({path:output+'/dark-'+width+'.png',fullPage:true,animations:'disabled'});
    if(width<1024){
      await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('link',{name:'Fixtures',exact:true}).click();
      await page.waitForURL('**/fixtures');
      await page.goBack(); await page.waitForURL('**/dashboard');
    }
    await context.close();
    console.log('PASS UI width '+width);
  }
  assert.deepEqual(errors,[]);
  writeFileSync(output+'/results.json',JSON.stringify({results,errors},null,2));
  console.log('PASS '+results.length+' route/viewport checks');
} finally {await browser.close();}
