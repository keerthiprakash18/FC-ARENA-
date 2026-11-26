// Obsidian Matchday browser checks against local Web + intercepted API fixtures.
// No production data/account access or writes. Native viewport uses the same
// user agent employed by the Android WebView regression harness.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createUiContext, checkLayout } from './phase-ui-harness.mjs';

const origin = process.env.SMOKE_WEB_ORIGIN || 'http://127.0.0.1:3000';
const output = process.env.SMOKE_OUTPUT || '/tmp/fcarena-mobile-ui';
mkdirSync(output, { recursive: true });
const themes = [
  'luxury-gold', 'classic-blue', 'city-sky', 'london-red', 'mersey-red',
  'madrid-royal', 'catalan-nights', 'munich-red', 'paris-night',
  'milan-blue', 'milan-red', 'turin-mono',
];
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
try {
  for (const width of [360, 390, 430, 768, 1440]) for (const mode of ['LIGHT','DARK']) {
    const native = width <= 430;
    const fixture = await createUiContext(browser, {
      width, mode, theme: 'LUXURY_GOLD', native, direct: true, reducedMotion: 'reduce'
    });
    try {
      await fixture.page.goto(origin + '/dashboard');
      await fixture.page.locator('.premium-home-hero').waitFor();
      await fixture.page.locator('.home-core-actions').waitFor();
      const report = await fixture.page.evaluate(() => {
        const root = document.documentElement;
        const shell = document.querySelector('.fc-app-shell');
        const hero = document.querySelector('.premium-home-hero');
        const sidebar = document.querySelector('.theme-sidebar');
        const nav = document.querySelector('.theme-bottom-nav');
        return {
          mode: root.dataset.mode,
          theme: root.dataset.theme,
          canvas: getComputedStyle(root).getPropertyValue('--theme-background').trim(),
          sidebar: getComputedStyle(sidebar).backgroundColor,
          heroRadius: getComputedStyle(hero).borderRadius,
          horizontalOverflow: root.scrollWidth > innerWidth + 1,
          shell: Boolean(shell),
          visibleNav: Boolean(nav) && getComputedStyle(nav).display !== 'none',
          navDestinations: nav?.querySelectorAll('a').length ?? 0,
          primaryControls: document.querySelectorAll('.home-core-actions a').length,
        };
      });
      assert.equal(report.theme, 'luxury-gold');
      assert.equal(report.mode, mode.toLowerCase());
      assert.equal(report.canvas, mode === 'LIGHT' ? '#f5f6f4' : '#0c131c');
      assert.equal(report.sidebar, 'rgb(12, 23, 34)');
      assert(report.shell);
      assert(!report.horizontalOverflow, `Dashboard overflow at ${width} / ${mode}`);
      assert.equal(report.primaryControls, 4, 'Quick actions retain all four existing destinations');
      assert.equal(report.navDestinations, 5, 'All mobile nav destinations remain');
      if (width <= 768) assert(report.visibleNav, 'Mobile navigation must remain visible');
      await checkLayout(fixture.page, `Obsidian dashboard ${width} ${mode}`);

      // Verify all saved club themes and both modes still have valid colors,
      // no horizontal overrun and no focus trap across the current shell.
      if (width === 390) {
        const results = await fixture.page.evaluate(themes => {
          const root = document.documentElement, issues = [];
          const before = { theme: root.dataset.theme, mode: root.dataset.mode };
          for (const theme of themes) for (const mode of ['light','dark']) {
            root.dataset.theme = theme;
            root.dataset.mode = mode;
            const styles = getComputedStyle(root);
            if (!styles.getPropertyValue('--theme-text').trim()) issues.push(`missing text: ${theme}/${mode}`);
            if (!styles.getPropertyValue('--theme-surface').trim()) issues.push(`missing surface: ${theme}/${mode}`);
            if (root.scrollWidth > innerWidth + 1) issues.push(`overflow: ${theme}/${mode}`);
          }
          root.dataset.theme = before.theme;
          root.dataset.mode = before.mode;
          return issues;
        }, themes);
        assert.deepEqual(results, [], 'All twelve themes must fit 390px');
      }
      await fixture.page.screenshot({
        path: join(output, `obsidian-dashboard-${mode.toLowerCase()}-${width}.png`),
        fullPage: true, animations: 'disabled'
      });
      assert.deepEqual(fixture.mutations, [], 'Design inspection must not trigger API writes');
      assert.deepEqual(fixture.errors, [], 'No JavaScript/fixture errors on Dashboard');
      console.log(`PASS dashboard ${width}px ${mode} with ${native ? 'Android WebView' : 'web'} layout`);
    } finally {
      await fixture.context.close();
    }
  }

  // Headings in Admin and other routine destinations must not inherit the
  // old dark stadium treatment. The details of the admin data remain mocked.
  for (const width of [390, 1440]) {
    const fixture = await createUiContext(browser, {
      width, mode: 'LIGHT', theme: 'LUXURY_GOLD', native: width < 500, direct: true,
      reducedMotion: 'reduce',
    });
    try {
      await fixture.page.goto(origin + '/admin/tournaments');
      const heading = fixture.page.locator('.fc-page-heading');
      await heading.waitFor();
      const background = await heading.evaluate(el => getComputedStyle(el).backgroundImage);
      assert.equal(background, 'none', 'Admin headings should be editorial, not stadium heroes');
      const search=fixture.page.getByRole('searchbox',{name:'Find a tournament'});
      await search.waitFor();
      await fixture.page.getByRole('heading',{name:'Responsive Cup',exact:true}).waitFor();
      await search.fill('no-such-tournament');
      await fixture.page.getByRole('heading',{name:'No matching tournaments',exact:true}).waitFor();
      assert.equal(await fixture.page.getByRole('heading',{name:'Responsive Cup',exact:true}).count(),0);
      await search.fill('PHASE3');
      await fixture.page.getByRole('heading',{name:'Responsive Cup',exact:true}).waitFor();
      assert.equal(await fixture.page.getByRole('link',{name:'Overview',exact:true}).filter({hasText:'Overview'}).count()>=1,true);
      await search.fill('');
      await checkLayout(fixture.page, `Obsidian admin ${width}`);
      await fixture.page.screenshot({
        path: join(output, `obsidian-admin-${width}.png`),
        fullPage: true, animations: 'disabled'
      });
      assert.deepEqual(fixture.mutations, [], 'Admin design review is read-only');
      console.log(`PASS admin editorial header ${width}px`);
    } finally {
      await fixture.context.close();
    }
  }
  for (const width of [320,390,1280]) for (const mode of ['LIGHT','DARK']) {
    const fixture=await createUiContext(browser,{width,mode,theme:'LUXURY_GOLD',native:width<500,direct:true,reducedMotion:'reduce'});
    try {
      const page=fixture.page;await page.goto(origin+'/fixtures');
      const controls=page.getByRole('group',{name:'Filter matches by status'});await controls.waitFor();
      const buttons=controls.getByRole('button');assert.equal(await buttons.count(),4);
      const scope=page.getByRole('group',{name:'Match scope'});await scope.waitFor();
      assert.equal(await scope.getByRole('button').count(),2);
      await page.locator('.premium-filter-workbench summary').click();
      const leagueSelect=page.getByLabel('League',{exact:true});
      await leagueSelect.waitFor();
      assert((await leagueSelect.boundingBox()).height>=44,'League filter must retain a finger-sized target');
      await page.locator('.premium-filter-workbench summary').click();
      const sizes=await buttons.evaluateAll(nodes=>nodes.map(node=>{const s=getComputedStyle(node),r=document.createRange();r.selectNodeContents(node);return{height:node.getBoundingClientRect().height,textHeight:r.getBoundingClientRect().height,lineHeight:parseFloat(s.lineHeight),nowrap:s.whiteSpace};}));
      assert(sizes.every(size=>size.height>=44&&size.nowrap==='nowrap'&&size.textHeight<=size.lineHeight+2),'Filter labels must fit on one line with finger-sized controls');
      assert.equal(await controls.locator('[aria-pressed="true"]').count(),1);
      await controls.getByRole('button',{name:'COMPLETED',exact:true}).click();
      assert.equal(await controls.getByRole('button',{name:'COMPLETED',exact:true}).getAttribute('aria-pressed'),'true');
      await controls.getByRole('button',{name:'ALL',exact:true}).click();
      await controls.getByRole('button',{name:'ALL',exact:true}).focus();
      await page.keyboard.press('Tab');
      const focus=await controls.getByRole('button',{name:'UPCOMING',exact:true}).evaluate(el=>{const s=getComputedStyle(el);return{style:s.outlineStyle,width:parseFloat(s.outlineWidth)};});
      assert(focus.style!=='none'&&focus.width>=2,'Keyboard selection needs a visible focus ring');
      const badge=page.locator('.theme-status-badge').filter({hasText:/^SCHEDULED$/}).first();
      await badge.waitFor();assert.equal(await badge.evaluate(el=>getComputedStyle(el).flexShrink),'0');
      await checkLayout(page,`Refined fixtures ${width} ${mode}`);
      const palettes=await page.evaluate(themes=>{
        const root=document.documentElement,button=document.querySelector('.fc-fixture-filter[aria-pressed="true"]'),before={theme:root.dataset.theme,mode:root.dataset.mode};
        const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number);
        const luma=rgb=>rgb.slice(0,3).reduce((sum,v,i)=>sum+(v/255<=.04045?v/255/12.92:((v/255+.055)/1.055)**2.4)*[.2126,.7152,.0722][i],0);
        const issues=[];
        for(const theme of themes)for(const mode of ['light','dark']){
          root.dataset.theme=theme;root.dataset.mode=mode;
          let bg=mode==='light'?[255,255,255]:[0,0,0];const ancestors=[];
          for(let el=button;el;el=el.parentElement)ancestors.unshift(el);
          for(const el of ancestors){const c=rgb(getComputedStyle(el).backgroundColor),a=c[3]??1;bg=bg.map((v,i)=>(c[i]??v)*a+v*(1-a));}
          const fg=luma(rgb(getComputedStyle(button).color)),back=luma(bg),ratio=(Math.max(fg,back)+.05)/(Math.min(fg,back)+.05);
          if(ratio<4.5)issues.push({theme,mode,ratio});
        }
        root.dataset.theme=before.theme;root.dataset.mode=before.mode;return issues;
      },themes);
      assert.deepEqual(palettes,[],'Selected filter text must remain readable across all club themes and both modes');
      const enlarged=await controls.evaluate(el=>{
        const root=document.documentElement,before=root.style.fontSize;root.style.fontSize='200%';
        const fits=[...el.querySelectorAll('button')].every(button=>button.scrollWidth<=button.clientWidth+1);
        root.style.fontSize=before;return fits;
      });
      assert(enlarged,'Status controls must expand with larger text');
      await page.emulateMedia({forcedColors:'active'});
      const ink=await page.locator('h1').first().evaluate(el=>{const s=getComputedStyle(el);return{color:s.color,fill:s.webkitTextFillColor};});
      assert.equal(ink.fill,ink.color,'High-contrast headings must use visible text fill');
      await page.emulateMedia({forcedColors:'none'});
      await page.screenshot({path:join(output,`refined-fixtures-${mode.toLowerCase()}-${width}.png`),fullPage:true,animations:'disabled'});
      assert.deepEqual(fixture.errors,[]);console.log(`PASS refined fixtures ${width}px ${mode}: labels, focus, selection, 24 theme/mode contrast pairs`);
    } finally {await fixture.context.close();}
  }
} finally {
  await browser.close();
}
