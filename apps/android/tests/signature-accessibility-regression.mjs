// Rendered acceptance uses synthetic intercepted data and never contacts production.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createUiContext, checkLayout } from './phase-ui-harness.mjs';
import { phaseData } from './phase-ui-fixtures.mjs';

const origin=process.env.SMOKE_WEB_ORIGIN||'http://127.0.0.1:3000';
const outputRoot=process.env.SMOKE_OUTPUT||'/tmp/fcarena-mobile-ui';
mkdirSync(outputRoot,{recursive:true});
const output=mkdtempSync(join(outputRoot,'signature-accessibility-'));
const themes=['LUXURY_GOLD','CLASSIC_BLUE','CITY_SKY','LONDON_RED','MERSEY_RED','MADRID_ROYAL','CATALAN_NIGHTS','MUNICH_RED','PARIS_NIGHT','MILAN_BLUE','MILAN_RED','TURIN_MONO'];
const match=phaseData['/api/matches/phase3'].match;
const submission={id:'signature-confirmed',homeScore:3,awayScore:1,status:'CONFIRMED',source:'MANUAL',rejectionReason:null,createdAt:'2026-11-25T12:00:00Z',submittedBy:{id:'phase3',fullName:'Fixture Player',player:null},reviewedBy:{id:'fixture-admin',fullName:'Fixture Admin'}};
const overrides={
 '/api/matches/phase3':{match:{...match,status:'COMPLETED'}},
 '/api/matches/phase3/results':{isLeagueAdmin:false,canVerifyResult:false,confirmedResultSubmissionId:submission.id,submissions:[submission]},
};
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});
const results=[];
try {
 for(const theme of themes)for(const mode of ['LIGHT','DARK']){
  const f=await createUiContext(browser,{width:390,native:true,direct:true,theme,mode,overrides});
  try{
   for(const route of ['/dashboard','/matches/phase3']){
    await f.page.goto(origin+route);
    await f.page.locator(route==='/dashboard'?'.premium-home-hero':'.fc-signature-score').first().waitFor();
    await checkLayout(f.page,theme+' '+mode+' '+route);
    const audit=await new AxeBuilder({page:f.page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
    results.push({theme,mode,route,violations:audit.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),incomplete:audit.incomplete.map(v=>v.id)});
   }
   assert.deepEqual(f.errors,[]);assert.deepEqual(f.mutations,[]);
  }finally{await f.context.close();}
 }
 // Reflow, enlarged text, focus restoration/trapping and forced colors.
 for(const width of [320,768,1280]){
  const f=await createUiContext(browser,{width,direct:true,mode:'DARK'});
  try{
   await f.page.goto(origin+'/settings/appearance');
   await f.page.locator('.fc-signature-preview').last().waitFor();
   await f.page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
   await checkLayout(f.page,'200% text '+width);
   await f.page.screenshot({path:join(output,`signature-reflow-${width}.png`),fullPage:true,animations:'disabled'});
   await f.page.evaluate(()=>{document.documentElement.style.fontSize='';});
   const trigger=f.page.getByRole('button',{name:'Choose club theme'});
   await trigger.focus();await f.page.keyboard.press('Enter');
   const dialog=f.page.getByRole('dialog',{name:'Choose FC Arena club theme'});
   await dialog.waitFor();
   for(let i=0;i<30;i++){
    await f.page.keyboard.press('Tab');
    // Native dialog can send Tab to browser chrome; background page controls
    // must remain inert whenever the document itself owns keyboard focus.
    assert(await dialog.evaluate(e=>!document.hasFocus()||e.contains(document.activeElement)),'theme dialog keeps page focus inside the modal');
   }
   await f.page.keyboard.press('Escape');
   assert(await trigger.evaluate(e=>e===document.activeElement),'theme dialog restores keyboard focus');
   const outline=await trigger.evaluate(e=>{const s=getComputedStyle(e);return {style:s.outlineStyle,width:parseFloat(s.outlineWidth)};});
   assert(outline.style!=='none'&&outline.width>=2,'keyboard focus is visible');
   await f.page.emulateMedia({forcedColors:'active'});
   await f.page.screenshot({path:join(output,`signature-forced-colors-${width}.png`),fullPage:true,animations:'disabled'});
   assert.deepEqual(f.errors,[]);assert.deepEqual(f.mutations,[]);
  }finally{await f.context.close();}
 }
 for(const [native,reducedMotion] of [[false,'no-preference'],[false,'reduce'],[true,'no-preference']]){
  const f=await createUiContext(browser,{width:1280,native,direct:true,reducedMotion,overrides});
  try{
   await f.page.goto(origin+'/matches/phase3');await f.page.locator('.fc-signature-score').first().waitFor();
   const motion=await f.page.locator('.fc-signature-score').first().evaluate(e=>{const s=getComputedStyle(e);return {name:s.animationName,duration:s.animationDuration,iterations:s.animationIterationCount};});
   if(native||reducedMotion==='reduce')assert.equal(motion.name,'none','reduced motion and Android suppress score animation');
   else {assert(motion.name.includes('fc-confirmed-score-reveal'));assert(parseFloat(motion.duration)<=0.25);assert.equal(motion.iterations,'1');}
   await f.page.waitForTimeout(400);await checkLayout(f.page,'bounded score reveal');
  }finally{await f.context.close();}
 }
 assert.deepEqual(results.filter(r=>r.violations.length),[],'rendered WCAG violations (see signature-accessibility-results.json)');
 console.log(`PASS: ${results.length} rendered WCAG audits; reflow, keyboard, forced colors and bounded/reduced/native motion`);
} finally {writeFileSync(join(output,'signature-accessibility-results.json'),JSON.stringify(results,null,2),{flag:'wx',mode:0o600});await browser.close();}
