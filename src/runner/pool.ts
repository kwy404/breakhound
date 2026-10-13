import { fork, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Result of one invocation inside a worker. */
export type Outcome =
  | {
      readonly kind: 'return';
      readonly canon: string;
      readonly preview: string;
      readonly type: string;
      readonly nan: boolean;
      readonly lone?: { readonly where: string; readonly accessor: string; readonly index: number; readonly unit: number };
      readonly string?: string;
      readonly clockRead: boolean;
      readonly ms: number;
    }
  | {
      readonly kind: 'throw';
      readonly canon: string;
      readonly preview: string;
      readonly error: { readonly name: string; readonly message: string; readonly stack: string };
      readonly clockRead: boolean;
      readonly ms: number;
    }
  | { readonly kind: 'timeout'; readonly preview: string }
  | { readonly kind: 'crash'; readonly preview: string }
  | { readonly kind: 'missing'; readonly preview: string }
  | { readonly kind: 'skip'; readonly preview: string }
  | { readonly kind: 'budget'; readonly preview: string };

export interface CallRequest {
  readonly path: readonly string[];
  readonly args: readonly unknown[];
  /** Run the same call this many times in a row (fresh copies of the arguments). */
  readonly repeat?: number;
  /** Then call another function with the first result as its only argument. */
  readonly then?: { readonly path: readonly string[]; readonly expect?: string };
}

export interface CallResult {
  readonly outcomes: readonly Outcome[];
  /** How the function was found: `named` export or `default` export (module.exports). */
  readonly via?: 'named' | 'default';
  /** Effective path from the root named by `via`. */
  readonly path?: readonly string[];
  /** Canonical text of the first argument, computed in the worker before the call. */
  readonly inputCanon?: string;
}

export class LoadError extends Error {
  override name = 'LoadError';
}

/** Locates the worker script next to the built bundle, or next to this file in the source tree. */
export function workerPath(): string {
  const here = new URL('.', import.meta.url);
  for (const candidate of ['./worker.mjs', './runner/worker.mjs', '../dist/worker.mjs']) {
    const path = fileURLToPath(new URL(candidate, here));
    if (existsSync(path)) return path;
  }
  throw new Error('breakhound worker script not found');
}

export interface WorkerOptions {
  readonly entry: string;
  readonly tz: string;
  /** Epoch milliseconds the worker clock is frozen at. */
  readonly now: number;
  readonly cwd: string;
  readonly loadTimeout?: number;
}

interface Pending {
  readonly resolve: (result: CallResult) => void;
  readonly timer: NodeJS.Timeout;
}

/** One child process with the package loaded, executing one call at a time. */
export class Worker {
  private child: ChildProcess | undefined;
  private ready: Promise<void> | undefined;
  private pending: Pending | undefined;
  private nextId = 1;
  busy = false;

  constructor(private readonly options: WorkerOptions) {}

  start(): Promise<void> {
    if (this.ready) return this.ready;
    const child = fork(workerPath(), [this.options.entry, String(this.options.now)], {
      cwd: this.options.cwd,
      env: { ...process.env, TZ: this.options.tz, NODE_OPTIONS: '' },
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      serialization: 'advanced',
      execArgv: ['--max-old-space-size=1024'],
    });
    this.child = child;
    this.ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new LoadError(`loading ${this.options.entry} took longer than ${this.options.loadTimeout ?? 20000} ms`));
        this.kill();
      }, this.options.loadTimeout ?? 20000);
      child.on('message', (message: { type: string; id?: number; message?: string } & CallResult) => {
        if (message.type === 'ready') {
          clearTimeout(timer);
          resolve();
        } else if (message.type === 'load-error') {
          clearTimeout(timer);
          reject(new LoadError(`could not load ${this.options.entry}:\n${message.message ?? ''}`));
        } else if (message.type === 'result' && this.pending) {
          const pending = this.pending;
          this.pending = undefined;
          clearTimeout(pending.timer);
          pending.resolve({
            outcomes: message.outcomes,
            ...(message.via ? { via: message.via } : {}),
            ...(message.path ? { path: message.path } : {}),
            ...(message.inputCanon !== undefined ? { inputCanon: message.inputCanon } : {}),
          });
        }
      });
      child.on('exit', (code, signal) => {
        clearTimeout(timer);
        reject(new LoadError(`worker exited while loading (code ${code}, signal ${signal})`));
        if (this.child !== child) return;
        this.child = undefined;
        this.ready = undefined;
        if (this.pending) {
          const pending = this.pending;
          this.pending = undefined;
          clearTimeout(pending.timer);
          pending.resolve({ outcomes: [{ kind: 'crash', preview: `the process exited (code ${code}, signal ${signal})` }] });
        }
      });
      child.on('error', () => {});
    });
    // Avoid unhandled rejection noise when nobody awaits a failed start.
    this.ready.catch(() => {});
    return this.ready;
  }

  /** Executes a call. Resolves with a `timeout` outcome (and kills the process) when it takes too long. */
  async call(request: CallRequest, timeoutMs: number): Promise<CallResult> {
    await this.start();
    const child = this.child;
    if (!child) return { outcomes: [{ kind: 'crash', preview: 'worker is not running' }] };
    const repeat = Math.max(1, request.repeat ?? 1) + (request.then ? 1 : 0);
    const limit = timeoutMs * repeat;
    return new Promise<CallResult>((resolve) => {
      const timer = setTimeout(() => {
        this.pending = undefined;
        this.kill();
        resolve({ outcomes: [{ kind: 'timeout', preview: `did not finish within ${timeoutMs} ms` }] });
      }, limit);
      this.pending = { resolve, timer };
      try {
        child.send({ type: 'call', id: this.nextId++, ...request });
      } catch (error) {
        clearTimeout(timer);
        this.pending = undefined;
        resolve({ outcomes: [{ kind: 'crash', preview: `could not send the call: ${String(error)}` }] });
      }
    });
  }

  kill(): void {
    const child = this.child;
    this.child = undefined;
    this.ready = undefined;
    if (child && child.exitCode === null) child.kill('SIGKILL');
  }
}

