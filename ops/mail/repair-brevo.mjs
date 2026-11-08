import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

const apiDirectory = '/opt/fcarena/apps/api';
const statisticsUrl = 'https://api.brevo.com/v3/smtp/statistics/aggregatedReport?days=1';

export function replaceBrevoKey(source, key) {
  if (key.startsWith('BREVO_API_KEY=') || !/^[A-Za-z0-9._~+/=-]{20,2048}$/.test(key)) {
    throw new Error('Paste only the API key, without BREVO_API_KEY=, spaces or quotes.');
  }
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const retained = source.split(/\r?\n/)
    .filter(line => !/^\uFEFF?[\t ]*(?:export[\t ]+)?BREVO_API_KEY[\t ]*=/.test(line))
    .join(newline);
  return retained + (retained && !retained.endsWith('\n') ? newline : '')
    + `BREVO_API_KEY="${key}"${newline}`;
}

export async function verifyBrevoKey(key, fetchImpl = fetch) {
  let response;
  try {
    // Read-only: this also works with a Transactional email restricted key.
    response = await fetchImpl(statisticsUrl, {
      headers: { accept: 'application/json', 'api-key': key },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error('Cannot reach Brevo from the server. No configuration was changed.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const ipBlocked = typeof body?.message === 'string' && /\bip\b/i.test(body.message);
    const reason = ipBlocked ? 'Authorize this server IP in Brevo.'
      : response.status === 401 ? 'The key is invalid or expired.'
        : response.status === 403 ? 'Check Transactional email permissions and authorized IPs.'
          : 'Check the Brevo account status and try again.';
    // Never print the provider body: it may contain credentials or account data.
    throw new Error(`Brevo rejected the check (HTTP ${response.status}). ${reason} No configuration was changed.`);
  }
  await response.arrayBuffer();
}

async function main() {
  try {
    const key = fs.readFileSync(0, 'utf8').trim();
    // Validate input before making a provider request.
    replaceBrevoKey('', key);
    await verifyBrevoKey(key);
    console.log('Brevo key accepted. Updating the server configuration.');

    const require = createRequire(`${apiDirectory}/package.json`);
    const dotenv = require('dotenv');
    const target = fs.realpathSync(`${apiDirectory}/.env`);
    const original = fs.readFileSync(target, 'utf8');
    const updated = replaceBrevoKey(original, key);
    const before = dotenv.parse(original);
    const after = dotenv.parse(updated);
    if (after.BREVO_API_KEY !== key || Object.keys(before).some(name =>
      name !== 'BREVO_API_KEY' && before[name] !== after[name])) {
      throw new Error('Configuration verification failed. No configuration was changed.');
    }

    const stat = fs.statSync(target);
    const backupDirectory = '/root/.local/state/fcarena/brevo-env-backups';
    fs.mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
    fs.chmodSync(backupDirectory, 0o700);
    const backup = `${backupDirectory}/api-env-${Date.now()}-${randomUUID()}`;
    fs.writeFileSync(backup, original, { mode: 0o600, flag: 'wx' });

    function install(content) {
      const temporary = `${target}.brevo-${randomUUID()}`;
      try {
        fs.writeFileSync(temporary, content, { mode: stat.mode & 0o777, flag: 'wx' });
        fs.chownSync(temporary, stat.uid, stat.gid);
        fs.renameSync(temporary, target);
      } finally {
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
      }
    }

    if (fs.readFileSync(target, 'utf8') !== original) {
      throw new Error('Configuration changed during the check. Run the helper again.');
    }
    install(updated);
    try {
      execFileSync('systemctl', ['restart', 'fcarena-api'], { stdio: 'ignore', timeout: 45_000 });
      let healthy = false;
      for (let attempt = 0; attempt < 20; attempt++) {
        try {
          const response = await fetch('http://127.0.0.1:4000/api/health', { signal: AbortSignal.timeout(2_000) });
          const body = await response.json();
          if (response.ok && body.success === true && body.data?.status === 'healthy') {
            healthy = true;
            break;
          }
        } catch { /* Wait for the service to start. */ }
        await new Promise(resolve => setTimeout(resolve, 1_000));
      }
      if (!healthy) throw new Error('Health check did not pass.');
    } catch {
      install(original);
      try {
        execFileSync('systemctl', ['restart', 'fcarena-api'], { stdio: 'ignore', timeout: 45_000 });
      } catch {
        throw new Error('Previous configuration restored; API restart failed. Check fcarena-api service status.');
      }
      throw new Error('API health check failed; previous configuration restored and service restarted.');
    }
    console.log('SUCCESS: Brevo key verified, duplicate entries replaced, API restarted and healthy.');
    console.log('Now test Forgot Password using your registered email.');
  } catch (error) {
    // Only errors deliberately raised here are safe to display.
    const safe = error instanceof Error && !('code' in error) && !('syscall' in error);
    console.error(safe ? error.message : 'Server update failed. Check server access and configuration permissions.');
    process.exitCode = 1;
  }
}

// The PowerShell launcher supplies this module as a data URL; importing it in
// local tests never starts an SSH connection or changes configuration.
if (import.meta.url.startsWith('data:')) await main();
