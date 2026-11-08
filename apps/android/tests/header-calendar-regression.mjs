import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {createUiContext,checkLayout} from './phase-ui-harness.mjs';
const origin=process.env.SMOKE_WEB_ORIGIN||'http://127.0.0.1:3000';
const direct=process.env.HEADER_DIRECT==='true',appOrigin=direct?origin:'https://fcarena.in';
const output=process.env.HEADER_SCREENSHOTS||'.cache/header-calendar/screenshots';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let checks=0;
try{
 for(const width of [320,360,390,430,560,640,768,1024,1280])for(const mode of ['LIGHT','DARK']){
  const {context,page,errors}=await createUiContext(browser,{width,mode,direct,native:width===390,onMutation:route=>{
   assert.equal(new URL(route.request().url()).pathname,'/api/telemetry/web-vitals');return route.fulfill({status:204});
  }});
  try{
   await page.goto(appOrigin+'/dashboard');const header=page.locator('header.theme-top-header');
   const calendar=header.getByRole('link',{name:'Check-in Calendar',exact:true});await calendar.waitFor();
   assert.equal(await calendar.getAttribute('href'),'/experience#daily-check-in');
   const brand=header.getByRole('link',{name:'FC Arena Home',exact:true});
   if(await brand.isVisible()){const r=await brand.boundingBox();assert(r.width>=44&&r.height>=44,'The compact home logo keeps a full touch target');}
   assert(await header.getByRole('button',{name:/Switch to (Light|Dark) Mode/}).evaluate(el=>el.nextElementSibling?.getAttribute('aria-label')==='Check-in Calendar'));
   const targets=await header.locator('.fc-header-actions > a,.fc-header-actions > button').evaluateAll(nodes=>nodes.filter(el=>el.getClientRects().length).map(el=>{
    const r=el.getBoundingClientRect();return {label:el.getAttribute('aria-label'),x:r.x,y:r.y,width:r.width,height:r.height};
   }));
   const center=targets[0].y+targets[0].height/2;
   for(let i=0;i<targets.length;i++){
    const target=targets[i];assert(target.width>=44&&target.height>=44,`${width} ${mode}: ${JSON.stringify(target)} touch size`);
    assert(target.x>=0&&target.x+target.width<=width,`${width} ${mode}: ${target.label} is clipped`);
    assert(Math.abs(target.y+target.height/2-center)<1,`${width} ${mode}: controls must share a center line`);
    if(i)assert(target.x-(targets[i-1].x+targets[i-1].width)>=3.9,`${width} ${mode}: controls overlap or lack spacing`);
   }
   await checkLayout(page,`Header ${width} ${mode}`);
   await header.getByRole('button',{name:/Switch to (Light|Dark) Mode/}).click();
   await header.getByRole('button',{name:mode==='LIGHT'?'Switch to Light Mode':'Switch to Dark Mode'}).waitFor();
   await calendar.click();await page.getByRole('table',{name:'November 2026 check-in calendar'}).waitFor();
   assert(new URL(page.url()).hash==='#daily-check-in');
   const section=await page.locator('#daily-check-in').boundingBox(),bar=await header.boundingBox();
   assert(section.y>=bar.y+bar.height-1&&section.y<=bar.y+bar.height+100,`${width}: calendar anchor is hidden or offscreen (${section.y})`);
   assert.equal(await page.getByRole('dialog',{name:'Daily check-in',exact:true}).count(),0,'The shortcut remains available after collection without reopening the popup');
   await checkLayout(page,`Calendar ${width} ${mode}`);assert.deepEqual(errors,[]);
   if([320,390,1280].includes(width))await header.screenshot({path:`${output}/header-${width}-${mode.toLowerCase()}.png`});
   console.log(`PASS ${width}px ${mode}: calendar beside display toggle; aligned 44px controls, clear gaps, no clipping; opens visible calendar after collection.`);checks++;
  }finally{await context.close();}
 }
 console.log(`PASS ${checks} header/calendar layouts.`);
}finally{await browser.close();}
