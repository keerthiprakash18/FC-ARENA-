const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require('node:path').join(__dirname, '../apps/web/src/lib/auth-client.ts'), 'utf8');
const code = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let reads = 0;
const exportsObject = {};
const api = {API_URL:'https://test.invalid', apiRequest:async(path,options)=>{
  if(path === '/notifications' && (!options.method || options.method === 'GET')){reads++; await new Promise(resolve=>setTimeout(resolve,5));return {data:{unreadCount:reads}};}
  return {data:{}};
}};
vm.runInNewContext(code, {exports:exportsObject, require:()=>api, Date, Promise, Error, JSON, setTimeout});
(async()=>{
 exportsObject.establishLoginSession('test',3600);
 const [bell,inbox]=await Promise.all([exportsObject.authenticatedRequest('/notifications'),exportsObject.authenticatedRequest('/notifications')]);
 assert.equal(reads,1,'Bell and inbox must coalesce concurrent reads');assert.equal(bell.data.unreadCount,inbox.data.unreadCount);
 await exportsObject.authenticatedRequest('/notifications');assert.equal(reads,1,'Fresh cache must be reused');
 await exportsObject.authenticatedRequest('/notifications/one/read',{method:'POST'});await exportsObject.authenticatedRequest('/notifications');assert.equal(reads,2,'Mark read must invalidate cached count');
 await exportsObject.logoutCurrentUser();exportsObject.establishLoginSession('other-user',3600);await exportsObject.authenticatedRequest('/notifications');assert.equal(reads,3,'Another account must never inherit notification cache');
 console.log('Notification cache: concurrency, reuse, mutation and account isolation passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
