import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createUiContext, checkLayout } from './phase-ui-harness.mjs';
import { phaseData } from './phase-ui-fixtures.mjs';
const browser = await chromium.launch({headless:true, executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',args:['--no-sandbox']});
try {
 for (const width of [360,1280]) {
  let created;
  let revision=0, calls=0, pending=null;
  const base=phaseData['/api/ballon/seasons/phase3/rankings'];
  const season={...base.season,status:'LIVE',maximumMatches:25,rankingLimit:20,tournamentRequirements:{SOLO:0,DUO:0,TEAM:0}};
  const {context,page,errors}=await createUiContext(browser,{width,mode:'DARK',overrides:{
   '/api/leagues/my':{leagues:[{adminRole:'OWNER',league:{id:'phase3',name:'Arena League',code:'P3'}}]},
   '/api/ballon/seasons':(route,headers)=>route.fulfill({headers,json:{success:true,data:{seasons:revision?[{...season,name:'Refreshed Live Season'}]:[]},error:null}}),
   '/api/ballon/seasons/phase3/players/phase3':(route,headers)=>route.fulfill({headers,json:{success:true,data:{season,ranking:{...base.rows[0],fullName:revision?'Refreshed Player':'Initial Player'}},error:null}}),
   '/api/ballon/seasons/phase3/rankings':async(route,headers)=>{
    calls++;
    if(pending) await pending;
    return route.fulfill({headers,json:{success:true,data:{season,rows:[{...base.rows[0],rating:75+revision}]},error:null}});
   },
  },onMutation:(route,headers)=>{
   if(new URL(route.request().url()).pathname==='/api/telemetry/web-vitals') return route.fulfill({status:204,headers});
   assert.equal(new URL(route.request().url()).pathname,'/api/admin/ballon/seasons');
   created=route.request().postDataJSON();
   return route.fulfill({headers,json:{success:true,data:{season:{...created,id:'new',status:'DRAFT'}},error:null}});
  }});
  await page.goto('https://fcarena.in/admin/ballon');
  const min=page.getByLabel('Minimum Matches for Eligibility');
  const max=page.getByLabel('Maximum Matches Counted');
  const save=page.getByRole('button',{name:'Create Draft Season',exact:true});
  await page.getByLabel('Season Name').fill('Custom Count Season');
  await max.fill('10');
  await max.press('Control+A'); await max.press('Backspace');
  assert.equal(await max.inputValue(),''); assert.equal(await save.isDisabled(),true);
  await max.pressSequentially('25'); assert.equal(await max.inputValue(),'25');
  for(const value of ['9','201','12.5','0','-1']) {
   await max.fill(value); assert.equal(await save.isDisabled(),true,`invalid max ${value}`);
  }
  await max.fill('25'); await min.fill(''); assert.equal(await min.inputValue(),'');
  assert.equal(await save.isDisabled(),true);
  await min.pressSequentially('12');
  await page.getByRole('button',{name:'2 Months',exact:true}).click();
  assert.equal(await min.inputValue(),'12'); assert.equal(await max.inputValue(),'25');
  await save.click(); await page.getByText('Ballon season created as DRAFT.',{exact:true}).waitFor();
  assert.equal(created.minimumMatches,12); assert.equal(created.maximumMatches,25);
  await checkLayout(page,`Ballon admin ${width}`);
  await page.goto('https://fcarena.in/awards/ballon/phase3');
  await page.getByText('75',{exact:true}).first().waitFor();
  let release;
  pending=new Promise(resolve=>{release=resolve;}); revision=1;
  const before=calls;
  await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(200); assert.equal(calls,before+1,'focus requests must not overlap');
  release(); pending=null;
  await page.getByText('76',{exact:true}).first().waitFor();
  revision=2;
  await page.getByText('77',{exact:true}).first().waitFor({timeout:15000});
  await checkLayout(page,`Ballon ranking ${width}`);
  revision=0;
  await page.goto('https://fcarena.in/awards/ballon/phase3/players/phase3');
  await page.getByRole('heading',{name:'Initial Player',exact:true,level:1}).waitFor();
  revision=1; await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.getByRole('heading',{name:'Refreshed Player',exact:true,level:1}).waitFor();
  revision=0; await page.goto('https://fcarena.in/awards/ballon');
  await page.getByText('No FC Arena Ballon seasons have been created yet.',{exact:false}).waitFor();
  revision=1; await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.getByText('Refreshed Live Season',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  await context.close();
  console.log(`PASS ${width}px: editable count, invalid count blocked, numeric save, presets preserved, focus and 10s ranking refresh with no overlap`);
 }
} finally {await browser.close();}
