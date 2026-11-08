import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createUiContext, user, checkLayout } from './phase-ui-harness.mjs';
const origin=process.env.SMOKE_WEB_ORIGIN||'http://127.0.0.1:3000';
const themes=[['LUXURY_GOLD','luxury-gold','Luxury Gold'],['CLASSIC_BLUE','classic-blue','Classic Blue'],['CITY_SKY','city-sky','Manchester City'],['LONDON_RED','london-red','Arsenal'],['MERSEY_RED','mersey-red','Liverpool'],['MADRID_ROYAL','madrid-royal','Real Madrid'],['CATALAN_NIGHTS','catalan-nights','Barcelona'],['MUNICH_RED','munich-red','Bayern Munich'],['PARIS_NIGHT','paris-night','Paris Saint-Germain'],['MILAN_BLUE','milan-blue','Inter Milan'],['MILAN_RED','milan-red','AC Milan'],['TURIN_MONO','turin-mono','Juventus']];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const measurements=[];
try{
 for(const width of [390,1280]){
  const f=await createUiContext(browser,{width,direct:true,native:width<500,mode:'LIGHT',onMutation:(route,headers)=>{assert.equal(new URL(route.request().url()).pathname,'/api/telemetry/web-vitals');return route.fulfill({status:204,headers});}});
  try{
   await f.page.goto(origin+'/dashboard');await f.page.locator('h1').waitFor();
   await f.page.evaluate(()=>{
    const panel=document.createElement('section');panel.className='fc-panel';panel.id='color-contract';
    panel.innerHTML='<p class="theme-text">Primary text</p><p class="theme-secondary-text">Supporting text</p><p class="theme-muted">Helper text</p><button class="theme-primary-button">Continue</button><span class="theme-status-badge theme-tone-primary">Selected</span><span class="theme-status-badge theme-tone-success">Verified</span><span class="theme-status-badge theme-tone-danger">Rejected</span><span class="theme-status-badge theme-tone-premium">Award</span><input aria-label="Color test input" value="Readable form value" />';document.querySelector('.fc-main').append(panel);
    // Disable interpolation only for deterministic measurement, retaining all product styles.
    const style=document.createElement('style');style.nonce=document.querySelector('script[nonce]')?.nonce||'';style.textContent='*,*::before,*::after{transition:none!important}';document.head.append(style);
   });
   for(const mode of ['light','dark'])for(const [,theme] of themes){
    const result=await f.page.evaluate(({theme,mode,width})=>{
     document.documentElement.dataset.theme=theme;document.documentElement.dataset.mode=mode;
     const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
     const rgba=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].map((v,i)=>i===3?v/255:v);};
     const lum=c=>{const n=c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return .2126*n[0]+.7152*n[1]+.0722*n[2];};
     const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
     const bg=el=>{const layers=[];for(let n=el;n;n=n.parentElement){const c=rgba(getComputedStyle(n).backgroundColor);layers.push(c);if(c[3]===1)break;}let base=[255,255,255,1];for(const c of layers.reverse())base=[0,1,2].map(i=>c[i]*c[3]+base[i]*(1-c[3])).concat(1);return base;};
     const root=getComputedStyle(document.documentElement),resolve=(element,name)=>{const p=document.createElement('span');p.style.setProperty('color',`var(${name})`,'important');p.style.setProperty('transition','none','important');element.append(p);const c=rgba(getComputedStyle(p).color);p.remove();return c;};
     const pairs=[];for(const node of document.querySelector('#color-contract').children)if(node.tagName!=='INPUT')pairs.push({label:node.textContent,ratio:ratio(rgba(getComputedStyle(node).color),bg(node))});
     const input=document.querySelector('#color-contract input');pairs.push({label:'Form text',ratio:ratio(rgba(getComputedStyle(input).color),bg(input))});
     const controls=[{label:'Form border',ratio:ratio(rgba(getComputedStyle(input).borderTopColor),bg(input))}];
     const hero=document.querySelector('.premium-home-hero');for(const node of hero.querySelectorAll('h1,.theme-secondary-text'))for(const end of ['--theme-matchday-start','--theme-matchday-end'])pairs.push({label:'Hero '+node.tagName+' '+end,ratio:ratio(rgba(getComputedStyle(node).color),resolve(hero,end))});
     const cta=hero.querySelector('.theme-primary-button');pairs.push({label:'Hero action',ratio:ratio(rgba(getComputedStyle(cta).color),bg(cta))});
     const active=document.querySelector(width>=1024?'.theme-sidebar .theme-nav-item[data-active="true"]':'.theme-bottom-item[data-active="true"]');if(active)pairs.push({label:'Active navigation',ratio:ratio(rgba(getComputedStyle(active).color),bg(active))});
     const background=resolve(document.documentElement,'--theme-background');return {theme,mode,pairs,controls,backgroundLuminance:lum(background),surface:root.getPropertyValue('--theme-surface').trim()};
    },{theme,mode,width});
    for(const pair of result.pairs)assert(pair.ratio>=4.5,`${width} ${mode} ${theme}: ${pair.label} ${pair.ratio}`);
    for(const pair of result.controls)assert(pair.ratio>=3,`${width} ${mode} ${theme}: ${pair.label} ${pair.ratio}`);
    assert(mode==='light'?result.backgroundLuminance>.75:result.backgroundLuminance<.03,`${theme}: display mode must control page brightness`);
    measurements.push({width,...result});await checkLayout(f.page,`${width} ${theme} ${mode}`);
   }
   assert.deepEqual(f.errors,[]);console.log(`PASS ${width}px: 12 club palettes x 2 display modes; text, statuses, hero, active navigation and field contrast`);
  }finally{await f.context.close();}
 }
 for(const width of [390,1280]){
  let preference='LUXURY_GOLD';
  const f=await createUiContext(browser,{width,direct:true,native:width<500,mode:'LIGHT',overrides:{'/api/auth/me':(route,headers)=>route.fulfill({headers,json:{success:true,data:{user:{...user,themePreference:preference}},error:null}})},onMutation:(route,headers)=>{
   const request=route.request(),path=new URL(request.url()).pathname;
   if(path==='/api/auth/preferences/theme'){assert.equal(request.method(),'PATCH');preference=request.postDataJSON().themePreference;return route.fulfill({headers,json:{success:true,data:{themePreference:preference},error:null}});}
   assert.equal(path,'/api/telemetry/web-vitals');return route.fulfill({status:204,headers});
  }});
  try{
   await f.page.goto(origin+'/dashboard');await f.page.locator('h1').waitFor();
   for(const [pref,dataTheme,name] of themes){
    await f.page.getByRole('button',{name:'Choose club theme',exact:true}).click();
    await f.page.getByRole('dialog',{name:'Choose FC Arena club theme'}).getByRole('button',{name:new RegExp(name)}).click();
    await f.page.getByRole('dialog',{name:'Choose FC Arena club theme'}).waitFor({state:'hidden'});
    assert.equal(await f.page.locator('html').getAttribute('data-theme'),dataTheme);
    assert.equal(await f.page.evaluate(()=>localStorage.getItem('fc-arena-theme-preference')),pref);
    await f.page.getByRole('button',{name:'Switch to Dark Mode',exact:true}).click();assert.equal(await f.page.locator('html').getAttribute('data-mode'),'dark');
    await f.page.getByRole('button',{name:'Switch to Light Mode',exact:true}).click();assert.equal(await f.page.locator('html').getAttribute('data-mode'),'light');
   }
   assert.deepEqual(f.errors,[]);console.log(`PASS ${width}px: all club choices save, picker closes and Light/Dark controls work`);
  }finally{await f.context.close();}
 }
}finally{await browser.close();}