export interface PoolOptions {
  readonly entry: string;
  readonly now: number;
  readonly timeout: number;
  /** Workers per time zone. Zones not listed get one worker. */
  readonly sizes?: Readonly<Record<string, number>>;
}

/** Worker processes grouped by time zone, with a shared call counter. */
export class Pool {
  private readonly workers = new Map<string, Worker[]>();
  private readonly waiting = new Map<string, ((w: Worker) => void)[]>();
  readonly cwd: string;
  calls = 0;

  constructor(private readonly options: PoolOptions) {
    this.cwd = mkdtempSync(join(tmpdir(), 'breakhound-run-'));
  }

  private group(tz: string): Worker[] {
    let list = this.workers.get(tz);
    if (!list) {
      const size = Math.max(1, this.options.sizes?.[tz] ?? 1);
      list = Array.from({ length: size }, () => new Worker({ entry: this.options.entry, tz, now: this.options.now, cwd: this.cwd }));
      this.workers.set(tz, list);
    }
    return list;
  }

  private acquire(tz: string): Promise<Worker> {
    const free = this.group(tz).find((w) => !w.busy);
    if (free) {
      free.busy = true;
      return Promise.resolve(free);
    }
    return new Promise((resolve) => {
      const queue = this.waiting.get(tz) ?? [];
      queue.push(resolve);
      this.waiting.set(tz, queue);
    });
  }

  private release(tz: string, worker: Worker): void {
    const next = this.waiting.get(tz)?.shift();
    if (next) next(worker);
    else worker.busy = false;
  }

  /** Starts one worker in the zone and fails if the package cannot be loaded. */
  async check(tz: string): Promise<void> {
    const worker = await this.acquire(tz);
    try {
      await worker.start();
    } finally {
      this.release(tz, worker);
    }
  }

  async run(request: CallRequest, tz: string): Promise<CallResult> {
    this.calls += Math.max(1, request.repeat ?? 1) + (request.then ? 1 : 0);
    const worker = await this.acquire(tz);
    try {
      return await worker.call(request, this.options.timeout);
    } catch (error) {
      return { outcomes: [{ kind: 'crash', preview: String(error instanceof Error ? error.message : error) }] };
    } finally {
      this.release(tz, worker);
    }
  }

  close(): void {
    for (const list of this.workers.values()) for (const worker of list) worker.kill();
    this.workers.clear();
    try {
      rmSync(this.cwd, { recursive: true, force: true, maxRetries: 3 });
    } catch {
      // A library may still hold a file open on Windows; the OS temp cleaner will remove it.
    }
  }
}
