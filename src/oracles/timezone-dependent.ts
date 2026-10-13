import type { Evidence } from '../types';
import type { Oracle } from './types';
import { isDateName, settled, shapeHas, spread } from './util';

/** The same call returns different results when the process runs in another time zone. */
export const timezoneDependent: Oracle = {
  id: 'timezone-dependent',
  title: 'Time zone dependent output',
  summary: 'The function takes no Date and no time zone, yet its result changes with the TZ of the process.',
  plans(fn, _all, options) {
    if (fn.returnKinds.length === 1 && fn.returnKinds[0] === 'void') return [];
    const takesDate = fn.params.some((p) => shapeHas(p.shape, 'date') || isDateName(p.name));
    return [
      {
        rule: 'timezone-dependent',
        fn,
        inputs: (generated) => spread(generated, options.tzInputs),
        async check(input, ctx) {
          const [primary, ...others] = ctx.zones;
          if (!primary || !others.length) return null;
          const base = await ctx.call(fn, input.args);
          const [first, again] = base.outcomes;
          if (!settled(first) || !settled(again) || first.canon !== again.canon) return null;
          const results = await Promise.all(others.map(async (tz) => ({ tz, out: (await ctx.call(fn, input.args, { tz })).outcomes[0] })));
          const diffs = results.filter((r) => settled(r.out) && r.out.canon !== first.canon);
          if (!diffs.length) return null;
          const clockRead = first.clockRead || diffs.some((d) => settled(d.out) && d.out.clockRead);
          const info = takesDate || (clockRead && isDateName(fn.name));
          const other = diffs[0] as (typeof diffs)[number];
          const expr = ctx.value(fn, input.args);
          const evidence: Evidence[] = [
            { call: ctx.expr(fn, input.args), result: first.preview, tz: primary },
            ...diffs.slice(0, 3).map((d) => ({ call: ctx.expr(fn, input.args), result: d.out?.preview ?? '', tz: d.tz })),
          ];
          const clockNote = clockRead
            ? ` The function reads the current time; breakhound freezes the clock at ${ctx.now}, an instant that is already New Year in some zones and still December 31 in others.`
            : '';
          return {
            severity: info ? 'info' : 'high',
            confidence: info ? 'high' : 'medium',
            title: info ? `${fn.id} depends on the host time zone` : `${fn.id} returns different results in different time zones`,
            explanation: info
              ? `The result of ${fn.id} changes with the TZ of the process (${diffs.map((d) => d.tz).join(', ')} differ from ${primary}). It takes a date or time argument, so this is often intended, but callers should know that it uses the host time zone.${clockNote}`
              : `${fn.id} takes no Date and no time zone argument, yet the same call returns a different value when the process runs with TZ=${other.tz} instead of TZ=${primary}. ` +
                `Code like this usually mixes local time getters (getHours, getDate, getFullYear, toLocaleString) with UTC values, so results change near midnight and New Year, or between servers and browsers in different zones.${clockNote}`,
            expected: 'The same result in every time zone, or an explicit time zone parameter.',
            evidence,
            group: 'tz',
            repro: [
              ...(clockRead ? [`// The function reads the clock. breakhound froze it at ${ctx.now}.`] : []),
              `for (const tz of ['${primary}', '${other.tz}']) {`,
              '  process.env.TZ = tz;',
              `  console.log(tz, ${expr});`,
              '}',
            ],
            test: {
              name: `${fn.id} does not depend on the host time zone`,
              ...(clockRead ? { vitest: ['vi'] } : {}),
              body: [
                'const original = process.env.TZ;',
                ...(clockRead ? ['vi.useFakeTimers();', `vi.setSystemTime(new Date('${ctx.now}'));`] : []),
                'try {',
                `  process.env.TZ = '${primary}';`,
                `  const expected = ${expr};`,
                `  process.env.TZ = '${other.tz}';`,
                `  expect(${expr}).toEqual(expected);`,
                '} finally {',
                '  if (original === undefined) delete process.env.TZ;',
                '  else process.env.TZ = original;',
                ...(clockRead ? ['  vi.useRealTimers();'] : []),
                '}',
              ],
            },
          };
        },
      },
    ];
  },
};
