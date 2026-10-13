import type { FunctionInfo } from '../types';
import type { Oracle, Plan } from './types';
import { firstArgInputs, onlyFirstRequired, returns, settled, shapeKind, withoutNegativeZero, words } from './util';

const PAIRS: readonly (readonly [string, string])[] = [
  ['encode', 'decode'],
  ['escape', 'unescape'],
  ['serialize', 'deserialize'],
  ['stringify', 'parse'],
  ['format', 'parse'],
  ['compress', 'decompress'],
  ['pack', 'unpack'],
  ['marshal', 'unmarshal'],
  ['to', 'from'],
];

/** Finds decoder partners for an encoder by name: `encodeX` and `decodeX`, `toY` and `fromY`. */
export function findPartners(fn: FunctionInfo, all: readonly FunctionInfo[]): FunctionInfo[] {
  const a = words(fn.name);
  const parent = fn.path.slice(0, -1).join('.');
  return all.filter((other) => {
    if (other === fn || other.path.slice(0, -1).join('.') !== parent) return false;
    const b = words(other.name);
    if (a.length !== b.length) return false;
    let diff = -1;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        if (diff !== -1) return false;
        diff = i;
      }
    }
    return diff !== -1 && PAIRS.some(([x, y]) => a[diff] === x && b[diff] === y);
  });
}

