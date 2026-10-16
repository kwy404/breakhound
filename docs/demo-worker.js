// The paste and see demo, worker side. Receives two versions of one function
// and the edge case pools (built from the same catalog as the CLI), runs both
// versions on the same inputs and reports where the answers differ, plus the
// bugs the new version has. Runs off the main thread so a slow or endless
// function cannot freeze the page; the page stops this worker after a few
// seconds.
/* eslint-disable no-new-func */

const MAX_INPUTS = 360;

// ---------- Values ----------

function decode(v) {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if ('$n' in v) return v.$n === '-0' ? -0 : Number(v.$n);
    if ('$b' in v) return BigInt(v.$b);
    if ('$d' in v) return new Date(v.$d);
  }
  return v;
}

const LONE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const hasLone = (s) => LONE.test(s);

function strLit(s) {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (ch === "'" || ch === '\\') out += `\\${ch}`;
    else if (ch === '\n') out += '\\n';
    else if (ch === '\t') out += '\\t';
    else if (ch === '\r') out += '\\r';
    else if (c < 0x20 || (c >= 0x7f && c < 0xa0)) out += `\\x${c.toString(16).padStart(2, '0')}`;
    else if (c >= 0xd800 && c <= 0xdfff) out += `\\u${c.toString(16)}`;
    else if (c > 0xffff && !/\p{Extended_Pictographic}/u.test(ch)) out += `\\u{${c.toString(16).toUpperCase()}}`;
    else if (c > 0xffff) out += ch;
    else if (c === 0x200b || c === 0x200d || c === 0xfeff || c === 0x2028 || c === 0x2029) out += `\\u{${c.toString(16).toUpperCase()}}`;
    else out += ch;
  }
  return `'${out}'`;
}

