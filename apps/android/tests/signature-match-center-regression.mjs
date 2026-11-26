// Read-only browser coverage with intercepted synthetic match data.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { createUiContext, checkLayout } from './phase-ui-harness.mjs';
import { phaseData } from './phase-ui-fixtures.mjs';
const origin=process.env.SMOKE_WEB_ORIGIN||'http://127.0.0.1:3000';
const output=process.env.SMOKE_OUTPUT||'/tmp/fcarena-mobile-ui';
mkdirSync(output,{recursive:true});
const base=phaseData['/api/matches/phase3'].match;
const submission={id:'verified-1',homeScore:3,awayScore:1,status:'CONFIRMED',source:'MANUAL',rejectionReason:null,createdAt:'2026-11-25T12:00:00Z',submittedBy:{id:'phase3',fullName:'Fixture Player',player:null},reviewedBy:{id:'fixture-admin',fullName:'Fixture Admin'}};
const states=[
  {key:'scheduled',match:base,submissions:[],confirmed:null,title:'Match Room active',enter:true},
  {key:'ready',match:{...base,readiness:{...base.readiness,homeReady:true,awayReady:true,bothReady:true}},submissions:[],confirmed:null,title:'Both sides Ready · play the match',enter:true},
  {key:'review',match:base,submissions:[{...submission,status:'PENDING_VERIFICATION'}],confirmed:null,title:'Result submitted · awaiting verification',enter:false},
  {key:'verified',match:{...base,status:'COMPLETED'},submissions:[submission],confirmed:submission.id,title:'Verified result · Match Room locked',enter:false},
  {key:'cancelled',match:{...base,status:'CANCELLED'},submissions:[],confirmed:null,title:'Match cancelled',enter:false},
  {key:'locked',match:{...base,returnLeg:{canUpload:false,firstLegMatchId:null,firstLegFixtureCode:'F0',firstLegScore:null,message:'First leg requires verification'}},submissions:[],confirmed:null,title:'First-leg verification required',enter:false}
];
const themes=['LUXURY_GOLD','CLASSIC_BLUE','CITY_SKY','LONDON_RED','MERSEY_RED','MADRID_ROYAL','CATALAN_NIGHTS','MUNICH_RED','PARIS_NIGHT','MILAN_BLUE','MILAN_RED','TURIN_MONO'];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});
let count=0;
async function run(theme,mode,width,state){
 const f=await createUiContext(browser,{width,native:width<=430,direct:true,theme,mode,overrides:{
   '/api/matches/phase3':{match:state.match},
   '/api/matches/phase3/results':{isLeagueAdmin:false,canVerifyResult:false,confirmedResultSubmissionId:state.confirmed,submissions:state.submissions}
 }});
 try{
  await f.page.goto(origin+'/matches/phase3');
  const board=f.page.getByRole('region',{name:'Match scoreboard'});
  await board.waitFor();
  const task=f.page.getByRole('region',{name:'Match actions'});
  if(state.largeText)await f.page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
  assert.equal(await board.getAttribute('data-match-state'),state.key);
  assert.equal(await task.getAttribute('data-match-state'),state.key);
  assert(await task.getByText(state.title,{exact:true}).isVisible());
  assert.equal(await task.getByRole('link',{name:'Enter score',exact:true}).count(),state.enter?1:0);
  const scores=board.locator('.fc-signature-score');
  if(state.key==='verified') assert.deepEqual(await scores.allTextContents(),['3','1']);
  else assert.equal(await scores.count(),0,'unverified score must not appear as official');
  if(state.key==='review') assert(await task.getByRole('link',{name:'Review submissions'}).isVisible());
  if(state.key==='ready') {
   const summary=board.getByText('Both Ready',{exact:true});
   const summaryBox=await summary.boundingBox();
   const teamsBox=await board.locator('.fc-match-room-score-grid').boundingBox();
   assert(summaryBox && teamsBox && summaryBox.y>=teamsBox.y+teamsBox.height,'readiness summary must not overlap team names');
  }
  await checkLayout(f.page,theme+' '+mode+' '+state.key+' '+width);
  if(state.key==='verified'||theme==='LUXURY_GOLD') await f.page.screenshot({path:join(output,'signature-match-'+theme.toLowerCase()+'-'+mode.toLowerCase()+'-'+width+'-'+(state.label||state.key)+'.png'),animations:'disabled'});
  assert.deepEqual(f.errors,[]);
  assert.deepEqual(f.mutations,[]);
  count++;
 }finally{await f.context.close();}
}
try{
 for(const theme of themes)for(const mode of ['LIGHT','DARK'])await run(theme,mode,390,states[3]);
 for(const state of states)for(const [width,mode] of [[320,'LIGHT'],[1280,'DARK']])await run('LUXURY_GOLD',mode,width,state);
 const home={...base.fixture.homeRegistration,entryName:'HomeClubWithAVeryLongUnbrokenNameThatMustStayInsideTheScoreboard'};
 const away={...base.fixture.awayRegistration,entryName:'Away Club With A Long Competition Entry Name And International Characters தமிழ்'};
 const large={...states[1],label:'ready-large-text',largeText:true,match:{...states[1].match,fixture:{...base.fixture,homeRegistration:home,home,awayRegistration:away,away}}};
 for(const width of [320,768,1280])await run('LUXURY_GOLD','LIGHT',width,large);
 console.log('PASS Signature Match Center: '+count+' theme, state and layout cases');
}finally{await browser.close();}
