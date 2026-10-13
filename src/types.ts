/** Severity of a finding, from most to least important. */
export type Severity = 'high' | 'medium' | 'low' | 'info';

/** How likely a finding is to be a real bug rather than intended behavior. */
export type Confidence = 'high' | 'medium' | 'low';

/** Identifier of an oracle (a rule that decides whether an output is wrong). */
export type RuleId =
  | 'lone-surrogate-output'
  | 'timezone-dependent'
  | 'unexpected-crash'
  | 'nan-leak'
  | 'nondeterministic'
  | 'roundtrip'
  | 'not-idempotent'
  | 'negative-zero-sign';

/** A parameter or property type that breakhound knows how to generate values for. */
export type Shape =
  | { readonly kind: 'string' }
  | { readonly kind: 'number' }
  | { readonly kind: 'boolean' }
  | { readonly kind: 'bigint' }
  | { readonly kind: 'date' }
  | { readonly kind: 'literal'; readonly values: readonly (string | number | boolean)[] }
  | { readonly kind: 'array'; readonly element: Shape }
  | { readonly kind: 'object'; readonly props: readonly PropShape[] }
  | { readonly kind: 'union'; readonly options: readonly Shape[] };

export interface PropShape {
  readonly name: string;
  readonly shape: Shape;
  readonly optional: boolean;
}

/** Coarse classification of a declared return type. */
export type ValueKind = 'string' | 'number' | 'boolean' | 'bigint' | 'date' | 'array' | 'object' | 'void' | 'other';

export interface ParamInfo {
  readonly name: string;
  /** `null` when the type is not supported; such a parameter is optional and always omitted. */
  readonly shape: Shape | null;
  readonly optional: boolean;
  readonly rest: boolean;
  readonly typeText: string;
}

/** An exported function (or a method of an exported object) that breakhound can call. */
export interface FunctionInfo {
  /** Display name, for example `slugify`, `he.encode` or `format`. */
  readonly id: string;
  /** Property path from the module namespace. An empty path means the module itself (`export =`). */
  readonly path: readonly string[];
  /** Last path segment, or the package identifier for the module itself. */
  readonly name: string;
  readonly params: readonly ParamInfo[];
  readonly returnType: string;
  /** Kinds the declared return type can have. Promises are unwrapped. */
  readonly returnKinds: readonly ValueKind[];
  readonly async: boolean;
  /** Declaration text, for example `slugify(text: string, options?: Options): string`. */
  readonly signature: string;
}

/** An export that was found but not analyzed, with the reason. */
export interface SkippedSignature {
  readonly id: string;
  readonly reason: string;
  readonly signature?: string;
}

/** One call shown as evidence in a finding. */
export interface Evidence {
  /** JavaScript expression, for example `truncate('abc', 2)`. */
  readonly call: string;
  /** Inspected result, for example `'ab'` or `throws TypeError: ...`. */
  readonly result: string;
  /** Time zone the call ran in, when it matters. */
  readonly tz?: string;
  readonly note?: string;
}

export interface Finding {
  readonly rule: RuleId;
  readonly severity: Severity;
  readonly confidence: Confidence;
  /** Function display name. */
  readonly function: string;
  readonly signature: string;
  /** One line summary. */
  readonly title: string;
  /** Neutral explanation of what was observed and why it is likely wrong. */
  readonly explanation: string;
  /** What a correct result would look like. */
  readonly expected: string;
  /** The minimal failing input, as JavaScript source for each argument. */
  readonly input: readonly string[];
  readonly evidence: readonly Evidence[];
  /** A standalone ESM script that reproduces the finding with Node. */
  readonly reproduction: string;
  /** A ready to paste Vitest test that fails while the bug exists. */
  readonly test: string;
  /** Whether the finding was reproduced again in a fresh process. */
  readonly confirmed: boolean;
}

export interface TargetInfo {
  /** What the user passed, for example `slugify` or `./my-lib`. */
  readonly spec: string;
  readonly name: string;
  readonly version: string;
  readonly source: 'local' | 'npm';
  /** Declaration file the signatures were read from. */
  readonly types: string;
  /** Runtime entry file that was executed. */
  readonly entry: string;
}

export interface ReportStats {
  /** Callable exports found in the declarations (analyzed plus skipped). */
  readonly exports: number;
  readonly analyzed: number;
  readonly skipped: number;
  readonly calls: number;
  readonly durationMs: number;
  /** True when `maxCalls` stopped the hunt early. */
  readonly budgetExhausted: boolean;
  /** Findings dropped because they did not reproduce in a fresh process. */
  readonly unconfirmed: number;
}

export interface Report {
  readonly tool: { readonly name: 'breakhound'; readonly version: string };
  readonly target: TargetInfo;
  readonly options: {
    readonly seed: number;
    readonly maxCalls: number;
    readonly timeout: number;
    readonly zones: readonly string[];
    readonly rules: readonly RuleId[];
  };
  readonly stats: ReportStats;
  readonly counts: Readonly<Record<Severity, number>>;
  readonly findings: readonly Finding[];
  readonly skipped: readonly SkippedSignature[];
  readonly functions: readonly { readonly id: string; readonly signature: string; readonly calls: number }[];
}

export interface HuntOptions {
  /** Only analyze these functions (names or ids, `*` wildcards allowed). */
  readonly only?: readonly string[];
  /** Skip these functions (names or ids, `*` wildcards allowed). */
  readonly exclude?: readonly string[];
  /** Run only these rules. Defaults to every rule. */
  readonly rules?: readonly RuleId[];
  /** Seed for the random part of the inputs. Default 42. */
  readonly seed?: number;
  /** Maximum number of function calls for the whole hunt. Default 20000. */
  readonly maxCalls?: number;
  /** Per call timeout in milliseconds. Default 2000. */
  readonly timeout?: number;
  /** Time zones for the time zone oracle. The first one is the primary zone. */
  readonly zones?: readonly string[];
  /** Directory used for npm installs. Defaults to a new folder in the OS temp directory. */
  readonly installDir?: string;
  /** Keep the temporary install directory. */
  readonly keep?: boolean;
  /** Called with progress messages. */
  readonly onProgress?: (message: string) => void;
}
