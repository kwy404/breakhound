import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { extractSignatures, generateInputs, packageIdentifier } from '../src/index';
import { findPartners } from '../src/oracles/pairs';
import { isEngineError, words } from '../src/oracles/util';
import { shrinkCandidates } from '../src/shrink';
import { loneSurrogateIndex, stringLiteral, toSource } from '../src/values';

const types = fileURLToPath(new URL('./fixtures/buggy-lib/dist/index.d.ts', import.meta.url));
const { functions, skipped } = extractSignatures(types, 'buggy-lib');
const byId = new Map(functions.map((f) => [f.id, f]));
const get = (id: string) => {
  const fn = byId.get(id);
  if (!fn) throw new Error(`missing ${id}`);
  return fn;
};

describe('signature extraction', () => {
  test('reads string, number and array parameters', () => {
    expect(get('truncate').params.map((p) => p.shape?.kind)).toEqual(['string', 'number']);
    expect(get('average').params[0]?.shape).toEqual({ kind: 'array', element: { kind: 'number' } });
  });

  test('reads object literals with optional literal unions', () => {
    expect(get('pad').params[1]?.shape).toEqual({
      kind: 'object',
      props: [
        { name: 'width', shape: { kind: 'number' }, optional: false },
        { name: 'side', shape: { kind: 'literal', values: ['left', 'right'] }, optional: true },
      ],
    });
  });

  test('skips callbacks with a reason', () => {
    expect(skipped[0]?.id).toBe('mapWords');
    expect(skipped[0]?.reason).toMatch(/unsupported type/);
  });

  test('package identifiers', () => {
    expect(packageIdentifier('query-string')).toBe('queryString');
    expect(packageIdentifier('@scope/escape-html')).toBe('escapeHtml');
  });
});

describe('input generation', () => {
  test('is deterministic for a seed and respects the budget', () => {
    const a = generateInputs(get('truncate'), { seed: 1, budget: 30 });
    const b = generateInputs(get('truncate'), { seed: 1, budget: 30 });
    expect(a).toHaveLength(30);
    expect(a.map((i) => toSource(i.args))).toEqual(b.map((i) => toSource(i.args)));
    expect(a[0]?.args).toEqual(['Hello World', 1]);
  });

  test('only produces well formed strings', () => {
    for (const input of generateInputs(get('truncate'), { seed: 7, budget: 60 })) {
      expect(loneSurrogateIndex(input.args[0] as string)).toBe(-1);
    }
  });
});

describe('oracle helpers', () => {
  test('engine errors versus validation errors', () => {
    expect(isEngineError('TypeError', "Cannot read properties of undefined (reading 'x')")).toBe(true);
    expect(isEngineError('TypeError', 'x.map is not a function')).toBe(true);
    expect(isEngineError('TypeError', 'Expected a string but received a number')).toBe(false);
    expect(isEngineError('RangeError', 'Invalid time value')).toBe(false);
  });

  test('words and inverse pairs', () => {
    expect(words('encodeHTMLEntities')).toEqual(['encode', 'html', 'entities']);
    expect(findPartners(get('encodeBase'), functions).map((f) => f.id)).toEqual(['decodeBase']);
  });
});

describe('values and shrinking', () => {
  test('string literals escape everything outside printable ASCII', () => {
    const text = `a${String.fromCodePoint(0x1f600)}${String.fromCharCode(0xd83d)}\n`;
    expect(stringLiteral(text)).toBe(String.raw`'a\u{1F600}\uD83D\n'`);
    expect(toSource([-0, 1n, Number.NaN, { a: 'x' }])).toBe("[-0, 1n, NaN, { a: 'x' }]");
  });

  test('shrink candidates keep code points whole', () => {
    const candidates = shrinkCandidates([`ab${String.fromCodePoint(0x1f600)}`, 10], get('truncate'));
    expect(candidates[0]).toEqual(['', 10]);
    for (const c of candidates) expect(loneSurrogateIndex(c[0] as string)).toBe(-1);
  });
});
