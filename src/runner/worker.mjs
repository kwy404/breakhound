// @ts-check
// Child process that loads the package under test and executes calls sent by
// the parent over IPC. It runs with its own TZ environment variable, a frozen
// clock and a scratch working directory. It must stay self contained: it is
// copied as is to dist/worker.mjs.
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { inspect } from 'node:util';

const [entry = '', frozenArg = '0'] = process.argv.slice(2);
const FROZEN = Number(frozenArg);
const realExit = process.exit.bind(process);

/** @param {unknown} message */
const send = (message) => {
  if (process.send) process.send(message);
};

// Frozen clock: `new Date()`, `Date()` and `Date.now()` return a fixed instant,
// so outputs that read the clock are comparable across calls and processes.
let clockRead = false;
const RealDate = Date;
const now = () => {
  clockRead = true;
  return FROZEN;
};
const FrozenDate = new Proxy(RealDate, {
  construct(target, args, newTarget) {
    if (args.length === 0) {
      clockRead = true;
      return Reflect.construct(target, [FROZEN], newTarget);
    }
    return Reflect.construct(target, args, newTarget);
  },
  apply() {
    clockRead = true;
    return new RealDate(FROZEN).toString();
  },
  get(target, prop) {
    if (prop === 'now') return now;
    return Reflect.get(target, prop, target);
  },
});
globalThis.Date = FrozenDate;
RealDate.prototype.constructor = FrozenDate;

// A library calling process.exit must not end the worker silently.
process.exit = /** @type {typeof process.exit} */ (
  (code) => {
    throw new Error(`process.exit(${code ?? ''}) was called`);
  }
);
process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});

/** @type {any} */
let ns;

const LONG_STRING = 4096;

/**
 * Canonical text of a value, used to compare outputs between calls and processes.
 * @param {unknown} value
 * @param {number} [depth]
 * @param {WeakSet<object>} [seen]
 * @returns {string}
 */
function canon(value, depth = 0, seen = new WeakSet()) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  switch (typeof value) {
    case 'string':
      if (value.length > LONG_STRING) return `string(${value.length}:${createHash('sha1').update(value, 'utf16le').digest('hex')})`;
      return JSON.stringify(value);
    case 'number':
      return Object.is(value, -0) ? '-0' : String(value);
    case 'bigint':
      return `${value}n`;
    case 'boolean':
      return String(value);
    case 'symbol':
      return `Symbol(${value.description ?? ''})`;
    case 'function':
      return `[Function ${value.name}]`;
    default:
      break;
  }
  const object = /** @type {object} */ (value);
  if (seen.has(object)) return '[Circular]';
  if (depth > 6) return '[Deep]';
  seen.add(object);
  try {
    if (object instanceof RealDate) {
      const time = object.getTime();
      return Number.isNaN(time) ? 'Date(Invalid)' : `Date(${object.toISOString()})`;
    }
    if (object instanceof RegExp) return String(object);
    if (object instanceof Error) return `${object.name}(${object.message})`;
    if (Array.isArray(object)) {
      const items = [];
      const max = Math.min(object.length, 500);
      for (let i = 0; i < max; i++) items.push(i in object ? canon(object[i], depth + 1, seen) : '<hole>');
      return `[${items.join(',')}${object.length > max ? `,...${object.length}` : ''}]`;
    }
    if (object instanceof Map) {
      return `Map{${[...object].slice(0, 200).map(([k, v]) => `${canon(k, depth + 1, seen)}=>${canon(v, depth + 1, seen)}`).join(',')}}`;
    }
    if (object instanceof Set) return `Set{${[...object].slice(0, 200).map((v) => canon(v, depth + 1, seen)).join(',')}}`;
    if (ArrayBuffer.isView(object)) return `${object.constructor.name}(${Array.from(new Uint8Array(object.buffer, object.byteOffset, object.byteLength)).join(',')})`;
    if (typeof (/** @type {any} */ (object).then) === 'function') return '[Promise]';
    const proto = Object.getPrototypeOf(object);
    const name = proto === null ? 'null' : proto === Object.prototype ? '' : (proto.constructor && proto.constructor.name) || 'anonymous';
    const keys = Object.keys(object).sort();
    const parts = keys.slice(0, 200).map((k) => {
      let v;
      try {
        v = /** @type {any} */ (object)[k];
      } catch {
        v = '[getter threw]';
      }
      return `${JSON.stringify(k)}:${canon(v, depth + 1, seen)}`;
    });
    return `${name}{${parts.join(',')}}`;
  } finally {
    seen.delete(object);
  }
}

