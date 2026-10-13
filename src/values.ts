/** Helpers for the values breakhound generates: keys, well formedness, size and JavaScript source. */

/**
 * A generated callback. It travels to the worker as plain data and is
 * rebuilt there from its source, which is also what reproductions print.
 */
export interface CallbackValue {
  readonly __breakhoundCallback: string;
}

export function callback(source: string): CallbackValue {
  return { __breakhoundCallback: source };
}

export function isCallback(value: unknown): value is CallbackValue {
  return typeof value === 'object' && value !== null && typeof (value as CallbackValue).__breakhoundCallback === 'string';
}

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/** Index of the first lone surrogate in a string, or -1. Same as `!isWellFormed()` (Node 20+), available on Node 18. */
export function loneSurrogateIndex(text: string): number {
  const match = LONE_SURROGATE.exec(text);
  return match ? match.index : -1;
}

export function isWellFormedString(text: string): boolean {
  return loneSurrogateIndex(text) === -1;
}

/** Calls `visit` for every primitive inside a value (arrays and plain objects are walked). */
export function walk(value: unknown, visit: (v: unknown) => void, depth = 0): void {
  if (depth > 8) return;
  if (isCallback(value)) {
    visit(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit, depth + 1);
    return;
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    for (const item of Object.values(value)) walk(item, visit, depth + 1);
    return;
  }
  visit(value);
}

/** True when every string inside the value is well formed UTF-16. */
export function allStringsWellFormed(value: unknown): boolean {
  let ok = true;
  walk(value, (v) => {
    if (typeof v === 'string' && !isWellFormedString(v)) ok = false;
  });
  return ok;
}

/** A stable string key for a value, distinguishing -0, NaN, dates, bigints and undefined. */
export function valueKey(value: unknown): string {
  if (value === undefined) return 'u';
  if (value === null) return 'null';
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'number':
      return Object.is(value, -0) ? '-0' : String(value);
    case 'bigint':
      return `${value}n`;
    case 'boolean':
      return String(value);
    default:
      break;
  }
  if (value instanceof Date) return `D(${value.getTime()})`;
  if (isCallback(value)) return `F(${value.__breakhoundCallback})`;
  if (Array.isArray(value)) return `[${value.map(valueKey).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${JSON.stringify(k)}:${valueKey(v)}`)
      .join(',')}}`;
  }
  return String(value);
}

/**
 * How complex a value is, used to pick the simplest failing input:
 * shorter strings, smaller numbers and fewer elements score lower.
 */
export function complexity(value: unknown): number {
  if (value === undefined || value === null) return 0;
  switch (typeof value) {
    case 'boolean':
      return 0;
    case 'string': {
      let score = 1;
      for (const ch of value) {
        const cp = ch.codePointAt(0) as number;
        score += cp < 0x80 ? (cp >= 0x20 && cp < 0x7f ? 2 : 4) : cp > 0xffff ? 5 : 4;
      }
      return score;
    }
    case 'number': {
      if (!Number.isFinite(value)) return 12;
      if (value === 0) return Object.is(value, -0) ? 2 : 0;
      const text = String(Math.abs(value));
      return text.replace(/[.e+-]/g, '').length + (value < 0 ? 1 : 0) + (Number.isInteger(value) ? 0 : 1) + (text.includes('e') ? 4 : 0);
    }
    case 'bigint':
      return String(value).length + 1;
    default:
      break;
  }
  if (value instanceof Date) return 4;
  if (isCallback(value)) return 3;
  if (Array.isArray(value)) return 2 + value.reduce((sum: number, v) => sum + complexity(v), 0);
  if (typeof value === 'object') {
    return 2 + Object.entries(value as Record<string, unknown>).reduce((sum, [, v]) => sum + 1 + complexity(v), 0);
  }
  return 1;
}

export function argsComplexity(args: readonly unknown[]): number {
  return args.reduce((sum: number, v) => sum + complexity(v), 0);
}

function escapeChar(cp: number): string {
  if (cp > 0xffff) return `\\u{${cp.toString(16).toUpperCase()}}`;
  return `\\u${cp.toString(16).toUpperCase().padStart(4, '0')}`;
}

/** JavaScript string literal source. Every non printable ASCII or non ASCII character is escaped. */
export function stringLiteral(text: string): string {
  let out = "'";
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    // Keep surrogate pairs together as one \u{...} escape; lone surrogates stay as \uXXXX.
    if (unit >= 0xd800 && unit <= 0xdbff && i + 1 < text.length) {
      const low = text.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        out += escapeChar(((unit - 0xd800) << 10) + (low - 0xdc00) + 0x10000);
        i++;
        continue;
      }
    }
    const ch = text[i] as string;
    if (ch === "'") out += "\\'";
    else if (ch === '\\') out += '\\\\';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (unit < 0x20 || unit >= 0x7f) out += escapeChar(unit);
    else out += ch;
  }
  return `${out}'`;
}

function propertyKey(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : stringLiteral(key);
}

/** JavaScript source that evaluates to the value (strings, numbers, bigints, dates, arrays, plain objects). */
export function toSource(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  switch (typeof value) {
    case 'string':
      return stringLiteral(value);
    case 'number':
      if (Object.is(value, -0)) return '-0';
      if (Number.isNaN(value)) return 'NaN';
      if (value === Infinity) return 'Infinity';
      if (value === -Infinity) return '-Infinity';
      return String(value);
    case 'bigint':
      return `${value}n`;
    case 'boolean':
      return String(value);
    default:
      break;
  }
  if (isCallback(value)) return value.__breakhoundCallback;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "new Date('invalid')" : `new Date('${value.toISOString()}')`;
  }
  if (Array.isArray(value)) return `[${value.map(toSource).join(', ')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) return '{}';
    return `{ ${entries.map(([k, v]) => `${propertyKey(k)}: ${toSource(v)}`).join(', ')} }`;
  }
  return String(value);
}

/** Argument list source, with trailing `undefined` arguments removed. */
export function argsSource(args: readonly unknown[]): string {
  let end = args.length;
  while (end > 0 && args[end - 1] === undefined) end--;
  return args.slice(0, end).map(toSource).join(', ');
}

/** Shortens a source snippet for one line display. */
export function clip(text: string, max = 120): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}
