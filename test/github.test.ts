import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import {
  escapeData,
  escapeProperty,
  githubAnnotations,
  githubSummary,
  writeGithubOutputs,
} from '../src/report/github';
import type { Finding, Report, Severity } from '../src/types';

function finding(severity: Severity, overrides: Partial<Finding> = {}): Finding {
  return {
    rule: 'unexpected-crash',
    severity,
    confidence: 'high',
    function: 'truncate',
    signature: 'truncate(text: string, max: number): string',
    title: 'throws on an empty string',
    explanation: 'The function throws a TypeError for an empty string.',
    expected: 'An empty string.',
    input: ["''", '2'],
    evidence: [{ call: "truncate('', 2)", result: 'throws TypeError: bad' }],
    reproduction: "import { truncate } from 'buggy-lib';\nconsole.log(truncate('', 2));\n",
    test: "import { expect, test } from 'vitest';\ntest('x', () => { expect(1).toBe(1); });\n",
    confirmed: true,
    ...overrides,
  };
}

function fakeReport(findings: Finding[], skipped: Report['skipped'] = []): Report {
  const counts: Record<Severity, number> = { high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;
  return {
    tool: { name: 'breakhound', version: '0.1.0' },
    target: { spec: 'buggy-lib', name: 'buggy-lib', version: '1.2.3', source: 'local', types: 'index.d.ts', entry: 'index.js' },
    options: { seed: 42, maxCalls: 20000, timeout: 2000, zones: ['UTC'], rules: [] },
    stats: { exports: 3, analyzed: 2, skipped: skipped.length, calls: 100, durationMs: 1500, budgetExhausted: false, unconfirmed: 0 },
    counts,
    findings,
    skipped,
    functions: [],
  };
}

describe('escaping', () => {
  test('escapes data per GitHub rules', () => {
    expect(escapeData('100%\r\nnext: a, b')).toBe('100%25%0D%0Anext: a, b');
  });

  test('escapes properties including colon and comma', () => {
    expect(escapeProperty('a:b,c%\n')).toBe('a%3Ab%2Cc%25%0A');
  });

  test('annotations escape newlines and percent signs in the message', () => {
    const report = fakeReport([finding('high', { title: 'returns 50%\nwrong', input: ["'a\\nb'"] })]);
    const [line] = githubAnnotations(report);
    expect(line).toBe("::error title=breakhound unexpected-crash::truncate: returns 50%25%0Awrong (input: 'a\\nb')");
    expect(line).not.toContain('\n');
  });
});

describe('severity mapping', () => {
  test('maps high to error, medium and low to warning, info to notice', () => {
    const report = fakeReport([finding('high'), finding('medium'), finding('low'), finding('info', { rule: 'nan-leak' })]);
    const lines = githubAnnotations(report);
    expect(lines.map((l) => l.split(' ')[0])).toEqual(['::error', '::warning', '::warning', '::notice']);
    expect(lines[0]).toBe("::error title=breakhound unexpected-crash::truncate: throws on an empty string (input: '', 2)");
    expect(lines[3]).toContain('title=breakhound nan-leak::');
  });

  test('no findings means no annotations', () => {
    expect(githubAnnotations(fakeReport([]))).toEqual([]);
  });
});

describe('summary', () => {
  test('contains title, verdict, table, details and skipped list', () => {
    const report = fakeReport(
      [finding('high'), finding('high'), finding('low', { rule: 'roundtrip', function: 'encode', title: 'decode(encode(x)) <> x' })],
      [{ id: 'weird', reason: 'unsupported parameter type' }],
    );
    const md = githubSummary(report);
    expect(md).toContain('breakhound report for buggy-lib@1.2.3');
    expect(md).toContain('**Verdict:** likely bugs found, 3 findings (2 high, 1 low).');
    expect(md).toContain('| Rule | Severity | Count |');
    expect(md).toContain('| unexpected-crash | high | 2 |');
    expect(md).toContain('| roundtrip | low | 1 |');
    expect(md.match(/<details>/g)).toHaveLength(3);
    expect(md).toContain('The function throws a TypeError for an empty string.');
    expect(md).toContain("Minimal input: `'', 2`");
    expect(md).toContain("```js\nimport { truncate } from 'buggy-lib';\nconsole.log(truncate('', 2));\n```");
    expect(md).toContain("```ts\nimport { expect, test } from 'vitest';");
    expect(md).toContain('decode(encode(x)) &lt;&gt; x');
    expect(md).toContain('### Skipped signatures (1)');
    expect(md).toContain('- `weird`: unsupported parameter type');
  });

  test('clean report says no findings and has no table', () => {
    const md = githubSummary(fakeReport([]));
    expect(md).toContain('**Verdict:** no findings.');
    expect(md).not.toContain('| Rule |');
    expect(md).not.toContain('<details>');
  });

  test('uses a longer fence when the code contains triple backticks', () => {
    const md = githubSummary(fakeReport([finding('medium', { reproduction: 'const s = "```";\n' })]));
    expect(md).toContain('````js\nconst s = "```";\n````');
  });
});

describe('writeGithubOutputs', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });
  const tempSummary = () => {
    const dir = mkdtempSync(join(tmpdir(), 'breakhound-gh-'));
    dirs.push(dir);
    return join(dir, 'summary.md');
  };

  test('prints annotations and appends the summary when GITHUB_ACTIONS is true', () => {
    const path = tempSummary();
    const out: string[] = [];
    const report = fakeReport([finding('high'), finding('info')]);
    const result = writeGithubOutputs(report, { GITHUB_ACTIONS: 'true', GITHUB_STEP_SUMMARY: path }, (t) => out.push(t));
    expect(result).toEqual({ enabled: true, annotations: 2, summaryPath: path });
    expect(out.join('')).toBe(`${githubAnnotations(report).join('\n')}\n`);
    expect(readFileSync(path, 'utf8')).toContain('breakhound report for buggy-lib@1.2.3');

    writeGithubOutputs(report, { GITHUB_ACTIONS: 'true', GITHUB_STEP_SUMMARY: path }, () => undefined);
    expect(readFileSync(path, 'utf8').match(/breakhound report for/g)).toHaveLength(2);
  });

  test('prints annotations without a summary file when GITHUB_STEP_SUMMARY is unset', () => {
    const out: string[] = [];
    const result = writeGithubOutputs(fakeReport([finding('low')]), { GITHUB_ACTIONS: 'true' }, (t) => out.push(t));
    expect(result).toEqual({ enabled: true, annotations: 1, summaryPath: null });
    expect(out).toHaveLength(1);
  });

  test('does nothing outside GitHub Actions', () => {
    const path = tempSummary();
    const out: string[] = [];
    const result = writeGithubOutputs(fakeReport([finding('high')]), { GITHUB_STEP_SUMMARY: path }, (t) => out.push(t));
    expect(result).toEqual({ enabled: false, annotations: 0, summaryPath: null });
    expect(out).toEqual([]);
    expect(existsSync(path)).toBe(false);
  });
});
