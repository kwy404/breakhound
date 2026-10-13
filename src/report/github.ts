import { appendFileSync } from 'node:fs';
import type { Finding, Report, Severity } from '../types';

const SEVERITIES: readonly Severity[] = ['high', 'medium', 'low', 'info'];
const COMMANDS: Record<Severity, 'error' | 'warning' | 'notice'> = {
  high: 'error',
  medium: 'warning',
  low: 'warning',
  info: 'notice',
};
const SKIPPED_SHOWN = 10;

/** Escapes the message part of a GitHub Actions workflow command. */
export function escapeData(text: string): string {
  return text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

/** Escapes a property value (for example `title`) of a GitHub Actions workflow command. */
export function escapeProperty(text: string): string {
  return escapeData(text).replace(/:/g, '%3A').replace(/,/g, '%2C');
}

function inputText(finding: Finding): string {
  return finding.input.length ? finding.input.join(', ') : '(no arguments)';
}

/** One GitHub Actions workflow command (error, warning or notice) per finding. */
export function githubAnnotations(report: Report): string[] {
  return report.findings.map((f) => {
    const title = escapeProperty(`breakhound ${f.rule}`);
    const message = escapeData(`${f.function}: ${f.title} (input: ${inputText(f)})`);
    return `::${COMMANDS[f.severity]} title=${title}::${message}`;
  });
}

function html(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function inlineCode(text: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(longest + 1);
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}

function codeBlock(code: string, lang: string): string {
  const longest = Math.max(0, ...(code.match(/`{3,}/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}${lang}\n${code.trimEnd()}\n${fence}`;
}

function verdict(report: Report): string {
  const c = report.counts;
  const total = report.findings.length;
  if (!total) return '**Verdict:** no findings.';
  const parts = SEVERITIES.filter((s) => c[s] > 0).map((s) => `${c[s]} ${s}`);
  const noun = total === 1 ? 'finding' : 'findings';
  if (c.high > 0) return `**Verdict:** likely bugs found, ${total} ${noun} (${parts.join(', ')}).`;
  if (c.medium + c.low > 0) return `**Verdict:** possible bugs found, ${total} ${noun} (${parts.join(', ')}).`;
  return `**Verdict:** only informational findings (${parts.join(', ')}).`;
}

/** Markdown job summary for `GITHUB_STEP_SUMMARY`. */
export function githubSummary(report: Report): string {
  const { target, stats } = report;
  const lines: string[] = [];
  lines.push(`## breakhound report for ${target.name}@${target.version}`, '');
  lines.push(verdict(report), '');
  lines.push(
    `${stats.analyzed} functions analyzed, ${stats.skipped} skipped, ${stats.calls} calls, seed ${report.options.seed}, ${(stats.durationMs / 1000).toFixed(1)}s.`,
    '',
  );

  if (report.findings.length) {
    const rows = new Map<string, { rule: string; severity: Severity; count: number }>();
    for (const f of report.findings) {
      const key = `${f.rule}\u0000${f.severity}`;
      const row = rows.get(key);
      if (row) row.count++;
      else rows.set(key, { rule: f.rule, severity: f.severity, count: 1 });
    }
    const sorted = [...rows.values()].sort(
      (a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) || a.rule.localeCompare(b.rule),
    );
    lines.push('| Rule | Severity | Count |', '| --- | --- | ---: |');
    for (const r of sorted) lines.push(`| ${cell(r.rule)} | ${r.severity} | ${r.count} |`);
    lines.push('');

    for (const severity of SEVERITIES) {
      for (const f of report.findings.filter((x) => x.severity === severity)) {
        lines.push('<details>');
        lines.push(`<summary><strong>${f.severity}</strong> ${html(f.rule)}: ${html(f.function)}: ${html(f.title)}</summary>`, '');
        lines.push(f.explanation.trim(), '');
        lines.push(`Expected: ${f.expected.trim()}`, '');
        lines.push(`Minimal input: ${inlineCode(inputText(f))}`, '');
        lines.push(`Confidence: ${f.confidence}${f.confirmed ? ', confirmed in a fresh process' : ''}`, '');
        lines.push('Reproduction:', '', codeBlock(f.reproduction, 'js'), '');
        lines.push('Vitest test:', '', codeBlock(f.test, 'ts'), '');
        lines.push('</details>', '');
      }
    }
  }

  if (report.skipped.length) {
    lines.push(`### Skipped signatures (${report.skipped.length})`, '');
    for (const s of report.skipped.slice(0, SKIPPED_SHOWN)) lines.push(`- ${inlineCode(s.id)}: ${s.reason}`);
    if (report.skipped.length > SKIPPED_SHOWN) lines.push(`- ...and ${report.skipped.length - SKIPPED_SHOWN} more`);
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

/** What `writeGithubOutputs` did. */
export interface GithubOutputResult {
  /** True when running inside GitHub Actions (`GITHUB_ACTIONS=true`). */
  readonly enabled: boolean;
  /** Number of workflow commands printed. */
  readonly annotations: number;
  /** File the job summary was appended to, or null when none was written. */
  readonly summaryPath: string | null;
}

/**
 * Inside GitHub Actions, prints one annotation per finding and appends the
 * markdown summary to `GITHUB_STEP_SUMMARY` when it is set. Does nothing elsewhere.
 */
export function writeGithubOutputs(
  report: Report,
  env: Readonly<Record<string, string | undefined>> = process.env,
  write: (text: string) => unknown = (text) => process.stdout.write(text),
): GithubOutputResult {
  if (env.GITHUB_ACTIONS !== 'true') return { enabled: false, annotations: 0, summaryPath: null };
  const annotations = githubAnnotations(report);
  if (annotations.length) write(`${annotations.join('\n')}\n`);
  const summaryPath = env.GITHUB_STEP_SUMMARY || null;
  if (summaryPath) appendFileSync(summaryPath, `${githubSummary(report)}\n`, 'utf8');
  return { enabled: true, annotations: annotations.length, summaryPath };
}
