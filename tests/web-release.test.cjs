const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const out = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/web/src/lib/web-release.ts', 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, {exports: out, URL});
test('only a valid different frontend release creates an update notice',()=>{
 const old='a'.repeat(40),next='b'.repeat(40);
 assert.equal(out.newerWebRelease(old,{release:next}),next);
 assert.equal(out.newerWebRelease(old,{release:old.toUpperCase()}),null);
 for(const payload of [null,{},'<html>',{release:'unknown'},{release:'javascript:alert(1)'}])assert.equal(out.newerWebRelease(old,payload),null);
 assert.equal(out.newerWebRelease('unknown',{release:next}),null);
});
test('fresh document navigation preserves the current route, filters and fragment without accumulating refresh parameters',()=>{
 const next='b'.repeat(40);
 const url=new URL(out.freshAppUrl('https://fcarena.in/tournaments/cup/registration?view=pending&leagueId=kickoff&fc_native_refresh=old#pending-approvals',next));
 assert.equal(url.pathname,'/tournaments/cup/registration');assert.equal(url.searchParams.get('view'),'pending');assert.equal(url.searchParams.get('leagueId'),'kickoff');assert.equal(url.hash,'#pending-approvals');assert.deepEqual(url.searchParams.getAll('fc_native_refresh'),[next]);
 assert.throws(()=>out.freshAppUrl(url.href,'invalid'));
});
