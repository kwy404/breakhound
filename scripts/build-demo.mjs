// Captures real breakhound output from the buggy fixture for the docs site.
// Runs the built CLI (dist/cli.js) against test/fixtures/buggy-lib and writes
// the results to site/data/, which scripts/build-docs.mjs turns into pages:
//   run-80.ansi, run-46.ansi   rich terminal output at 80 and 46 columns
//   progress.json              the live progress line, frame by frame
//   report.json                the --json report
//   github.json                GitHub Actions annotations and job summary
//   help.txt, version.txt      --help and --version
// Usage: npm run build && npm run demo
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const cli = join(root, 'dist', 'cli.js');
const fixture = join(root, 'test', 'fixtures', 'buggy-lib');
const out = join(root, 'site', 'data');
mkdirSync(out, { recursive: true });

// A tiny wrapper that makes stdout and stderr look like a terminal of a given
// width, then loads the CLI, so the rich view and the progress line render.
const work = mkdtempSync(join(tmpdir(), 'breakhound-demo-'));
const wrapper = join(work, 'tty.mjs');
writeFileSync(
  wrapper,
  `import { writeFileSync } from 'node:fs';
const cols = Number(process.env.DEMO_COLUMNS || 80);
const start = Date.now();
const frames = [];
for (const s of [process.stdout, process.stderr]) { s.isTTY = true; s.columns = cols; }
const write = process.stderr.write.bind(process.stderr);
process.stderr.write = (chunk, ...rest) => { frames.push([Date.now() - start, String(chunk)]); return write(chunk, ...rest); };
process.on('exit', () => { if (process.env.DEMO_FRAMES) writeFileSync(process.env.DEMO_FRAMES, JSON.stringify(frames)); });
await import(${JSON.stringify(pathToFileURL(cli).href)});
`,
);

function run(args, env = {}) {
  const res = spawnSync(process.execPath, args, {
    cwd: work,
    env: { ...process.env, NO_COLOR: '', FORCE_COLOR: '', GITHUB_ACTIONS: '', ...env },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.error) throw res.error;
  return res;
}


// Rich output at two widths: desktop and phone.
for (const cols of [80, 46]) {
  const framesFile = join(work, `frames-${cols}.json`);
  const res = run([wrapper, fixture], { DEMO_COLUMNS: String(cols), DEMO_FRAMES: framesFile });
  // The saved path is absolute (a temp folder here), so show it relative, as a
  // run from the project folder would print it.
  const text = res.stdout.replace(/\u001b\[2mSaved report to[\s\S]*$/, '\u001b[2mSaved report to .breakhound/report.json\u001b[0m\n');
  writeFileSync(join(out, `run-${cols}.ansi`), text);
  if (cols === 80) {
    const frames = JSON.parse(readFileSync(framesFile, 'utf8'))
      .map(([t, text]) => [t, text.replace(/\r|\u001b\[2K/g, '')])
      .filter(([, text]) => text.trim());
    // Keep at most one frame per 60 ms so the file stays small.
    const kept = [];
    for (const f of frames) if (!kept.length || f[0] - kept[kept.length - 1][0] >= 60) kept.push(f);
    writeFileSync(join(out, 'progress.json'), `${JSON.stringify(kept)}\n`);
  }
  console.log(`captured ${cols} columns`);
}

// JSON report.
const json = run([cli, fixture, '--json', '--no-save']);
writeFileSync(join(out, 'report.json'), json.stdout);
console.log('captured report.json');

// GitHub Actions: annotations on stdout, markdown summary in a file.
const summary = join(work, 'summary.md');
writeFileSync(summary, '');
const gh = run([cli, fixture, '--plain', '--no-save', '--fail-on', 'high'], { GITHUB_ACTIONS: 'true', GITHUB_STEP_SUMMARY: summary });
writeFileSync(
  join(out, 'github.json'),
  `${JSON.stringify(
    {
      exitCode: gh.status,
      annotations: gh.stdout.split('\n').filter((l) => l.startsWith('::')),
      summary: readFileSync(summary, 'utf8'),
    },
    null,
    2,
  )}\n`,
);
console.log('captured github.json');

writeFileSync(join(out, 'help.txt'), run([cli, '--help']).stdout);
writeFileSync(join(out, 'version.txt'), run([cli, '--version']).stdout);
console.log('captured help.txt and version.txt');

rmSync(work, { recursive: true, force: true });
