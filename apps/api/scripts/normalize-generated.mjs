import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Prisma emits trailing spaces in generated comments. Keep generated sources
// compatible with the repository's whitespace gate without changing semantics.
async function normalize(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await normalize(path);
    else if (entry.name.endsWith('.ts')) {
      const source = await readFile(path, 'utf8');
      const clean = source.replace(/[\t ]+$/gm, '');
      if (clean !== source) await writeFile(path, clean);
    }
  }
}
await normalize(fileURLToPath(new URL('../src/generated/prisma/', import.meta.url)));
