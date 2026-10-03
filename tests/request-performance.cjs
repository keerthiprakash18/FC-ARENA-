const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { performance } = require('node:perf_hooks');
const source = fs.readFileSync(process.argv[2] || 'apps/web/src/lib/auth-client.ts', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const paths = ['/auth/me','/players/me/dashboard','/leagues/my','/leagues/test/tournaments','/tournaments/test/fixtures','/tournaments/test/standings','/awards/overview','/notifications','/players/me/career','/admin/system'];
(async () => {
 const results = [];
 for (const path of paths) {
  const samples = []; let requests = 0;
  for (let i = 0; i < 15; i++) {
   const client = {};
   const api = { apiRequest: async () => { requests++; await new Promise(r => setTimeout(r, 40)); return { data: { sample: true } }; } };
   vm.runInNewContext(code, { exports: client, require: () => api, Date, Promise, Error, JSON, Map, setTimeout });
   client.establishLoginSession('synthetic-test-token', 3600);
   const start = performance.now();
   await Promise.all([client.authenticatedRequest(path), client.authenticatedRequest(path), client.authenticatedRequest(path)]);
   samples.push(performance.now() - start);
  }
  samples.sort((a,b) => a-b);
  results.push({ path, samples: 15, consumersPerSample: 3, requestsPerSample: requests / 15, medianMs: +samples[7].toFixed(2), p95Ms: +samples[14].toFixed(2) });
 }
 console.log(JSON.stringify({ method: 'Isolated real auth-client, 40ms mocked transport; not production page latency', results }, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
