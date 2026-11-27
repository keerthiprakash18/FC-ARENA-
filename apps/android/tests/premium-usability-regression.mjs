// Synthetic browser fixtures only; never contact production APIs.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createUiContext, checkLayout } from './phase-ui-harness.mjs';
const origin=process.env.SMOKE_WEB_ORIGIN||'http://127.0.0.1:3000';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});
try {
  for(const width of [320,390,768,1280]) {
    const f=await createUiContext(browser,{width,direct:true});
    try {
      const providers=f.page.waitForResponse(r=>r.url().includes('/auth/social/providers'));
      await f.page.goto(origin+'/login');
      await providers;
      const recovery=f.page.getByRole('link',{name:'Forgot password?',exact:true});
      await recovery.waitFor();
      const submit=f.page.getByRole('button',{name:'Sign In',exact:true});
      assert(await recovery.evaluate((e)=>Boolean(e.closest('form'))));
      assert((await recovery.boundingBox()).y<(await submit.boundingBox()).y,'recovery precedes sign-in');
      assert.equal(await f.page.getByRole('button',{name:/Continue with (Google|Facebook)/}).count(),0);
      await f.page.locator('#auth-password').focus();
      await f.page.keyboard.press('Tab'); // Show/hide password remains accessible.
      await f.page.keyboard.press('Tab');
      assert(await recovery.evaluate(e=>e===document.activeElement));
      await checkLayout(f.page,'Login recovery '+width);
    } finally {await f.context.close();}
  }
  const f=await createUiContext(browser,{width:390,direct:true,overrides:{'/api/auth/social/providers':{google:true,facebook:false}}});
  try {
    await f.page.goto(origin+'/login');
    await f.page.getByRole('button',{name:'Continue with Google'}).waitFor();
    assert.equal(await f.page.getByRole('button',{name:/Continue with Facebook/}).count(),0);
    await f.page.goto(origin+'/settings/appearance');
    const details=f.page.locator('.fc-signature-option details');
    await details.last().waitFor();assert.equal(await details.count(),12);
    assert.equal(await details.evaluateAll(els=>els.filter(e=>e.open).length),0);
    const first=details.first();const summary=first.locator('summary');
    await summary.focus();await f.page.keyboard.press('Enter');
    assert(await first.evaluate(e=>e.open));
    assert(await first.locator('p').last().isVisible());
    await f.page.keyboard.press('Enter');assert.equal(await first.evaluate(e=>e.open),false);
    assert.equal(await f.page.getByRole('button',{name:/Current theme:|Use theme:/}).count(),12);
    await checkLayout(f.page,'Compact theme gallery');
    assert.deepEqual(f.errors,[]);assert.deepEqual(f.mutations,[]);
  } finally {await f.context.close();}
  console.log('Premium usability: recovery keyboard/order, available providers and all 12 theme details passed');
} finally {await browser.close();}
