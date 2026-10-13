import { fileURLToPath } from 'node:url';
import { afterAll, expect, test } from 'vitest';
import { Pool } from '../src/runner/pool';

const entry = fileURLToPath(new URL('./fixtures/hang/index.js', import.meta.url));
const pool = new Pool({ entry, now: Date.UTC(2026, 0, 1), timeout: 500 });
afterAll(() => pool.close());

test('returns values from the child process', async () => {
  const result = await pool.run({ path: ['spin'], args: [5] }, 'UTC');
  expect(result.outcomes[0]).toMatchObject({ kind: 'return', canon: '5' });
});

test('kills an infinite loop after the timeout and keeps working', async () => {
  const hang = await pool.run({ path: ['spin'], args: [0] }, 'UTC');
  expect(hang.outcomes[0]?.kind).toBe('timeout');
  const after = await pool.run({ path: ['spin'], args: [2] }, 'UTC');
  expect(after.outcomes[0]).toMatchObject({ kind: 'return', canon: '2' });
});

test('turns process.exit into an error instead of ending the worker', async () => {
  const result = await pool.run({ path: ['quit'], args: [1] }, 'UTC');
  expect(result.outcomes[0]).toMatchObject({ kind: 'throw' });
});

test('reports functions missing at runtime', async () => {
  const result = await pool.run({ path: ['nope'], args: [] }, 'UTC');
  expect(result.outcomes[0]?.kind).toBe('missing');
});

test('runs with the requested time zone', async () => {
  const lib = fileURLToPath(new URL('./fixtures/buggy-lib/dist/index.js', import.meta.url));
  const p = new Pool({ entry: lib, now: 0, timeout: 2000 });
  try {
    const result = await p.run({ path: ['yearLabel'], args: [0] }, 'America/New_York');
    expect(result.outcomes[0]).toMatchObject({ kind: 'return', canon: '"1969"' });
  } finally {
    p.close();
  }
});
