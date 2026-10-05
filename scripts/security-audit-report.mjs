// Never include registry output in errors: proxy errors can contain credentials.
export function parseAuditResult(result) {
  if (result.error || result.signal || ![0, 1].includes(result.status)) {
    throw new Error('Dependency audit could not complete. No security result is available.');
  }
  let audit;
  try { audit = JSON.parse(result.stdout); }
  catch { throw new Error('Dependency audit returned invalid JSON.'); }
  if (!audit || audit.error || audit.auditReportVersion !== 2 ||
      !audit.vulnerabilities || typeof audit.vulnerabilities !== 'object' || Array.isArray(audit.vulnerabilities) ||
      !audit.metadata?.vulnerabilities ||
      !Number.isInteger(audit.metadata.vulnerabilities.total)) {
    throw new Error('Dependency audit returned an incomplete report.');
  }
  const severities = ['info', 'low', 'moderate', 'high', 'critical'];
  const entries = Object.values(audit.vulnerabilities);
  if (entries.length !== audit.metadata.vulnerabilities.total || entries.some(finding =>
    !finding || !severities.includes(finding.severity) || !Array.isArray(finding.via))) {
    throw new Error('Dependency audit returned inconsistent findings.');
  }
  return audit;
}
