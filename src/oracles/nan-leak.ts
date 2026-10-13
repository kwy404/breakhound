import type { Oracle } from './types';
import { returns, shapeHas } from './util';

/** Checks that every number is finite, no text is passed and no array is empty. */
export function nanEligible(args: readonly unknown[]): { ok: boolean; extreme: boolean } {
  let ok = true;
  let extreme = false;
  const visit = (v: unknown): void => {
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) ok = false;
      else if (Math.abs(v) > 1e15) extreme = true;
    } else if (typeof v === 'bigint') {
      if (v > 2n ** 53n || v < -(2n ** 53n)) extreme = true;
    } else if (typeof v === 'string') {
      ok = false;
    } else if (v instanceof Date) {
      if (Number.isNaN(v.getTime())) ok = false;
      else if (Math.abs(v.getTime()) > 4.32e15) extreme = true;
    } else if (Array.isArray(v)) {
      if (v.length === 0) ok = false;
      v.forEach(visit);
    } else if (v && typeof v === 'object') {
      Object.values(v).forEach(visit);
    }
  };
  args.forEach(visit);
  return { ok, extreme };
}

/** NaN comes out although every number that went in is finite. */
export const nanLeak: Oracle = {
  id: 'nan-leak',
  title: 'NaN leak',
  summary: 'Every numeric argument is finite and no text is parsed, yet the result is NaN or a string containing "NaN".',
  plans(fn) {
    if (!returns(fn, 'number') && !returns(fn, 'string')) return [];
    // Parsing text into NaN is normal, so functions that take free form strings are left out.
    if (fn.params.some((p) => shapeHas(p.shape, 'string'))) return [];
    if (!fn.params.some((p) => shapeHas(p.shape, 'number') || shapeHas(p.shape, 'date') || shapeHas(p.shape, 'bigint'))) return [];
    return [
      {
        rule: 'nan-leak',
        fn,
        async check(input, ctx) {
          const { ok, extreme } = nanEligible(input.args);
          if (!ok || extreme) return null;
          const result = await ctx.call(fn, input.args);
          const out = result.outcomes[0];
          if (!out || out.kind !== 'return' || !out.nan) return null;
          const isNumber = out.type === 'number';
          const value = ctx.value(fn, input.args);
          return {
            severity: extreme ? 'low' : 'medium',
            confidence: extreme ? 'medium' : 'high',
            title: isNumber ? `${fn.id} returns NaN for finite input` : `${fn.id} returns a string containing "NaN" for finite input`,
            explanation:
              `All numeric arguments are finite, but the result is ${isNumber ? 'NaN' : `${out.preview}, which contains "NaN"`}. ` +
              'NaN usually leaks from 0 / 0, Infinity - Infinity, arithmetic on undefined or a failed lookup, and then spreads silently through later calculations.' +
              (extreme ? ' The input uses very large magnitudes, so this may be an overflow at the limits of double precision.' : ''),
            expected: isNumber ? 'A finite number, or an explicit error for inputs outside the supported range.' : 'A string without "NaN".',
            evidence: [{ call: ctx.expr(fn, input.args), result: out.preview }],
            group: 'nan',
            repro: [`console.log(${value});`],
            test: {
              name: `${fn.id} does not return NaN for finite input`,
              body: [isNumber ? `expect(${value}).not.toBeNaN();` : `expect(${value}).not.toContain('NaN');`],
            },
          };
        },
      },
    ];
  },
};
