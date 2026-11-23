// Real browser UI against local source. Every API request uses synthetic data.
import assert from 'node:assert/strict';
import {existsSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createUiContext,checkLayout,user} from './phase-ui-harness.mjs';
import {phaseData,tournament} from './phase-ui-fixtures.mjs';
import {makeFixtureFeed} from './fixture-feed-fixtures.mjs';
const chrome=process.env.CHROMIUM_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'/usr/bin/google-chrome');
const browser=await chromium.launch({headless:true,executablePath:existsSync(chrome)?chrome:undefined});
const home={id:'duo-home',entryName:'Alpha Duo',members:[{id:'phase3',fullName:'Home A',inGameName:'Home A'},{id:'second-home',fullName:'Home B',inGameName:'Home B '+ 'Champion'.repeat(8)}]};
const away={id:'duo-away',entryName:'Beta Duo',members:[{id:'away-a',fullName:'Away A',inGameName:'Away A'},{id:'away-b',fullName:'Away B',inGameName:'Away B'}]};
const cup={...tournament,mode:'DUO',duoAggregateEnabled:true,duoGamesPerFixture:4,status:'ACTIVE',teamSize:2};
const ok=(route,headers,data,status=200)=>route.fulfill({status,headers,json:{success:true,data,error:null}});
try {
 for(const width of [320,390,1280]) {
  let games=[],revision=0,puts=0,submits=0,confirms=0,failed=false,confirmed=false,submissions=[];
  const summary=()=>({revision,games,requiredGames:4,completedGames:games.length,homeScore:games.reduce((n,g)=>n+g.homeGoals,0),awayScore:games.reduce((n,g)=>n+g.awayGoals,0),complete:games.length===4});
  const context=()=>({home,away,gameCount:4,progress:summary()});
  const match=()=>({...phaseData['/api/matches/phase3'].match,tournament:cup,isLeagueAdmin:true,status:confirmed?'COMPLETED':'LIVE',fixture:{...phaseData['/api/matches/phase3'].match.fixture,home,away}});
  const f=await createUiContext(browser,{width,native:width<500,overrides:{
   '/api/matches/phase3':(route,headers)=>ok(route,headers,{match:match()}),
   '/api/matches/phase3/results':(route,headers)=>ok(route,headers,{isLeagueAdmin:true,canVerifyResult:true,canSubmitResult:true,isParticipant:true,confirmedResultSubmissionId:confirmed?'saved-fixture':null,submissions,duoContext:confirmed?null:context()}),
   '/api/leagues/phase3/fixture-feed':(route,headers)=>ok(route,headers,makeFixtureFeed('phase3',[cup],{phase3:[{...phaseData['/api/tournaments/phase3/fixtures'].fixtures[0],homeRegistration:home,awayRegistration:away,match:{id:'phase3',status:'LIVE',confirmedResult:null}}]})),
  },onMutation:(route,headers)=>{
   const path=new URL(route.request().url()).pathname,body=route.request().postDataJSON();
   if(path==='/api/matches/phase3/duo-games'){
    puts++;assert.equal(route.request().method(),'PUT');
    if(width===320&&!failed){failed=true;return route.fulfill({status:503,headers,json:{success:false,error:{code:'TEST_OFFLINE',message:'Temporary connection problem'}}});}
    const existing=games.find(g=>g.homePlayerId===body.homePlayerId&&g.awayPlayerId===body.awayPlayerId);
    if(body.expectedVersion!==(existing?.version??0))return route.fulfill({status:409,headers,json:{success:false,error:{code:'STALE_GAME',message:'This game was updated elsewhere. Reload its saved score before changing it.'}}});
    games=games.filter(g=>g!==existing);games.push({homePlayerId:body.homePlayerId,awayPlayerId:body.awayPlayerId,homeGoals:body.homeGoals,awayGoals:body.awayGoals,version:(existing?.version??0)+1});revision++;
    return ok(route,headers,{progress:summary()});
   }
   if(path==='/api/matches/phase3/results'){
    submits++;assert.equal(body.duoGames.length,4);assert.equal(body.homeScore,9);assert.equal(body.awayScore,6);
    submissions=[{id:'saved-fixture',...body,status:'PENDING_VERIFICATION',source:'MANUAL',rejectionReason:null,createdAt:new Date().toISOString(),submittedBy:{id:user.id,fullName:user.fullName,player:user.player},reviewedBy:null}];
    return ok(route,headers,{submission:{id:'saved-fixture'},message:'Awaiting verification'},201);
   }
   assert.equal(path,'/api/results/saved-fixture/confirm');confirms++;confirmed=true;submissions[0].status='CONFIRMED';submissions[0].reviewedBy={id:user.id,fullName:user.fullName};
   return ok(route,headers,{message:'Fixture verified'},201);
  }});
  try {
   const page=f.page;await page.goto('https://fcarena.in/matches/phase3');
   let panel=page.getByRole('form',{name:'Individual Duo results'});await panel.waitFor();
   const input=(game,side)=>panel.getByLabel(`Game ${game} ${side} goals`,{exact:true});
   const save=game=>panel.getByRole('button',{name:`Save game ${game}`,exact:true});
   const finish=()=>panel.getByRole('button',{name:'Verify fixture & update stats',exact:true});
   assert.equal(await finish().isDisabled(),true);
   await input(2,'home').fill('3');await input(2,'away').fill('1');
   await input(1,'home').fill('0');await save(1).click();assert.equal(puts,0);
   await input(1,'away').fill('0');await save(1).click();
   if(width===320){await panel.getByRole('alert').filter({hasText:'Temporary connection problem'}).waitFor();assert.equal(await input(1,'home').inputValue(),'0');await save(1).click();}
   await panel.getByText('1 of 4 games saved',{exact:true}).waitFor();
   assert.equal(await input(2,'home').inputValue(),'3');assert.equal(await input(2,'away').inputValue(),'1');
   await page.reload();await panel.waitFor();await panel.getByText('1 of 4 games saved',{exact:true}).waitFor();assert.equal(await input(1,'home').inputValue(),'0');
   await input(2,'home').fill('3');await input(2,'away').fill('1');await save(2).click();await panel.getByText('2 of 4 games saved',{exact:true}).waitFor();
   await input(3,'home').fill('4');await input(3,'away').fill('3');
   // A second editor saves this pairing while this browser still has version 0.
   games.push({homePlayerId:'second-home',awayPlayerId:'away-a',homeGoals:9,awayGoals:0,version:1});revision++;
   await save(3).click();await panel.getByRole('alert').filter({hasText:'updated elsewhere'}).waitFor();assert.equal(await input(3,'home').inputValue(),'4');
   await panel.getByRole('button',{name:'Use saved score for game 3',exact:true}).click();assert.equal(await input(3,'home').inputValue(),'9');
   await input(3,'home').fill('4');await input(3,'away').fill('3');await save(3).click();await panel.getByText('3 of 4 games saved',{exact:true}).waitFor();
   await input(4,'home').fill('1');await input(4,'away').fill('2');await save(4).click();await panel.getByText('4 of 4 games saved',{exact:true}).waitFor();
   assert.equal(await finish().isEnabled(),true);await input(1,'home').fill('1');assert.equal(await finish().isDisabled(),true);
   await panel.getByText('Saved total: 8 – 6',{exact:true}).waitFor();await save(1).click();await panel.getByText('Saved total: 9 – 6',{exact:true}).waitFor();
   await checkLayout(page,`Duo per-game save ${width}`);
   assert.deepEqual(await panel.locator('input, label, legend').evaluateAll(nodes=>nodes.filter(node=>node.getBoundingClientRect().right>innerWidth+1||node.getBoundingClientRect().left<0).map(node=>node.tagName)),[],'Long player names must not push score controls outside the viewport');
   if(process.env.DUO_SMOKE_OUTPUT){mkdirSync(process.env.DUO_SMOKE_OUTPUT,{recursive:true});await page.screenshot({path:`${process.env.DUO_SMOKE_OUTPUT}/duo-games-${width}.png`,fullPage:true});}
   if(width===390){
    // The fixtures inline editor uses the same durable game progress.
    await page.goto('https://fcarena.in/fixtures');await page.getByRole('button',{name:'Update Result',exact:true}).click();
    panel=page.getByRole('form',{name:'Individual Duo results'});await panel.getByText('4 of 4 games saved',{exact:true}).waitFor();
    await checkLayout(page,'Duo fixtures inline 390');
   }
   await finish().click();await panel.waitFor({state:'hidden'});assert.equal(submits,1);assert.equal(confirms,1);assert.deepEqual(f.errors,[]);
   console.log(`PASS ${width}px: independent saves, 0–0, preserved inputs, refresh persistence, stale-editor conflict, saved totals and one final verification${width===390?', fixtures inline editor':''}`);
  }finally{await f.context.close();}
 }
}finally{await browser.close();}
