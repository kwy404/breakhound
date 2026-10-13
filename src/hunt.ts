import { cpus } from 'node:os';
import { extractSignatures, packageIdentifier } from './extract';
import { generateInputs, type Input } from './generate';
import { ORACLES, RULE_IDS } from './oracles/index';
import type { ExecContext, Plan, Violation } from './oracles/types';
import { Pool, type CallResult } from './runner/pool';
import { resolveTarget } from './resolve';
import { shrinkCandidates } from './shrink';
import type { Finding, FunctionInfo, HuntOptions, Report, Severity } from './types';
import { argsComplexity, argsSource, valueKey } from './values';
import { VERSION } from './version';

export const DEFAULT_ZONES = ['UTC', 'America/Sao_Paulo', 'Asia/Kathmandu', 'Pacific/Kiritimati', 'America/New_York', 'Australia/Lord_Howe'];
/** The worker clock: late on December 31 in UTC, already New Year east of +01:30. */
export const FROZEN_NOW = '2026-12-31T22:30:00.000Z';
export const SEVERITIES: readonly Severity[] = ['high', 'medium', 'low', 'info'];

interface Access {
  via: 'named' | 'default';
  path: readonly string[];
}

function matches(fn: FunctionInfo, patterns: readonly string[]): boolean {
  return patterns.some((p) => {
    const re = new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
    return re.test(fn.id) || re.test(fn.name);
  });
}

class Engine implements ExecContext {
  readonly cache = new Map<string, Promise<CallResult>>();
  readonly access = new Map<string, Access>();
  readonly perFunction = new Map<string, number>();
  exhausted = false;

  constructor(
    readonly pool: Pool,
    readonly zones: readonly string[],
    readonly now: string,
    readonly pkgId: string,
    readonly maxCalls: number,
  ) {}

  private run(fn: FunctionInfo, key: string, request: Parameters<Pool['run']>[0], tz: string): Promise<CallResult> {
    const cached = this.cache.get(key);
    if (cached) return cached;
    if (this.pool.calls >= this.maxCalls) {
      this.exhausted = true;
      return Promise.resolve({ outcomes: [{ kind: 'budget', preview: 'call budget exhausted' }] });
    }
    this.perFunction.set(fn.id, (this.perFunction.get(fn.id) ?? 0) + 1);
    const promise = this.pool.run(request, tz).then((result) => {
      if (result.via && result.path && !this.access.has(fn.id)) this.access.set(fn.id, { via: result.via, path: result.path });
      return result;
    });
    this.cache.set(key, promise);
    return promise;
  }

  call(fn: FunctionInfo, args: readonly unknown[], options: { tz?: string } = {}): Promise<CallResult> {
    const tz = options.tz ?? (this.zones[0] as string);
    const repeat = tz === this.zones[0] ? 2 : 1;
    return this.run(fn, `c|${fn.id}|${tz}|${args.map(valueKey).join('|')}`, { path: fn.path, args, repeat }, tz);
  }

  chain(first: FunctionInfo, second: FunctionInfo, args: readonly unknown[], expect?: string): Promise<CallResult> {
    const tz = this.zones[0] as string;
    return this.run(
      first,
      `t|${first.id}|${second.id}|${args.map(valueKey).join('|')}`,
      { path: first.path, args, repeat: 2, then: { path: second.path, ...(expect ? { expect } : {}) } },
      tz,
    );
  }

  callee(fn: FunctionInfo): string {
    const access = this.access.get(fn.id) ?? { via: 'named', path: fn.path };
    const path = [...access.path];
    if (access.via === 'named' && path[0] !== 'default') return path.join('.');
    if (access.via === 'named') path.shift();
    return [this.pkgId, ...path].join('.');
  }

  expr(fn: FunctionInfo, args: readonly unknown[]): string {
    return `${this.callee(fn)}(${argsSource(args)})`;
  }

  value(fn: FunctionInfo, args: readonly unknown[]): string {
    return `${fn.async ? 'await ' : ''}${this.expr(fn, args)}`;
  }

  valueOf(fn: FunctionInfo, argument: string): string {
    return `${fn.async ? 'await ' : ''}${this.callee(fn)}(${argument})`;
  }

