import type { Report, Severity } from '../types';

const SEVERITIES: readonly Severity[] = ['high', 'medium', 'low', 'info'];
const COLORS: Record<Severity, string> = { high: '31', medium: '33', low: '36', info: '90' };

/** Formats a report for the terminal. Pass `color: false` for plain text. */
export function formatTerminal(report: Report, options: { color?: boolean; verbose?: boolean } = {}): string {
  const color = options.color ?? false;
  const paint = (code: string, text: string) => (color ? `\u001b[${code}m${text}\u001b[0m` : text);
  const bold = (text: string) => paint('1', text);
  const dim = (text: string) => paint('2', text);
  const lines: string[] = [];
  const { target, stats } = report;
  lines.push(`${bold('breakhound')} ${dim(`v${report.tool.version}`)}  ${target.name}@${target.version} (${target.source})`);
  lines.push(
    dim(
      `${stats.analyzed} functions analyzed, ${stats.skipped} skipped | ${stats.calls} calls | ${report.options.zones.length} time zones | seed ${report.options.seed} | ${(stats.durationMs / 1000).toFixed(1)}s`,
    ),
  );
  lines.push('');
  for (const severity of SEVERITIES) {
    const group = report.findings.filter((f) => f.severity === severity);
    if (!group.length) continue;
    lines.push(paint(COLORS[severity], bold(`${severity.toUpperCase()} (${group.length})`)));
    for (const f of group) {
      lines.push(`  ${paint(COLORS[severity], `[${f.rule}]`)} ${f.title} ${dim(`(confidence ${f.confidence})`)}`);
      if (severity === 'info' && !options.verbose) continue;
      for (const e of f.evidence) lines.push(`    ${e.tz ? dim(`TZ=${e.tz} `) : ''}${e.call}  ${dim('->')} ${e.result}`);
      if (severity !== 'info') {
        lines.push(dim('    reproduction:'));
        for (const l of f.reproduction.trimEnd().split('\n')) lines.push(`      ${l}`);
        lines.push(dim('    vitest test:'));
        for (const l of f.test.trimEnd().split('\n')) lines.push(`      ${l}`);
      }
      lines.push('');
    }
    if (severity === 'info' && !options.verbose) lines.push('');
  }
  if (!report.findings.length) lines.push(paint('32', 'No findings.'), '');
  if (report.skipped.length) {
    lines.push(bold(`Skipped signatures (${report.skipped.length})`));
    const shown = options.verbose ? report.skipped : report.skipped.slice(0, 10);
    for (const s of shown) lines.push(`  ${s.id}: ${s.reason}`);
    if (shown.length < report.skipped.length) lines.push(dim(`  ...and ${report.skipped.length - shown.length} more (use --verbose)`));
    lines.push('');
  }
  const c = report.counts;
  lines.push(`${bold('Summary:')} ${c.high} high, ${c.medium} medium, ${c.low} low, ${c.info} info`);
  if (stats.budgetExhausted) lines.push(dim('The call budget ran out before every input was tried. Raise --max-calls for a deeper hunt.'));
  if (stats.unconfirmed) lines.push(dim(`${stats.unconfirmed} candidate finding(s) did not reproduce in a fresh process and were dropped.`));
  return `${lines.join('\n')}\n`;
}
