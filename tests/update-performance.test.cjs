const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function moduleCode(path) {return ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;}
function client() {
 const out={}, calls=[];
 const api={apiRequest:(path,options)=>new Promise((resolve,reject)=>calls.push({path,options,resolve,reject}))};
 vm.runInNewContext(moduleCode('apps/web/src/lib/auth-client.ts'),{exports:out,require:()=>api,Date,Promise,Error,JSON,Map,setTimeout});
 out.establishLoginSession('account-a',3600); return {out,calls};
}
const tick=()=>new Promise(r=>setImmediate(r));
test('concurrent GETs coalesce but completed data is never retained',async()=>{
 const {out,calls}=client();const a=out.authenticatedRequest('/auth/me'),b=out.authenticatedRequest('/auth/me');await tick();assert.equal(calls.length,1);calls[0].resolve({data:1});await Promise.all([a,b]);
 const c=out.authenticatedRequest('/auth/me');await tick();assert.equal(calls.length,2);calls[1].resolve({data:2});assert.equal((await c).data,2);
});
test('different scopes and custom request options do not coalesce',async()=>{
 const {out,calls}=client();const pending=[out.authenticatedRequest('/leagues/a'),out.authenticatedRequest('/leagues/b'),out.authenticatedRequest('/leagues/a',{cache:'no-store'}),out.authenticatedRequest('/leagues/a',{signal:new AbortController().signal})];await tick();assert.equal(calls.length,4);calls.forEach(c=>c.resolve({}));await Promise.all(pending);
});
test('new login cannot reuse an old account request',async()=>{
 const {out,calls}=client();const a=out.authenticatedRequest('/auth/me');await tick();out.establishLoginSession('account-b',3600);const b=out.authenticatedRequest('/auth/me');await tick();assert.equal(calls.length,2);assert.notEqual(calls[0].options.headers.Authorization,calls[1].options.headers.Authorization);calls[0].resolve({data:'a'});calls[1].resolve({data:'b'});assert.equal((await b).data,'b');await a;
});
test('mutation prevents a following read from sharing pre-mutation data',async()=>{
 const {out,calls}=client();const a=out.authenticatedRequest('/leagues/a');await tick();const mutation=out.authenticatedRequest('/leagues/a',{method:'PATCH'});await tick();const b=out.authenticatedRequest('/leagues/a');await tick();assert.equal(calls.length,3);calls.forEach(c=>c.resolve({}));await Promise.all([a,b,mutation]);
});
test('failed GET is retryable',async()=>{
 const {out,calls}=client();const a=out.authenticatedRequest('/auth/me');await tick();calls[0].reject(new Error('offline'));await assert.rejects(a);const b=out.authenticatedRequest('/auth/me');await tick();assert.equal(calls.length,2);calls[1].resolve({});await b;
});
function workerFixture(fail=false) {
 const removed=[],deleted=[],storage=new Map(),out={};let tries=0;
 const registration=path=>({active:{scriptURL:'https://fcarena.in'+path},unregister:async()=>{removed.push(path);return true;}});
 const cache={keys:async()=>['fc-arena-v7','other-app'],delete:async name=>{deleted.push(name);return true;}};
 const context={exports:out,URL,Promise,window:{location:{origin:'https://fcarena.in'},caches:cache},caches:cache,sessionStorage:{getItem:key=>storage.get(key),setItem:(k,v)=>storage.set(k,v)},navigator:{serviceWorker:{getRegistrations:async()=>{if(fail && tries++===0)throw new Error('offline');return [registration('/sw.js'),registration('/other-sw.js')];}}}};
 vm.runInNewContext(moduleCode('apps/web/src/lib/service-worker-lifecycle.ts'),context);return {out,removed,deleted,storage};
}
test('native worker retirement preserves unrelated workers/caches',async()=>{
 const f=workerFixture();await f.out.retireNativeServiceWorker();assert.deepEqual(f.removed,['/sw.js']);assert.deepEqual(f.deleted,['fc-arena-v7']);assert.equal(f.storage.get('fc-arena-sw-retired-v2'),'1');await f.out.retireNativeServiceWorker();assert.equal(f.removed.length,1);
});
test('failed cleanup is retried instead of being permanently marked complete',async()=>{
 const f=workerFixture(true);await f.out.retireNativeServiceWorker();assert.equal(f.storage.size,0);await f.out.retireNativeServiceWorker();assert.equal(f.storage.size,1);
});
test('PWA activation deletes only old FC Arena caches',async()=>{
 const callbacks={},deleted=[];let completed;
 vm.runInNewContext(fs.readFileSync('apps/web/public/sw.js','utf8'),{self:{addEventListener:(name,fn)=>callbacks[name]=fn,clients:{claim:()=>{}},location:{origin:'https://fcarena.in'}},caches:{keys:async()=>['fc-arena-v7','fc-arena-v8','other-app'],delete:async name=>deleted.push(name)},Promise,URL});
 callbacks.activate({waitUntil:p=>completed=p});await completed;assert.deepEqual(deleted,['fc-arena-v7']);
});
test('push binding handles token rotation in flight and retries on a later login',async()=>{
 const out={},calls=[],listeners=new Map();
 const window={__fcPush:{enabled:true,token:'token-a'},addEventListener:(n,f)=>{listeners.set(n,f);},removeEventListener:()=>{},dispatchEvent:e=>listeners.get(e.type)?.()};
 const code=ts.transpileModule(fs.readFileSync('apps/web/src/components/notifications/phone-push.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code,{exports:out,require:name=>name==='react'?{useEffect:fn=>fn()}:name==='@/lib/auth-client'?{authenticatedRequest:(path,options)=>new Promise(resolve=>calls.push({path,options,resolve}))}:{},window,Event,Promise,JSON});
 out.PushSync();assert.equal(calls.length,1);window.__fcPush={enabled:true,token:'token-b'};window.dispatchEvent(new Event('fc-arena:native-push'));calls[0].resolve({});await tick();assert.equal(calls.length,2);assert.equal(JSON.parse(calls[1].options.body).token,'token-b');calls[1].resolve({});await tick();window.dispatchEvent(new Event('fc-arena:signed-out'));window.dispatchEvent(new Event('fc-arena:signed-in'));assert.equal(calls.length,3);calls[2].resolve({});await tick();
});

test('account change before token-await continuation cannot share the old request',async()=>{
 const {out,calls}=client();const a=out.authenticatedRequest('/auth/me');out.establishLoginSession('account-b',3600);const b=out.authenticatedRequest('/auth/me');await tick();assert.equal(calls.length,2);calls.forEach(c=>c.resolve({}));await Promise.all([a,b]);
});
