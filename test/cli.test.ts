import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, test } from 'vitest';
import { runCli } from '../src/run-cli';

const fixture = fileURLToPath(new URL('./fixtures/buggy-lib', import.meta.url));
const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

async function run(args: string[], env: Record<string, string> = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'breakhound-cli-'));
  dirs.push(cwd);
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
});
