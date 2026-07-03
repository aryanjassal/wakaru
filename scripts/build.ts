import { cp, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import packageJson from '../package.json' with { type: 'json' };

const root = resolve(import.meta.dirname, '..');
const outputDirectory = resolve(root, 'dist');
const runtimeAssets = resolve(root, 'assets/runtime');

await requireFile(resolve(runtimeAssets, 'dictionary.sqlite'));
await requireDirectory(resolve(runtimeAssets, 'kuromoji'));

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

await build({
  entryPoints: [resolve(root, 'src/tui/main.tsx')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node26',
  outfile: resolve(outputDirectory, 'main.js'),
  // Native dependencies must retain their package layout so Node can locate
  // their platform-specific binaries. Kuromoji is JavaScript and is bundled.
  external: ['@opentui/core', 'better-sqlite3'],
});

await cp(runtimeAssets, resolve(outputDirectory, 'assets'), {
  recursive: true,
});

await writeFile(
  resolve(outputDirectory, 'package.json'),
  `${JSON.stringify(
    {
      name: 'wakaru-runtime',
      private: true,
      type: 'module',
      engines: packageJson.engines,
      scripts: {
        start: 'node --experimental-ffi main.js',
      },
      dependencies: {
        '@opentui/core': packageJson.dependencies['@opentui/core'],
        'better-sqlite3': packageJson.dependencies['better-sqlite3'],
      },
    },
    null,
    2
  )}\n`,
  'utf8'
);

async function requireFile(path: string): Promise<void> {
  const details = await stat(path).catch(() => null);
  if (!details?.isFile())
    throw new Error(`Required build asset missing: ${path}`);
}

async function requireDirectory(path: string): Promise<void> {
  const details = await stat(path).catch(() => null);
  if (!details?.isDirectory()) {
    throw new Error(`Required build asset directory missing: ${path}`);
  }
}
