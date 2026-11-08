import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { createUiContext, user, checkLayout } from './phase-ui-harness.mjs';
import { tournament } from './phase-ui-fixtures.mjs';
const origin=process.env.SMOKE_WEB_ORIGIN||'http://127.0.0.1:3102';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox']});
const ok=(route,headers,data)=>route.fulfill({headers,json:{success:true,data,error:null}});
const memberships=[['arena-tamil','FC ARENA TAMIL','PRIMARY'],['kickoff','KICKOFF FC','SECONDARY']].map(([id,name,membershipType])=>({membershipType,adminRole:'ADMIN',league:{id,name,code:id}}));
const pending=Array.from({length:3},(_,i)=>({id:`pending-${i}`,entryName:`Pending team ${i}`,status:'PENDING',createdAt:'2026-11-07T12:00:00Z',reviewedAt:null,registeredBy:{...user,id:`player-${i}`},members:[{user:{...user,id:`player-${i}`}}]}));
const approved=Array.from({length:19},(_,i)=>({...pending[0],id:`approved-${i}`,entryName:`Approved team ${i}`,status:'APPROVED'}));
const telemetry=(route,headers)=>{assert.equal(new URL(route.request().url()).pathname,'/api/telemetry/web-vitals');return route.fulfill({status:204,headers});};
async function gesture(context,page,{x=180,y=170,dx=0,dy=150,cancel=false,release=true}={}){
 const cdp=await context.newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 for(let i=1;i<=6;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/6,y:y+dy*i/6}]});await page.waitForTimeout(20);}
 if(release)await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});
 return cdp;
}
await mkdir('.cache/registration-pull',{recursive:true});
let passes=0;
try{
 for(const width of [390,1280]){
  const rows=[...approved,...pending].map(row=>({...row}));let listReads=0,documents=0,refreshes=0,approvals=0;
  const cup=()=>({...tournament,name:'International Friendlies',code:'KICKOFF-CUP',leagueId:'kickoff',league:memberships[1].league,status:'REGISTRATION_OPEN',maxEntries:48,approvedEntries:rows.filter(r=>r.status==='APPROVED').length,pendingEntries:rows.filter(r=>r.status==='PENDING').length,registeredEntries:rows.length,isLeagueAdmin:true,canManageParticipants:true,canManageSettings:false,canManageAdmins:false});
  const f=await createUiContext(browser,{width,direct:true,native:width<500,role:'USER',overrides:{
   '/api/leagues/my':{leagues:memberships},
   '/api/leagues/arena-tamil/tournaments':{tournaments:[{...tournament,id:'empty-cup',name:'International Friendlies',code:'TAMIL-CUP',status:'REGISTRATION_OPEN',approvedEntries:0,pendingEntries:0,registeredEntries:0,canManageParticipants:false,maxEntries:48}]},
   '/api/leagues/kickoff/tournaments':(r,h)=>{listReads++;return ok(r,h,{tournaments:[cup()]});},
   '/api/auth/refresh':(r,h)=>{refreshes++;return ok(r,h,{accessToken:'fixture-only',expiresIn:3600});},
   '/api/tournaments/phase3':(r,h)=>ok(r,h,{tournament:cup()}),
   '/api/tournaments/phase3/registrations':(r,h)=>ok(r,h,{registrations:rows}),
  },onMutation:(r,h)=>{
   const path=new URL(r.request().url()).pathname;
   if(path==='/api/tournaments/phase3/registrations/pending-0/approve'){approvals++;rows.find(row=>row.id==='pending-0').status='APPROVED';return ok(r,h,{message:'Approved'});}
   return telemetry(r,h);
  }});
  f.page.on('request',r=>{if(r.isNavigationRequest()&&r.resourceType()==='document')documents++;});
  try{
   await f.page.goto(origin+'/tournaments');await f.page.getByText('TAMIL-CUP',{exact:true}).waitFor();
   await f.page.getByRole('button',{name:/KICKOFF FC/}).click();await f.page.waitForURL(url=>url.searchParams.get('leagueId')==='kickoff');await f.page.getByText('KICKOFF-CUP',{exact:true}).waitFor();
   assert.equal(new URL(f.page.url()).searchParams.get('leagueId'),'kickoff');await f.page.getByText('22 registered',{exact:true}).waitFor();await f.page.getByRole('link',{name:'Review 3 pending',exact:true}).waitFor();
   assert.equal(await f.page.getByRole('button',{name:'Delete Tournament',exact:true}).count(),0);
   assert.equal(await f.page.getByText('TAMIL-CUP',{exact:true}).count(),0);await checkLayout(f.page,'registration card '+width);
   await f.page.screenshot({path:`.cache/registration-pull/list-${width}.png`,fullPage:true});
   if(width<500){
    await f.page.evaluate(()=>scrollTo(0,0));const before={listReads,documents,refreshes};
    const cdp=await gesture(f.context,f.page,{release:false});await f.page.getByRole('status').filter({hasText:'Release to refresh'}).waitFor();
    await f.page.screenshot({path:'.cache/registration-pull/pull-ready.png'});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
    await f.page.getByText('KICKOFF-CUP',{exact:true}).waitFor();await f.page.waitForTimeout(1700);
    assert(listReads>before.listReads);assert.equal(documents,before.documents);assert.equal(refreshes,before.refreshes);assert.equal(new URL(f.page.url()).searchParams.get('leagueId'),'kickoff');
    passes++;console.log('PASS real touch pull refreshes current league in place and retains the auth session');
    for(const options of [{dy:50},{dx:120,dy:12},{cancel:true}]){const before=listReads;const d=await gesture(f.context,f.page,options);await d.detach();await f.page.waitForTimeout(150);assert.equal(listReads,before);}
    const button = await f.page.getByRole('button',{name:/KICKOFF FC/}).boundingBox();
    const beforeControls = listReads;
    const controls = await gesture(f.context,f.page,{x:button.x+button.width/2,y:button.y+button.height/2});await controls.detach();
    await f.page.evaluate(()=>{const box=document.createElement('div');box.id='nested-scroll-test';box.style.cssText='position:fixed;top:140px;left:120px;z-index:80;width:120px;height:80px;overflow-y:auto;background:#123';const content=document.createElement('div');content.style.height='300px';box.append(content);document.querySelector('#main-content').append(box);box.scrollTop=30;});
    const nested=await gesture(f.context,f.page,{x:160,y:170});await nested.detach();await f.page.evaluate(()=>document.querySelector('#nested-scroll-test').remove());
    await f.page.waitForTimeout(150);assert.equal(listReads,beforeControls);
    const readsBeforeIgnored=listReads;await f.page.evaluate(()=>scrollTo(0,400));const d=await gesture(f.context,f.page);await d.detach();await f.page.waitForTimeout(150);assert.equal(listReads,readsBeforeIgnored);await f.page.evaluate(()=>scrollTo(0,0));
    await f.context.setOffline(true);const off=await gesture(f.context,f.page);await off.detach();await f.page.waitForTimeout(150);assert.equal(listReads,readsBeforeIgnored);await f.context.setOffline(false);
    passes++;console.log('PASS short, horizontal, cancelled, button, nested-scroll, middle-page and offline gestures never refresh');
   }
   await f.page.getByRole('link',{name:'Review 3 pending',exact:true}).click();await f.page.waitForURL('**/tournaments/phase3/registration?view=pending#pending-approvals');
   await f.page.getByRole('button',{name:'Pending (3)',exact:true}).waitFor();assert.equal(await f.page.getByRole('button',{name:'Approve',exact:true}).count(),3);assert.equal(await f.page.getByText('Approved team 0',{exact:true}).count(),0);
   await f.page.getByRole('button',{name:'Approve',exact:true}).first().click();await f.page.getByRole('button',{name:'Pending (2)',exact:true}).waitFor();assert.equal(approvals,1);
   await f.page.getByRole('button',{name:'All registrations (22)',exact:true}).click();await f.page.getByText('Approved team 0',{exact:true}).waitFor();
   await checkLayout(f.page,'review queue '+width);assert.deepEqual(f.errors,[]);passes++;console.log(`PASS ${width}px correct league counts → pending queue → approval updates counts and the roster`);
   await f.page.goto(origin+'/tournaments');await f.page.getByText('KICKOFF-CUP',{exact:true}).waitFor();assert.equal(await f.page.getByText('TAMIL-CUP',{exact:true}).count(),0);
   await f.page.goto(origin+'/more');await f.page.locator('h1').waitFor();assert.equal(await f.page.getByText('Refresh app data',{exact:true}).count(),0);passes++;console.log(`PASS ${width}px More has no refresh card`);
  }finally{await f.context.close();}
 }
 const f=await createUiContext(browser,{width:390,direct:true,native:true,role:'USER',overrides:{'/api/leagues/my':{leagues:[memberships[1]]},'/api/leagues/kickoff/tournaments':{tournaments:[{...tournament,status:'REGISTRATION_OPEN',approvedEntries:0,pendingEntries:3,registeredEntries:3,canManageParticipants:false}]}},onMutation:telemetry});
 try{await f.page.goto(origin+'/tournaments');await f.page.getByText('3 registered',{exact:true}).waitFor();assert.equal(await f.page.getByRole('link',{name:/Review \d+ pending/}).count(),0);assert.deepEqual(f.errors,[]);passes++;console.log('PASS players see pending totals without administrative review controls');}finally{await f.context.close();}
 console.log(JSON.stringify({passes}));
}finally{await browser.close();}
