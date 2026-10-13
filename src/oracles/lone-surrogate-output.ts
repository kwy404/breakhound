import { allStringsWellFormed } from '../values';
import type { Oracle } from './types';
import { hex, returns } from './util';

const LONE_SURROGATE_SOURCE = String.raw`/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/`;

/** Well formed strings in, malformed UTF-16 out: a surrogate pair was cut in half. */
export const loneSurrogateOutput: Oracle = {
  id: 'lone-surrogate-output',
  title: 'Lone surrogate in output',
  summary: 'Every string argument is well formed, yet the returned string contains half of a surrogate pair.',
  plans(fn) {
    if (!['string', 'array', 'object'].some((k) => returns(fn, k))) return [];
    return [
      {
        rule: 'lone-surrogate-output',
        fn,
        async check(input, ctx) {
          if (!allStringsWellFormed(input.args)) return null;
          const result = await ctx.call(fn, input.args);
          const out = result.outcomes[0];
          if (!out || out.kind !== 'return' || !out.lone) return null;
          const { where, accessor, index, unit } = out.lone;
          const target = `result${accessor}`;
          return {
            severity: 'high',
            confidence: 'high',
            title: `${fn.id} returns a string with a lone surrogate`,
            explanation:
              `Every string argument is well formed UTF-16, but the ${where} contains an unpaired surrogate (${hex(unit)} at index ${index}). ` +
              'A lone surrogate renders as a replacement character, makes encodeURIComponent throw and is changed by TextEncoder and by JSON round trips through UTF-8. ' +
              'It usually means a string was cut between the two halves of a surrogate pair, for example by slice, substring, substr or a length limit counted in UTF-16 code units.',
            expected: 'A well formed string. Cut text at code point or grapheme boundaries so surrogate pairs stay together.',
            evidence: [{ call: ctx.expr(fn, input.args), result: out.preview, note: `${hex(unit)} at index ${index} of the ${where} has no partner` }],
            group: 'lone',
            repro: [
              `const result = ${ctx.value(fn, input.args)};`,
              `console.log(${target});`,
              '// true means the string contains a lone surrogate (isWellFormed() is false on Node 20+):',
              `console.log(${LONE_SURROGATE_SOURCE}.test(${target}));`,
            ],
            test: {
              name: `${fn.id} returns well formed UTF-16`,
              prelude: [`const LONE_SURROGATE = ${LONE_SURROGATE_SOURCE};`],
              body: [`const result = ${ctx.value(fn, input.args)};`, `expect(${target}).not.toMatch(LONE_SURROGATE);`],
            },
          };
        },
      },
    ];
  },
};
