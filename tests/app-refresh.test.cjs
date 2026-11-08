const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function fixture(){
 const effects=[],out={};
 const code=ts.transpileModule(fs.readFileSync('apps/web/src/lib/app-refresh.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports:out,require:()=>({useRef:value=>({current:value}),useEffect:fn=>effects.push(fn)}),AbortController,Promise,Set});
 return {out,effects};
}
test('refresh waits for every registered read and reports a partial failure without cancelling successful reads',async()=>{
 const {out}=fixture();let release,finished=false;out.registerAppRefresh(()=>new Promise(resolve=>{release=()=>{finished=true;resolve();};}));out.registerAppRefresh(()=>false);
 const work=out.refreshAppReads();await Promise.resolve();assert.equal(finished,false);release();const result=await work;assert.equal(result.ok,false);assert.equal(result.handled,2);assert.equal(finished,true);
});
test('completed refreshes do not cache responses and unmounted handlers never run again',async()=>{
 const {out}=fixture();let reads=0;const stop=out.registerAppRefresh(()=>{reads++;});await out.refreshAppReads();await out.refreshAppReads();assert.equal(reads,2);stop();assert.equal((await out.refreshAppReads()).handled,0);assert.equal(reads,2);
});
test('synchronous read errors are contained and leave the other readers running',async()=>{
 const {out}=fixture();let ran=false;out.registerAppRefresh(()=>{throw Error('temporary read error');});out.registerAppRefresh(()=>{ran=true;});assert.equal((await out.refreshAppReads()).ok,false);assert.equal(ran,true);
});
test('navigating away aborts the registered read and removes its refresh subscription',async()=>{
 const {out,effects}=fixture();let signal;out.useAppRefresh(value=>{signal=value;},'match-one');const stop=effects.map(effect=>effect()).find(value=>typeof value==='function');await out.refreshAppReads();assert.equal(signal.aborted,false);stop();assert.equal(signal.aborted,true);assert.equal((await out.refreshAppReads()).handled,0);
});
