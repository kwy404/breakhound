// Fixture for breakhound's tests: every planted bug has a correct twin that
// must produce no finding.

/** Bug: cuts by UTF-16 code units, so a surrogate pair can be split. */
export function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, Math.max(0, max)) : text;
}

/** Correct twin: cuts by code points. */
export function truncateSafe(text: string, max: number): string {
  const points = Array.from(text);
  return points.length > max ? points.slice(0, Math.max(0, max)).join('') : text;
}

/** Bug: uses the host time zone for a calendar label of a timestamp in seconds. */
export function yearLabel(seconds: number): string {
  return String(new Date(seconds * 1000).getFullYear());
}

/** Correct twin: UTC. */
export function yearLabelUtc(seconds: number): string {
  return String(new Date(seconds * 1000).getUTCFullYear());
}

/** Bug: reads a missing key. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0] as string)[0]!.toUpperCase() + (parts[1] ? (parts[1][0] as string).toUpperCase() : '');
}

/** Correct twin. */
export function initialsSafe(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part)[0]!.toUpperCase())
    .join('');
}

/** Correct: validates explicitly (info at most). */
export function percent(part: number, total: number): number {
  if (total === 0) throw new RangeError('total must not be 0');
  return (part / total) * 100;
}

/** Bug: 0 / 0. */
export function average(values: number[]): number {
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.filter((v) => v > 0).length;
}

/** Correct twin. */
export function averageSafe(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

let counter = 0;
/** Bug: hidden module level state. */
export function label(text: string): string {
  counter += 1;
  return counter % 2 === 0 ? text.toUpperCase() : text;
}

/** Correct twin. */
export function labelSafe(text: string): string {
  return text.toUpperCase();
}

/** Expected to vary: the name says so. */
export function randomToken(): string {
  return Math.random().toString(36).slice(2);
}

/** Bug: decodeBase turns every underscore into a space, not only the encoded ones. */
export function encodeBase(text: string): string {
  return text.replace(/ /g, '_');
}
export function decodeBase(text: string): string {
  return text.replace(/_/g, ' ');
}

/** Correct pair. */
export function encodeSafe(text: string): string {
  return encodeURIComponent(text);
}
export function decodeSafe(text: string): string {
  return decodeURIComponent(text);
}

/** Bug: a second pass changes the result again. */
export function slugify(text: string): string {
  // Replaces underscores before spaces become underscores, so a second pass changes them again.
  return text.trim().replace(/_/g, '-').replace(/\s+/g, '_').toLowerCase();
}

/** Correct twin. */
export function slugifySafe(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Bug: formats the integer part with its own sign, like the pdf.js printf bug. */
export function formatFixed(value: number): string {
  const whole = Math.trunc(value);
  const fraction = Math.round(Math.abs(value - whole) * 100);
  return `${whole}.${String(fraction).padStart(2, '0')}`;
}

/** Correct twin. */
export function formatFixedSafe(value: number): string {
  return value.toFixed(2);
}

/** Supported: literal union and object parameters. */
export function pad(text: string, options: { width: number; side?: 'left' | 'right' }): string {
  return options.side === 'left' ? text.padStart(options.width) : text.padEnd(options.width);
}

/** Bug: crashes when the callback returns an empty string. */
export function mapWords(text: string, fn: (word: string) => string): string {
  return text
    .split(' ')
    .map((word) => fn(word)[0]!.toUpperCase() + fn(word).slice(1))
    .join(' ');
}

/** Correct twin with a callback parameter. */
export function mapWordsSafe(text: string, fn: (word: string) => string): string {
  return text
    .split(' ')
    .map((word) => {
      const mapped = fn(word);
      return mapped.charAt(0).toUpperCase() + mapped.slice(1);
    })
    .join(' ');
}

/** Skipped: classes are not called. */
export class Counter {
  count = 0;
  increment(): number {
    this.count += 1;
    return this.count;
  }
}
