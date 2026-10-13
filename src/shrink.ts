import type { FunctionInfo, Shape } from './types';
import { argsComplexity } from './values';

function stringCandidates(text: string): string[] {
  const cps = [...text];
  if (!cps.length) return [];
  const out = ['', cps.slice(0, Math.ceil(cps.length / 2)).join(''), cps.slice(Math.floor(cps.length / 2)).join('')];
  if (cps.length <= 40) for (let i = 0; i < cps.length; i++) out.push([...cps.slice(0, i), ...cps.slice(i + 1)].join(''));
  return out.filter((s) => s !== text);
}

function numberCandidates(n: number): number[] {
  if (!Number.isFinite(n)) return [];
  const out = [0, 1, -1, Math.trunc(n), Math.round(n * 100) / 100, Number.isInteger(n) ? Math.trunc(n / 2) : n];
  return [...new Set(out)].filter((x) => !Object.is(x, n) && Number.isFinite(x));
}

function valueCandidates(value: unknown, shape: Shape | null): unknown[] {
  if (!shape) return [];
  const kinds = shape.kind === 'union' ? shape.options.map((o) => o.kind) : [shape.kind];
  if (typeof value === 'string' && kinds.includes('string')) return stringCandidates(value);
  if (typeof value === 'number' && kinds.includes('number')) return numberCandidates(value);
  if (Array.isArray(value) && shape.kind === 'array') {
    const out: unknown[] = [];
    for (let i = 0; i < value.length; i++) out.push([...value.slice(0, i), ...value.slice(i + 1)]);
    value.forEach((item, i) => {
      for (const c of valueCandidates(item, shape.element).slice(0, 6)) out.push(value.map((v, j) => (j === i ? c : v)));
    });
    return out;
  }
  return [];
}

/**
 * Simpler variants of an argument list, simplest first: shorter strings
 * (removing whole code points, so well formed text stays well formed),
 * smaller numbers, shorter arrays and omitted trailing optional arguments.
 */
export function shrinkCandidates(args: readonly unknown[], fn: FunctionInfo): unknown[][] {
  const out: unknown[][] = [];
  const last = args.length - 1;
  if (last >= 0 && fn.params[last]?.optional) out.push(args.slice(0, last));
  args.forEach((value, i) => {
    for (const candidate of valueCandidates(value, fn.params[i]?.shape ?? null)) {
      const copy = [...args];
      copy[i] = candidate;
      out.push(copy);
    }
  });
  return out.sort((a, b) => argsComplexity(a) - argsComplexity(b));
}
