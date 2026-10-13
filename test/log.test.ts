import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { createRunLogger, saveRunArtifacts } from '../src/log';

const tmp = mkdtempSync(join(tmpdir(), 'breakhound-log-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const sink = () => {
  const out: string[] = [];
  return { out, stream: { write: (s: string) => out.push(s) } };
};

const clock = (start: number) => {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
};

describe('createRunLogger', () => {
  test('records valid JSON Lines with time, type and data', () => {
    const c = clock(Date.UTC(2026, 0, 1));
    const log = createRunLogger({ now: c.now });
    log.event('run-start', { version: '1.0.0', target: 'slugify', options: { seed: 42 }, node: 'v20', platform: 'linux' });
    c.advance(10);
    log.event('finding', { rule: 'nan-leak', severity: 'high', function: 'average', input: ['[]'] });
    log.event('run-end');
    const lines = log.lines();
    expect(lines).toHaveLength(3);
    const parsed = lines.map((l) => JSON.parse(l) as Record<string, unknown>);
    for (const l of lines) expect(l).not.toContain('\n');
    expect(parsed[0]).toEqual({
      t: '2026-01-01T00:00:00.000Z',
      type: 'run-start',
      version: '1.0.0',
      target: 'slugify',
      options: { seed: 42 },
      node: 'v20',
      platform: 'linux',
    });
    expect(parsed[1]).toMatchObject({ t: '2026-01-01T00:00:00.010Z', type: 'finding', rule: 'nan-leak', input: ['[]'] });
    expect(parsed[2]).toEqual({ t: '2026-01-01T00:00:00.010Z', type: 'run-end' });
  });

  test('serializes bigint values instead of throwing', () => {
    const log = createRunLogger({});
    expect(() => log.event('calls', { count: 10n })).not.toThrow();
    expect(JSON.parse(log.lines()[0]!)).toMatchObject({ count: '10n' });
  });

  test('debug writes to stderr only when verbose', () => {
    const c = clock(1000);
    const on = sink();
    const verbose = createRunLogger({ verbose: true, stderr: on.stream, now: c.now });
    c.advance(25);
    verbose.debug('reading types');
    expect(on.out).toEqual(['[breakhound] 25ms reading types\n']);

    const off = sink();
    const quiet = createRunLogger({ verbose: false, stderr: off.stream, now: c.now });
    quiet.debug('reading types');
    expect(off.out).toEqual([]);
  });

  test('appends events to a file, creating parent folders', async () => {
    const file = join(tmp, 'nested', 'deeper', 'run.jsonl');
    const log = createRunLogger({ file });
    log.event('signature', { name: 'slugify', status: 'extracted' });
    log.event('signature', { name: 'weird', status: 'skipped', reason: 'unsupported type' });
    await log.close();
    const content = readFileSync(file, 'utf8');
    expect(content.endsWith('\n')).toBe(true);
    const rows = content.trim().split('\n').map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(rows.map((r) => r.status)).toEqual(['extracted', 'skipped']);
    expect(rows[1]).toMatchObject({ type: 'signature', reason: 'unsupported type' });
    expect(content.trim().split('\n')).toEqual(log.lines());
  });

  test('an unwritable path does not throw and is reported once', async () => {
    const blocker = join(tmp, 'blocker');
    writeFileSync(blocker, 'a file, not a folder');
    const err = sink();
    const log = createRunLogger({ file: join(blocker, 'sub', 'run.jsonl'), verbose: true, stderr: err.stream });
    expect(() => {
      log.event('timeout', { function: 'spin' });
      log.event('runner-error', { detail: 'crash' });
    }).not.toThrow();
    await expect(log.close()).resolves.toBeUndefined();
    expect(log.lines()).toHaveLength(2);
    expect(err.out.filter((l) => l.includes('cannot write log file'))).toHaveLength(1);
  });
});

describe('saveRunArtifacts', () => {
  test('writes the log and the report when save is true', () => {
    const dir = join(tmp, 'project');
    const lines = ['{"type":"run-start"}', '{"type":"run-end"}'];
    const result = saveRunArtifacts(dir, { findings: [] }, lines, { save: true });
    expect(result.saved).toBe(true);
    expect(result.logPath).toBe(join(dir, '.breakhound', 'last-run.jsonl'));
    expect(result.reportPath).toBe(join(dir, '.breakhound', 'report.json'));
    expect(readFileSync(result.logPath!, 'utf8')).toBe(`${lines.join('\n')}\n`);
    expect(JSON.parse(readFileSync(result.reportPath!, 'utf8'))).toEqual({ findings: [] });
  });

  test('writes nothing when save is false', () => {
    const dir = join(tmp, 'nosave');
    expect(saveRunArtifacts(dir, {}, ['{}'], { save: false })).toEqual({ saved: false });
    expect(() => readFileSync(join(dir, '.breakhound', 'report.json'))).toThrow();
  });
});
