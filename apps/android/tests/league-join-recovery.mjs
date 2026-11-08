import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createUiContext, user, checkLayout } from './phase-ui-harness.mjs';
const origin=process.env.SMOKE_WEB_ORIGIN||'http://127.0.0.1:3102';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox']});
const ok=(r,h,data)=>r.fulfill({headers:h,json:{success:true,data,error:null}});
const fail=(r,h)=>r.fulfill({status:503,headers:h,json:{success:false,data:null,error:{code:'TEMPORARY',message:'Temporary connection interruption'}}});
const league={id:'phase3',name:'Approval League',code:'AL',logoUrl:null,description:null,region:'India',rules:null,membershipType:'PRIMARY',adminRole:'ADMIN',isSuperAdmin:false,members:20,maxMembers:100,pendingApplications:2,canManageMembers:true,canManageSettings:false,creator:{id:user.id,fullName:user.fullName,playerCode:'P3',inGameName:'Admin'}};
const telemetry=(r,h)=>{assert.equal(new URL(r.request().url()).pathname,'/api/telemetry/web-vitals');return r.fulfill({status:204,headers:h});};
let passed=0;
try{
 for(const width of [390,1280]){
  let homeAvailable=false,queueAvailable=false,posts=0;
  const rows=[1,2].map(i=>({id:`request-${i}`,user:{...user,id:`applicant-${i}`,fullName:`Applicant ${i}`,player:{playerCode:`NEW${i}`,identity:{inGameName:`Applicant ${i}`}}}}));
  const f=await createUiContext(browser,{width,direct:true,native:width<500,role:'USER',overrides:{
   '/api/leagues/phase3':(r,h)=>homeAvailable?ok(r,h,{league:{...league,pendingApplications:rows.length}}):fail(r,h),
   '/api/leagues/phase3/applications':(r,h)=>queueAvailable?ok(r,h,{applications:rows}):fail(r,h),
  },onMutation:(r,h)=>{if(new URL(r.request().url()).pathname==='/api/leagues/phase3/applications/request-1/approve'){posts++;rows.splice(rows.findIndex(row=>row.id==='request-1'),1);queueAvailable=false;return ok(r,h,{message:'League application approved.'});}return telemetry(r,h);}});
  try{
   await f.page.goto(origin+'/leagues/phase3');await f.page.getByRole('button',{name:'Try again',exact:true}).waitFor();assert.equal(new URL(f.page.url()).pathname,'/leagues/phase3');homeAvailable=true;await f.page.getByRole('button',{name:'Try again',exact:true}).click();
   await f.page.getByRole('link',{name:'Review 2 join requests',exact:true}).click();await f.page.waitForURL('**/leagues/phase3/settings#join-requests');
   await f.page.getByRole('button',{name:'Try again',exact:true}).waitFor();assert.equal(new URL(f.page.url()).pathname,'/leagues/phase3/settings');queueAvailable=true;await f.page.getByRole('button',{name:'Try again',exact:true}).click();
   const queue=f.page.locator('#join-requests');await queue.getByText('2 Pending',{exact:true}).waitFor();assert.equal(await queue.getByRole('button',{name:'Approve',exact:true}).count(),2);
   await queue.getByRole('button',{name:'Approve',exact:true}).first().click();await f.page.getByRole('button',{name:'Try again',exact:true}).waitFor();assert.equal(posts,1);queueAvailable=true;await f.page.getByRole('button',{name:'Try again',exact:true}).click();
   await queue.getByText('1 Pending',{exact:true}).waitFor();assert.equal(posts,1);assert.equal(await queue.getByText('Applicant 1',{exact:true}).count(),0);await checkLayout(f.page,'league join approvals '+width);assert.deepEqual(f.errors,[]);
   passed++;console.log(`PASS ${width}px league overview → join requests; 503 recovers in place; committed approval never replays`);
  }finally{await f.context.close();}
 }
 for(const adminRole of ['ADMIN',null]){
  let queueReads=0;
  const f=await createUiContext(browser,{width:390,direct:true,native:true,role:'USER',overrides:{'/api/leagues/phase3':{league:{...league,adminRole,canManageMembers:false,canManageSettings:false}},'/api/leagues/phase3/applications':(r,h)=>{queueReads++;return fail(r,h);}},onMutation:telemetry});
  try{await f.page.goto(origin+'/leagues/phase3/settings');await f.page.getByRole('heading',{name:'Settings',exact:true}).waitFor();assert.equal(queueReads,0);assert.equal(await f.page.locator('#join-requests').count(),0);assert.deepEqual(f.errors,[]);passed++;console.log(`PASS ${adminRole??'PLAYER'} without member-review permission retains settings without a forbidden queue request`);}finally{await f.context.close();}
 }
 console.log(JSON.stringify({passed}));
}finally{await browser.close();}
