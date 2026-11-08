import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { createUiContext, user, career, checkLayout } from './phase-ui-harness.mjs';
import { phaseData, tournament as baseCup } from './phase-ui-fixtures.mjs';
import { makeFixtureFeed } from './fixture-feed-fixtures.mjs';

const origin=process.env.SMOKE_WEB_ORIGIN||'http://127.0.0.1:3102';
const baseline=process.env.BASELINE_CONTEXT==='1';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox']});
const ok=(r,h,data)=>r.fulfill({headers:h,json:{success:true,data,error:null}});
const fail=(r,h)=>r.fulfill({status:503,headers:h,json:{success:false,data:null,error:{code:'TEMPORARY',message:'Temporary read failure'}}});
const memberships=[['arena-tamil','FC ARENA TAMIL','PRIMARY'],['kickoff','KICKOFF FC','SECONDARY']].map(([id,name,membershipType])=>({membershipType,adminRole:'ADMIN',league:{id,name,code:id,region:'India',members:32,maxMembers:100,logoUrl:null}}));
async function pull(context,page){
 await page.evaluate(()=>scrollTo(0,0));
 const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:180,y:170}]});
 for(let i=1;i<=7;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:180,y:170+i*24}]});await page.waitForTimeout(20);}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
}
await mkdir('.cache/navigation-refresh',{recursive:true});
let passed=0;
try{
 const widths=baseline?[390]:[390,1280];
 for(const width of widths){
  let account=user.id,count=22,hold=false,held=[],unavailable=false,listReads=0,documentReads=0,tokenRefreshes=0;
  const teamRows=()=>Array.from({length:count},(_,i)=>({id:`team-${i}`,entryName:`Target Team ${i}`,status:i<19?'APPROVED':'PENDING',fixtureCount:0,entryLogoUrl:null,createdAt:'2026-11-07T12:00:00Z',members:[{user:{...user,id:`player-${i}`}}]}));
  const target=()=>({...baseCup,id:'phase3',name:'International Friendlies',code:'TARGET-KICKOFF',leagueId:'kickoff',league:memberships[1].league,status:'REGISTRATION_OPEN',maxEntries:48,approvedEntries:19,pendingEntries:count-19,registeredEntries:count,isLeagueAdmin:true,canManageParticipants:true,canManageSettings:false,canManageAdmins:false,visibility:'LEAGUE'});
  const empty={...target(),id:'empty-cup',code:'EMPTY-TAMIL',leagueId:'arena-tamil',league:memberships[0].league,approvedEntries:0,pendingEntries:0,registeredEntries:0};
  const myMemberships=()=>account===user.id?memberships:[memberships[0]];
  const fixture={...phaseData['/api/tournaments/phase3/fixtures'].fixtures[0],match:{id:'phase3',status:'SCHEDULED'},tournamentId:'phase3',leagueId:'kickoff',tournamentName:'International Friendlies',leagueName:'KICKOFF FC'};
  const f=await createUiContext(browser,{width,direct:true,native:width<500,mode:'DARK',role:'USER',overrides:{
   '/api/auth/me':(r,h)=>ok(r,h,{user:{...user,id:account,role:'USER'}}),
   '/api/auth/refresh':(r,h)=>{tokenRefreshes++;return ok(r,h,{accessToken:'fixture-only',expiresIn:3600});},
   '/api/leagues/my':(r,h)=>ok(r,h,{leagues:myMemberships()}),
   '/api/players/me/dashboard':(r,h)=>ok(r,h,{career:{...career,tournamentHistory:[{tournament:{id:'phase3'},registration:{id:'team-0',entryName:'My Club'}}]},memberships:myMemberships(),tournaments:[empty,target()],fixtures:[]}),
   '/api/leagues/arena-tamil/tournaments':{tournaments:[empty]},
   '/api/leagues/kickoff/tournaments':(r,h)=>{listReads++;if(hold){held.push({r,h});return;}return unavailable?fail(r,h):ok(r,h,{tournaments:[target()]});},
   '/api/leagues/kickoff':{league:{...memberships[1].league,adminRole:'ADMIN',membershipType:'SECONDARY',canManageMembers:true,canManageSettings:false,pendingApplications:0,description:null,rules:null,creator:{id:user.id,fullName:user.fullName,playerCode:'P3',inGameName:'Admin'}}},
   '/api/leagues/kickoff/tournament-templates':{templates:[]},
   '/api/leagues/kickoff/fixture-feed':(r,h)=>ok(r,h,makeFixtureFeed('kickoff',[target()],{phase3:[fixture]},'KICKOFF FC')),
   '/api/leagues/arena-tamil/fixture-feed':(r,h)=>ok(r,h,makeFixtureFeed('arena-tamil',[empty],{},'FC ARENA TAMIL')),
   '/api/tournaments/phase3':(r,h)=>ok(r,h,{tournament:target()}),
   '/api/tournaments/phase3/entries':(r,h)=>ok(r,h,{entries:teamRows(),maxEntries:48}),
   '/api/tournaments/phase3/registrations':(r,h)=>ok(r,h,{registrations:teamRows()}),
   '/api/matches/phase3':{match:{...phaseData['/api/matches/phase3'].match,tournament:target(),league:memberships[1].league}},
  },onMutation:(r,h)=>{assert.equal(new URL(r.request().url()).pathname,'/api/telemetry/web-vitals');return r.fulfill({status:204,headers:h});}});
  await f.context.addInitScript(id=>sessionStorage.setItem(`fc-arena:tournament-league:${id}`,'arena-tamil'),user.id);
  f.page.on('request',r=>{if(r.isNavigationRequest()&&r.resourceType()==='document')documentReads++;});
  async function overviewAndTeams(label){
   await f.page.waitForURL(url=>url.pathname==='/tournaments/phase3');
   await f.page.getByText(`${count} registered`,{exact:true}).waitFor();
   const progress=f.page.getByText('Approved Entry Progress',{exact:true}).locator('..');assert.match(await progress.innerText(),/19\/48/);
   await f.page.getByRole('navigation',{name:'Tournament sections'}).getByRole('link',{name:'Teams',exact:true}).click();
   await f.page.getByRole('heading',{name:`Target Team ${count-1}`,exact:true}).waitFor();assert.equal(await f.page.getByText('No Tournament teams yet',{exact:true}).count(),0);
   await checkLayout(f.page,label);passed++;console.log(`PASS ${width}px ${label}: same tournament ID, registration total/progress and complete team roster`);
  }
  try{
   await f.page.goto(origin+'/dashboard');await f.page.getByRole('combobox',{name:'Dashboard league context'}).selectOption('kickoff');
   await f.page.locator('a[href="/tournaments/phase3"]').first().waitFor();
   await f.page.getByRole('link',{name:'Cup',exact:true}).click();await f.page.locator('article').first().waitFor();
   if(baseline){await f.page.getByText('EMPTY-TAMIL',{exact:true}).waitFor({timeout:8000});console.log('CONFIRMED baseline bug: Home selected KICKOFF FC, but direct Cup opened the empty FC ARENA TAMIL tournament.');continue;}
   await f.page.getByText('TARGET-KICKOFF',{exact:true}).waitFor({timeout:10000});assert.equal(await f.page.getByText('EMPTY-TAMIL',{exact:true}).count(),0);
   await f.page.locator('a[href="/tournaments/phase3"]').filter({hasText:'View Details'}).click();await overviewAndTeams('Home → direct Cup');
   await f.page.goto(origin+'/leagues/kickoff');await f.page.getByRole('link',{name:/Open Tournaments/}).click();
   await f.page.getByRole('link',{name:'View Tournament',exact:true}).click();await overviewAndTeams('League → tournament management');
   await f.page.getByRole('link',{name:'Matches',exact:true}).click();await f.page.locator('h1').waitFor();
   await f.page.getByText('League & tournament filters · KICKOFF FC',{exact:false}).waitFor();
   await f.page.locator('a[href="/matches/phase3"]').first().click();await f.page.locator('a[href="/tournaments/phase3"]').first().click();await overviewAndTeams('Matches → Match Room → tournament');
   await f.page.getByRole('link',{name:'Cup',exact:true}).click();await f.page.getByText('TARGET-KICKOFF',{exact:true}).waitFor();
   if(width<500){
    await f.page.evaluate(()=>{window.__card=document.querySelector('article');});
    hold=true;const before={listReads,documentReads,tokenRefreshes};await pull(f.context,f.page);
    await f.page.locator('[data-phase="refreshing"]').waitFor();await f.page.waitForTimeout(1700);
    assert.equal(await f.page.evaluate(()=>window.__card===document.querySelector('article')&&window.__card.isConnected),true,'refresh must keep the loaded card mounted');
    assert.equal(await f.page.locator('[data-phase="refreshing"]').count(),1,'spinner must follow the actual pending request');
    await pull(f.context,f.page);assert.equal(listReads,before.listReads+1,'a second gesture must not start a duplicate read');
    count=23;hold=false;for(const item of held.splice(0))await ok(item.r,item.h,{tournaments:[target()]});
    await f.page.getByText('23 registered',{exact:true}).waitFor();await f.page.locator('[data-phase="idle"]').waitFor({state:'attached'});
    assert.equal(documentReads,before.documentReads);assert.equal(tokenRefreshes,before.tokenRefreshes);assert.equal(await f.page.evaluate(()=>window.__card.isConnected),true);
    passed++;console.log('PASS slow refresh keeps content mounted, waits for the real read and ignores repeated gestures');
    unavailable=true;await pull(f.context,f.page);await f.page.getByText('Could not refresh. Your loaded details are kept.',{exact:true}).waitFor();
    await f.page.getByText('23 registered',{exact:true}).waitFor();assert.equal(await f.page.evaluate(()=>window.__card.isConnected),true);unavailable=false;count=24;
    await f.page.getByRole('button',{name:'Retry',exact:true}).click();await f.page.getByText('24 registered',{exact:true}).waitFor();await f.page.locator('[data-phase="idle"]').waitFor({state:'attached'});
    passed++;console.log('PASS failed background refresh retains content and retries reads in place');
    await f.page.goto(origin+'/tournaments/phase3/registration');await f.page.locator('input[name="entryName"]').fill('Unsubmitted team draft');
    await f.page.getByPlaceholder('Your FC Mobile game name').fill('Draft IGN');
    await f.page.evaluate(()=>{window.__input=document.querySelector('input[name="entryName"]');});const fresh=f.page.waitForResponse(response=>new URL(response.url()).pathname==='/api/tournaments/phase3/my-registration');await pull(f.context,f.page);await fresh;await f.page.locator('[data-phase="idle"]').waitFor({state:'attached'});
    assert.equal(await f.page.locator('input[name="entryName"]').inputValue(),'Unsubmitted team draft');assert.equal(await f.page.getByPlaceholder('Your FC Mobile game name').inputValue(),'Draft IGN');
    assert.equal(await f.page.evaluate(()=>window.__input===document.querySelector('input[name="entryName"]')),true);
    passed++;console.log('PASS refresh preserves controlled and uncontrolled registration drafts without remounting inputs');
   }
   account='another-account';await f.page.goto(origin+'/tournaments');await f.page.getByText('EMPTY-TAMIL',{exact:true}).waitFor();assert.equal(await f.page.getByText('TARGET-KICKOFF',{exact:true}).count(),0);
   account=user.id;await f.page.goto(origin+'/tournaments');await f.page.getByText('TARGET-KICKOFF',{exact:true}).waitFor();
   assert.deepEqual(f.errors,[]);passed++;console.log(`PASS ${width}px league selection is isolated per account and restored for the original account`);
   await f.page.screenshot({path:`.cache/navigation-refresh/final-${width}.png`,fullPage:true});
  }finally{for(const item of held)await item.r.abort().catch(()=>{});await f.context.close();}
 }
 console.log(JSON.stringify({passed,baseline}));
}finally{await browser.close();}
