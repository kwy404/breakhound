import type { Finding, HuntStatus, Report, Severity } from '../types';

const SEVERITIES: readonly Severity[] = ['high', 'medium', 'low', 'info'];
const SEV_COLORS: Record<Severity, string> = { high: '1;97;41', medium: '1;30;43', low: '1;30;46', info: '1;97;100' };
const SEV_TEXT: Record<Severity, string> = { high: '31', medium: '33', low: '36', info: '90' };
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;

/** Sniff the bloodhound detective, holding a magnifying glass. ASCII only. */
const SNIFF: readonly string[] = [
  String.raw`    __/\__        `,
  String.raw`   (  o  o)__     `,
  String.raw`   /   (_)   \ .-.`,
  String.raw`  ( '--'  ,__(( O )`,
  String.raw`   \_____/    \'-' `,
];

export interface TtyOptions {
  readonly color: boolean;
  readonly width?: number;
  readonly durationMs?: number;
  readonly savedPath?: string;
  /** List every skipped signature instead of the first five. */
  readonly verbose?: boolean;
}

/** Visible length of a string, ignoring ANSI escape codes. */
function visible(text: string): number {
  return text.replace(ANSI, '').length;
}

/** Wraps plain text (no ANSI) to `width` columns, breaking long words when needed. */
function wrap(text: string, width: number): string[] {
  const w = Math.max(1, width);
  const out: string[] = [];
  for (const raw of text.split('\n')) {
    const indent = /^\s*/.exec(raw)?.[0] ?? '';
    const pad = indent.length < w / 2 ? indent : '';
    let line = '';
    const words = raw.slice(indent.length).split(' ');
    let first = true;
    for (let word of words) {
      const prefix = first ? indent : pad;
      while (true) {
        const candidate = line ? `${line} ${word}` : `${prefix}${word}`;
        if (candidate.length <= w) {
          line = candidate;
          break;
        }
        if (line) {
          out.push(line);
          line = '';
          first = false;
          continue;
        }
        const room = Math.max(1, w - prefix.length);
        out.push(`${prefix}${word.slice(0, room)}`);
        word = word.slice(room);
        first = false;
        if (!word) break;
      }
      first = false;
    }
    out.push(line);
  }
  return out;
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

/** Renders a report as a rich terminal view. Pass `color: false` for plain text with no ANSI codes. */
export function renderTty(report: Report, opts: TtyOptions): string {
  const width = Math.max(40, Math.floor(opts.width ?? 100));
  const paint = (code: string, text: string) => (opts.color ? `\u001b[${code}m${text}\u001b[0m` : text);
  const bold = (text: string) => paint('1', text);
  const dim = (text: string) => paint('2', text);
  const lines: string[] = [];
  /** Pushes plain text wrapped to the full width, styled line by line. */
  const push = (text: string, style: (t: string) => string = (t) => t) => {
    for (const l of wrap(text, width)) lines.push(l ? style(l) : l);
  };
  const { target, stats } = report;
  const durationMs = opts.durationMs ?? stats.durationMs;

  // Header: Sniff next to the title and target.
  const side = [
    `${bold('breakhound')} ${dim(`v${report.tool.version}`)}`,
    `target ${target.name}@${target.version} ${dim(`(${target.source})`)}`,
    dim(`${stats.analyzed} functions, ${stats.calls} calls, seed ${report.options.seed}`),
    dim(`${report.options.zones.length} time ${report.options.zones.length === 1 ? 'zone' : 'zones'}, ${report.options.rules.length} ${report.options.rules.length === 1 ? 'rule' : 'rules'}`),
    '',
  ];
  const artWidth = Math.max(...SNIFF.map((l) => l.length));
  SNIFF.forEach((art, i) => {
    const text = side[i] ?? '';
    const room = width - artWidth - 2;
    let right = text;
    if (visible(text) > room) right = room > 3 ? text.replace(ANSI, '').slice(0, room - 3) + '...' : '';
    lines.push(`${paint('33', art.padEnd(artWidth))}  ${right}`.trimEnd());
  });
  lines.push('');

  // Findings, grouped by severity, each in a rounded box.
  const inner = width - 4;
  const box = (f: Finding): void => {
    const tag = ` ${f.severity.toUpperCase()} `;
    const title = ` ${f.function} `;
    const rule = ` ${f.rule} `;
    let fill = width - 3 - tag.length - title.length - rule.length;
    let shownTitle = title;
    if (fill < 1) {
      const cut = Math.max(4, title.length + fill - 1);
      shownTitle = `${title.slice(0, cut - 3)}...`;
      fill = Math.max(1, width - 3 - tag.length - shownTitle.length - rule.length);
    }
    const border = (t: string) => paint(SEV_TEXT[f.severity], t);
    lines.push(
      `${border('╭─')}${paint(SEV_COLORS[f.severity], tag)}${bold(shownTitle)}${border('─'.repeat(fill))}${dim(rule)}${border('╮')}`,
    );
    const row = (text: string, style: (t: string) => string = (t) => t) => {
      for (const l of wrap(text, inner)) lines.push(`${border('│')} ${style(l.padEnd(inner))} ${border('│')}`);
    };
    row(f.title, bold);
    row(f.explanation.replace(/\s+/g, ' ').trim());
    row('');
    row(`input: ${f.input.join(', ')}`);
    for (const e of f.evidence.slice(0, 2)) row(`${e.tz ? `TZ=${e.tz} ` : ''}${e.call} -> ${e.result}`, dim);
    if (f.reproduction.trim()) {
      row('');
      row('reproduction:', dim);
      for (const l of f.reproduction.trimEnd().split('\n')) row(`  ${l}`);
    }
    lines.push(border(`╰${'─'.repeat(width - 2)}╯`));
  };

  for (const severity of SEVERITIES) {
    const group = report.findings.filter((f) => f.severity === severity);
    if (!group.length) continue;
    lines.push(paint(SEV_TEXT[severity], bold(`${severity.toUpperCase()} (${group.length})`)));
    for (const f of group) box(f);
    lines.push('');
  }
  if (!report.findings.length) {
    push('Nothing sniffed out. Sniff found no bugs this time.', (t) => paint('32', t));
    lines.push('');
  }

  // Summary table: rule, count, severity.
  if (report.findings.length) {
    const rows = new Map<string, { rule: string; count: number; severity: Severity }>();
    for (const f of report.findings) {
      const key = `${f.rule}\u0000${f.severity}`;
      const r = rows.get(key);
      if (r) r.count += 1;
      else rows.set(key, { rule: f.rule, count: 1, severity: f.severity });
    }
    const sorted = [...rows.values()].sort(
      (a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) || b.count - a.count || a.rule.localeCompare(b.rule),
    );
    const ruleW = Math.min(Math.max(4, ...sorted.map((r) => r.rule.length)), width - 20);
    lines.push(bold('Summary'));
    lines.push(dim(`  ${'rule'.padEnd(ruleW)}  ${'count'.padStart(5)}  severity`));
    for (const r of sorted) {
      const name = r.rule.length > ruleW ? `${r.rule.slice(0, ruleW - 3)}...` : r.rule.padEnd(ruleW);
      lines.push(`  ${name}  ${String(r.count).padStart(5)}  ${paint(SEV_TEXT[r.severity], r.severity)}`);
    }
    lines.push('');
  }

  // Verdict.
  const n = report.findings.length;
  const verdict = `${n} ${n === 1 ? 'bug' : 'bugs'} sniffed out in ${stats.analyzed} ${stats.analyzed === 1 ? 'function' : 'functions'}, ${formatSeconds(durationMs)}`;
  push(verdict, (t) => bold(paint(n ? '31' : '32', t)));
  if (stats.budgetExhausted) push('The call budget ran out early. Raise --max-calls for a deeper hunt.', dim);
  if (stats.unconfirmed) push(`${stats.unconfirmed} candidate finding(s) did not reproduce in a fresh process and were dropped.`, dim);

  // Skipped signatures, briefly.
  if (report.skipped.length) {
    lines.push('');
    push(`Skipped ${report.skipped.length} ${report.skipped.length === 1 ? 'signature' : 'signatures'}:`, dim);
    const shown = opts.verbose ? report.skipped : report.skipped.slice(0, 5);
    for (const s of shown) push(`  ${s.id}: ${s.reason}`, dim);
    if (shown.length < report.skipped.length) push(`  ...and ${report.skipped.length - shown.length} more`, dim);
  }

  lines.push('');
  push('Hints: --json for machine output, --fail-on high for CI, --only <names> to focus', dim);
  if (opts.savedPath) push(`Saved report to ${opts.savedPath}`, dim);
  return `${lines.join('\n')}\n`;
}

export interface Progress {
  phase(name: string): void;
  tick(done: number, total: number, extra: { functions: number; findings: number }): void;
  stop(): void;
  /** Convenience for `HuntOptions.onStatus`: sets the phase and ticks in one call. */
  update(status: HuntStatus): void;
}

/** The part of a writable stream the progress line needs. `process.stderr` fits. */
export interface ProgressStream {
  write(text: string): unknown;
  readonly isTTY?: boolean;
  readonly columns?: number;
}

const SPINNER = ['|', '/', '-', '\\'];
const FRAME_MS = Math.ceil(1000 / 12);

/** Live progress line for TTY streams. Does nothing when the stream is not a TTY. */
export function createProgress(stream: NodeJS.WriteStream | ProgressStream, opts: { color: boolean; target?: string }): Progress {
  if (!stream.isTTY) return { phase() {}, tick() {}, stop() {}, update() {} };
  const paint = (code: string, text: string) => (opts.color ? `\u001b[${code}m${text}\u001b[0m` : text);
  const start = Date.now();
  let name = 'starting';
  let done = 0;
  let total = 0;
  let functions = 0;
  let findings = 0;
  let frame = 0;
  let last = -Infinity;
  let stopped = false;

  const draw = (): void => {
    if (stopped) return;
    const now = Date.now();
    if (now - last < FRAME_MS) return;
    last = now;
    const cols = Math.max(40, stream.columns || 80);
    const spin = SPINNER[frame++ % SPINNER.length] ?? '|';
    const ratio = total > 0 ? Math.min(1, done / total) : 0;
    const barW = Math.max(10, Math.min(30, cols - 60));
    const filled = Math.round(ratio * barW);
    const bar = `[${paint('33', '#'.repeat(filled))}${'.'.repeat(barW - filled)}]`;
    const pct = `${Math.round(ratio * 100)}%`.padStart(4);
    const counts = `${functions} fn, ${findings} ${findings === 1 ? 'finding' : 'findings'}`;
    const elapsed = formatSeconds(now - start);
    let label = name;
    const fixed = 2 + 1 + barW + 2 + 1 + pct.length + 2 + counts.length + 2 + elapsed.length + 1;
    const room = cols - fixed;
    if (label.length > room) label = room > 3 ? `${label.slice(0, room - 3)}...` : '';
    stream.write(`\r\u001b[2K${paint('36', spin)} ${label} ${bar} ${pct}  ${counts}  ${paint('2', elapsed)}`);
  };

  const timer = setInterval(() => draw(), FRAME_MS);
  timer.unref?.();

  return {
    phase(next: string) {
      name = next;
      draw();
    },
    tick(d, t, extra) {
      done = d;
      total = t;
      functions = extra.functions;
      findings = extra.findings;
      draw();
    },
    update(status) {
      name = opts.target ? `${status.phase} ${opts.target}` : status.phase;
      done = status.calls;
      total = status.estimatedCalls;
      functions = status.functionsDone;
      findings = status.findings;
      draw();
    },
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      stream.write('\r\u001b[2K');
    },
  };
}
