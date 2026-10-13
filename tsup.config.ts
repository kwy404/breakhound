import { copyFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
const define = { __VERSION__: JSON.stringify(version) };

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    shims: true,
    target: 'node18',
    platform: 'node',
    define,
    onSuccess: async () => {
      copyFileSync('src/runner/worker.mjs', 'dist/worker.mjs');
    },
  },
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    target: 'node18',
    platform: 'node',
    define,
  },
]);
