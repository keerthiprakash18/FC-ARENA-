const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('apps/web/src/lib/use-recoverable-load.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const tick = () => new Promise(resolve=>setImmediate(resolve));
function mount(status=503) {
 const refreshers=new Set(), states=[];let readGate=null; const effects=[], timers=new Map(), redirects=[], errors=[], listeners={window:new Map(),document:new Map()}, calls=[];let id=0, available=false;
 class ApiError extends Error {constructor(status){super('Temporary outage');this.status=status;}}
 const target=map=>({addEventListener(name,fn){map.set(name,fn);},removeEventListener(name){map.delete(name);}});
 const navigator={onLine:true}, document={...target(listeners.document),visibilityState:'visible'};
 const out={};vm.runInNewContext(code,{exports:out,require:name=>name==='react'?{useRef:value=>({current:value}),useState:initial=>{const index=states.length;states.push(initial);return [initial,value=>{states[index]=typeof value==='function'?value(states[index]):value;errors.push(states[index]);}];},useCallback:fn=>fn,useEffect:fn=>effects.push(fn)}:name==='next/navigation'?{useRouter:()=>({replace:path=>redirects.push(path)})}:name==='./app-refresh'?{registerAppRefresh:fn=>{refreshers.add(fn);return ()=>refreshers.delete(fn);}}:{ApiError},AbortController,Error,navigator,document,window:target(listeners.window),setTimeout(fn){const key=++id;timers.set(key,fn);return key;},clearTimeout(key){timers.delete(key);}});
 const result=out.useRecoverableLoad(async signal=>{calls.push(signal);if(readGate)await readGate;if(!available)throw new ApiError(status);});
 const cleanup=effects.map(fn=>fn()).filter(Boolean);
 return {result,states,refreshers,calls,timers,redirects,errors,navigator,document,listeners,recover(){available=true;},fail(){available=false;},holdNext(){let release;readGate=new Promise(resolve=>{release=resolve;});return ()=>{readGate=null;release();};},fire(){for(const [key,fn] of [...timers]){timers.delete(key);fn();}},emit(where,name){listeners[where].get(name)?.();},stop(){cleanup.forEach(fn=>fn());}};
}
test('page retries stop after three attempts instead of generating an endless outage loop',async()=>{
 const f=mount();await tick();for(let n=0;n<4;n++){f.fire();await tick();}assert.equal(f.calls.length,4);assert.equal(f.timers.size,0);assert.deepEqual(f.redirects,[]);f.stop();
});
test('hidden and offline pages pause recovery and resume on return',async()=>{
 for(const pause of ['offline','hidden']){const f=mount();await tick();if(pause==='offline')f.navigator.onLine=false;else f.document.visibilityState='hidden';f.fire();await tick();assert.equal(f.calls.length,1);f.recover();f.navigator.onLine=true;f.document.visibilityState='visible';f.emit('window','online');await tick();assert.equal(f.calls.length,2);assert.equal(f.errors.at(-1),'');f.stop();}
});
test('only confirmed unauthorized sessions redirect; denied scopes remain reviewable',async()=>{
 for(const status of [401,403]){const f=mount(status);await tick();assert.deepEqual(f.redirects,status===401?['/login']:[]);assert.equal(f.timers.size,0);f.stop();}
});
test('navigation aborts pending reads and removes every recovery timer and listener',async()=>{
 const f=mount();await tick();f.stop();assert(f.calls[0].aborted);assert.equal(f.timers.size,0);assert.equal(f.listeners.window.size+f.listeners.document.size,0);f.fire();await tick();assert.equal(f.calls.length,1);
});


test('refreshing loaded data preserves the page error state during a temporary failure',async()=>{
 const f=mount();f.recover();await tick();f.fail();assert.equal(await f.result.reload(),false);assert.equal(f.states[0],'');assert.match(f.states[1],/Temporary outage/);assert.deepEqual(f.redirects,[]);f.stop();assert.equal(f.refreshers.size,0);
});
test('repeated refresh requests share the real pending read and resolve when that read finishes',async()=>{
 const f=mount();f.recover();await tick();const release=f.holdNext();const first=f.result.reload(),second=f.result.reload();assert.equal(first,second);await tick();assert.equal(f.calls.length,2);release();assert.equal(await first,true);assert.equal(f.states[0],'');f.stop();
});
