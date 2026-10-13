import type { Input } from '../generate';
import type { CallResult } from '../runner/pool';
import type { Confidence, Evidence, FunctionInfo, RuleId, Severity } from '../types';

/** What an oracle can do while checking one input. Calls are cached and counted against the budget. */
export interface ExecContext {
  /** Primary time zone first, then the others. */
  readonly zones: readonly string[];
  /** ISO time the worker clock is frozen at. */
  readonly now: string;
  /**
   * Calls `fn(...args)` in a worker running in `tz` (default: the primary zone).
   * In the primary zone every call runs twice in a row, so `outcomes[1]` is the repeat.
   */
  call(fn: FunctionInfo, args: readonly unknown[], options?: { readonly tz?: string }): Promise<CallResult>;
  /**
   * Calls `first(...args)` twice, then `second(result)` with the first result.
   * Outcomes: `[first, first again, second]`. `expect` guards the type of the intermediate value.
   */
  chain(first: FunctionInfo, second: FunctionInfo, args: readonly unknown[], expect?: string): Promise<CallResult>;
  /** Source of the call expression, for example `slugify('a b')` or `he.encode('x')`. */
  expr(fn: FunctionInfo, args: readonly unknown[]): string;
  /** Like `expr`, with `await ` in front for async functions. */
  value(fn: FunctionInfo, args: readonly unknown[]): string;
  /** Like `value`, with a source expression as the single argument. */
  valueOf(fn: FunctionInfo, argumentSource: string): string;
}

/** A failed check for one input. The hunt turns the simplest one per group into a Finding. */
export interface Violation {
  readonly severity: Severity;
  readonly confidence: Confidence;
  readonly title: string;
  readonly explanation: string;
  readonly expected: string;
  readonly evidence: readonly Evidence[];
  /** Violations with the same group for the same function become one finding. */
  readonly group: string;
  /** Lines of the reproduction script after the imports. */
  readonly repro: readonly string[];
  /** The Vitest test. */
  readonly test: {
    readonly name: string;
    readonly body: readonly string[];
    /** Lines placed between the imports and the test. */
    readonly prelude?: readonly string[];
    /** Extra named imports from vitest, besides `test` and `expect`. */
    readonly vitest?: readonly string[];
  };
}

/** One way an oracle checks one function (for example one roundtrip partner). */
export interface Plan {
  readonly rule: RuleId;
  readonly fn: FunctionInfo;
  /** Other function involved, for example the decoder of an encoder. */
  readonly partner?: FunctionInfo;
  /** Turns the generated inputs into the inputs this plan checks. Defaults to all of them. */
  inputs?(generated: readonly Input[]): Input[];
  /** Maximum number of inputs to check. */
  readonly maxInputs?: number;
  /** Set to false when shrinking makes no sense for this plan. */
  readonly shrink?: boolean;
  check(input: Input, ctx: ExecContext): Promise<Violation | null>;
}

/** A rule that decides whether a function's behavior is likely wrong. */
export interface Oracle {
  readonly id: RuleId;
  /** Short human title. */
  readonly title: string;
  /** One sentence description used in help output and docs. */
  readonly summary: string;
  /** Returns the checks to run for a function, or an empty list when the rule does not apply. */
  plans(fn: FunctionInfo, all: readonly FunctionInfo[], options: { readonly tzInputs: number }): Plan[];
}
