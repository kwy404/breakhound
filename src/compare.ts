import type { Finding, Report, RuleId, Severity } from './types';

/** A finding as it appears in a comparison: enough to recognize it. */
export interface ComparedFinding {
  readonly rule: RuleId;
  readonly severity: Severity;
  readonly function: string;
  readonly title: string;
}

/** The difference between a baseline report and the current one. */
export interface Comparison {
  /** The baseline target, for example `my-lib@1.2.0`, and where it was read from. */
  readonly baseline: { readonly target: string; readonly file: string };
  /** Findings in the current report that the baseline did not have. */
  readonly added: readonly ComparedFinding[];
  /** Findings in the baseline that the current report no longer has. */
  readonly fixed: readonly ComparedFinding[];
  /** Findings present in both. */
  readonly unchanged: number;
}

const key = (f: Pick<Finding, 'rule' | 'function'>) => `${f.rule}\u0000${f.function}`;
const brief = (f: Finding): ComparedFinding => ({ rule: f.rule, severity: f.severity, function: f.function, title: f.title });

/** Checks that a parsed JSON value looks like a breakhound report. */
export function isReport(value: unknown): value is Report {
  if (!value || typeof value !== 'object') return false;
  const r = value as Partial<Report>;
  return Array.isArray(r.findings) && Boolean(r.target) && typeof r.target?.name === 'string';
}

/**
 * Compares two reports. A finding is the same in both when it has the same
 * rule and function, so a reworded message does not count as a new bug.
 */
export function compareReports(baseline: Report, current: Report, file = ''): Comparison {
  const before = new Map<string, number>();
  for (const f of baseline.findings) before.set(key(f), (before.get(key(f)) ?? 0) + 1);
  const after = new Map<string, number>();
  for (const f of current.findings) after.set(key(f), (after.get(key(f)) ?? 0) + 1);
  const added: ComparedFinding[] = [];
  const fixed: ComparedFinding[] = [];
  let unchanged = 0;
  const seen = new Map<string, number>();
  for (const f of current.findings) {
    const k = key(f);
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    if (n <= (before.get(k) ?? 0)) unchanged++;
    else added.push(brief(f));
  }
  seen.clear();
  for (const f of baseline.findings) {
    const k = key(f);
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    if (n > (after.get(k) ?? 0)) fixed.push(brief(f));
  }
  return { baseline: { target: `${baseline.target.name}@${baseline.target.version}`, file }, added, fixed, unchanged };
}

/** Formats a comparison for the terminal. */
export function formatComparison(c: Comparison, options: { color?: boolean } = {}): string {
  const paint = (code: string, text: string) => (options.color ? `\u001b[${code}m${text}\u001b[0m` : text);
  const lines = [`${paint('1', 'Compared with')} ${c.baseline.target}${c.baseline.file ? paint('2', ` (${c.baseline.file})`) : ''}: ${c.added.length} new, ${c.fixed.length} fixed, ${c.unchanged} unchanged`];
  for (const f of c.added) lines.push(`  ${paint('31', 'NEW  ')} ${paint('2', `[${f.rule}]`)} ${f.title} ${paint('2', `(${f.severity})`)}`);
  for (const f of c.fixed) lines.push(`  ${paint('32', 'FIXED')} ${paint('2', `[${f.rule}]`)} ${f.title}`);
  if (!c.added.length && !c.fixed.length) lines.push(paint('2', '  Same findings as the baseline.'));
  return `${lines.join('\n')}\n`;
}