  importLine(fns: readonly FunctionInfo[], moduleName: string): string {
    const named = new Set<string>();
    let useDefault = false;
    for (const fn of fns) {
      const access = this.access.get(fn.id) ?? { via: 'named', path: fn.path };
      if (access.via === 'named' && access.path[0] !== 'default') named.add(access.path[0] as string);
      else useDefault = true;
    }
    const parts = [useDefault ? this.pkgId : '', named.size ? `{ ${[...named].join(', ')} }` : ''].filter(Boolean);
    return `import ${parts.join(', ')} from '${moduleName}';`;
  }
}

interface Hit {
  plan: Plan;
  input: Input;
  violation: Violation;
}

async function shrink(plan: Plan, hit: Hit, ctx: ExecContext): Promise<Hit> {
  let best = hit;
  let attempts = 0;
  let improved = true;
  while (improved && attempts < 60) {
    improved = false;
    for (const args of shrinkCandidates(best.input.args, plan.fn)) {
      const rank = argsComplexity(args);
      if (rank >= best.input.rank) continue;
      if (++attempts > 60) break;
      const input = { args, rank, order: best.input.order };
      const violation = await plan.check(input, ctx);
      if (violation && violation.group === best.violation.group) {
        best = { plan, input, violation };
        improved = true;
        break;
      }
    }
  }
  return best;
}

function indent(lines: readonly string[]): string[] {
  return lines.map((l) => (l ? `  ${l}` : l));
}

/**
 * Finds bugs in a package without tests: reads its TypeScript declarations,
 * generates inputs for every exported function, runs the calls in child
 * processes and reports what the oracles flag.
 */
