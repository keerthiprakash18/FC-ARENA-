import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createUiContext} from './phase-ui-harness.mjs';
import {dailyFixture} from './daily-rewards-fixtures.mjs';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const popup=page=>page.getByRole('dialog',{name:'Daily check-in',exact:true});
const collect=page=>popup(page).getByRole('button',{name:'Collect today · +10',exact:true});
function collected(state){state.claimedToday=true;state.balance=10;state.streak=1;state.longestStreak=1;state.cycleCompleted=1;}
async function fixture({ambiguous=false,unavailable=false}={}){
 const state=dailyFixture();let posts=0,reads=0,rewardUnavailable=unavailable;
 const ui=await createUiContext(browser,{width:390,mode:'DARK',native:true,overrides:{
  '/api/experience/me/check-in':(route,headers)=>{reads++;return rewardUnavailable?route.fulfill({status:503,headers,json:{success:false,data:null,error:{code:'UNAVAILABLE',message:'Rewards temporarily unavailable.'}}}):route.fulfill({headers,json:{success:true,data:state,error:null}});},
 },onMutation:(route,headers)=>{
  if(new URL(route.request().url()).pathname==='/api/telemetry/web-vitals')return route.fulfill({status:204,headers});
  assert.equal(new URL(route.request().url()).pathname,'/api/experience/me/check-in');posts++;
  if(ambiguous){collected(state);return route.fulfill({status:503,headers,json:{success:false,data:null,error:{code:'UNAVAILABLE',message:'Connection interrupted.'}}});}
  collected(state);return route.fulfill({headers,json:{success:true,data:{...state,receipt:{kind:'CHECK_IN',alreadyApplied:false,coins:10,bonus:0}},error:null}});
 }});
 return {...ui,state,posts:()=>posts,reads:()=>reads,makeAvailable:()=>{rewardUnavailable=false;}};
}
try{
 {
  const {context,page,state,errors,posts}=await fixture();
  try{
   await page.goto('https://fcarena.in/profile');await popup(page).waitFor();
   await popup(page).getByRole('button',{name:'Not now',exact:true}).click();await popup(page).waitFor({state:'hidden'});assert.equal(posts(),0);
   const read=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/experience/me/check-in');
   await page.goto('https://fcarena.in/experience');await read;await page.getByRole('table').waitFor();assert.equal(await popup(page).count(),0,'Skipping does not reopen the prompt on navigation');
   state.today='2026-11-04';state.serverNow='2026-11-04T04:30:00Z';state.nextResetAt='2026-11-04T18:30:00Z';
   await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await popup(page).waitFor();
   await page.keyboard.press('Escape');await popup(page).waitFor({state:'hidden'});assert.equal(posts(),0);
   assert.deepEqual(errors,[]);console.log('PASS deep-link launch, optional dismissal, navigation, next-day foreground and Escape without claiming.');
  }finally{await context.close();}
 }
 {
  const {context,page,state,errors,posts}=await fixture({ambiguous:true});
  try{
   await page.goto('https://fcarena.in/dashboard');await collect(page).click();await popup(page).waitFor({state:'hidden'});
   assert.equal(posts(),1);assert.equal(state.balance,10);
   const read=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/experience/me/check-in');await page.reload();await read;
   assert.equal(await popup(page).count(),0);assert.equal(posts(),1);assert.deepEqual(errors,[]);
   console.log('PASS lost claim response reconciles confirmed balance, closes popup and never repeats the credit.');
  }finally{await context.close();}
 }
 {
  const {context,page,state,errors,posts}=await fixture();
  try{
   await page.goto('https://fcarena.in/dashboard');await popup(page).waitFor();const other=await context.newPage();
   await other.goto('https://fcarena.in/profile');await popup(other).waitFor();await collect(page).click();
   await popup(page).waitFor({state:'hidden'});await popup(other).waitFor({state:'hidden'});
   assert.equal(posts(),1);assert.equal(state.balance,10);assert.deepEqual(errors,[]);
   console.log('PASS collecting in one tab closes the other tab’s popup through confirmed server state.');
  }finally{await context.close();}
 }
 {
  const {context,page,errors,reads,makeAvailable}=await fixture({unavailable:true});
  try{
   const failedRead=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/experience/me/check-in'&&r.status()===503);
   await page.goto('https://fcarena.in/profile');await page.getByRole('button',{name:'Add profile photo',exact:true}).waitFor();await failedRead;
   assert.equal(await popup(page).count(),0);assert(reads()>0);await context.setOffline(true);makeAvailable();
   await context.setOffline(false);await popup(page).waitFor();await collect(page).click();await popup(page).waitFor({state:'hidden'});
   assert.deepEqual(errors,[]);console.log('PASS unavailable rewards leave the app usable; reconnect presents the available daily reward.');
  }finally{await context.close();}
 }
}finally{await browser.close();}