/**
 * Escapes everything outside printable ASCII, so invisible characters,
 * surrogates and look alike characters are unambiguous in reports.
 * @param {string} text
 */
function asciiSafe(text) {
  let out = '';
  for (const ch of text) {
    const cp = /** @type {number} */ (ch.codePointAt(0));
    if (cp === 10 || (cp >= 0x20 && cp < 0x7f)) out += ch;
    else if (cp > 0xffff) out += `\\u{${cp.toString(16).toUpperCase()}}`;
    else out += `\\u${cp.toString(16).toUpperCase().padStart(4, '0')}`;
  }
  return out;
}

/** @param {unknown} value */
function preview(value) {
  if (typeof value === 'string' && value.length > 300) {
    return asciiSafe(`${inspect(value.slice(0, 300))}... (${value.length} chars)`);
  }
  return asciiSafe(inspect(value, { depth: 3, maxArrayLength: 20, maxStringLength: 300, breakLength: Infinity, compact: true, sorted: true }));
}

/** @param {unknown} value */
function kindOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (value instanceof RealDate) return 'date';
  return typeof value;
}

const LONE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/**
 * Finds a lone surrogate in a returned string, or in strings one level inside an array or object.
 * @param {unknown} value
 */
function findLone(value) {
  /** @type {[string, string, unknown][]} */
  const candidates = [['return value', '', value]];
  if (Array.isArray(value)) value.slice(0, 200).forEach((v, i) => candidates.push([`element ${i}`, `[${i}]`, v]));
  else if (value && typeof value === 'object' && !(value instanceof RealDate)) {
    for (const key of Object.keys(value).slice(0, 200)) {
      try {
        candidates.push([`property ${JSON.stringify(key)}`, `[${JSON.stringify(key)}]`, /** @type {any} */ (value)[key]]);
      } catch {
        // ignore throwing getters
      }
    }
  }
  for (const [where, accessor, v] of candidates) {
    if (typeof v !== 'string') continue;
    const match = LONE.exec(v);
    if (match) return { where, accessor, index: match.index, unit: v.charCodeAt(match.index) };
  }
  return undefined;
}

/**
 * @param {{ kind: 'return', value: unknown } | { kind: 'throw', error: unknown }} result
 * @param {boolean} read
 * @param {number} ms
 */
function describe(result, read, ms) {
  if (result.kind === 'return') {
    const value = result.value;
    return {
      kind: 'return',
      canon: canon(value),
      preview: preview(value),
      type: kindOf(value),
      nan: (typeof value === 'number' && Number.isNaN(value)) || (typeof value === 'string' && value.includes('NaN')),
      lone: findLone(value),
      string: typeof value === 'string' ? value.slice(0, 2000) : undefined,
      clockRead: read,
      ms,
    };
  }
  const error = /** @type {any} */ (result.error);
  const isError = error instanceof Error;
  const name = isError ? String(error.name) : 'thrown value';
  const message = asciiSafe(isError ? String(error.message) : preview(error));
  return {
    kind: 'throw',
    canon: `throw:${name}:${message}`,
    preview: `throws ${name}: ${message}`,
    error: { name, message, stack: isError ? String(error.stack ?? '').split('\n').slice(0, 8).join('\n') : '' },
    clockRead: read,
    ms,
  };
}

/**
 * @param {unknown} root
 * @param {readonly string[]} path
 */
function walkPath(root, path) {
  /** @type {any} */
  let current = root;
  /** @type {any} */
  let parent;
  for (const key of path) {
    if (current === null || current === undefined || (typeof current !== 'object' && typeof current !== 'function')) return undefined;
    parent = current;
    try {
      current = current[key];
    } catch {
      return undefined;
    }
  }
  return { fn: current, parent };
}

