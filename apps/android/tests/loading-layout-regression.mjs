import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createUiContext } from './phase-ui-harness.mjs';
const origin=process.env.SMOKE_WEB_ORIGIN||'http://127.0.0.1:3000';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 for(const width of [390,1280]) for(const dismissed of [false,true]){
  const f=await createUiContext(browser,{width,direct:true,native:width<500,mode:'DARK',onMutation:(route,headers)=>route.fulfill({status:204,headers})});
  await f.page.addInitScript(dismissed=>{
   if(dismissed)localStorage.setItem('fc-onboarding:phase3','dismissed');
   window.__shifts=[];new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__shifts.push(e.value);}).observe({type:'layout-shift',buffered:true});
  },dismissed);
  const cdp=await f.context.newCDPSession(f.page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:200000,uploadThroughput:96000});
  try{
   await f.page.goto(origin+'/dashboard');await f.page.getByRole('heading',{name:/Welcome back/}).waitFor();await f.page.waitForTimeout(1500);
   assert.equal(await f.page.getByRole('heading',{name:/Get match ready/}).count(),dismissed?0:1);
   const shifts=await f.page.evaluate(()=>window.__shifts);const cls=shifts.reduce((a,b)=>a+b,0);assert(cls<0.05,`Dashboard CLS ${cls} exceeds loading stability budget`);
   assert.deepEqual(f.errors,[]);console.log(`PASS ${width}px onboarding ${dismissed?'dismissed':'visible'}: CLS=${cls.toFixed(4)} under 4x CPU and 1.6Mbps`);
  }finally{await f.context.close();}
 }
}finally{await browser.close();}
