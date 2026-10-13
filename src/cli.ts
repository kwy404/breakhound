#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { hunt, SEVERITIES } from './hunt';
import { isRuleId, RULE_IDS } from './oracles/index';
import { formatTerminal } from './report/terminal';
import type { RuleId, Severity } from './types';
import { VERSION } from './version';

const HELP = `breakhound ${VERSION}
Point it at any JavaScript package. It sniffs out the bugs.

Usage: breakhound <npm package | local path> [options]

Options:
  --only <names>        Only these functions (comma separated, * wildcards)
  --exclude <names>     Skip these functions
  --rules <ids>         Only these rules: ${RULE_IDS.join(', ')}
  --seed <n>            Seed for random inputs (default 42)
  --max-calls <n>       Call budget for the whole hunt (default 20000)
  --timeout <ms>        Per call timeout (default 2000)
  --zones <list>        Time zones, the first is the primary one
  --fail-on <severity>  Exit with code 1 when a finding has this severity or higher (high, medium, low, info)
  --json                Print the report as JSON
  --output <file>       Write the report to a file instead of stdout
  --no-color            Disable colors
  --verbose             Show info findings and every skipped signature
  -v, --version         Print the version
  -h, --help            Print this help

breakhound executes the package code. Run it only on code you trust, or inside a container.`;

const list = (value: string | undefined) => (value ? value.split(',').map((s) => s.trim()).filter(Boolean) : undefined);

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      only: { type: 'string' },
      exclude: { type: 'string' },
      rules: { type: 'string' },
      seed: { type: 'string' },
      'max-calls': { type: 'string' },
      timeout: { type: 'string' },
      zones: { type: 'string' },
      'fail-on': { type: 'string' },
      json: { type: 'boolean' },
      output: { type: 'string' },
      'no-color': { type: 'boolean' },
      verbose: { type: 'boolean' },
      version: { type: 'boolean', short: 'v' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.version) {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }
  const target = positionals[0];
  if (values.help || !target) {
    process.stdout.write(`${HELP}\n`);
    return target || values.help ? 0 : 2;
  }
  const rules = list(values.rules);
  for (const rule of rules ?? []) {
    if (!isRuleId(rule)) throw new Error(`unknown rule: ${rule}. Known rules: ${RULE_IDS.join(', ')}`);
  }
  const failOn = values['fail-on'] as Severity | undefined;
  if (failOn && !SEVERITIES.includes(failOn)) throw new Error(`--fail-on must be one of ${SEVERITIES.join(', ')}`);
  const number = (name: string, value: string | undefined) => {
    if (value === undefined) return undefined;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) throw new Error(`--${name} must be a non negative number`);
    return n;
  };
  const interactive = process.stderr.isTTY && !values.json;
  const seed = number('seed', values.seed);
  const maxCalls = number('max-calls', values['max-calls']);
  const timeout = number('timeout', values.timeout);
  const report = await hunt(target, {
    only: list(values.only) ?? [],
    exclude: list(values.exclude) ?? [],
    ...(rules ? { rules: rules as RuleId[] } : {}),
    ...(seed !== undefined ? { seed } : {}),
    ...(maxCalls !== undefined ? { maxCalls } : {}),
    ...(timeout !== undefined ? { timeout } : {}),
    zones: list(values.zones) ?? [],
    ...(interactive ? { onProgress: (m: string) => void process.stderr.write(`\r\u001b[2K${m.slice(0, 100)}`) } : {}),
  });
  if (interactive) process.stderr.write('\r\u001b[2K');
  const color = !values['no-color'] && !values.output && !values.json && process.stdout.isTTY && !process.env.NO_COLOR;
  const text = values.json ? `${JSON.stringify(report, null, 2)}\n` : formatTerminal(report, { color, verbose: Boolean(values.verbose) });
  if (values.output) writeFileSync(values.output, text);
  else process.stdout.write(text);
  if (failOn) {
    const limit = SEVERITIES.indexOf(failOn);
    if (report.findings.some((f) => SEVERITIES.indexOf(f.severity) <= limit)) return 1;
  }
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(`breakhound: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  },
);
