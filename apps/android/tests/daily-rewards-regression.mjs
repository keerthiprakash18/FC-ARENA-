import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { createUiContext, checkLayout } from './phase-ui-harness.mjs';
import { dailyFixture, emptyExperience } from './daily-rewards-fixtures.mjs';
const origin='https://fcarena.in';
const output=process.env.REWARDS_SCREENSHOTS||'.cache/daily-rewards/screenshots';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox']});
try{
 for(const width of [320,390,1280])for(const mode of ['LIGHT','DARK']){
  let state=dailyFixture(),claims=0,failClaim=true,png;const cardId='81fb40f4-7e4f-40a6-a429-c87dd7242ae2';
  const response=(route,headers,data=state)=>route.fulfill({headers,json:{success:true,data,error:null}});
  const {context,page,errors}=await createUiContext(browser,{width,mode,overrides:{
   '/api/experience/me/check-in':(route,headers)=>{const month=new URL(route.request().url()).searchParams.get('month');return response(route,headers,{...state,calendar:{...state.calendar,month:month||'2026-11'}});},
   '/api/experience/me':(route,headers)=>response(route,headers,{...emptyExperience,cosmetics:state.cosmetics}),
   ['/api/players/card-exports/'+cardId]:(route,headers)=>route.fulfill({headers:{...headers,'content-type':'image/png','content-disposition':'attachment; filename="reward-card.png"'},body:png}),
  },onMutation:async(route,headers)=>{
   const p=new URL(route.request().url()).pathname;
   if(p==='/api/telemetry/web-vitals')return route.fulfill({status:204,headers});
   if(p==='/api/players/me/card-export'){
    const req=route.request();const form=await new Request(req.url(),{method:'POST',headers:req.headers(),body:req.postDataBuffer()}).formData();
    png=Buffer.from(await form.get('image').arrayBuffer());return response(route,headers,{path:`/players/card-exports/${cardId}?grant=fixture`,filename:'reward-card.png',expiresAt:new Date(Date.now()+300000).toISOString()});
   }
   const body=JSON.parse(route.request().postData());
   if(p.endsWith('/check-in')){
    claims++;assert.deepEqual(body,{intent:'DAILY_CHECK_IN'});
    if(failClaim){failClaim=false;return route.fulfill({status:503,headers,json:{success:false,data:null,error:{code:'UNAVAILABLE',message:'Please retry your check-in.'}}});}
    if(!state.claimedToday){state.balance+=10;state.claimedToday=true;state.streak=1;state.longestStreak=1;state.cycleCompleted=1;state.calendar.claims=[{day:state.today,coins:10,bonus:0,streak:1}];}
    return response(route,headers,{...state,receipt:{kind:'CHECK_IN',alreadyApplied:false,coins:10,bonus:0}});
   }
   const item=state.catalog.find(i=>i.id===body.itemId);assert(item);
   if(p.endsWith('/purchase')){if(!item.owned){state.balance-=item.price;item.owned=true;}assert(state.balance>=0);return response(route,headers,{...state,receipt:{kind:'PURCHASE',alreadyApplied:false,itemId:item.id,coins:item.price}});}
   assert(p.endsWith('/equip'));assert(item.owned);if(item.kind==='BACKGROUND')state.cosmetics.background=item.id;else state.cosmetics.badge=item.id;
   for(const i of state.catalog)i.equipped=state.cosmetics.background===i.id||state.cosmetics.badge===i.id;
   return response(route,headers,{...state,receipt:{kind:'EQUIP',itemId:item.id}});
  }});
  try{
   await page.goto(origin+'/dashboard');const popup=page.getByRole('dialog',{name:'Daily check-in',exact:true});
   const collect=popup.getByRole('button',{name:'Collect today · +10',exact:true});await collect.waitFor();
   assert(await popup.evaluate(element=>element.matches(':modal')),'Native modal contains keyboard focus and makes the page inert');
   if(width===390)await page.screenshot({path:`${output}/popup-${mode.toLowerCase()}.png`});
   await collect.click();await popup.getByText('Please retry your check-in.').waitFor();assert.equal(claims,1);
   assert(await popup.isVisible(),'A rejected claim keeps the reward available for retry');
   await collect.evaluate(button=>{button.click();button.click();});await popup.waitFor({state:'hidden'});assert.equal(claims,2);assert.equal(state.balance,10);
   assert.equal(await page.locator('.daily-rewards').count(),0,'Home has no permanent daily reward panel after collecting');
   const refreshed=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/experience/me/check-in');
   await page.reload();await refreshed;assert.equal(await page.getByRole('dialog',{name:'Daily check-in',exact:true}).count(),0,'Collected rewards never flash on reload');
   await page.locator('header').getByRole('link',{name:'Check-in Calendar',exact:true}).click();const panel=page.getByRole('region',{name:'Daily check-in rewards'});
   await page.getByRole('table',{name:'November 2026 check-in calendar'}).waitFor();
   assert.equal(await panel.locator('.daily-wallet strong').innerText(),'10');
   await context.setOffline(true);assert.equal(await panel.locator('.daily-wallet strong').innerText(),'10');await context.setOffline(false);
   await page.locator('time[datetime="2026-11-03"]').getAttribute('aria-label').then(value=>assert(value.includes('collected 10 coins')));
   assert(await page.getByRole('button',{name:'Unlock Royal Stripe for 100 coins'}).isDisabled());
   await page.getByRole('button',{name:'Previous month'}).click();await page.getByRole('table',{name:'October 2026 check-in calendar'}).waitFor();
   await page.getByRole('button',{name:'Next month'}).click();await page.getByRole('table',{name:'November 2026 check-in calendar'}).waitFor();
   state.balance=150;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
   const unlock=page.getByRole('button',{name:'Unlock Royal Stripe for 100 coins'});await unlock.waitFor();await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.getAttribute('aria-label')==='Unlock Royal Stripe for 100 coins')?.disabled);
   await unlock.click();await page.getByRole('button',{name:'Use Royal Stripe',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('.player-edition')?.getAttribute('data-background')==='ROYAL_STRIPE');
   await page.getByRole('button',{name:'Unlock Arena Spark for 50 coins'}).click();await page.getByRole('button',{name:'Use Arena Spark'}).click();
   await page.locator('.edition-cosmetic').getByText(/Arena Spark/).waitFor();
   const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download player card ↓',exact:true}).click();const downloaded=await download;
   const failure=await downloaded.failure();assert.equal(failure,null,JSON.stringify({failure,errors,alerts:await page.getByRole('alert').allTextContents(),url:downloaded.url()}));
   const saved=await downloaded.path();
   const pixels=await sharp(saved).removeAlpha().raw().toBuffer();assert(Math.abs(pixels[0]-66)<3,'export must use the equipped plum background');
   await checkLayout(page,`Daily rewards ${width} ${mode}`);assert.deepEqual(errors,[]);
   if(width===390)await page.screenshot({path:`${output}/daily-${mode.toLowerCase()}.png`,fullPage:true});
   console.log(`PASS ${width}px ${mode}: launch popup, claim retry/double-click, auto-close, no Home panel or repeat on reload, calendar, cosmetics and exported PNG`);
  }finally{await context.close();}
 }
}finally{await browser.close();}
