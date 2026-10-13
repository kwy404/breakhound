import type { Input } from '../generate';
import type { Outcome } from '../runner/pool';
import type { FunctionInfo, Shape } from '../types';
import { allStringsWellFormed, argsComplexity, valueKey } from '../values';

/** Splits an identifier into lower case words: `encodeHTML_entities` gives `encode html entities`. */
export function words(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

/**
 * Messages that the JavaScript engine (V8) produces for programming errors,
 * as opposed to messages written by a library author in an explicit check.
 */
const ENGINE_MESSAGES: readonly RegExp[] = [
  /^Cannot read propert(?:y|ies) of (?:undefined|null)/,
  /^Cannot set propert(?:y|ies) of (?:undefined|null)/,
  /^Cannot read property '.*' of (?:undefined|null)/,
  /\bis not a function\b/,
  /\bis not iterable\b/,
  /^Cannot convert undefined or null to object/,
  /^Cannot destructure /,
  /\bis not a constructor$/,
  /^Reduce of empty array with no initial value/,
  /^Cannot convert a BigInt value to a number/,
  /^Cannot mix BigInt and other types/,
  /^Do not know how to serialize a BigInt/,
  /^Converting circular structure to JSON/,
  /^Cannot create property '.*' on (?:string|number|boolean)/,
  /^Cannot use 'in' operator/,
  /^Cannot assign to read only property/,
  /^Invalid attempt to (?:spread|destructure|iterate)/,
  /^Object prototype may only be an Object or null/,
  /^Assignment to constant variable/,
  /\bis not defined$/,
  /^Cannot access '.*' before initialization/,
];

/** True for a TypeError or ReferenceError whose message comes from the engine. */
export function isEngineError(name: string, message: string): boolean {
  if (name !== 'TypeError' && name !== 'ReferenceError') return false;
  if (/cannot be invoked without 'new'/.test(message)) return false;
  return ENGINE_MESSAGES.some((pattern) => pattern.test(message));
}

/** Names that announce randomness or time, for which different results are expected. */
export function isRandomOrTimeName(name: string): boolean {
  const w = words(name);
  return w.some((x) =>
    ['random', 'rand', 'uuid', 'guid', 'uid', 'nanoid', 'now', 'id', 'ids', 'shuffle', 'sample', 'token', 'nonce', 'salt', 'seed', 'time', 'timestamp', 'date', 'today', 'unique', 'generate'].includes(x),
  );
}

const DATE_WORDS = ['date', 'dates', 'time', 'times', 'timestamp', 'zone', 'tz', 'timezone', 'epoch', 'millis', 'ms', 'offset', 'day', 'days', 'week', 'month', 'year', 'hour', 'hours', 'minute', 'minutes', 'utc', 'local', 'calendar', 'today', 'now', 'ago', 'clock', 'duration', 'dayjs', 'moment'];

export function isDateName(name: string): boolean {
  return words(name).some((w) => DATE_WORDS.includes(w));
}

export function shapeHas(shape: Shape | null, kind: Shape['kind']): boolean {
  if (!shape) return false;
  if (shape.kind === kind) return true;
  switch (shape.kind) {
    case 'array':
      return shapeHas(shape.element, kind);
    case 'object':
      return shape.props.some((p) => shapeHas(p.shape, kind));
    case 'union':
      return shape.options.some((o) => shapeHas(o, kind));
    default:
      return false;
  }
}

/** The kind of value a shape produces, when it is a single kind. */
export function shapeKind(shape: Shape | null): string | undefined {
  if (!shape) return undefined;
  switch (shape.kind) {
    case 'literal': {
      const kinds = new Set(shape.values.map((v) => typeof v));
      return kinds.size === 1 ? [...kinds][0] : undefined;
    }
    case 'union':
      return undefined;
    default:
      return shape.kind;
  }
}

/** True when every parameter after the first can be omitted. */
export function onlyFirstRequired(fn: FunctionInfo): boolean {
  return fn.params.length > 0 && fn.params.slice(1).every((p) => p.optional || p.rest);
}

export function returns(fn: FunctionInfo, kind: string): boolean {
  return fn.returnKinds.includes(kind as never) || fn.returnKinds.includes('other');
}

export type Settled = Extract<Outcome, { kind: 'return' | 'throw' }>;

export function settled(outcome: Outcome | undefined): outcome is Settled {
  return outcome !== undefined && (outcome.kind === 'return' || outcome.kind === 'throw');
}

/** Strings that are safe for roundtrip and idempotence checks: well formed, no control characters. */
export function isCleanString(text: string): boolean {
  return !/[\u0000-\u0008\u000B-\u001F\u007F-\u009F￾￿]/.test(text) && allStringsWellFormed(text);
}

/** Inputs reduced to their first argument, deduplicated, keeping only clean values. */
export function firstArgInputs(generated: readonly Input[]): Input[] {
  const out: Input[] = [];
  const seen = new Set<string>();
  for (const input of generated) {
    if (!input.args.length) continue;
    const x = input.args[0];
    if (x === undefined) continue;
    let clean = true;
    const check = (v: unknown): void => {
      if (typeof v === 'string' && !isCleanString(v)) clean = false;
      if (typeof v === 'number' && !Number.isFinite(v)) clean = false;
      if (Array.isArray(v)) v.forEach(check);
      else if (v && typeof v === 'object' && !(v instanceof Date)) Object.values(v).forEach(check);
    };
    check(x);
    if (!clean) continue;
    const key = valueKey(x);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ args: [x], rank: argsComplexity([x]), order: out.length });
  }
  return out;
}

/** Canonical text with negative zero treated as zero. */
export function withoutNegativeZero(canon: string): string {
  return canon.replace(/(^|[^\w.])-0(?![\w.])/g, '$10');
}

export function hex(unit: number): string {
  return `U+${unit.toString(16).toUpperCase().padStart(4, '0')}`;
}

/** Picks up to `count` items spread evenly over a list, always including the first. */
export function spread<T>(items: readonly T[], count: number): T[] {
  if (items.length <= count) return [...items];
  const out: T[] = [];
  for (let i = 0; i < count; i++) out.push(items[Math.floor((i * items.length) / count)] as T);
  return out;
}
