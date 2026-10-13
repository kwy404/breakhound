import type { Oracle } from './types';
import { isRandomOrTimeName, settled } from './util';

/** The same arguments twice in a row give different results. */
export const nondeterministic: Oracle = {
  id: 'nondeterministic',
  title: 'Nondeterministic output',
  summary: 'Calling the function twice with the same arguments in the same process returns different results, with the clock frozen.',
  plans(fn) {
    if (fn.returnKinds.length === 1 && fn.returnKinds[0] === 'void') return [];
    const expected = isRandomOrTimeName(fn.name);
    return [
      {
        rule: 'nondeterministic',
        fn,
        async check(input, ctx) {
          const result = await ctx.call(fn, input.args);
          const [first, second] = result.outcomes;
          if (!settled(first) || !settled(second) || first.canon === second.canon) return null;
          const value = ctx.value(fn, input.args);
          const call = ctx.expr(fn, input.args);
          return {
            severity: expected ? 'info' : 'medium',
            confidence: expected ? 'high' : 'medium',
            title: expected ? `${fn.id} returns a different result on each call` : `${fn.id} returns different results for the same input`,
            explanation: expected
              ? `${fn.id} returned different results for the same arguments. Its name suggests randomness, time or unique ids, so this is likely intended.`
              : `Calling ${fn.id} twice in a row with the same arguments, in the same process, gave different results. The clock is frozen during the calls and each call gets a fresh copy of the arguments, ` +
                'so the difference comes from somewhere else: Math.random, a module level counter or cache, or other state shared between calls.',
            expected: 'The same result for the same arguments, or a name and documentation that make the variation explicit.',
            evidence: [
              { call, result: first.preview, note: 'first call' },
              { call, result: second.preview, note: 'second call' },
            ],
            group: 'nondet',
            repro: [`const first = ${value};`, `const second = ${value};`, 'console.log(first, second);'],
            test: {
              name: `${fn.id} is deterministic`,
              body: [`const first = ${value};`, `const second = ${value};`, 'expect(second).toEqual(first);'],
            },
          };
        },
      },
    ];
  },
};
