import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAuditResult } from '../scripts/security-audit-report.mjs';
const report = { auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { total: 0 } } };
test('accepts a complete clean report and preserves vulnerability reports', () => {
  assert.deepEqual(parseAuditResult({ status: 0, stdout: JSON.stringify(report) }), report);
  const vulnerable = { ...report, vulnerabilities: { dependency: { severity: 'high', via: ['parent'] } }, metadata: { vulnerabilities: { total: 1 } } };
  assert.deepEqual(parseAuditResult({ status: 1, stdout: JSON.stringify(vulnerable) }), vulnerable);
});
test('fails closed for unavailable, malformed and incomplete audit results without printing their content', () => {
  for (const result of [
    { status: 1, stdout: JSON.stringify({ error: { summary: 'private-proxy-value' } }) },
    { status: 0, stdout: '{}' }, { status: 0, stdout: 'private-proxy-value' },
    { status: 2, stdout: JSON.stringify(report) }, { status: null, signal: 'SIGTERM', stdout: '' },
    { status: 0, error: new Error('private-proxy-value'), stdout: JSON.stringify(report) },
    { status: 0, stdout: JSON.stringify({ ...report, metadata: { vulnerabilities: { total: 1 } } }) },
  ]) {
    assert.throws(() => parseAuditResult(result), error => !error.message.includes('private-proxy-value'));
  }
});
