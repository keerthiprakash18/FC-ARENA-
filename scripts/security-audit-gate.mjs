import { parseAuditResult } from './security-audit-report.mjs';
import { spawnSync } from 'node:child_process';

const includeDev = process.argv.includes('--include-dev');
const result = spawnSync(
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  ['audit', ...(includeDev ? [] : ['--omit=dev']), '--json'],
  { encoding: 'utf8' },
);

let audit;
try {
  audit = parseAuditResult(result);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

if (result.error || audit.error || !audit.metadata?.vulnerabilities || !audit.vulnerabilities) {
  console.error('Dependency audit failed or returned an incomplete report.');
  process.exit(1);
}

const vulnerabilities = audit.vulnerabilities;
const blocking = [];

for (const [name, finding] of Object.entries(vulnerabilities)) {
  if (!['high', 'critical'].includes(finding.severity)) continue;

  blocking.push({
    name,
    severity: finding.severity,
    via: finding.via,
    range: finding.range,
  });
}

if (blocking.length > 0) {
  console.error(`Blocking high/critical ${includeDev ? 'full' : 'production'} dependency findings:`);
  console.error(JSON.stringify(blocking, null, 2));
  process.exit(1);
}

console.log(`${includeDev ? 'Full' : 'Production'} dependency gate passed: no high/critical findings; no exceptions.`);
