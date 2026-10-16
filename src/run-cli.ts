import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { compareReports, formatComparison, isReport, type Comparison } from './compare';
import { hunt, SEVERITIES } from './hunt';
import { createRunLogger, saveRunArtifacts } from './log';
import { isRuleId, RULE_IDS } from './oracles/index';
import { writeGithubOutputs } from './report/github';
import { formatTerminal } from './report/terminal';
import { createProgress, renderTty } from './report/tty';
import type { HuntEvent, Report, RuleId, Severity } from './types';
import { VERSION } from './version';

export const HELP = `breakhound
Point it at any JavaScript package. It sniffs out the bugs.

Usage: breakhound [npm package | local path] [options]

With no target, breakhound hunts the package in the current folder.

Options:
  --only <names>        Only these functions (comma separated, * wildcards)
  --exclude <names>     Skip these functions
  --rules <ids>         Only these rules: ${RULE_IDS.join(', ')}
  --seed <n>            Seed for random inputs (default 42)
  --max-calls <n>       Call budget for the whole hunt (default 20000)
  --timeout <ms>        Per call timeout (default 2000)
  --zones <list>        Time zones, the first is the primary one
  --fail-on <severity>  Exit with code 1 when a finding has this severity or higher (high, medium, low, info)
  --baseline <file>     Compare with an earlier JSON report and list new and fixed findings.
                        "last" means the previous run saved in .breakhound/report.json.
                        With --fail-on, only new findings fail the run
  --json                Print the report as JSON
  --output <file>       Write the report to a file instead of stdout
  --plain               Plain text output: no colors, boxes or spinner
  --no-color            Disable colors (also NO_COLOR=1)
  --log <file>          Write a JSON Lines run log (also BREAKHOUND_LOG)
  --no-save             Do not save .breakhound/last-run.jsonl and .breakhound/report.json
  -v, --verbose         Debug lines on stderr, info findings and every skipped signature
  -V, --version         Print the version
  -h, --help            Print this help

breakhound executes the package code. Run it only on code you trust, or inside a container.`;

export interface CliIo {
  readonly stdout: { write(text: string): unknown; isTTY?: boolean; columns?: number };
  readonly stderr: { write(text: string): unknown; isTTY?: boolean; columns?: number };
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
}

const OPTIONS = {
  only: { type: 'string' },
  exclude: { type: 'string' },
  rules: { type: 'string' },
  seed: { type: 'string' },
  'max-calls': { type: 'string' },
  timeout: { type: 'string' },
  zones: { type: 'string' },
  'fail-on': { type: 'string' },
  baseline: { type: 'string' },
  json: { type: 'boolean' },
  output: { type: 'string' },
  plain: { type: 'boolean' },
  'no-color': { type: 'boolean' },
  log: { type: 'string' },
  'no-save': { type: 'boolean' },
  verbose: { type: 'boolean', short: 'v' },
  version: { type: 'boolean', short: 'V' },
  help: { type: 'boolean', short: 'h' },
} as const;

/** Edit distance, for "did you mean" hints. */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0] as number;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = row[j] as number;
      row[j] = Math.min(next + 1, (row[j - 1] as number) + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = next;
    }
  }
  return row[b.length] as number;
}

/** The closest candidate, when it is close enough to be a typo. */
export function suggest(input: string, candidates: readonly string[]): string | undefined {
  let best: string | undefined;
  let score = Infinity;
  for (const c of candidates) {
    const d = input.length >= 3 && c.startsWith(input) ? 0.5 : distance(input, c);
    if (d < score) {
      score = d;
      best = c;
    }
  }
  return best !== undefined && score <= Math.max(1, Math.floor(input.length / 3)) ? best : undefined;
}

const hint = (input: string, candidates: readonly string[], prefix = '') => {
  const s = suggest(input, candidates);
  return s ? ` Did you mean ${prefix}${s}?` : '';
};

