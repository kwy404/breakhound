import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';

export interface ResolvedTarget {
  readonly spec: string;
  readonly name: string;
  readonly version: string;
  readonly source: 'local' | 'npm';
  /** Package root directory. */
  readonly dir: string;
  /** Absolute path of the runtime entry file. */
  readonly entry: string;
  /** Absolute path of the declaration file. */
  readonly types: string;
  /** Removes temporary files created for an npm install. */
  cleanup(): void;
}

export class TargetError extends Error {
  override name = 'TargetError';
}

interface PackageJson {
  name?: string;
  version?: string;
  main?: string;
  types?: string;
  typings?: string;
  exports?: unknown;
}

const NPM_SPEC = /^(@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*(@[a-z0-9._~^<>=*|+ -]+)?$/i;

/** True when the spec looks like an npm package name, optionally with a version or range. */
export function isNpmSpec(spec: string): boolean {
  return NPM_SPEC.test(spec) && !spec.includes('..') && !/[\\/]$/.test(spec);
}

/** Splits `name@range` into its parts, keeping the leading `@` of scoped names. */
export function splitSpec(spec: string): { name: string; range?: string } {
  const at = spec.indexOf('@', 1);
  if (at === -1) return { name: spec };
  return { name: spec.slice(0, at), range: spec.slice(at + 1) };
}

/** `@scope/name` becomes `@types/scope__name`. */
export function typesPackageName(name: string): string {
  return `@types/${name.startsWith('@') ? name.slice(1).replace('/', '__') : name}`;
}

function readJson(path: string): PackageJson {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as PackageJson;
  } catch {
    throw new TargetError(`could not read ${path}`);
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function withExtensions(base: string, extensions: readonly string[]): string | undefined {
  if (isFile(base)) return base;
  for (const ext of extensions) if (isFile(base + ext)) return base + ext;
  for (const ext of extensions) if (isFile(join(base, `index${ext}`))) return join(base, `index${ext}`);
  return undefined;
}

/**
 * Picks a target from a package.json `exports` value for the root entry,
 * following the given conditions in order.
 */
export function pickExport(exports: unknown, conditions: readonly string[]): string | undefined {
  if (typeof exports === 'string') return exports;
  if (Array.isArray(exports)) {
    for (const item of exports) {
      const found = pickExport(item, conditions);
      if (found) return found;
    }
    return undefined;
  }
  if (!exports || typeof exports !== 'object') return undefined;
  const record = exports as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.some((k) => k.startsWith('.'))) return '.' in record ? pickExport(record['.'], conditions) : undefined;
  for (const condition of conditions) {
    if (condition in record) {
      const found = pickExport(record[condition], conditions);
      if (found) return found;
    }
  }
  return undefined;
}

const RUNTIME_CONDITIONS = ['node', 'import', 'module-sync', 'default', 'require'];
const TYPES_CONDITIONS = ['types', 'import', 'node', 'module-sync', 'default', 'require'];

function findEntry(dir: string, pkg: PackageJson): string | undefined {
  const fromExports = pickExport(pkg.exports, RUNTIME_CONDITIONS);
  if (fromExports && !/\.d\.[cm]?ts$/.test(fromExports)) {
    const file = withExtensions(resolve(dir, fromExports), ['.js', '.cjs', '.mjs']);
    if (file) return file;
  }
  if (pkg.main) {
    const file = withExtensions(resolve(dir, pkg.main), ['.js', '.cjs', '.mjs', '.json']);
    if (file) return file;
  }
  return withExtensions(join(dir, 'index'), ['.js', '.cjs', '.mjs']);
}

function typesNextTo(file: string): string | undefined {
  const base = file.replace(/\.(c|m)?js$/, '');
  for (const ext of ['.d.ts', '.d.mts', '.d.cts']) if (isFile(base + ext)) return base + ext;
  return undefined;
}

function findTypes(dir: string, pkg: PackageJson, entry: string | undefined): string | undefined {
  const fromExports = pickExport(pkg.exports, TYPES_CONDITIONS);
  if (fromExports && /\.d\.[cm]?ts$/.test(fromExports) && isFile(resolve(dir, fromExports))) return resolve(dir, fromExports);
  const field = pkg.types ?? pkg.typings;
  if (field) {
    const file = withExtensions(resolve(dir, field), ['.d.ts']);
    if (file) return file;
  }
  if (entry) {
    const next = typesNextTo(entry);
    if (next) return next;
  }
  return withExtensions(join(dir, 'index'), ['.d.ts']);
}

function npmCommand(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function npmInstall(dir: string, specs: readonly string[]): { ok: boolean; output: string } {
  for (const spec of specs) {
    if (!isNpmSpec(spec)) throw new TargetError(`not a valid npm package name: ${spec}`);
  }
  const args = ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', '--omit=dev', '--loglevel=error', ...specs];
  const result = spawnSync(npmCommand(), args, {
    cwd: dir,
    encoding: 'utf8',
    // npm.cmd needs a shell on Windows; specs are validated above.
    shell: process.platform === 'win32',
    env: { ...process.env, npm_config_ignore_scripts: 'true' },
  });
  return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() };
}

function fromDirectory(spec: string, dir: string, source: 'local' | 'npm', cleanup: () => void, typesDir?: string): ResolvedTarget {
  const pkgPath = join(dir, 'package.json');
  const pkg: PackageJson = existsSync(pkgPath) ? readJson(pkgPath) : {};
  const entry = findEntry(dir, pkg);
  if (!entry) throw new TargetError(`could not find the runtime entry (exports, main or index.js) in ${dir}`);
  let types = findTypes(dir, pkg, entry);
  if (!types && typesDir) {
    const typesPkgPath = join(typesDir, 'package.json');
    const typesPkg: PackageJson = existsSync(typesPkgPath) ? readJson(typesPkgPath) : {};
    types = findTypes(typesDir, typesPkg, undefined);
  }
  if (!types) {
    throw new TargetError(
      `no TypeScript declarations found for ${pkg.name ?? spec}. breakhound reads parameter types from .d.ts files (types, typings, exports or @types).`,
    );
  }
  return {
    spec,
    name: pkg.name ?? spec,
    version: pkg.version ?? '0.0.0',
    source,
    dir,
    entry,
    types,
    cleanup,
  };
}

function looksLikePath(spec: string): boolean {
  return spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('~') || isAbsolute(spec) || /^[A-Za-z]:/.test(spec) || existsSync(spec);
}

/**
 * Resolves a local path or an npm package name to an installed package with
 * a runtime entry and a declaration file. npm packages are installed with
 * `--ignore-scripts` into a new temporary directory.
 */
export function resolveTarget(spec: string, options: { installDir?: string; keep?: boolean; onProgress?: (m: string) => void } = {}): ResolvedTarget {
  if (looksLikePath(spec)) {
    const path = resolve(spec);
    if (!existsSync(path)) throw new TargetError(`path not found: ${spec}`);
    if (isFile(path)) {
      const types = typesNextTo(path);
      if (!types) throw new TargetError(`no declaration file next to ${spec} (expected ${path.replace(/\.(c|m)?js$/, '')}.d.ts)`);
      return { spec, name: path.replace(/^.*[\\/]/, '').replace(/\.(c|m)?js$/, ''), version: '0.0.0', source: 'local', dir: dirname(path), entry: path, types, cleanup() {} };
    }
    return fromDirectory(spec, path, 'local', () => {});
  }
  if (!isNpmSpec(spec)) throw new TargetError(`not a path and not a valid npm package name: ${spec}`);
  const { name } = splitSpec(spec);
  const root = options.installDir ? resolve(options.installDir) : mkdtempSync(join(tmpdir(), 'breakhound-'));
  mkdirSync(root, { recursive: true });
  const cleanup = () => {
    if (options.keep || options.installDir) return;
    rmSync(root, { recursive: true, force: true, maxRetries: 3 });
  };
  try {
    writeFileSync(join(root, 'package.json'), `${JSON.stringify({ name: 'breakhound-sandbox', private: true }, null, 2)}\n`);
    options.onProgress?.(`installing ${spec} with --ignore-scripts`);
    const installed = npmInstall(root, [spec]);
    if (!installed.ok) throw new TargetError(`npm install ${spec} failed:\n${installed.output}`);
    const dir = join(root, 'node_modules', name);
    const pkg = readJson(join(dir, 'package.json'));
    const entry = findEntry(dir, pkg);
    let typesDir: string | undefined;
    if (!findTypes(dir, pkg, entry)) {
      const typesName = typesPackageName(name);
      options.onProgress?.(`no bundled types, trying ${typesName}`);
      if (npmInstall(root, [typesName]).ok) typesDir = join(root, 'node_modules', typesName);
    }
    return fromDirectory(spec, dir, 'npm', cleanup, typesDir);
  } catch (error) {
    cleanup();
    throw error;
  }
}
