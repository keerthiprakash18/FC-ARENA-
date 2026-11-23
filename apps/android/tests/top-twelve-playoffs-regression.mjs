// Synthetic API only: verify the organizer can select/save Top 12 Duo TEAMS.
import assert from 'node:assert/strict';
import {existsSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createUiContext,checkLayout} from './phase-ui-harness.mjs';
import {phaseData,tournament} from './phase-ui-fixtures.mjs';
const chrome=process.env.CHROMIUM_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'/usr/bin/google-chrome');
const browser=await chromium.launch({headless:true,executablePath:existsSync(chrome)?chrome:undefined});
try {
 for(const width of [320,390,1280]) {
  for(const approvedEntries of [14,11]) {
   let cup={...tournament,name:'Top Twelve Duo Cup',mode:'DUO',teamSize:2,duoAggregateEnabled:true,duoGamesPerFixture:4,status:'ACTIVE',maxEntries:14,approvedEntries,
    groupMode:'SINGLE_GROUP',competitionFormat:'GROUP_STAGE_KNOCKOUT',playoffSource:'OVERALL_STANDINGS',playoffSeedingBasis:'OVERALL_PERFORMANCE',playoffFormat:'PROTECTED_SEED',playoffQualifiersTotal:8,
    isLeagueAdmin:true,canManageSettings:true,canManageFixtures:true};
   let saves=0;
   const f=await createUiContext(browser,{width,native:width<500,overrides:{
    '/api/tournaments/phase3':(route,headers)=>route.fulfill({headers,json:{success:true,data:{tournament:cup},error:null}}),
    '/api/tournaments/phase3/groups':{groups:[]},
    '/api/tournaments/phase3/fixtures':{fixtures:phaseData['/api/tournaments/phase3/fixtures'].fixtures.map(f=>({...f,phase:'STAGE',group:null}))},
   },onMutation:(route,headers)=>{
    const path=new URL(route.request().url()).pathname;
    assert(['/api/tournaments/phase3/playoffs/league-settings','/api/tournaments/phase3/playoffs/enable-from-league'].includes(path));
    const body=route.request().postDataJSON();assert.equal(body.playoffQualifiersTotal,12);assert.equal(body.confirmation,cup.name);
    assert.equal(route.request().method(),path.endsWith('league-settings')?'PATCH':'POST');
    saves++;cup={...cup,...body,competitionFormat:'GROUP_STAGE_KNOCKOUT',playoffSource:'OVERALL_STANDINGS',playoffSeedingBasis:'OVERALL_PERFORMANCE'};
    return route.fulfill({headers,json:{success:true,data:{message:'Top 12 playoff rules saved'},error:null}});
   }});
   try {
    const page=f.page;await page.goto('https://fcarena.in/tournaments/phase3/playoffs');
    await page.getByRole('button',{name:'Edit playoff settings',exact:true}).click();
    const count=page.getByLabel('Qualifiers from final league table');
    if(approvedEntries<12) {
     assert.equal(await count.locator('option[value="12"]').count(),0);assert.equal(saves,0);await checkLayout(page,`Top 12 unavailable with 11 teams ${width}`);assert.deepEqual(f.errors,[]);continue;
    }
    await count.selectOption('12');
    const format=page.getByLabel('Playoff bracket format');
    const preview=page.getByLabel('Your selected playoff format preview');
    for(const kind of ['GLOBAL_SEEDED','PROTECTED_SEED','DOUBLE_CHANCE']) {
     await format.selectOption(kind);await preview.getByText(`Top 12 → ${kind==='GLOBAL_SEEDED'?'Global Seeded Knockout':kind==='PROTECTED_SEED'?'Protected Seed Knockout':'Double-Chance Playoffs'}`,{exact:true}).waitFor();
     if(kind==='DOUBLE_CHANCE') {assert.equal(await preview.getByText(/Byes to quarter-finals:/).count(),0);await preview.getByText('Top 4 seeds',{exact:true}).waitFor();}
     else {await preview.getByText('Byes to quarter-finals: #1, #2, #3, #4',{exact:true}).waitFor();await preview.getByText('PI1: #8 vs #9',{exact:true}).waitFor();await preview.getByText('QF1: #1 vs winner PI1',{exact:true}).waitFor();}
    }
    await format.selectOption('PROTECTED_SEED');await checkLayout(page,`Top 12 preview ${width}`);
    if(process.env.TOP12_SMOKE_OUTPUT){mkdirSync(process.env.TOP12_SMOKE_OUTPUT,{recursive:true});await page.screenshot({path:`${process.env.TOP12_SMOKE_OUTPUT}/top12-${width}.png`,fullPage:true});}
    await page.getByLabel('Type the exact tournament name to confirm').fill(cup.name);
    await page.getByRole('button',{name:'Save Playoff Changes',exact:true}).click();
    await page.getByRole('button',{name:'Edit playoff settings',exact:true}).waitFor();assert.equal(saves,1);
    await page.reload();await page.getByRole('button',{name:'Edit playoff settings',exact:true}).click();assert.equal(await count.inputValue(),'12');
    assert.equal(await page.getByRole('button',{name:'Save Playoff Changes',exact:true}).isDisabled(),true);
    if(width===390) {
     cup={...cup,competitionFormat:'LEAGUE_ROUND_ROBIN',playoffSource:'AUTO',playoffQualifiersTotal:null};
     await page.goto('https://fcarena.in/tournaments/phase3');await page.getByRole('button',{name:'Configure playoffs',exact:true}).click();
     await page.getByLabel('Qualifiers from final league table').selectOption('12');await page.getByLabel('Playoff bracket format').selectOption('PROTECTED_SEED');
     await page.getByLabel('Type the exact tournament name to confirm').fill(cup.name);
     const saved=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/tournaments/phase3/playoffs/enable-from-league'&&response.request().method()==='POST');
     await page.getByRole('button',{name:'Save League + Playoffs',exact:true}).click();assert.equal((await saved).status(),200);assert.equal(saves,2);
    }
    assert.deepEqual(f.errors,[]);console.log(`PASS ${width}px: Top 12 Duo teams, four byes, three format previews, saved refresh${width===390?', league conversion':''}, no option with insufficient approved teams`);
   }finally{await f.context.close();}
  }
 }
}finally{await browser.close();}
