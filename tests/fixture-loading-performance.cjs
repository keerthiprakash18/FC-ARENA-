const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {performance}=require('node:perf_hooks');
const source=fs.readFileSync(process.argv[2]||'apps/web/src/app/fixtures/manage/page.tsx','utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
(async()=>{
 const times=[];
 for(let i=0;i<15;i++){
  let state=0,done;const complete=new Promise(r=>done=r);const out={};
  const delay=value=>new Promise(r=>setTimeout(()=>r(value),40));
  const react={useState:value=>{const index=state++;return [value,()=>{if(index===1)done();}];},useEffect:fn=>fn()};
  const requireModule=name=>name==='react'?react:name==='react/jsx-runtime'?{jsx:()=>null,jsxs:()=>null}:name==='next/navigation'?{useRouter:()=>({replace:()=>{throw Error('Unexpected redirect');}})}:name==='@/lib/auth-client'?{getCurrentUser:()=>delay({id:'synthetic-user'}),authenticatedRequest:()=>delay({data:{leagues:[]}})}:{};
  vm.runInNewContext(code,{exports:out,require:requireModule,Promise});const start=performance.now();out.default();await complete;times.push(performance.now()-start);
 }
 times.sort((a,b)=>a-b);console.log(JSON.stringify({method:'Real fixture-management component effect with mocked React setters and two 40ms API reads; not device rendering',samples:15,medianMs:+times[7].toFixed(2),p95Ms:+times[14].toFixed(2)},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