export async function hunt(target: string, options: HuntOptions = {}): Promise<Report> {
  const started = Date.now();
  const seed = options.seed ?? 42;
  const maxCalls = options.maxCalls ?? 20000;
  const timeout = options.timeout ?? 2000;
  const zones = options.zones?.length ? [...options.zones] : DEFAULT_ZONES;
  const rules = options.rules?.length ? [...options.rules] : [...RULE_IDS];
  const progress = options.onProgress ?? (() => {});
  const resolved = resolveTarget(target, {
    ...(options.installDir ? { installDir: options.installDir } : {}),
    ...(options.keep ? { keep: options.keep } : {}),
    onProgress: progress,
  });
  try {
    progress(`reading ${resolved.types}`);
    const extraction = extractSignatures(resolved.types, resolved.name);
    let functions = extraction.functions;
    if (options.only?.length) functions = functions.filter((f) => matches(f, options.only ?? []));
    if (options.exclude?.length) functions = functions.filter((f) => !matches(f, options.exclude ?? []));
    const pkgId = packageIdentifier(resolved.name);
    const primarySize = Math.max(1, Math.min(3, cpus().length - 1));
    const pool = new Pool({ entry: resolved.entry, now: Date.parse(FROZEN_NOW), timeout, sizes: { [zones[0] as string]: primarySize } });
    const engine = new Engine(pool, zones, FROZEN_NOW, pkgId, maxCalls);
    const findings: Finding[] = [];
    let unconfirmed = 0;
    try {
      await pool.check(zones[0] as string);
      const perFunction = Math.max(8, Math.min(60, Math.floor((maxCalls / Math.max(1, functions.length) - 40) / 2.5)));
      const tzInputs = Math.min(10, perFunction);
      const oracles = ORACLES.filter((o) => rules.includes(o.id));
      const hits = new Map<string, Hit[]>();

      const huntFunction = async (fn: FunctionInfo): Promise<void> => {
        progress(`hunting ${fn.id}`);
        const inputs = generateInputs(fn, { seed, budget: perFunction });
        const plans = oracles.flatMap((o) => o.plans(fn, extraction.functions, { tzInputs }));
        for (const plan of plans) {
          const planInputs = (plan.inputs ? plan.inputs(inputs) : inputs).slice(0, plan.maxInputs ?? Infinity);
          let found = 0;
          for (const input of planInputs) {
            if (engine.exhausted || found >= 10) break;
            const violation = await plan.check(input, engine);
            if (!violation) continue;
            found++;
            const key = `${fn.id}|${plan.rule}|${plan.partner?.id ?? ''}|${violation.group}`;
            const list = hits.get(key) ?? [];
            list.push({ plan, input, violation });
            hits.set(key, list);
          }
        }
      };

      const queue = [...functions];
      await Promise.all(
        Array.from({ length: primarySize }, async () => {
          for (let fn = queue.shift(); fn; fn = queue.shift()) await huntFunction(fn);
        }),
      );

      for (const list of hits.values()) {
        list.sort((a, b) => a.input.rank - b.input.rank || a.input.order - b.input.order);
        let best = list[0] as Hit;
        if (best.plan.shrink !== false) best = await shrink(best.plan, best, engine);
        let confirmed = false;
        if (best.violation.severity !== 'info') {
          const fresh = new Pool({ entry: resolved.entry, now: Date.parse(FROZEN_NOW), timeout });
          const freshEngine = new Engine(fresh, zones, FROZEN_NOW, pkgId, Infinity);
          for (const [id, access] of engine.access) freshEngine.access.set(id, access);
          try {
            const again = await best.plan.check(best.input, freshEngine);
            confirmed = again !== null && again.group === best.violation.group;
          } finally {
            fresh.close();
          }
          if (!confirmed) {
            unconfirmed++;
            continue;
          }
        }
        const v = best.violation;
        const fns = [best.plan.fn, ...(best.plan.partner ? [best.plan.partner] : [])];
        const importLine = engine.importLine(fns, resolved.name);
        const isAsync = fns.some((f) => f.async) || v.test.body.some((l) => l.includes('await '));
        const reproduction = [
          `// ${v.title}`,
          `// Found by breakhound. Package: ${resolved.name}@${resolved.version}`,
          importLine,
          '',
          ...v.repro,
          '',
        ].join('\n');
        const vitestNames = ['expect', 'test', ...(v.test.vitest ?? [])].sort();
        const test = [
          `import { ${vitestNames.join(', ')} } from 'vitest';`,
          importLine,
          '',
          ...(v.test.prelude?.length ? [...v.test.prelude, ''] : []),
          `test(${JSON.stringify(v.test.name)}, ${isAsync ? 'async ' : ''}() => {`,
          ...indent(v.test.body),
          '});',
          '',
        ].join('\n');
        findings.push({
          rule: best.plan.rule,
          severity: v.severity,
          confidence: v.confidence,
          function: best.plan.fn.id,
          signature: best.plan.fn.signature,
          title: v.title,
          explanation: v.explanation,
          expected: v.expected,
          input: best.input.args.map((a) => argsSource([a])),
          evidence: v.evidence,
          reproduction,
          test,
          confirmed,
        });
      }
    } finally {
      pool.close();
    }
    findings.sort(
      (a, b) =>
        SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) ||
        RULE_IDS.indexOf(a.rule) - RULE_IDS.indexOf(b.rule) ||
        a.function.localeCompare(b.function) ||
        a.title.localeCompare(b.title),
    );
    const counts = { high: 0, medium: 0, low: 0, info: 0 } as Record<Severity, number>;
    for (const f of findings) counts[f.severity]++;
    return {
      tool: { name: 'breakhound', version: VERSION },
      target: {
        spec: target,
        name: resolved.name,
        version: resolved.version,
        source: resolved.source,
        types: resolved.types,
        entry: resolved.entry,
      },
      options: { seed, maxCalls, timeout, zones, rules },
      stats: {
        exports: extraction.functions.length + extraction.skipped.length,
        analyzed: functions.length,
        skipped: extraction.skipped.length,
        calls: pool.calls,
        durationMs: Date.now() - started,
        budgetExhausted: engine.exhausted,
        unconfirmed,
      },
      counts,
      findings,
      skipped: extraction.skipped,
      functions: functions.map((f) => ({ id: f.id, signature: f.signature, calls: engine.perFunction.get(f.id) ?? 0 })),
    };
  } finally {
    resolved.cleanup();
  }
}
