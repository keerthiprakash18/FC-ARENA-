import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {createUiContext,user,career,checkLayout} from './phase-ui-harness.mjs';
import {tournament} from './phase-ui-fixtures.mjs';
const origin=process.env.SMOKE_WEB_ORIGIN||'http://127.0.0.1:3102', baseline=process.env.BASELINE_PERSISTENCE==='1';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox']});
const memberships=[['arena-tamil','FC ARENA TAMIL','PRIMARY','OWNER'],['kickoff','KICKOFF FC','SECONDARY','ADMIN']].map(([id,name,membershipType,adminRole])=>({membershipType,adminRole,league:{id,name,code:id,region:'INDIA',members:29}}));
const cups=memberships.map((m,i)=>({...tournament,id:i?'phase3':'empty-cup',leagueId:m.league.id,leagueName:m.league.name,league:m.league,name:'International Friendlies',code:i?'FCA-T-UE22UX':'FCA-T-PXCHVC',status:'REGISTRATION_OPEN',maxEntries:48,approvedEntries:i?35:1,pendingEntries:i?1:0,registeredEntries:i?36:1}));
const telemetry=(r,h)=>{assert.equal(new URL(r.request().url()).pathname,'/api/telemetry/web-vitals');return r.fulfill({status:204,headers:h});};
const overrides={'/api/leagues/my':{leagues:memberships},'/api/players/me/dashboard':{career,memberships,tournaments:cups,fixtures:[]},'/api/leagues/arena-tamil/tournaments':{tournaments:[cups[0]]},'/api/leagues/kickoff/tournaments':{tournaments:[cups[1]]},'/api/tournaments/phase3':{tournament:{...cups[1],isLeagueAdmin:false,canManageParticipants:false}},'/api/tournaments/phase3/entries':{entries:[]}};
let passed=0;
await mkdir('.cache/native-web-refresh',{recursive:true});
try{
 for(const width of baseline?[390]:[320,390,1280]){
  const f=await createUiContext(browser,{width,direct:true,native:true,role:'USER',mode:width===390?'LIGHT':'DARK',overrides,onMutation:telemetry});
  try{
   await f.page.goto(origin+'/dashboard');await f.page.getByRole('combobox',{name:'Dashboard league context'}).selectOption('kickoff');
   await f.page.locator('a[href="/tournaments/phase3"]').first().waitFor();
   await f.page.evaluate(()=>sessionStorage.clear());await f.page.goto(origin+'/dashboard');
   const selection=await f.page.getByRole('combobox',{name:'Dashboard league context'}).inputValue();
   if(baseline){assert.equal(selection,'arena-tamil');console.log('CONFIRMED old native-session bug: losing sessionStorage changes KICKOFF FC back to primary FC ARENA TAMIL (1/48).');continue;}
   assert.equal(selection,'kickoff');await f.page.getByText('36 registered',{exact:true}).waitFor();
   await f.page.getByText('KICKOFF FC · FCA-T-UE22UX',{exact:true}).waitFor();
   assert.equal(await f.page.getByRole('combobox',{name:'Active tournament league'}).inputValue(),'kickoff');
   await checkLayout(f.page,'Persistent native Home '+width);
   await f.page.locator('.fc-tournament-panel').screenshot({path:`.cache/native-web-refresh/home-${width}.png`});
   passed++;console.log(`PASS ${width}px new WebView session retains KICKOFF FC and its registered/approved/pending totals and unique tournament code`);
   await f.page.getByRole('combobox',{name:'Active tournament league'}).selectOption('arena-tamil');
   await f.page.getByText('1 registered',{exact:true}).waitFor();await f.page.getByText('FC ARENA TAMIL · FCA-T-PXCHVC',{exact:true}).waitFor();
   await f.page.getByRole('link',{name:'Cup',exact:true}).click();await f.page.getByText('FCA-T-PXCHVC',{exact:true}).waitFor();
   assert.equal(await f.page.getByText('FCA-T-UE22UX',{exact:true}).count(),0);assert.deepEqual(f.errors,[]);
   passed++;console.log(`PASS ${width}px changing the card league changes Home and Cup together without combining identically named tournaments`);
  }finally{await f.context.close();}
 }
 if(!baseline){
  for(const width of [320,390]){
   const f=await createUiContext(browser,{width,direct:true,native:true,role:'USER',mode:width===390?'LIGHT':'DARK',overrides,onMutation:telemetry});
   let latest='unknown',checks=0,documents=0;
   await f.page.clock.install();
   await f.context.route('**/web-release?*',r=>{checks++;return r.fulfill({json:{release:latest},headers:{'cache-control':'no-store'}});});
   f.page.on('request',r=>{if(r.isNavigationRequest()&&r.resourceType()==='document')documents++;});
   await f.context.addCookies([{name:'fc_refresh_probe',value:'preserved',domain:new URL(origin).hostname,path:'/',httpOnly:true,secure:origin.startsWith('https:')}]);
   try{
    await f.page.goto(origin+'/tournaments/phase3/registration?view=all#entry');
    const field=f.page.locator('input[name="entryName"]');await field.fill('Unsaved team draft');
    const actual=await f.page.locator('body').getAttribute('data-web-release');
    await f.page.evaluate(()=>{document.body.dataset.webRelease='a'.repeat(40);localStorage.setItem('fc-release-test-marker','keep');window.__draft=document.querySelector('input[name="entryName"]');});
    const initialDocuments=documents;latest='b'.repeat(40);await f.page.clock.fastForward(61000);
    const notice=f.page.getByRole('region',{name:'Latest app improvements'});
    await notice.waitFor();assert.equal(documents,initialDocuments);assert.equal(await field.inputValue(),'Unsaved team draft');assert.equal(await f.page.evaluate(()=>window.__draft.isConnected),true);
    await checkLayout(f.page,'Native release notice '+width);await notice.screenshot({path:`.cache/native-web-refresh/notice-${width}.png`});
    passed++;console.log(`PASS ${width}px a deployed web release is announced without navigation, remounting a draft or rotating the login`);
    await notice.getByRole('button',{name:'Later',exact:true}).click();await f.page.clock.fastForward(61000);assert.equal(await notice.count(),0);
    latest='c'.repeat(40);await f.page.clock.fastForward(61000);await notice.waitFor();
    passed++;console.log(`PASS ${width}px Later snoozes that release while a subsequent release can still be announced`);
    await f.page.evaluate(()=>document.querySelector('form').setAttribute('data-refresh-lock','true'));
    await notice.getByRole('button',{name:'Reload latest',exact:true}).click();assert.equal(documents,initialDocuments);
    await f.page.evaluate(()=>document.querySelector('form').removeAttribute('data-refresh-lock'));
    latest=actual;
    await notice.getByRole('button',{name:'Reload latest',exact:true}).click();
    await f.page.waitForURL(url=>url.searchParams.get('fc_native_refresh')==='c'.repeat(40));await field.waitFor();
    const loaded=new URL(f.page.url());assert.equal(loaded.pathname,'/tournaments/phase3/registration');assert.equal(loaded.searchParams.get('view'),'all');assert.equal(loaded.hash,'#entry');
    assert.equal(await f.page.evaluate(()=>localStorage.getItem('fc-release-test-marker')),'keep');
    assert.ok((await f.context.cookies()).some(c=>c.name==='fc_refresh_probe'&&c.value==='preserved'));
    assert.deepEqual(f.errors,[]);passed++;console.log(`PASS ${width}px explicit reload waits for a safe action, fetches a fresh document and preserves route, cookie and settings`);
    const before=checks;await f.context.setOffline(true);await f.page.clock.fastForward(61000);assert.equal(checks,before);await f.context.setOffline(false);
    passed++;console.log(`PASS ${width}px optional release checks pause offline`);
   }finally{await f.context.close();}
  }
  const f=await createUiContext(browser,{width:1280,direct:true,native:false,role:'USER',overrides,onMutation:telemetry});let checks=0;
  await f.context.route('**/web-release?*',r=>{checks++;return r.fulfill({json:{release:'b'.repeat(40)}});});
  try{await f.page.goto(origin+'/dashboard');await f.page.getByRole('heading',{name:'Active Tournament',exact:true}).waitFor();assert.equal(checks,0);assert.equal(await f.page.getByRole('region',{name:'Latest app improvements'}).count(),0);passed++;console.log('PASS ordinary browser users receive no native-only release polling or notice');}finally{await f.context.close();}
 }
 console.log(JSON.stringify({passed,baseline}));
}finally{await browser.close();}
