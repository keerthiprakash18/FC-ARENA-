import { pathToFileURL } from 'node:url';

// Inspect values in memory only. Diagnostics contain fixed labels, never values.
export function checkSecurityEnv(env) {
  const errors = [];
  const warnings = [];
  const fail = message => errors.push(message);
  if (env.NODE_ENV !== 'production') fail('NODE_ENV must be production on the production API.');
  for (const name of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    const value = env[name] ?? '';
    if (Buffer.byteLength(value) < 32 || /example|change.?me|replace.?me|test.?secret/i.test(value)) {
      fail(`${name} must be a strong, non-placeholder secret of at least 32 bytes.`);
    }
  }
  if (env.JWT_ACCESS_SECRET && env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    fail('Access and refresh JWT secrets must differ.');
  }
  if (Object.keys(env).some(name => /^(NEXT_PUBLIC_|VITE_|REACT_APP_)/.test(name) &&
    /SECRET|PASSWORD|PRIVATE|CREDENTIAL|DATABASE_URL|BREVO|CLOUDINARY_API_KEY/i.test(name))) {
    fail('A server credential variable has a public frontend prefix.');
  }
  if (/--inspect|--debug/.test(env.NODE_OPTIONS ?? '') || env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    fail('Node debugging or TLS verification bypass is enabled.');
  }
  if (!/^(0|[1-9]\d*)$/.test(env.TRUST_PROXY_HOPS ?? '1')) fail('TRUST_PROXY_HOPS must be a nonnegative integer.');
  try {
    const url = new URL(env.DATABASE_URL ?? '');
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.username || !url.password) {
      fail('DATABASE_URL must reference authenticated PostgreSQL.');
    }
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && !['verify-full', 'verify-ca'].includes(url.searchParams.get('sslmode'))) {
      warnings.push('Verify authenticated TLS for the remote database and restrict its network access.');
    }
  } catch { fail('DATABASE_URL is missing or malformed.'); }
  for (const value of (env.WEB_ORIGIN ?? '').split(',').map(x => x.trim()).filter(Boolean)) {
    try {
      const origin = new URL(value);
      if (origin.protocol !== 'https:' || origin.origin !== value || origin.username || origin.password) {
        fail('WEB_ORIGIN must contain only exact HTTPS origins without credentials or paths.');
      }
    } catch { fail('WEB_ORIGIN contains an invalid origin.'); }
  }
  if (env.PUSH_ENABLED === 'true') {
    try {
      const credentials = JSON.parse(env.FIREBASE_ADMIN_CREDENTIALS_JSON ?? '');
      if (credentials.type !== 'service_account' || !credentials.project_id || !credentials.client_email || !credentials.private_key) {
        fail('Firebase Admin service-account configuration is incomplete.');
      }
    } catch { fail('Firebase Admin service-account configuration is invalid.'); }
  }
  return { errors: [...new Set(errors)], warnings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = checkSecurityEnv(process.env);
  for (const message of report.errors) console.error(`FAIL: ${message}`);
  for (const message of report.warnings) console.warn(`REVIEW: ${message}`);
  console.log(`Environment check: ${report.errors.length} error(s), ${report.warnings.length} review item(s). No values printed.`);
  process.exitCode = report.errors.length ? 1 : 0;
}
