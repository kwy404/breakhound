import { bigints, dates, emails, json, numbers, numericStrings, paths, strings, urls } from 'edgegoat';
import type { FunctionInfo, Shape } from './types';
import { createRng, deriveSeed, type Rng } from './random';
import { argsComplexity, callback, isCallback, isWellFormedString, toSource, valueKey, type CallbackValue } from './values';

/** One generated call: the argument list plus bookkeeping used for shrinking. */
export interface Input {
  readonly args: readonly unknown[];
  /** Complexity score; lower is simpler. */
  readonly rank: number;
  /** Generation order; earlier inputs win ties. */
  readonly order: number;
}

const MAX_STRING_LENGTH = 2000;

const wellFormed = (s: string) => s.length <= MAX_STRING_LENGTH && isWellFormedString(s);
const values = <T>(cases: readonly { value: T }[]): T[] => cases.map((c) => c.value);

const SIMPLE_STRINGS = ['Hello World', '', 'a', ' ', 'hello-world', 'Hello, World!', '42', 'foo bar baz', 'A', 'x y'];
const SIMPLE_NUMBERS = [1, 0, -1, 2, 10, 0.5, -0.5, 100, 3.14159, -42, 1000000, 0.1, 7, 1.5, -2.5, 255];
const SIMPLE_BIGINTS = [1n, 0n, -1n, 123n];
export const BASE_DATE_ISO = '2026-01-15T12:00:00.000Z';

let cache: Record<string, readonly unknown[]> | undefined;

/** Edge case pools, built once from edgegoat. */
function pools(): Record<string, readonly unknown[]> {
  if (cache) return cache;
  const dateCases = values(dates({ exclude: ['invalid'] })).filter((d) => !Number.isNaN(d.getTime()));
  cache = {
    string: [...SIMPLE_STRINGS, ...values(strings()).filter(wellFormed), ...values(numericStrings()).filter(wellFormed)],
    url: values(urls()).filter(wellFormed),
    email: values(emails()).filter(wellFormed),
    path: values(paths()).filter(wellFormed),
    json: values(json()).filter(wellFormed),
    isoDate: dateCases.slice(0, 20).map((d) => d.toISOString()),
    number: [...SIMPLE_NUMBERS, ...values(numbers())],
    bigint: [...SIMPLE_BIGINTS, ...values(bigints())],
    date: [new Date(BASE_DATE_ISO), ...dateCases],
  };
  return cache;
}

/** The simple value used for a parameter while another parameter is varied. */
export function baseValue(shape: Shape): unknown {
  switch (shape.kind) {
    case 'string':
      return 'Hello World';
    case 'number':
      return 1;
    case 'boolean':
      return true;
    case 'bigint':
      return 1n;
    case 'date':
      return new Date(BASE_DATE_ISO);
    case 'literal':
      return shape.values[0];
    case 'array':
      return [baseValue(shape.element)];
    case 'object': {
      const out: Record<string, unknown> = {};
      for (const prop of shape.props) if (!prop.optional) out[prop.name] = baseValue(prop.shape);
      return out;
    }
    case 'union':
      return baseValue(shape.options[0] as Shape);
    case 'function':
      return callbackValues(shape)[0];
  }
}

function identifier(name: string | undefined, fallback: string): string {
  return name && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : fallback;
}

/**
 * Callbacks for a function typed parameter, built from its declared
 * signature: identity, simple transformers, constants of the return type,
 * and a no-op for void callbacks. Each keeps its source for reproductions.
 */
export function callbackValues(shape: Extract<Shape, { kind: 'function' }>): CallbackValue[] {
  const arg = identifier(shape.params[0], 'value');
  const params = shape.params.length ? arg : '';
  const out: string[] = [];
  const returns = shape.returns;
  if (!returns) {
    out.push(`(${params}) => {}`);
  } else {
    const inputKind = shape.input?.kind;
    if (inputKind && inputKind === returns.kind && inputKind !== 'literal') out.push(`(${arg}) => ${arg}`);
    if (returns.kind === 'string' && inputKind === 'string') out.push(`(${arg}) => ${arg}.toUpperCase()`, `(${arg}) => ${arg} + ${arg}`);
    if (returns.kind === 'number' && inputKind === 'number') out.push(`(${arg}) => ${arg} * 2`);
    if (returns.kind === 'boolean') out.push('() => true', '() => false');
    else for (const value of edgeValues(returns).slice(0, 4)) if (!isCallback(value)) out.push(`() => ${toSource(value)}`);
  }
  return [...new Set(out)].map(callback);
}

function stringPool(hint: string): readonly unknown[] {
  const p = pools();
  const lower = hint.toLowerCase();
  const first: unknown[] = [];
  if (/url|uri|href|link|src|origin/.test(lower)) first.push(...(p.url ?? []));
  if (/mail/.test(lower)) first.push(...(p.email ?? []));
  if (/path|file|dir|folder/.test(lower)) first.push(...(p.path ?? []));
  if (/json/.test(lower)) first.push(...(p.json ?? []));
  if (/date|time|iso|day/.test(lower)) first.push(...(p.isoDate ?? []));
  return first.length ? [...SIMPLE_STRINGS.slice(0, 2), ...first, ...(p.string ?? [])] : (p.string ?? []);
}

function interleave(lists: readonly (readonly unknown[])[]): unknown[] {
  const out: unknown[] = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) for (const list of lists) if (i < list.length) out.push(list[i]);
  return out;
}

