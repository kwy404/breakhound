import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, test } from 'vitest';
import { hunt } from '../src/index';
import type { Report } from '../src/index';

const fixture = fileURLToPath(new URL('./fixtures/buggy-lib', import.meta.url));
let report: Report;

beforeAll(async () => {
  report = await hunt(fixture, { maxCalls: 8000 });
});

const rulesFor = (fn: string) =>
  report.findings
    .filter((f) => f.function === fn && f.severity !== 'info')
    .map((f) => f.rule)
    .sort();

describe('buggy-lib fixture', () => {
  test.each([
    ['truncate', 'lone-surrogate-output'],
    ['initials', 'lone-surrogate-output'],
    ['initials', 'unexpected-crash'],
    ['yearLabel', 'timezone-dependent'],
    ['average', 'nan-leak'],
    ['label', 'nondeterministic'],
    ['encodeBase', 'roundtrip'],
    ['slugify', 'not-idempotent'],
    ['formatFixed', 'negative-zero-sign'],
  ])('%s is flagged by %s', (fn, rule) => {
    expect(rulesFor(fn)).toContain(rule);
  });

  test.each(['truncateSafe', 'yearLabelUtc', 'initialsSafe', 'averageSafe', 'labelSafe', 'encodeSafe', 'slugifySafe', 'formatFixedSafe', 'pad', 'percent'])(
    'correct twin %s has no findings above info',
    (fn) => {
      expect(rulesFor(fn)).toEqual([]);
    },
  );

  test('expected variation and validation errors are info only', () => {
    const info = report.findings.filter((f) => f.severity === 'info').map((f) => `${f.function}:${f.rule}`);
    expect(info).toContain('randomToken:nondeterministic');
    expect(info).toContain('percent:unexpected-crash');
  });

  test('unsupported signatures are reported as skipped', () => {
    expect(report.skipped.map((s) => s.id)).toEqual(['mapWords']);
    expect(report.stats.skipped).toBe(1);
  });

  test('every finding is confirmed and has a reproduction and a Vitest test', () => {
    for (const f of report.findings.filter((x) => x.severity !== 'info')) {
      expect(f.confirmed).toBe(true);
      expect(f.reproduction).toContain("from 'buggy-lib'");
      expect(f.test).toContain("from 'vitest'");
    }
  });

  test('shrinks to the simplest input', () => {
    const lone = report.findings.find((f) => f.function === 'truncate');
    expect(lone?.input).toEqual(["'\\u{1F600}'", '1']);
    const crash = report.findings.find((f) => f.function === 'initials' && f.rule === 'unexpected-crash');
    expect(crash?.input).toEqual(["''"]);
  });

  test('the same seed gives the same findings', async () => {
    const rules = ['lone-surrogate-output', 'unexpected-crash'] as const;
    const again = await hunt(fixture, { maxCalls: 8000, rules: [...rules] });
    const first = report.findings.filter((f) => (rules as readonly string[]).includes(f.rule)).map((f) => f.title);
    expect(again.findings.map((f) => f.title)).toEqual(first);
  });
});