/** @type {Map<string, any>} */
const resolved = new Map();

/**
 * Finds the runtime function for a declaration path. Tries the module
 * namespace first, then the default export (CommonJS module.exports).
 * @param {readonly string[]} path
 */
function resolveFunction(path) {
  const key = path.join('\u0000');
  if (resolved.has(key)) return resolved.get(key);
  /** @type {[string, unknown, readonly string[]][]} */
  const attempts = [['named', ns, path]];
  if (ns && ns.default !== undefined && ns.default !== null) {
    attempts.push(['default', ns.default, path]);
    if (path[0] === 'default') attempts.push(['default', ns.default, path.slice(1)]);
  }
  let found = null;
  for (const [via, root, p] of attempts) {
    if (via === 'named' && p.length === 0) continue;
    const hit = walkPath(root, p);
    if (hit && typeof hit.fn === 'function') {
      const isClass = /^class[\s{]/.test(Function.prototype.toString.call(hit.fn));
      const thisArg = via === 'named' && p.length <= 1 ? undefined : hit.parent;
      found = { fn: hit.fn, thisArg, via, path: p, isClass };
      break;
    }
  }
  resolved.set(key, found);
  return found;
}

/**
 * @param {Function} fn
 * @param {unknown} thisArg
 * @param {unknown[]} args
 */
async function invoke(fn, thisArg, args) {
  clockRead = false;
  const start = performance.now();
  /** @type {{ kind: 'return', value: unknown } | { kind: 'throw', error: unknown }} */
  let result;
  try {
    let value = fn.apply(thisArg, args);
    if (value && typeof value === 'object' && typeof value.then === 'function') value = await value;
    result = { kind: 'return', value };
  } catch (error) {
    result = { kind: 'throw', error };
  }
  return { result, read: clockRead, ms: performance.now() - start };
}

/**
 * @param {unknown} value
 * @param {string} expected
 */
function matchesKind(value, expected) {
  const kind = kindOf(value);
  if (expected === 'object') return kind === 'object';
  return kind === expected;
}

/** @param {any} message */
async function handle(message) {
  const target = resolveFunction(message.path);
  if (!target || target.isClass) {
    send({ type: 'result', id: message.id, outcomes: [{ kind: 'missing', preview: target ? 'is a class at runtime' : 'not found at runtime' }] });
    return;
  }
  /** @type {unknown[]} */
  const args = message.args;
  const inputCanon = args.length ? canon(args[0]) : 'undefined';
  const outcomes = [];
  const repeat = Math.max(1, message.repeat ?? 1);
  /** @type {unknown} */
  let firstValue;
  let firstKind = '';
  for (let i = 0; i < repeat; i++) {
    const callArgs = i === repeat - 1 ? args : structuredClone(args);
    const { result, read, ms } = await invoke(target.fn, target.thisArg, callArgs);
    if (i === 0) {
      firstKind = result.kind;
      firstValue = result.kind === 'return' ? result.value : undefined;
    }
    outcomes.push(describe(result, read, ms));
  }
  if (message.then && firstKind === 'return') {
    const next = resolveFunction(message.then.path);
    if (!next || next.isClass) outcomes.push({ kind: 'missing', preview: 'not found at runtime' });
    else if (message.then.expect && !matchesKind(firstValue, message.then.expect)) outcomes.push({ kind: 'skip', preview: `intermediate value is ${kindOf(firstValue)}` });
    else {
      const { result, read, ms } = await invoke(next.fn, next.thisArg, [firstValue]);
      outcomes.push(describe(result, read, ms));
    }
  }
  send({ type: 'result', id: message.id, outcomes, via: target.via, path: target.path, inputCanon });
}

process.on('message', (message) => {
  handle(message).catch((error) => {
    send({ type: 'result', id: /** @type {any} */ (message).id, outcomes: [{ kind: 'crash', preview: `worker error: ${String(error)}` }] });
  });
});

try {
  ns = await import(pathToFileURL(entry).href);
  send({ type: 'ready' });
} catch (error) {
  send({ type: 'load-error', message: error instanceof Error ? String(error.stack ?? error.message) : String(error) });
  setTimeout(() => realExit(1), 50);
}
