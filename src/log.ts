import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { RuleId, Severity } from './types';

/**
 * Event types written to the run log, one JSON object per line.
 * Every line is `{ t: <ISO time>, type, ...data }`.
 *
 * - `run-start`: `version`, `target`, `options`, `node`, `platform`.
 * - `signature`: `name`, `status` (`extracted` or `skipped`), `reason` (when skipped).
 * - `calls`: `function`, `count`, `timeZone`, `durationMs`.
 * - `finding`: `rule`, `severity`, `function`, `input`.
 * - `runner-error`: details of a child process crash or protocol error.
 * - `timeout`: a call that was killed after the per call timeout.
 * - `run-end`: `totals`, `durationMs`.
 */
export type RunEventType =
  | 'run-start'
  | 'signature'
  | 'calls'
  | 'finding'
  | 'runner-error'
  | 'timeout'
  | 'run-end';

/** Typed payloads of the documented events, for callers that want type checking. */
export interface RunEventData {
  'run-start': { version: string; target: string; options: Record<string, unknown>; node: string; platform: string };
  signature: { name: string; status: 'extracted' | 'skipped'; reason?: string };
  calls: { function: string; count: number; timeZone: string; durationMs: number };
  finding: { rule: RuleId; severity: Severity; function: string; input: readonly string[] };
  'runner-error': { function?: string; detail: string };
  timeout: { function?: string; timeZone?: string; detail?: string };
  'run-end': { totals: Record<string, unknown>; durationMs: number };
}

export interface RunLoggerOptions {
  /** JSON Lines file to append every event to. Parent folders are created. */
  file?: string | undefined;
  /** Print debug messages to stderr. */
  verbose?: boolean | undefined;
  /** Stream for debug messages. Defaults to `process.stderr`. */
  stderr?: { write(s: string): unknown } | undefined;
  /** Clock in milliseconds. Defaults to `Date.now`. */
  now?: (() => number) | undefined;
}

export interface RunLogger {
  /** Records one event (see {@link RunEventType}) as a JSON line. */
  event(type: string, data?: Record<string, unknown>): void;
  /** Writes `[breakhound] <ms since start>ms <message>` to stderr when verbose. */
  debug(message: string): void;
  /** Every JSON line recorded so far. */
  lines(): string[];
  /** Finishes the log. Safe to call more than once. */
  close(): Promise<void>;
}

/** Creates a logger that keeps run events in memory and optionally appends them to a file. Never throws on write errors. */
export function createRunLogger(opts: RunLoggerOptions = {}): RunLogger {
  const now = opts.now ?? Date.now;
  const stderr = opts.stderr ?? process.stderr;
  const start = now();
  const recorded: string[] = [];
  let file = opts.file;
  let closed = false;

  const debug = (message: string): void => {
    if (!opts.verbose) return;
    try {
      stderr.write(`[breakhound] ${now() - start}ms ${message}\n`);
    } catch {
      // stderr is best effort
    }
  };

  if (file) {
    try {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, '');
    } catch (error) {
      debug(`cannot write log file ${file}: ${errorText(error)}`);
      file = undefined;
    }
  }

  return {
    event(type, data = {}) {
      if (closed) return;
      let line: string;
      try {
        line = JSON.stringify({ t: new Date(now()).toISOString(), type, ...data }, jsonReplacer);
      } catch (error) {
        line = JSON.stringify({ t: new Date(now()).toISOString(), type, error: `unserializable data: ${errorText(error)}` });
      }
      recorded.push(line);
      if (!file) return;
      try {
        appendFileSync(file, `${line}\n`);
      } catch (error) {
        debug(`cannot write log file ${file}: ${errorText(error)}`);
        file = undefined;
      }
    },
    debug,
    lines() {
      return [...recorded];
    },
    close() {
      closed = true;
      return Promise.resolve();
    },
  };
}

export interface SavedArtifacts {
  saved: boolean;
  logPath?: string;
  reportPath?: string;
}

/**
 * Writes `<dir>/.breakhound/last-run.jsonl` and `<dir>/.breakhound/report.json` when `save` is true.
 * Returns `{ saved: false }` when saving is off or the files cannot be written.
 */
export function saveRunArtifacts(dir: string, report: unknown, logLines: string[], opts: { save: boolean }): SavedArtifacts {
  if (!opts.save) return { saved: false };
  const folder = join(dir, '.breakhound');
  const logPath = join(folder, 'last-run.jsonl');
  const reportPath = join(folder, 'report.json');
  try {
    mkdirSync(folder, { recursive: true });
    writeFileSync(logPath, logLines.length > 0 ? `${logLines.join('\n')}\n` : '');
    writeFileSync(reportPath, `${JSON.stringify(report, jsonReplacer, 2)}\n`);
    return { saved: true, logPath, reportPath };
  } catch {
    return { saved: false };
  }
}

function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return `${value}n`;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  return value;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
