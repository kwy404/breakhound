import type { RuleId } from '../types';
import { loneSurrogateOutput } from './lone-surrogate-output';
import { nanLeak } from './nan-leak';
import { nondeterministic } from './nondeterministic';
import { negativeZeroSign, notIdempotent, roundtrip } from './pairs';
import { timezoneDependent } from './timezone-dependent';
import type { Oracle } from './types';
import { unexpectedCrash } from './unexpected-crash';

export type { ExecContext, Oracle, Plan, Violation } from './types';

/** Every oracle, in report order. */
export const ORACLES: readonly Oracle[] = [
  loneSurrogateOutput,
  timezoneDependent,
  unexpectedCrash,
  nanLeak,
  nondeterministic,
  roundtrip,
  notIdempotent,
  negativeZeroSign,
];

export const RULE_IDS: readonly RuleId[] = ORACLES.map((o) => o.id);

export function isRuleId(value: string): value is RuleId {
  return (RULE_IDS as readonly string[]).includes(value);
}
