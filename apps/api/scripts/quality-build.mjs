import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

// Verify regeneration without overwriting an existing contributor's generated
// client. Build the actual application with a separate incremental cache.
const require = createRequire(import.meta.url);
const api = resolve(import.meta.dirname, '..');
const temporary = await mkdtemp(join(tmpdir(), 'fc-quality-build-'));
function run(cli, args) {
  const result = spawnSync(process.execPath, [require.resolve(cli), ...args], { cwd: api, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Quality build command failed (${result.status ?? result.signal})`);
}
try {
  const schema = await readFile(join(api, 'prisma/schema.prisma'), 'utf8');
  const generated = join(temporary, 'generated');
  await writeFile(join(temporary, 'schema.prisma'), schema.replace(/output\s*=\s*"\.\.\/src\/generated\/prisma"/, `output = ${JSON.stringify(generated)}`));
  run('prisma/build/index.js', ['generate', '--config', join(api, 'prisma.config.ts'), '--schema', join(temporary, 'schema.prisma')]);
  const actualModels = (await readdir(join(api, 'src/generated/prisma/models'))).sort();
  const freshModels = (await readdir(join(generated, 'models'))).sort();
  if (JSON.stringify(actualModels) !== JSON.stringify(freshModels)) throw new Error('Existing generated model set differs from fresh schema generation; review contributor changes.');
  // Exercise the newly generated TypeScript client against the installed runtime.
  await writeFile(join(temporary, 'generated-tsconfig.json'), JSON.stringify({
    extends: join(api, 'tsconfig.json'),
    compilerOptions: {
      rootDir: generated, outDir: join(temporary, 'compiled'), incremental: false,
      types: [], paths: { '@prisma/client/*': [join(api, '../../node_modules/@prisma/client/*')] },
    },
    include: [join(generated, '**/*.ts')], exclude: [],
  }));
  run('typescript/lib/tsc.js', ['--project', join(temporary, 'generated-tsconfig.json')]);
  await writeFile(join(temporary, 'api-tsconfig.json'), JSON.stringify({
    extends: join(api, 'tsconfig.build.json'),
    compilerOptions: { incremental: false, types: [join(api, '../../node_modules/@types/node'), join(api, '../../node_modules/vitest/globals')] },
    include: [join(api, 'src')], exclude: [join(api, 'src/**/*spec.ts'), join(api, 'test'), join(api, 'dist')],
  }));
  run('@nestjs/cli/bin/nest.js', ['build', '--path', relative(api, join(temporary, 'api-tsconfig.json'))]);
  console.log('Fresh Prisma client generation/typecheck and API production build passed; contributor artifacts preserved.');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
