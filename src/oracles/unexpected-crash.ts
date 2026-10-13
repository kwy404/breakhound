import type { Oracle } from './types';
import { isEngineError } from './util';

/** A TypeError or ReferenceError from the engine for arguments that match the declared types. */
export const unexpectedCrash: Oracle = {
  id: 'unexpected-crash',
  title: 'Unexpected crash',
  summary: 'Arguments that match the declared types make the function throw a TypeError or ReferenceError from the engine, hang, or end the process.',
  plans(fn) {
    return [
      {
        rule: 'unexpected-crash',
        fn,
        async check(input, ctx) {
          const result = await ctx.call(fn, input.args);
          const out = result.outcomes[0];
          if (!out) return null;
          const call = ctx.expr(fn, input.args);
          const value = ctx.value(fn, input.args);
          const declared = fn.signature;
          if (out.kind === 'timeout' || out.kind === 'crash') {
            const hang = out.kind === 'timeout';
            return {
              severity: hang ? 'medium' : 'high',
              confidence: hang ? 'low' : 'medium',
              title: hang ? `${fn.id} does not return for some inputs` : `${fn.id} ends the process for some inputs`,
              explanation: hang
                ? `The call ${out.preview}, with arguments that match the declared types (${declared}). It may loop forever or be very slow for this input. Timeouts can also come from a busy machine, so check it by hand.`
                : `The worker process running the call ended unexpectedly (${out.preview}). The arguments match the declared types (${declared}).`,
              expected: 'The call returns, or throws an error, within a reasonable time.',
              evidence: [{ call, result: out.preview }],
              group: out.kind,
              repro: [`console.log(${value});`, `// ${out.preview}`],
              test: { name: `${fn.id} finishes for this input`, body: [`${value};`] },
            };
          }
          if (out.kind !== 'throw') return null;
          const { name, message } = out.error;
          if (isEngineError(name, message)) {
            return {
              severity: 'high',
              confidence: 'high',
              title: `${fn.id} throws ${name}: ${message}`,
              explanation:
                `The arguments match the declared parameter types (${declared}), but the call throws ${name}: ${message}. ` +
                'This message comes from the JavaScript engine, not from an explicit validation check, which usually means the code reads a property of undefined or null, calls a missing method or iterates something that is not iterable.',
              expected: 'A return value, or an explicit error that explains which input is not supported (and a declared type that excludes it).',
              evidence: [{ call, result: out.preview }],
              group: `throw:${name}:${message}`,
              repro: [`console.log(${value});`, `// ${name}: ${message}`],
              test: {
                name: `${fn.id} does not throw ${name} for valid input`,
                body: fn.async ? [`${value};`] : [`expect(() => ${value}).not.toThrow();`],
              },
            };
          }
          return {
            severity: 'info',
            confidence: 'high',
            title: `${fn.id} throws ${name} for some inputs that match its types`,
            explanation:
              `For arguments that match the declared types (${declared}), the call throws ${name}: ${message}. ` +
              'This looks like an intentional validation error or a documented limit, so it is reported for information only. If the input is not supported, a narrower declared type would let TypeScript users catch it at compile time.',
            expected: 'A narrower declared type, or a documented error.',
            evidence: [{ call, result: out.preview }],
            group: `info:${name}`,
            repro: [`console.log(${value});`, `// ${name}: ${message}`],
            test: { name: `${fn.id} accepts this input`, body: fn.async ? [`${value};`] : [`expect(() => ${value}).not.toThrow();`] },
          };
        },
      },
    ];
  },
};
