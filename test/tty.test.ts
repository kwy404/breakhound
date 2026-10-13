import { describe, expect, test } from 'vitest';
import { createProgress, renderTty } from '../src/report/tty';
import type { Finding, Report } from '../src/types';

const finding = (over: Partial<Finding> = {}): Finding => ({
  rule: 'nan-leak',
  severity: 'high',
  confidence: 'high',
  function: 'average',
  signature: 'average(values: number[]): number',
  title: 'average returns NaN for an empty array',
  explanation:
    'The function was called with an empty array and returned NaN, which silently spreads through any arithmetic that uses the result. A long explanation that has to wrap inside the box because it is far wider than the configured width of the terminal.',
  expected: 'A number or a thrown error',
  input: ['[]'],
  evidence: [{ call: 'average([])', result: 'NaN' }],
  reproduction: "import { average } from 'buggy-lib';\nconsole.log(average([]));",
  test: '',
  confirmed: true,
  ...over,
});

const report: Report = {
  tool: { name: 'breakhound', version: '1.2.3' },
  target: { spec: 'buggy-lib', name: 'buggy-lib', version: '0.0.1', source: 'local', types: 'index.d.ts', entry: 'index.js' },
  options: { seed: 42, maxCalls: 20000, timeout: 2000, zones: ['UTC', 'Asia/Tokyo'], rules: ['nan-leak', 'unexpected-crash'] },
  stats: { exports: 25, analyzed: 24, skipped: 1, calls: 1234, durationMs: 1900, budgetExhausted: false, unconfirmed: 0 },
  counts: { high: 2, medium: 1, low: 0, info: 0 },
  findings: [
    finding(),
    finding({ function: 'truncate', input: ["'\\ud83d\\ude00'", '1'], rule: 'unexpected-crash' }),
    finding({ function: 'pad', severity: 'medium', rule: 'unexpected-crash', title: 'pad throws on a negative width' }),
  ],
  skipped: [{ id: 'weird', reason: 'unsupported parameter type' }],
  functions: [],
};

describe('renderTty', () => {
  test('plain output is stable and contains every section', () => {
    const out = renderTty(report, { color: false });
    expect(out).toBe(renderTty(report, { color: false }));
    expect(out).not.toMatch(/\u001b\[/);
    expect(out).toContain('breakhound v1.2.3');
    expect(out).toContain('buggy-lib@0.0.1');
    expect(out).toContain('╭─ HIGH  average ');
    expect(out).toContain('╰');
    expect(out).toContain('input: []');
    expect(out).toContain('reproduction:');
    expect(out).toContain('Summary');
    expect(out).toMatch(/unexpected-crash\s+1\s+high/);
    expect(out).toContain('3 bugs sniffed out in 24 functions, 1.9 s');
    expect(out).toContain('weird: unsupported parameter type');
    expect(out).toContain('--fail-on high');
    for (const code of [0x2013, 0x2014]) expect(out).not.toContain(String.fromCharCode(code));
  });

  test('shows the saved path and duration override', () => {
    const out = renderTty(report, { color: false, durationMs: 500, savedPath: 'breakhound-report.json' });
    expect(out).toContain('0.5 s');
    expect(out).toContain('breakhound-report.json');
  });

  test('color output contains ANSI codes', () => {
    expect(renderTty(report, { color: true })).toMatch(/\u001b\[[0-9;]+m/);
  });

  test.each([100, 60, 40])('no line exceeds width %i', (width) => {
    for (const color of [false, true]) {
      const out = renderTty(report, { color, width });
      for (const line of out.split('\n')) expect(line.replace(/\u001b\[[0-9;]*m/g, '').length).toBeLessThanOrEqual(width);
    }
  });

  test('boxes are exactly the requested width', () => {
    const out = renderTty(report, { color: false, width: 70 });
    const boxLines = out.split('\n').filter((l) => /^[╭│╰]/.test(l));
    expect(boxLines.length).toBeGreaterThan(0);
    for (const l of boxLines) expect(l.length).toBe(70);
  });
});

describe('createProgress', () => {
  const fakeStream = (isTTY: boolean) => {
    const writes: string[] = [];
    const stream = { isTTY, columns: 100, write: (s: string) => (writes.push(s), true) } as unknown as NodeJS.WriteStream;
    return { stream, writes };
  };

  test('writes nothing when the stream is not a TTY', () => {
    const { stream, writes } = fakeStream(false);
    const p = createProgress(stream, { color: false });
    p.phase('hunting');
    p.tick(5, 10, { functions: 2, findings: 1 });
    p.stop();
    expect(writes).toEqual([]);
  });

  test('writes in place frames for a TTY stream and throttles them', () => {
    const { stream, writes } = fakeStream(true);
    const p = createProgress(stream, { color: false });
    p.phase('hunting');
    for (let i = 0; i < 50; i++) p.tick(i, 50, { functions: 3, findings: 1 });
    p.stop();
    expect(writes.length).toBeGreaterThanOrEqual(2);
    expect(writes.length).toBeLessThan(10);
    expect(writes[0]).toMatch(/^\r\u001b\[2K/);
    expect(writes[0]).toContain('hunting');
    expect(writes[0]).toContain('[');
    expect(writes.at(-1)).toBe('\r\u001b[2K');
  });
});
