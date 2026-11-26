// Render exact app routes with disposable fixtures only. No production requests.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { createUiContext, checkLayout } from './phase-ui-harness.mjs';

const origin = process.env.SMOKE_WEB_ORIGIN || 'http://127.0.0.1:3000';
const output = process.env.SMOKE_OUTPUT || '/tmp/fcarena-mobile-ui';
mkdirSync(output,{recursive:true});
const themes = ['LUXURY_GOLD','CLASSIC_BLUE','CITY_SKY','LONDON_RED','MERSEY_RED','MADRID_ROYAL','CATALAN_NIGHTS','MUNICH_RED','PARIS_NIGHT','MILAN_BLUE','MILAN_RED','TURIN_MONO'];
const browser = await chromium.launch({ headless:true, executablePath:process.env.CHROMIUM_PATH || undefined });
try {
  for (const width of [390,1280]) for (const mode of ['LIGHT','DARK']) {
    const f=await createUiContext(browser,{width,native:width===390,direct:true,mode});
    try {
      await f.page.goto(origin+'/settings/appearance');
      const cards=f.page.locator('.fc-signature-preview');
      await cards.last().waitFor();
      assert.equal(await cards.count(),12);
      await f.page.waitForFunction(mode=>[...document.querySelectorAll('.fc-signature-preview')].every(e=>e.dataset.previewMode===mode),mode.toLowerCase());
      const samples=await cards.evaluateAll(els=>els.map(el=>({
        theme:el.dataset.previewTheme,
        art:getComputedStyle(el.querySelector('.fc-signature-art')).backgroundImage,
        sample:getComputedStyle(el.querySelector('.fc-signature-sample')).backgroundColor
      })));
      assert.equal(new Set(samples.map(x=>x.art)).size,12,'every signature has distinct rendered artwork');
      if(mode==='DARK') assert(new Set(samples.map(x=>x.sample)).size>=10,'dark surfaces must be distinct');
      await checkLayout(f.page,'Signature gallery '+width+' '+mode);
      await f.page.screenshot({path:join(output,'signature-gallery-'+width+'-'+mode.toLowerCase()+'.png'),fullPage:true,animations:'disabled'});
      assert.deepEqual(f.errors,[]);
      assert.deepEqual(f.mutations,[]);
    } finally { await f.context.close(); }
  }
  for(const mode of ['LIGHT','DARK']){
    const art=[];
    for(const theme of themes){
      const f=await createUiContext(browser,{width:390,native:true,direct:true,theme,mode});
      try {
        await f.page.goto(origin+'/dashboard');
        const hero=f.page.locator('.premium-home-hero').first();
        await hero.waitFor();
        const colors=await hero.evaluate(el=>({ image:getComputedStyle(el).backgroundImage, accent:getComputedStyle(el).getPropertyValue('--theme-matchday-accent').trim(), rootTheme:document.documentElement.dataset.theme }));
        assert.equal(colors.rootTheme,theme.toLowerCase().replaceAll('_','-'));
        assert(colors.image!=='none' && colors.accent.length>0);
        art.push(colors.image);
        await checkLayout(f.page,theme+' '+mode);
        await f.page.screenshot({path:join(output,'signature-home-'+theme.toLowerCase()+'-'+mode.toLowerCase()+'.png'),animations:'disabled'});
        assert.deepEqual(f.errors,[]);
        assert.deepEqual(f.mutations,[]);
      } finally { await f.context.close(); }
    }
    assert.equal(new Set(art).size,12,'actual dashboard hero backgrounds must differ, not just swatches');
  }
  console.log('PASS: 4 appearance galleries and 24 actual dashboard theme/mode cases');
} finally { await browser.close(); }
