/**
 * Rebuild the owner-approved Birthday Magic stadium film on an off-host runner.
 * The fixed, versioned base64 parts are used because the GitHub connector has
 * a transport-size limit for uploading a single binary asset. No network call.
 * Never run this file on the production VCL host as part of a deployment.
 */
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const partsRoot = path.join(root, 'apps/web/birthday-video-src');
const destination = path.join(root, 'apps/web/public/birthday-magic/stadium.mp4');
const expectedHash = 'f274956e3ec572a56f848e5c1057dda2add3b5bc631fda5fc295443f3cf49e07';
const expectedBytes = 4_945_590;
const chunks = [];
for (let part = 1; part <= 18; part += 1) {
  const filename = `stadium.part${String(part).padStart(2, '0')}.b64`;
  const chunk = (await readFile(path.join(partsRoot, filename), 'utf8')).trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(chunk) || (part < 18 && chunk.length !== 384_000)) {
    throw new Error(`Invalid approved stadium source part ${part}`);
  }
  chunks.push(chunk);
}
const binary = Buffer.from(chunks.join(''), 'base64');
const actualHash = createHash('sha256').update(binary).digest('hex');
if (binary.length !== expectedBytes || actualHash !== expectedHash) {
  throw new Error('Approved Birthday Magic film SHA256/size verification failed; abort build.');
}
try {
  const existing = await readFile(destination);
  if (existing.length === expectedBytes && createHash('sha256').update(existing).digest('hex') === expectedHash) {
    console.log('Birthday Magic film already verified.');
    process.exit(0);
  }
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
await mkdir(path.dirname(destination), { recursive: true });
await writeFile(destination, binary, { flag: 'w' });
console.log('Prepared verified Birthday Magic stadium film from versioned off-host media sources.');