export const roundtrip: Oracle = {
  id: 'roundtrip',
  title: 'Broken roundtrip',
  summary: 'For a detected inverse pair (encode/decode, escape/unescape, stringify/parse, toX/fromX), b(a(x)) does not return x.',
  plans(fn, all) {
    const kind = shapeKind(fn.params[0]?.shape ?? null);
    if (!kind || !onlyFirstRequired(fn)) return [];
    const plans: Plan[] = [];
    for (const partner of findPartners(fn, all)) {
      const partnerKind = shapeKind(partner.params[0]?.shape ?? null);
      if (!partnerKind || !onlyFirstRequired(partner) || !returns(fn, partnerKind) || !returns(partner, kind)) continue;
      plans.push({
        rule: 'roundtrip',
        fn,
        partner,
        inputs: firstArgInputs,
        async check(input, ctx) {
          const result = await ctx.chain(fn, partner, input.args, partnerKind);
          const [encoded, , decoded] = result.outcomes;
          if (!encoded || encoded.kind !== 'return' || !settled(decoded)) return null;
          if (decoded.kind === 'return' && withoutNegativeZero(decoded.canon) === withoutNegativeZero(result.inputCanon ?? '')) return null;
          const x = ctx.expr(fn, input.args).replace(/^[^(]*\(/, '').replace(/\)$/, '');
          const inner = ctx.expr(fn, input.args);
          return {
            severity: 'medium',
            confidence: 'medium',
            title: `${partner.id}(${fn.id}(x)) does not return x`,
            explanation:
              `${fn.id} and ${partner.id} look like inverse functions. For a well formed input x, ${partner.id}(${fn.id}(x)) ${decoded.kind === 'throw' ? `throws (${decoded.preview})` : `returned ${decoded.preview}`} instead of x. ` +
              'One of the two functions loses information for this input, or the pair is not meant to be inverse (then this finding can be ignored).',
            expected: `${partner.id}(${fn.id}(x)) equals x.`,
            evidence: [
              { call: inner, result: encoded.preview },
              { call: `${ctx.expr(partner, []).replace(/\(\)$/, '')}(${inner})`, result: decoded.preview },
            ],
            group: `roundtrip:${partner.id}`,
            repro: [`const input = ${x};`, `const encoded = ${ctx.value(fn, input.args)};`, `const decoded = ${ctx.valueOf(partner, 'encoded')};`, 'console.log(encoded, decoded);'],
            test: {
              name: `${partner.id} reverses ${fn.id}`,
              body: [`const input = ${x};`, `const encoded = ${ctx.value(fn, input.args)};`, `expect(${ctx.valueOf(partner, 'encoded')}).toEqual(input);`],
            },
          };
        },
      });
    }
    return plans;
  },
};

const IDEMPOTENT_WORDS = ['normalize', 'trim', 'sanitize', 'slugify', 'slug', 'clean', 'canonicalize', 'canonical', 'dedupe', 'dedup', 'squish'];

export const notIdempotent: Oracle = {
  id: 'not-idempotent',
  title: 'Not idempotent',
  summary: 'For normalizing names (normalize, trim, sanitize, slugify, clean, canonicalize, dedupe), f(f(x)) differs from f(x).',
  plans(fn) {
    if (!words(fn.name).some((w) => IDEMPOTENT_WORDS.includes(w))) return [];
    const kind = shapeKind(fn.params[0]?.shape ?? null);
    if (!kind || !onlyFirstRequired(fn) || !returns(fn, kind)) return [];
    return [
      {
        rule: 'not-idempotent',
        fn,
        inputs: firstArgInputs,
        async check(input, ctx) {
          const result = await ctx.chain(fn, fn, input.args, kind);
          const [once, again, twice] = result.outcomes;
          if (!once || once.kind !== 'return' || !again || again.kind !== 'return' || once.canon !== again.canon) return null;
          if (!settled(twice) || (twice.kind === 'return' && twice.canon === once.canon)) return null;
          return {
            severity: 'medium',
            confidence: 'medium',
            title: `${fn.id} is not idempotent`,
            explanation: `The name suggests a normalizing function, and applying a normalizer twice should change nothing. For this input a second application changed the result again (${once.preview} became ${twice.preview}), so values normalized once and values normalized twice compare as different.`,
            expected: `${fn.id}(${fn.id}(x)) equals ${fn.id}(x).`,
            evidence: [
              { call: ctx.expr(fn, input.args), result: once.preview },
              { call: `${fn.id}(${ctx.expr(fn, input.args)})`, result: twice.preview },
            ],
            group: 'idem',
            repro: [`const once = ${ctx.value(fn, input.args)};`, `const twice = ${ctx.valueOf(fn, 'once')};`, 'console.log(once, twice);'],
            test: {
              name: `${fn.id} is idempotent`,
              body: [`const once = ${ctx.value(fn, input.args)};`, `expect(${ctx.valueOf(fn, 'once')}).toEqual(once);`],
            },
          };
        },
      },
    ];
  },
};

const SMALL = [0.5, 0.25, 0.75, 0.001];
const hasMinus = (s: string) => /[-−(]/.test(s);

export const negativeZeroSign: Oracle = {
  id: 'negative-zero-sign',
  title: 'Lost minus sign',
  summary: 'A number formatting function prints numbers between -1 and 0 without their minus sign, while -1.5 keeps it.',
  plans(fn) {
    if (!returns(fn, 'string')) return [];
    const plans: Plan[] = [];
    fn.params.forEach((param, index) => {
      if (param.rest || !param.shape || (param.shape.kind !== 'number' && !(param.shape.kind === 'union' && param.shape.options.some((o) => o.kind === 'number')))) return;
      const at = (args: readonly unknown[], value: number) => {
        const copy = [...args];
        while (copy.length <= index) copy.push(undefined);
        copy[index] = value;
        return copy;
      };
      plans.push({
        rule: 'negative-zero-sign',
        fn,
        shrink: false,
        inputs: (generated) => {
          const base = generated[0]?.args ?? [];
          return SMALL.map((v, order) => ({ args: at(base, -v), rank: order, order }));
        },
        async check(input, ctx) {
          const v = -(input.args[index] as number);
          const [neg, pos, refNeg, refPos] = await Promise.all([at(input.args, -v), at(input.args, v), at(input.args, -1.5), at(input.args, 1.5)].map(async (args) => (await ctx.call(fn, args)).outcomes[0]));
          const strings = [neg, pos, refNeg, refPos].map((o) => (o && o.kind === 'return' && typeof o.string === 'string' ? o.string : undefined));
          const [n, p, rn, rp] = strings;
          if (n === undefined || p === undefined || rn === undefined || rp === undefined) return null;
          if (!/[1-9]/.test(p) || hasMinus(p) || hasMinus(rp) || !hasMinus(rn) || hasMinus(n) || n !== p || rn === rp) return null;
          const negExpr = ctx.value(fn, at(input.args, -v));
          const posExpr = ctx.value(fn, at(input.args, v));
          const refExpr = ctx.value(fn, at(input.args, -1.5));
          return {
            severity: 'medium',
            confidence: 'medium',
            title: `${fn.id} drops the minus sign of numbers between -1 and 0`,
            explanation:
              `${ctx.expr(fn, at(input.args, -v))} returns ${neg?.preview}, the same as for ${v}. Negative numbers outside that range keep their sign (${ctx.expr(fn, at(input.args, -1.5))} returns ${refNeg?.preview}), so the sign is lost only when the integer part is zero. ` +
              'This often happens when the integer part is computed first and the sign is read from it: the integer part of -0.5 is -0, which prints as "0".',
            expected: `A result with a minus sign, like ${refNeg?.preview} for -1.5.`,
            evidence: [
              { call: ctx.expr(fn, at(input.args, -v)), result: neg?.preview ?? '' },
              { call: ctx.expr(fn, at(input.args, v)), result: pos?.preview ?? '' },
              { call: ctx.expr(fn, at(input.args, -1.5)), result: refNeg?.preview ?? '' },
            ],
            group: `neg:${index}`,
            repro: [`console.log(${negExpr});`, `console.log(${posExpr});`, `console.log(${refExpr});`],
            test: { name: `${fn.id} keeps the sign of ${-v}`, body: [`expect(${negExpr}).not.toBe(${posExpr});`] },
          };
        },
      });
    });
    return plans;
  },
};