/** JavaScript source for a value, short enough for one line. */
function src(v, depth = 0) {
  if (typeof v === 'string') return strLit(v.length > 60 ? `${v.slice(0, 57)}...` : v);
  if (typeof v === 'number') return Object.is(v, -0) ? '-0' : String(v);
  if (typeof v === 'bigint') return `${v}n`;
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? 'new Date(NaN)' : `new Date('${v.toISOString()}')`;
  if (typeof v === 'function') return 'function';
  if (depth > 2) return '...';
  if (Array.isArray(v)) return `[${v.slice(0, 6).map((x) => src(x, depth + 1)).join(', ')}${v.length > 6 ? ', ...' : ''}]`;
  if (typeof v === 'object') {
    const entries = Object.entries(v).slice(0, 5).map(([k, x]) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : strLit(k)}: ${src(x, depth + 1)}`);
    return entries.length ? `{ ${entries.join(', ')} }` : '{}';
  }
  return String(v);
}

/** A key that tells apart -0, NaN, dates and nested values. */
function key(v, depth = 0) {
  if (typeof v === 'number') return Object.is(v, -0) ? 'n:-0' : `n:${v}`;
  if (typeof v === 'string') return `s:${v}`;
  if (typeof v === 'bigint') return `b:${v}`;
  if (v instanceof Date) return `d:${v.getTime()}`;
  if (v === undefined || v === null || typeof v === 'boolean') return String(v);
  if (typeof v === 'function') return 'f';
  if (depth > 6) return '?';
  if (Array.isArray(v)) return `[${v.map((x) => key(x, depth + 1)).join(',')}]`;
  if (typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${k}:${key(v[k], depth + 1)}`).join(',')}}`;
  return String(v);
}

// ---------- Reading the pasted code ----------

/** Index of the bracket that closes the one at `open`. Skips strings and comments. */
function closing(text, open) {
  const pairs = { '(': ')', '[': ']', '{': '}', '<': '>' };
  const stack = [pairs[text[open]]];
  for (let i = open + 1; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      for (i++; i < text.length && text[i] !== c; i++) if (text[i] === '\\') i++;
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2);
      if (i < 0) return -1;
      i++;
    } else if (c === stack[stack.length - 1]) {
      stack.pop();
      if (!stack.length) return i;
    } else if (c === '(' || c === '[' || c === '{') stack.push(pairs[c]);
  }
  return -1;
}

function splitTop(text) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      for (i++; i < text.length && text[i] !== c; i++) if (text[i] === '\\') i++;
    } else if ('([{<'.includes(c)) depth++;
    else if (')]}>'.includes(c) && !(c === '>' && text[i - 1] === '=')) depth--;
    else if (c === ',' && depth === 0) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }
  if (text.slice(start).trim()) out.push(text.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

/** Maps a TypeScript type to a shape the demo can generate. */
function shapeOf(type) {
  const t = (type || '').trim().replace(/^readonly\s+/, '');
  if (!t) return null;
  const parts = splitUnion(t).filter((p) => !/^(undefined|null)$/.test(p));
  if (parts.length > 1) {
    if (parts.every((p) => /^(['"]).*\1$|^-?\d+(\.\d+)?$/.test(p))) return { kind: 'literal', values: parts.map((p) => (/^['"]/.test(p) ? p.slice(1, -1) : Number(p))) };
    return shapeOf(parts[0]);
  }
  const one = parts[0] || t;
  const arr = /^(.*)\[\]$/.exec(one) || /^(?:Readonly)?Array<(.*)>$/.exec(one);
  if (arr) return { kind: 'array', element: shapeOf(arr[1]) || { kind: 'string' } };
  if (/^string$/.test(one)) return { kind: 'string' };
  if (/^number$/.test(one)) return { kind: 'number' };
  if (/^boolean$/.test(one)) return { kind: 'boolean' };
  if (/^bigint$/.test(one)) return { kind: 'bigint' };
  if (/^Date$/.test(one)) return { kind: 'date' };
  if (/^(['"]).*\1$/.test(one)) return { kind: 'literal', values: [one.slice(1, -1)] };
  return null;
}
function splitUnion(t) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if ('(<[{'.includes(c)) depth++;
    else if (')>]}'.includes(c)) depth--;
    else if (c === '|' && depth === 0) {
      out.push(t.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(t.slice(start).trim());
  return out.filter(Boolean);
}

/** Guesses a shape from a default value or the parameter name. */
function guess(name, def) {
  if (def !== undefined) {
    if (/^['"`]/.test(def)) return { kind: 'string' };
    if (/^-?\d/.test(def)) return { kind: 'number' };
    if (/^(true|false)$/.test(def)) return { kind: 'boolean' };
    if (/^\[/.test(def)) return { kind: 'array', element: { kind: 'string' } };
  }
  const n = name.toLowerCase();
  if (/^(n|i|x|y|count|max|min|size|len|length|limit|index|amount|cents|price|total|value|num|number|width|height|ms|seconds|digits|precision)$|(count|max|min|size|len|limit|index|amount|cents|total|num)$/.test(n)) return { kind: 'number' };
  if (/^(date|day|when|at|time)$|date$/.test(n)) return { kind: 'date' };
  if (/^(flag|enabled|disabled|strict|loose)$|^(is|has|should|use)[A-Z_]/.test(name)) return { kind: 'boolean' };
  if (/(list|items|values|tags|words|parts|array|arr)$/.test(n)) return { kind: 'array', element: /values|nums|numbers/.test(n) ? { kind: 'number' } : { kind: 'string' } };
  return { kind: 'string' };
}

/**
 * Reads one function from pasted code: its name, parameters and types, and
 * the code with the parameter and return types removed so it runs as
 * JavaScript.
 */
