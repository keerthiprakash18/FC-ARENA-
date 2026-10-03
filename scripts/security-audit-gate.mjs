import { spawnSync } from 'node:child_process';

const exceptionExpires = new Date('2026-11-15T00:00:00Z');
const now = new Date();
if (now >= exceptionExpires) {
  console.error('Security audit exception review date has expired. Re-evaluate Prisma 7 dependency advisories.');
  process.exit(1);
}

const result = spawnSync(
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  ['audit', '--omit=dev', '--json'],
  { encoding: 'utf8' },
);

if (!result.stdout?.trim()) {
  console.error(result.stderr || 'npm audit produced no JSON output');
  process.exit(1);
}

let audit;
try {
  audit = JSON.parse(result.stdout);
} catch {
  console.error('Unable to parse npm audit JSON');
  console.error(result.stdout.slice(0, 4000));
  process.exit(1);
}

const vulnerabilities = audit.vulnerabilities ?? {};
const blocking = [];
const accepted = [];

const acceptedDirect = new Map([
  [
    'deepmerge-ts',
    new Set(['https://github.com/advisories/GHSA-ggr8-5vv4-36mx']),
  ],
  [
    'mysql2',
    new Set([
      'https://github.com/advisories/GHSA-3f6p-5ww8-9rcr',
      'https://github.com/advisories/GHSA-rgwj-5xj2-c3m3',
    ]),
  ],
]);

const acceptedParents = new Map([
  ['@prisma/config', new Set(['deepmerge-ts'])],
  ['prisma', new Set(['@prisma/config', 'mysql2'])],
]);

for (const [name, finding] of Object.entries(vulnerabilities)) {
  if (!['high', 'critical'].includes(finding.severity)) continue;

  if (acceptedDirect.has(name)) {
    const allowedUrls = acceptedDirect.get(name);
    const directAdvisories = (finding.via ?? []).filter((via) => typeof via === 'object');
    const viaPackages = (finding.via ?? []).filter((via) => typeof via === 'string');

    const advisoryUrls = directAdvisories.map((via) => via.url).filter(Boolean);
    const unknownDirect = advisoryUrls.filter((url) => !allowedUrls.has(url));

    if (unknownDirect.length === 0 && viaPackages.length === 0 && advisoryUrls.length > 0) {
      accepted.push({ name, severity: finding.severity, reason: 'temporary upstream Prisma toolchain exception' });
      continue;
    }
  }

  if (acceptedParents.has(name)) {
    const allowedVia = acceptedParents.get(name);
    const directAdvisories = (finding.via ?? []).filter((via) => typeof via === 'object');
    const viaPackages = (finding.via ?? []).filter((via) => typeof via === 'string');
    const unknownVia = viaPackages.filter((pkg) => !allowedVia.has(pkg));

    if (directAdvisories.length === 0 && unknownVia.length === 0 && viaPackages.length > 0) {
      accepted.push({ name, severity: finding.severity, reason: 'inherits only accepted Prisma toolchain advisories' });
      continue;
    }
  }

  blocking.push({
    name,
    severity: finding.severity,
    via: finding.via,
    range: finding.range,
  });
}

if (accepted.length > 0) {
  console.log('Temporarily accepted production audit findings (review by 2026-11-15):');
  for (const item of accepted) {
    console.log(`- ${item.name}: ${item.severity} — ${item.reason}`);
  }
}

if (blocking.length > 0) {
  console.error('Blocking high/critical production dependency findings:');
  console.error(JSON.stringify(blocking, null, 2));
  process.exit(1);
}

console.log('Production dependency gate passed: no unapproved high/critical findings.');
