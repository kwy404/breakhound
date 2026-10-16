import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, test } from 'vitest';
import { runCli, suggest } from '../src/run-cli';

const fixture = fileURLToPath(new URL('./fixtures/buggy-lib', import.meta.url));
const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

async function run(args: string[], env: Record<string, string> = {}, dir?: string) {
  const cwd = dir ?? mkdtempSync(join(tmpdir(), 'breakhound-cli-'));
  if (!dir) dirs.push(cwd);
  let stdout = '';
  let stderr = '';
  const code = await runCli(args, {
    stdout: { write: (t: string) => (stdout += t), isTTY: false },
    stderr: { write: (t: string) => (stderr += t), isTTY: false },
    env,
    cwd,
  });
  return { code, stdout, stderr, cwd };
}

const ONLY = ['--only', 'truncate,formatFixed,formatFixedSafe'];

describe('command line', () => {
  test('plain output without ANSI codes, independent of the version', async () => {
    const { code, stdout } = await run([fixture, ...ONLY]);
    expect(code).toBe(0);
    expect(stdout).not.toContain('\u001b[');
    const firstLine = stdout.split('\n')[0]?.replace(/v\d+\.\d+\.\d+\S*/, 'vX');
    expect(firstLine).toBe('breakhound vX  buggy-lib@1.0.0 (local)');
    expect(stdout).toContain('[lone-surrogate-output] truncate returns a string with a lone surrogate');
    expect(stdout).toContain('[negative-zero-sign] formatFixed drops the minus sign of numbers between -1 and 0');
    expect(stdout).toContain('Summary: 1 high, 1 medium, 0 low, 0 info');
  });

  test('--fail-on sets the exit code', async () => {
    expect((await run([fixture, ...ONLY, '--fail-on', 'high'])).code).toBe(1);
    expect((await run([fixture, '--only', 'formatFixedSafe', '--fail-on', 'info'])).code).toBe(0);
  });

  test('--json prints the report and keeps debug lines on stderr', async () => {
    const { stdout, stderr } = await run([fixture, ...ONLY, '--json', '--verbose']);
    const report = JSON.parse(stdout) as { findings: unknown[] };
    expect(report.findings).toHaveLength(2);
    expect(stderr).toContain('[breakhound]');
  });

  test('saves the run log and report under .breakhound by default', async () => {
    const { cwd } = await run([fixture, ...ONLY]);
    const lines = readFileSync(join(cwd, '.breakhound', 'last-run.jsonl'), 'utf8').trim().split('\n');
    const types = lines.map((l) => (JSON.parse(l) as { type: string }).type);
    expect(types[0]).toBe('run-start');
    expect(types.at(-1)).toBe('run-end');
    for (const t of ['signature', 'calls', 'finding']) expect(types).toContain(t);
    expect(JSON.parse(readFileSync(join(cwd, '.breakhound', 'report.json'), 'utf8'))).toHaveProperty('findings');
  });

  test('--no-save writes nothing and --log writes JSON Lines', async () => {
    const { cwd } = await run([fixture, ...ONLY, '--no-save', '--log', 'run.jsonl']);
    expect(existsSync(join(cwd, '.breakhound'))).toBe(false);
    const lines = readFileSync(join(cwd, 'run.jsonl'), 'utf8').trim().split('\n');
    expect(lines.every((l) => typeof (JSON.parse(l) as { type: unknown }).type === 'string')).toBe(true);
  });

  test('GitHub Actions annotations and job summary', async () => {
    const summary = join(mkdtempSync(join(tmpdir(), 'breakhound-gh-')), 'summary.md');
    dirs.push(summary.replace(/[\\/]summary\.md$/, ''));
    writeFileSync(summary, '');
    const { stdout } = await run([fixture, ...ONLY, '--no-save'], { GITHUB_ACTIONS: 'true', GITHUB_STEP_SUMMARY: summary });
    expect(stdout).toMatch(/^::error /m);
    expect(stdout).toMatch(/^::warning /m);
    expect(readFileSync(summary, 'utf8')).toContain('lone-surrogate-output');
  });

  test('help and version', async () => {
    expect((await run(['--help'])).stdout).toContain('Usage: breakhound');
    expect((await run(['--version'])).stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  test('unknown options, rules and severities get a did you mean hint', async () => {
    await expect(run([fixture, '--jsn'])).rejects.toThrow('unknown option --jsn. Did you mean --json?');
    await expect(run([fixture, '--rules', 'nan-leaks'])).rejects.toThrow('Did you mean nan-leak?');
    await expect(run([fixture, '--fail-on', 'hgh'])).rejects.toThrow('Did you mean high?');
    expect(suggest('max-call', ['max-calls', 'only'])).toBe('max-calls');
    expect(suggest('zzz', ['json', 'only'])).toBeUndefined();
  });

  test('with no target it hunts the package in the current folder', async () => {
    const empty = await run([]);
    expect(empty.code).toBe(2);
    expect(empty.stdout).toContain('Usage: breakhound');
    const { code, stdout, stderr } = await run(['--only', 'truncate', '--no-save'], {}, fixture);
    expect(code).toBe(0);
    expect(stderr).toContain('hunts the package in this folder');
    expect(stdout).toContain('buggy-lib@1.0.0 (local)');
  });

  test('--baseline lists new and fixed findings and gates only on new ones', async () => {
    const first = await run([fixture, '--only', 'truncate', '--json', '--output', 'base.json']);
    const base = join(first.cwd, 'base.json');
    const { code, stdout } = await run([fixture, '--only', 'formatFixed,formatFixedSafe', '--baseline', base, '--fail-on', 'high']);
    expect(code).toBe(0);
    expect(stdout).toContain('Compared with buggy-lib@1.0.0');
    expect(stdout).toContain('1 new, 1 fixed, 0 unchanged');
    expect(stdout).toMatch(/NEW +\[negative-zero-sign\] formatFixed/);
    expect(stdout).toMatch(/FIXED \[lone-surrogate-output\] truncate/);
    const same = await run([fixture, '--only', 'truncate', '--baseline', base, '--fail-on', 'high', '--json']);
    expect(same.code).toBe(0);
    const json = JSON.parse(same.stdout) as { comparison: { added: unknown[]; fixed: unknown[]; unchanged: number } };
    expect(json.comparison).toMatchObject({ added: [], fixed: [], unchanged: 1 });
    await expect(run([fixture, '--baseline', 'last'])).rejects.toThrow('no saved run yet');
    await expect(run([fixture, '--baseline', join(fixture, 'package.json')])).rejects.toThrow('is not a breakhound report');
  });
});