/** Edge case values for a shape, simplest first. `hint` is the parameter or property name. */
export function edgeValues(shape: Shape, hint = '', depth = 0): unknown[] {
  const p = pools();
  switch (shape.kind) {
    case 'string':
      return [...stringPool(hint)];
    case 'number':
      return [...(p.number ?? [])];
    case 'boolean':
      return [true, false];
    case 'bigint':
      return [...(p.bigint ?? [])];
    case 'date':
      return [...(p.date ?? [])];
    case 'literal':
      return [...shape.values];
    case 'union':
      return interleave(shape.options.map((o) => edgeValues(o, hint, depth)));
    case 'function':
      return callbackValues(shape);
    case 'array': {
      const elements = depth > 1 ? [baseValue(shape.element)] : edgeValues(shape.element, hint, depth + 1).slice(0, 12);
      const out: unknown[] = [[], [baseValue(shape.element)]];
      for (let i = 1; i < elements.length; i += 3) out.push(elements.slice(i, i + 3));
      out.push(...elements.slice(0, 6).map((e) => [e]));
      return out;
    }
    case 'object': {
      const base = baseValue(shape) as Record<string, unknown>;
      const out: unknown[] = [base];
      const full: Record<string, unknown> = { ...base };
      for (const prop of shape.props) full[prop.name] = baseValue(prop.shape);
      out.push(full);
      if (depth > 1) return out;
      for (const prop of shape.props) {
        for (const value of edgeValues(prop.shape, prop.name, depth + 1).slice(0, 4)) out.push({ ...base, [prop.name]: value });
      }
      return out;
    }
  }
}

const RANDOM_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789      -_.,!?/@#&:';
const RANDOM_UNICODE = ['é', 'ü', 'ß', 'İ', '中', '\u{1F600}', '\u{1F44D}\u{1F3FD}', '́', ' ', 'ש', '\u{1D11E}'];

/** A small random value of the given shape. */
export function randomValue(shape: Shape, rng: Rng, depth = 0): unknown {
  switch (shape.kind) {
    case 'string': {
      const length = rng.int(0, 12);
      let out = '';
      for (let i = 0; i < length; i++) out += rng.chance(0.1) ? rng.pick(RANDOM_UNICODE) : rng.pick([...RANDOM_CHARS]);
      return out;
    }
    case 'number': {
      const r = rng.next();
      if (r < 0.4) return rng.int(-100, 100);
      if (r < 0.7) return Number(((rng.next() - 0.5) * 200).toFixed(rng.int(1, 4)));
      if (r < 0.85) return Number(((rng.next() - 0.5) * 2).toFixed(rng.int(1, 6)));
      return Math.round((rng.next() - 0.5) * 2e9);
    }
    case 'boolean':
      return rng.chance(0.5);
    case 'bigint':
      return BigInt(rng.int(-1_000_000, 1_000_000));
    case 'date':
      return new Date(Date.UTC(rng.int(1900, 2100), rng.int(0, 11), rng.int(1, 28), rng.int(0, 23), rng.int(0, 59), rng.int(0, 59), rng.int(0, 999)));
    case 'literal':
      return rng.pick(shape.values);
    case 'union':
      return randomValue(rng.pick(shape.options), rng, depth);
    case 'function':
      return rng.pick(callbackValues(shape));
    case 'array': {
      const length = depth > 1 ? rng.int(0, 2) : rng.int(0, 4);
      return Array.from({ length }, () => randomValue(shape.element, rng, depth + 1));
    }
    case 'object': {
      const out: Record<string, unknown> = {};
      for (const prop of shape.props) {
        if (!prop.optional || rng.chance(0.5)) out[prop.name] = randomValue(prop.shape, rng, depth + 1);
      }
      return out;
    }
  }
}

function trimArgs(args: unknown[]): unknown[] {
  let end = args.length;
  while (end > 0 && args[end - 1] === undefined) end--;
  return args.slice(0, end);
}

/** The base argument list: simple values for required parameters, optional ones omitted. */
export function baseArgs(fn: FunctionInfo): unknown[] {
  return trimArgs(fn.params.map((p) => (!p.optional && p.shape ? baseValue(p.shape) : undefined)));
}

/**
 * Generates up to `budget` argument lists for a function: first the base
 * call, then each parameter varied over its edge cases while the others stay
 * simple (round robin across parameters), then random combinations.
 */
export function generateInputs(fn: FunctionInfo, options: { seed: number; budget: number }): Input[] {
  const rng = createRng(deriveSeed(options.seed, fn.id));
  const budget = Math.max(1, options.budget);
  const params = fn.params;
  const base = baseArgs(fn);
  const out: Input[] = [];
  const seen = new Set<string>();
  const add = (args: unknown[]): void => {
    const trimmed = trimArgs(args);
    const key = trimmed.map(valueKey).join('|');
    if (seen.has(key) || out.length >= budget) return;
    seen.add(key);
    out.push({ args: trimmed, rank: argsComplexity(trimmed), order: out.length });
  };
  add(base);

  const edges = params.map((p) => (p.shape && !p.rest ? edgeValues(p.shape, p.name) : []));
  const edgeBudget = Math.ceil(budget * 0.75);
  const rounds = Math.max(0, ...edges.map((e) => e.length));
  for (let r = 0; r < rounds && out.length < edgeBudget; r++) {
    edges.forEach((list, i) => {
      if (r >= list.length || out.length >= edgeBudget) return;
      const args = [...base];
      args[i] = list[r];
      add(args);
    });
  }

  let attempts = 0;
  while (out.length < budget && attempts < budget * 4) {
    attempts++;
    const args = params.map((p) => {
      if (!p.shape || p.rest) return undefined;
      if (p.optional && !rng.chance(0.4)) return undefined;
      return randomValue(p.shape, rng);
    });
    add(args);
  }
  return out;
}
