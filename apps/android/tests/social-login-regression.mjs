import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';
import {createUiContext,checkLayout,user} from './phase-ui-harness.mjs';
const chrome=process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'/usr/bin/google-chrome';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(existsSync(chrome)?chrome:undefined)});
const ok=(route,headers,data)=>route.fulfill({headers,json:{success:true,data,error:null}});
const session={kind:'session',accessToken:'synthetic-only',expiresIn:900,user};
try {
  for(const width of [320,390,1280]) {
    let current={...user,dateOfBirth:null,phoneNumber:null},writes=0;
    const f=await createUiContext(browser,{width,overrides:{'/api/auth/me':(route,headers)=>ok(route,headers,{user:current})},onMutation:(route,headers)=>{
      const path=new URL(route.request().url()).pathname;
      if(path==='/api/auth/login')return ok(route,headers,{...session,user:current});
      assert.equal(path,'/api/auth/me/profile');writes++;
      const body=route.request().postDataJSON();assert.deepEqual(body,{dateOfBirth:'2000-02-29',phoneNumber:'+91 98765 43210'});
      if(width===320&&writes===1)return route.fulfill({headers,status:503,json:{success:false,error:{code:'TEST_UNAVAILABLE',message:'Temporary test interruption'}}});
      current={...current,dateOfBirth:body.dateOfBirth,phoneNumber:'+919876543210'};
      return ok(route,headers,{dateOfBirth:current.dateOfBirth,phoneNumber:current.phoneNumber});
    }});
    try {
      await f.page.goto('https://fcarena.in/login');
      await f.page.getByLabel('Email or Game Name',{exact:true}).fill(user.email);
      await f.page.getByLabel('Password',{exact:true}).fill('Fixture123!');
      await f.page.getByRole('button',{name:'Sign In',exact:true}).click();
      await f.page.waitForURL('**/profile/complete');
      const dob=f.page.getByLabel('Date of birth',{exact:true}),phone=f.page.getByLabel('WhatsApp number',{exact:true});
      await phone.waitFor();assert.equal(await f.page.getByText("I'll add it later",{exact:true}).count(),0);
      await dob.fill('2000-02-29');await f.page.getByRole('button',{name:'Save and continue',exact:true}).click();
      assert.equal(writes,0);assert.equal(await phone.evaluate(input=>input.required),true);
      await phone.fill('+91 98765 43210');await f.page.getByRole('button',{name:'Save and continue',exact:true}).click();
      if(width===320){await f.page.getByRole('alert').filter({hasText:'Temporary test interruption'}).waitFor();assert.equal(writes,1);assert.equal(await phone.inputValue(),'+91 98765 43210');await f.page.getByRole('button',{name:'Save and continue',exact:true}).click();}
      await f.page.waitForURL('**/dashboard');assert.equal(writes,width===320?2:1);assert.deepEqual(f.errors,[]);
      console.log(`PASS ${width}px: legacy login requires both private profile fields, no skip, save continues`);
    }finally{await f.context.close();}
    let registered=null;
    const registration=await createUiContext(browser,{width,onMutation:(route,headers)=>{
      assert.equal(new URL(route.request().url()).pathname,'/api/auth/register');registered=route.request().postDataJSON();
      return ok(route,headers,{message:'Registration successful',player:{playerCode:'NEW'}});
    }});
    try {
      const page=registration.page;await page.goto('https://fcarena.in/register');
      await page.getByLabel('Full Name',{exact:true}).fill('New Player');await page.getByLabel('Email',{exact:true}).fill('new@example.invalid');
      await page.getByLabel('In-Game Name',{exact:true}).fill('NewPlayer');await page.getByLabel('Password',{exact:true}).fill('Fixture123!');
      await page.getByLabel('Confirm Password',{exact:true}).fill('Fixture123!');
      assert.equal(await page.locator('form').evaluate(form=>form.checkValidity()),false);
      await page.getByLabel('Date of birth',{exact:true}).fill('2000-02-29');
      assert.equal(await page.locator('form').evaluate(form=>form.checkValidity()),false);
      await page.getByLabel('WhatsApp number',{exact:true}).fill('+919876543210');
      await checkLayout(page,'required registration '+width);
      await page.locator('form button[type=submit]').click();await page.waitForURL('**/login');
      assert.equal(registered.dateOfBirth,'2000-02-29');assert.equal(registered.phoneNumber,'+919876543210');
      assert.deepEqual(registration.errors,[]);console.log(`PASS ${width}px: registration requires birth date and WhatsApp, private contact notice, layout`);
    }finally{await registration.context.close();}
  }
  for(const kind of ['register','connect']) {
    let challenge,completed=0;
    const state='S'.repeat(43),code='C'.repeat(43),ticket='T'.repeat(43);
    const f=await createUiContext(browser,{width:390,overrides:{
      '/api/auth/social/providers':{google:true,facebook:true},
      // A fresh document navigation keeps every request inside this harness;
      // Playwright's native redirect chain can skip routing subsequent URLs.
      '/api/auth/social/begin':(route)=>route.fulfill({status:200,contentType:'text/html',body:`<script>location.replace("https://fcarena.in/auth/social/callback?code=${code}&state=${state}")</script>`}),
    },onMutation:(route,headers)=>{
      const path=new URL(route.request().url()).pathname,body=route.request().postDataJSON();
      if(path==='/api/auth/social/start') {
        assert.equal(body.provider,kind==='connect'?'facebook':'google');challenge=body.challenge;
        return ok(route,headers,{state,url:`https://api.fcarena.in/api/auth/social/begin?state=${state}`});
      }
      if(path==='/api/auth/social/exchange') {
        assert.equal(createHash('sha256').update(body.verifier).digest('base64url'),challenge);
        assert.equal(body.code,code);assert.equal(body.state,state);
        return ok(route,headers,{kind,ticket,profile:{fullName:'Social Player',email:'social@example.invalid',provider:kind==='connect'?'facebook':'google'}});
      }
      assert.equal(path,`/api/auth/social/${kind}`);assert.equal(body.ticket,ticket);completed++;
      if(kind==='register'){assert.equal(body.dateOfBirth,'2000-02-29');assert.equal(body.phoneNumber,'+919876543210');}
      else assert.equal(body.password,'Existing123!');
      return ok(route,headers,session);
    }});
    try {
      await f.page.goto('https://fcarena.in/login');
      await f.page.getByRole('button',{name:kind==='connect'?'Continue with Facebook':'Continue with Google',exact:true}).click();
      await f.page.waitForURL('**/auth/social/callback');
      if(kind==='register') {
        await f.page.getByLabel('In-Game Name',{exact:true}).fill('SocialPlayer');
        assert.equal(await f.page.locator('form').evaluate(form=>form.checkValidity()),false);
        await f.page.getByLabel('Date of birth',{exact:true}).fill('2000-02-29');
        await f.page.getByLabel('WhatsApp number',{exact:true}).fill('+919876543210');
      }else await f.page.getByLabel('FC ARENA password',{exact:true}).fill('Existing123!');
      await checkLayout(f.page,'social '+kind);
      await f.page.locator('form button[type=submit]').click();await f.page.waitForURL('**/dashboard');
      assert.equal(completed,1);assert.deepEqual(f.errors,[]);
      console.log(`PASS mobile ${kind}: provider button, PKCE callback, required completion/password connection and session`);
    }catch(error){console.error(await f.page.locator('body').innerText());console.error(f.errors);throw error;}finally{await f.context.close();}
  }
  const native=await createUiContext(browser,{width:390,native:true});
  try {
    const response=await native.page.goto(`https://fcarena.in/auth/social/callback?code=${'C'.repeat(43)}&state=${'S'.repeat(43)}`);
    assert.equal(response.headers()['referrer-policy'],'no-referrer');
    const link=native.page.getByRole('link',{name:'Open FC ARENA app',exact:true});await link.waitFor();
    assert.match(await link.getAttribute('href'),/^intent:\/\/fcarena\.in\/auth\/social\/callback\?.*package=in\.fcarena\.app;end$/);
    assert.equal(new URL(native.page.url()).search,'');assert.deepEqual(native.errors,[]);
    console.log('PASS Android browser return: explicit app intent, opaque code/state only and cleaned browser URL');
  }finally{await native.context.close();}
}finally{await browser.close();}