function parse(argv: readonly string[]) {
  try {
    return parseArgs({ args: [...argv], allowPositionals: true, options: OPTIONS });
  } catch (error) {
    const code = (error as { code?: string }).code;
    const message = error instanceof Error ? error.message : String(error);
    const option = /'(-{1,2}[^'\s]+)/.exec(message)?.[1];
    if (code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION' && option) {
      const name = option.replace(/^-+/, '').split('=')[0] ?? '';
      throw new Error(`unknown option ${option}.${hint(name, Object.keys(OPTIONS), '--')} Run breakhound --help for the full list.`);
    }
    if (code === 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE' && option) throw new Error(`${option} needs a value. Run breakhound --help for examples.`);
    throw error;
  }
}

/** Reads the report to compare with. `last` means the previous saved run. */
function readBaseline(value: string, cwd: string): { report: Report; file: string } {
  const last = value === 'last';
  const file = last ? '.breakhound/report.json' : value;
  const path = resolve(cwd, file);
  if (!existsSync(path)) {
    throw new Error(
      last
        ? 'no saved run yet in .breakhound/report.json. Run breakhound once without --no-save, then use --baseline last.'
        : `baseline report not found: ${file}. Save one with --json --output ${file}.`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error(`${file} is not valid JSON. Save a baseline with --json --output ${file}.`);
  }
  if (!isReport(parsed)) throw new Error(`${file} is not a breakhound report. Save one with --json --output ${file}.`);
  return { report: parsed, file };
}

const list = (value: string | undefined) => (value ? value.split(',').map((s) => s.trim()).filter(Boolean) : undefined);

/** Runs the command line interface. Returns the exit code. */
export async function runCli(argv: readonly string[], io: CliIo): Promise<number> {
  const { values, positionals } = parse(argv);
  if (values.version) {
    io.stdout.write(`${VERSION}\n`);
    return 0;
  }
  if (values.help) {
    io.stdout.write(`${HELP}\n`);
    return 0;
  }
  let target = positionals[0];
  if (!target) {
    if (!existsSync(join(io.cwd, 'package.json'))) {
      io.stdout.write(`${HELP}\n`);
      return 2;
    }
    target = resolve(io.cwd) === resolve(process.cwd()) ? '.' : io.cwd;
    io.stderr.write('No target given, so breakhound hunts the package in this folder.\n');
  }
  const rules = list(values.rules);
  for (const rule of rules ?? []) {
    if (!isRuleId(rule)) throw new Error(`unknown rule: ${rule}.${hint(rule, RULE_IDS)} Known rules: ${RULE_IDS.join(', ')}`);
  }
  const failOn = values['fail-on'] as Severity | undefined;
  if (failOn && !SEVERITIES.includes(failOn)) throw new Error(`--fail-on must be one of ${SEVERITIES.join(', ')}.${hint(failOn, SEVERITIES)}`);
  const baseline = values.baseline ? readBaseline(values.baseline, io.cwd) : undefined;
  const number = (name: string, value: string | undefined) => {
    if (value === undefined) return undefined;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) throw new Error(`--${name} must be a non negative number`);
    return n;
  };
  const seed = number('seed', values.seed);
  const maxCalls = number('max-calls', values['max-calls']);
  const timeout = number('timeout', values.timeout);

  const noColor = Boolean(values['no-color']) || Boolean(io.env.NO_COLOR);
  const plain = Boolean(values.plain) || !io.stdout.isTTY || noColor || Boolean(values.json) || Boolean(values.output);
  const verbose = Boolean(values.verbose);
  const logFile = values.log ?? io.env.BREAKHOUND_LOG;
  const logger = createRunLogger({
    ...(logFile ? { file: resolve(io.cwd, logFile) } : {}),
    verbose,
    stderr: io.stderr,
  });
  logger.event('run-start', {
    version: VERSION,
    target,
    node: process.version,
    platform: process.platform,
    options: { only: values.only, exclude: values.exclude, rules, seed, maxCalls, timeout, zones: values.zones },
  });
  const started = Date.now();
  const logEvent = (event: HuntEvent): void => {
    switch (event.type) {
      case 'signature':
        logger.event('signature', { name: event.id, status: 'extracted', signature: event.signature });
        break;
      case 'skipped':
        logger.event('signature', { name: event.id, status: 'skipped', reason: event.reason });
        break;
      case 'calls':
        logger.event('calls', { function: event.function, count: event.calls, inputs: event.inputs, timeZone: event.zones.join(','), durationMs: event.ms });
        break;
      case 'finding':
        logger.event('finding', { rule: event.rule, severity: event.severity, function: event.function, title: event.title, confirmed: event.confirmed });
        break;
      case 'runner':
        if (event.kind === 'timeout') logger.event('timeout', { function: event.function, timeZone: event.tz, detail: event.detail });
        else logger.event('runner-error', { function: event.function, timeZone: event.tz, kind: event.kind, detail: event.detail });
        break;
      default: {
        const { type, ...data } = event;
        logger.event(type, data);
      }
    }
  };
  const progress = !plain && io.stderr.isTTY ? createProgress(io.stderr as NodeJS.WriteStream, { color: !noColor }) : undefined;
  let lastPhase = '';
  let report: Report;
  try {
    report = await hunt(target, {
      only: list(values.only) ?? [],
      exclude: list(values.exclude) ?? [],
      ...(rules ? { rules: rules as RuleId[] } : {}),
      ...(seed !== undefined ? { seed } : {}),
      ...(maxCalls !== undefined ? { maxCalls } : {}),
      ...(timeout !== undefined ? { timeout } : {}),
      zones: list(values.zones) ?? [],
      onProgress: (message) => logger.debug(message),
      onStatus: (status) => {
        if (!progress) return;
        if (status.phase !== lastPhase) {
          lastPhase = status.phase;
          progress.phase(status.phase);
        }
        progress.tick(status.calls, Math.max(status.calls, status.estimatedCalls), { functions: status.functionsDone, findings: status.findings });
      },
      onEvent: (event: HuntEvent) => {
        logEvent(event);
        if (event.type === 'calls') logger.debug(`${event.function}: ${event.calls} calls for ${event.inputs} inputs in ${event.ms} ms`);
        if (event.type === 'skipped') logger.debug(`skipped ${event.id}: ${event.reason}`);
        if (event.type === 'phase') logger.debug(`phase ${event.phase} took ${event.ms} ms`);
        if (event.type === 'runner') logger.debug(`runner ${event.kind} in ${event.tz ?? ''} for ${event.function ?? ''}: ${event.detail}`);
      },
    });
  } catch (error) {
    progress?.stop();
    logger.event('runner-error', { detail: error instanceof Error ? error.message : String(error) });
    await logger.close();
    throw error;
  }
  progress?.stop();
  logger.event('run-end', {
    totals: { findings: report.findings.length, ...report.counts, calls: report.stats.calls, analyzed: report.stats.analyzed, skipped: report.stats.skipped },
    durationMs: Date.now() - started,
  });
  await logger.close();

  const comparison: Comparison | undefined = baseline ? compareReports(baseline.report, report, baseline.file) : undefined;
  const saved = saveRunArtifacts(io.cwd, report, logger.lines(), { save: !values['no-save'] });
  const savedTo = saved.saved ? saved.reportPath : undefined;

  let text: string;
  if (values.json) text = `${JSON.stringify(comparison ? { ...report, comparison } : report, null, 2)}\n`;
  else if (plain) text = formatTerminal(report, { color: false, verbose });
  else text = renderTty(report, { color: !noColor, durationMs: report.stats.durationMs, ...(io.stdout.columns ? { width: io.stdout.columns } : {}), ...(savedTo ? { savedPath: savedTo } : {}) });
  if (comparison && !values.json) text += `\n${formatComparison(comparison, { color: !plain && !noColor })}`;
  if (values.output) writeFileSync(resolve(io.cwd, values.output), text);
  else io.stdout.write(text);

  writeGithubOutputs(report, io.env, (t) => (values.json ? io.stderr.write(t) : io.stdout.write(t)));

  if (failOn) {
    const limit = SEVERITIES.indexOf(failOn);
    const counted = comparison ? comparison.added : report.findings;
    if (counted.some((f) => SEVERITIES.indexOf(f.severity) <= limit)) return 1;
  }
  return 0;
}