function read(code) {
  let text = code.replace(/^\s*export\s+(default\s+)?/gm, '');
  const decl = /\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)\s*(<[^>(]*>)?\s*\(/.exec(text);
  const arrow = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:function\b[^(]*)?(<[^>(]*>)?\s*\(/.exec(text);
  const m = !arrow || (decl && decl.index < arrow.index) ? decl : arrow;
  if (!m) throw new SyntaxError('no function found. Write function name(...) { } or const name = (...) => ...');
  const name = m[1];
  const open = m.index + m[0].length - 1;
  const close = closing(text, open);
  if (close < 0) throw new SyntaxError('the parameter list is not closed');
  const params = splitTop(text.slice(open + 1, close)).map((raw) => {
    const rest = raw.startsWith('...');
    const body = rest ? raw.slice(3) : raw;
    const eq = body.search(/=(?!>)/);
    const head = eq >= 0 ? body.slice(0, eq) : body;
    const def = eq >= 0 ? body.slice(eq + 1).trim() : undefined;
    const colon = head.indexOf(':');
    let pname = (colon >= 0 ? head.slice(0, colon) : head).trim();
    const optional = pname.endsWith('?') || def !== undefined;
    pname = pname.replace(/\?$/, '');
    const type = colon >= 0 ? head.slice(colon + 1).trim() : '';
    const shape = shapeOf(type) || guess(pname, def);
    return { name: pname, type: type || null, shape, optional, rest, js: `${rest ? '...' : ''}${pname}${def !== undefined ? ` = ${def}` : ''}` };
  });
  // Drop type parameters and a return type ("): Type {" or "): Type =>").
  let head = text.slice(0, open);
  if (m[2]) {
    const at = head.lastIndexOf(m[2]);
    head = head.slice(0, at) + head.slice(at + m[2].length);
  }
  let tail = text.slice(close + 1);
  if (/^\s*:/.test(tail)) {
    const stop = tail.search(/\{|=>/);
    if (stop > 0) tail = tail.slice(stop);
  }
  const js = `${head}(${params.map((p) => p.js).join(', ')})${tail}`;
  // eslint-disable-next-line no-new-func
  const fn = new Function(`"use strict";\n${js}\n;return ${name};`)();
  if (typeof fn !== 'function') throw new TypeError(`${name} is not a function`);
  return { name, fn, params };
}

// ---------- Inputs ----------

const BASE_DATE = '2026-01-15T12:00:00.000Z';
function base(shape) {
  switch (shape.kind) {
    case 'string':
      return 'Hello World';
    case 'number':
      return 1;
    case 'boolean':
      return true;
    case 'bigint':
      return 1n;
    case 'date':
      return new Date(BASE_DATE);
    case 'literal':
      return shape.values[0];
    case 'array':
      return [base(shape.element)];
    default:
      return undefined;
  }
}
function pool(shape, name, pools) {
  switch (shape.kind) {
    case 'string': {
      const n = name.toLowerCase();
      const hint = /url|uri|href|link|src|origin/.test(n) ? 'url' : /mail/.test(n) ? 'email' : /path|file|dir|folder/.test(n) ? 'path' : /json/.test(n) ? 'json' : /date|time|iso|day/.test(n) ? 'isoDate' : 'string';
      return hint === 'string' ? pools.string : [...pools[hint], ...pools.string.slice(2)];
    }
    case 'number':
      return pools.number;
    case 'boolean':
      return [true, false];
    case 'bigint':
      return pools.bigint;
    case 'date':
      return pools.date;
    case 'literal':
      return shape.values;
    case 'array': {
      const el = pool(shape.element, name, pools).slice(0, 18);
      const out = [[], [base(shape.element)]];
      for (const v of el) out.push([v]);
      for (let i = 0; i + 1 < el.length; i += 2) out.push([el[i], el[i + 1]]);
      out.push(el.slice(0, 8));
      return out;
    }
    default:
      return [undefined];
  }
}
const clone = (v) => (v instanceof Date ? new Date(v.getTime()) : Array.isArray(v) ? v.map(clone) : v);

/** One parameter at a time over its pool, the others at a simple value. Simplest inputs first. */
function inputs(params, pools) {
  const fixed = params.filter((p) => !p.rest);
  const baseArgs = fixed.map((p) => base(p.shape));
  const out = [];
  const seen = new Set();
  const push = (args) => {
    const k = args.map((a) => key(a)).join('|');
    if (seen.has(k) || out.length >= MAX_INPUTS) return;
    seen.add(k);
    out.push(args);
  };
  push(baseArgs);
  const pools2 = fixed.map((p) => pool(p.shape, p.name, pools));
  const longest = Math.max(0, ...pools2.map((p) => p.length));
  for (let j = 0; j < longest; j++) {
    for (let i = 0; i < fixed.length; i++) {
      if (j >= pools2[i].length) continue;
      const args = baseArgs.slice();
      args[i] = pools2[i][j];
      push(args);
    }
  }
  // Pairs: the sharpest values of two parameters together, so a short string
  // meets a small length, an emoji meets a cut point, and so on.
  const sharp = pools2.map((list) =>
    list
      .filter((v, j) => j < 4 || (typeof v === 'string' && (/[\uD800-\uDFFF̀-ͯ]/.test(v) || (v.length > 0 && v.length < 4))) || (typeof v === 'number' && Number.isInteger(v) && v >= -2 && v <= 6))
      .slice(0, 12),
  );
  for (let a = 0; a < fixed.length; a++) {
    for (let b = a + 1; b < fixed.length; b++) {
      for (const va of sharp[a]) {
        for (const vb of sharp[b]) {
          const args = baseArgs.slice();
          args[a] = va;
          args[b] = vb;
          push(args);
        }
      }
    }
  }
  // Optional parameters left out.
  for (let i = fixed.length - 1; i >= 0 && fixed[i].optional; i--) push(baseArgs.slice(0, i));
  return out;
}

// ---------- Running ----------

function call(fn, args) {
  try {
    const value = fn(...args.map(clone));
    if (value && typeof value.then === 'function') return { kind: 'value', value: '[Promise]', async: true };
    return { kind: 'value', value };
  } catch (error) {
    const name = error && error.name ? error.name : 'Error';
    const message = error && error.message ? String(error.message) : String(error);
    return { kind: 'throw', name, message };
  }
}
const resultKey = (r) => (r.kind === 'throw' ? `throw:${r.name}` : `value:${key(r.value)}`);
const resultSrc = (r) => (r.kind === 'throw' ? `throws ${r.name}: ${r.message.length > 70 ? `${r.message.slice(0, 67)}...` : r.message}` : src(r.value));
const callSrc = (name, args) => `${name}(${args.map((a) => src(a)).join(', ')})`;

function allWellFormed(v, depth = 0) {
  if (typeof v === 'string') return !hasLone(v);
  if (depth > 4 || !v || typeof v !== 'object' || v instanceof Date) return true;
  return Object.values(v).every((x) => allWellFormed(x, depth + 1));
}
function allFinite(v, depth = 0) {
  if (typeof v === 'number') return Number.isFinite(v);
  if (depth > 4 || !v || typeof v !== 'object' || v instanceof Date) return true;
  return Object.values(v).every((x) => allFinite(x, depth + 1));
}
function hasLoneOut(v, depth = 0) {
  if (typeof v === 'string') return hasLone(v);
  if (depth > 4 || !v || typeof v !== 'object' || v instanceof Date) return false;
  return Object.values(v).some((x) => hasLoneOut(x, depth + 1));
}

/** The bug checks of the CLI that make sense for one function in a browser. */
function bugsOf(fn, args, r) {
  const out = [];
  if (r.kind === 'throw' && /^(TypeError|ReferenceError|InternalError)$/.test(r.name) || (r.kind === 'throw' && /call stack/i.test(r.message))) {
    out.push({ rule: 'unexpected-crash', title: 'Crash on valid input', why: `throws ${r.name} for a value its parameters accept` });
  }
  if (r.kind === 'value') {
    if (allWellFormed(args) && hasLoneOut(r.value)) out.push({ rule: 'lone-surrogate-output', title: 'Split emoji', why: 'returns half of a surrogate pair' });
    if (typeof r.value === 'number' && Number.isNaN(r.value) && allFinite(args) && args.some((a) => typeof a === 'number' || Array.isArray(a))) {
      out.push({ rule: 'nan-leak', title: 'NaN leak', why: 'returns NaN for finite numbers' });
    }
    if (typeof r.value === 'string' && /\d/.test(r.value) && !r.value.includes('-')) {
      const i = args.findIndex((a) => typeof a === 'number' && a < 0 && a > -1);
      if (i >= 0) {
        const flipped = args.slice();
        flipped[i] = -args[i];
        const r2 = call(fn, flipped);
        if (r2.kind === 'value' && r2.value === r.value && r.value !== '0') out.push({ rule: 'negative-zero-sign', title: 'Lost minus sign', why: `prints the same text for ${src(args[i])} and ${src(-args[i])}` });
      }
    }
  }
  return out;
}

self.onmessage = (event) => {
  const { oldCode, newCode, pools: raw } = event.data;
  const pools = {};
  for (const [k, list] of Object.entries(raw)) pools[k] = list.map(decode);
  let older = null;
  let newer;
  try {
    newer = read(newCode);
  } catch (error) {
    self.postMessage({ type: 'error', which: 'new', message: error.message });
    return;
  }
  if (oldCode.trim()) {
    try {
      older = read(oldCode);
    } catch (error) {
      self.postMessage({ type: 'error', which: 'old', message: error.message });
      return;
    }
  }
  const params = newer.params;
  const list = inputs(params, pools);
  self.postMessage({ type: 'start', name: newer.name, total: list.length, params: params.map((p) => ({ name: p.name, type: p.type, inferred: p.shape.kind === 'array' ? `${p.shape.element.kind}[]` : p.shape.kind, optional: p.optional })) });
  const changes = { throws: [], differs: [], accepts: [] };
  const counts = { throws: 0, differs: 0, accepts: 0 };
  const bugs = new Map();
  let calls = 0;
  for (let i = 0; i < list.length; i++) {
    const args = list[i];
    if (i % 24 === 0) self.postMessage({ type: 'progress', done: i, current: callSrc(newer.name, args) });
    const b = call(newer.fn, args);
    calls++;
    let a = null;
    if (older) {
      a = call(older.fn, args);
      calls++;
      if (resultKey(a) !== resultKey(b)) {
        const kind = b.kind === 'throw' && a.kind !== 'throw' ? 'throws' : a.kind === 'throw' && b.kind !== 'throw' ? 'accepts' : 'differs';
        counts[kind]++;
        if (changes[kind].length < 60) changes[kind].push({ call: callSrc(newer.name, args), before: resultSrc(a), after: resultSrc(b) });
      }
    }
    for (const bug of bugsOf(newer.fn, args, b)) {
      const found = bugs.get(bug.rule);
      if (found) {
        found.count++;
        continue;
      }
      let inOld = null;
      if (older) inOld = bugsOf(older.fn, args, a).some((x) => x.rule === bug.rule);
      bugs.set(bug.rule, { ...bug, count: 1, call: callSrc(newer.name, args), result: resultSrc(b), inOld });
    }
  }
  // Show a few varied examples: the simplest, then unicode, then the rest.
  for (const kind of Object.keys(changes)) {
    const all = changes[kind];
    const picks = all.slice(0, 2);
    const uni = all.find((c) => /[\uD800-\uDFFF]/.test(c.call) && !picks.includes(c)) || all.find((c) => c.call.includes('\\u') && !picks.includes(c));
    if (uni) picks.push(uni);
    for (const c of all) if (picks.length < 4 && !picks.includes(c)) picks.push(c);
    changes[kind] = picks;
  }
  self.postMessage({
    type: 'done',
    name: newer.name,
    compared: Boolean(older),
    calls,
    inputs: list.length,
    changes,
    counts,
    bugs: [...bugs.values()],
  });
};
