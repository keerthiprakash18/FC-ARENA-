import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createUiContext, user, checkLayout } from './phase-ui-harness.mjs';
import { phaseData } from './phase-ui-fixtures.mjs';
const origin = process.env.SMOKE_WEB_ORIGIN || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox'] });
const success = (route, headers, data) => route.fulfill({ headers, json: { success: true, data, error: null } });
const unavailable = (route, headers, status = 503) => route.fulfill({ status, headers, json: { success: false, data: null, error: { code: 'TEMPORARY', message: 'Temporary connection interruption' } } });
const defaults = { '/api/ai/status': { enabled: true, configured: true, mode: 'READ_ONLY', limits: { perMinute: 5, perDay: 50 } }, '/api/safety/blocks': { blockedUsers: [] }, '/api/safety/reports/mine': { reports: [] }, '/api/safety/admin/reports': { reports: [] } };
try {
 for (const width of [390, 1280]) {
  for (const [path, endpoint, data] of [
   ['/leagues','/api/leagues/my',phaseData['/api/leagues/my']], ['/more','/api/leagues/my',phaseData['/api/leagues/my']],
   ['/elite-cup','/api/leagues/my',phaseData['/api/leagues/my']], ['/ucl-cup','/api/leagues/my',phaseData['/api/leagues/my']],
   ['/tournaments','/api/leagues/my',phaseData['/api/leagues/my']], ['/settings','/api/auth/me',{user}], ['/settings/appearance','/api/auth/me',{user}],
   ['/ai','/api/ai/status',defaults['/api/ai/status']], ['/safety','/api/safety/blocks',{blockedUsers:[]}], ['/admin/safety-reports','/api/safety/admin/reports',{reports:[]}],
   ['/ucl-cup/phase3','/api/tournaments/phase3',{...phaseData['/api/tournaments/phase3'],tournament:{...phaseData['/api/tournaments/phase3'].tournament,competitionFormat:'UCL_CUP'}}],
  ]) {
   let available = false, reads = 0;
   const f = await createUiContext(browser, {width, direct:true, native:width<500,mode:'DARK', overrides:{...defaults,[endpoint]:(route,headers)=>{reads++;return available?success(route,headers,data):unavailable(route,headers);}},onMutation:(route,headers)=>{
    assert.equal(new URL(route.request().url()).pathname,'/api/telemetry/web-vitals');return route.fulfill({status:204,headers});
   }});
   try {
    await f.page.goto(origin+path); await f.page.getByRole('button',{name:'Try again',exact:true}).first().waitFor();
    assert.equal(new URL(f.page.url()).pathname,path,'temporary failures must preserve the current page');
    await f.context.setOffline(true); await f.page.waitForTimeout(300); const count = reads; await f.page.waitForTimeout(1200); assert.equal(reads,count,'offline retries must pause');
    available=true; await f.context.setOffline(false);
    await f.page.getByRole('button',{name:'Try again',exact:true}).waitFor({state:'hidden',timeout:15000});
    await f.page.locator('h1').waitFor(); assert.equal(new URL(f.page.url()).pathname,path);
    assert.deepEqual(f.errors,[]); await checkLayout(f.page,path);
    console.log(`PASS ${width}px ${path}: 503 stays signed in, pauses offline, recovers in place`);
   } finally {await f.context.close();}
  }
 }
 // Rapid league selection must cancel the previous scope rather than overwrite it.
 let releaseFirst; const firstSeen=new Promise(resolve=>releaseFirst=resolve); let pending;
 const memberships=phaseData['/api/leagues/my'].leagues;
 const scope=await createUiContext(browser,{width:390,direct:true,mode:'DARK',overrides:{
  '/api/leagues/my':{leagues:[memberships[0],{...memberships[0],league:{...memberships[0].league,id:'second',name:'Second League'}}]},
  '/api/leagues/phase3/tournaments':(route,headers)=>{pending={route,headers};releaseFirst();},
  '/api/leagues/second/tournaments':{tournaments:[{...phaseData['/api/leagues/phase3/tournaments'].tournaments[0],id:'second-tournament',name:'Second League Tournament',status:'ACTIVE'}]},
 },onMutation:(route,headers)=>route.fulfill({status:204,headers})});
 try {
  await scope.page.goto(origin+'/tournaments');await firstSeen;
  await scope.page.getByRole('button',{name:/Second League/}).click();
  await scope.page.getByText('Second League Tournament',{exact:true}).waitFor();
  await pending.route.fulfill({headers:pending.headers,json:{success:true,data:phaseData['/api/leagues/phase3/tournaments'],error:null}}).catch(()=>{});
  await scope.page.waitForTimeout(300);
  await scope.page.getByText('Second League Tournament',{exact:true}).waitFor();assert.deepEqual(scope.errors,[]);
  console.log('PASS rapid league changes retain the selected league data');
 }finally{await scope.context.close();}
 const f=await createUiContext(browser,{width:390,direct:true,overrides:{'/api/leagues/my':(route,headers)=>unavailable(route,headers,401)},onMutation:(route,headers)=>route.fulfill({status:204,headers})});
 try {await f.page.goto(origin+'/leagues');await f.page.waitForURL('**/login');assert.deepEqual(f.errors,[]);console.log('PASS confirmed 401 opens login');}finally{await f.context.close();}
}finally{await browser.close();}
