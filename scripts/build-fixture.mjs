// Compiles test/fixtures/buggy-lib/src/index.ts to dist/index.js and dist/index.d.ts.
// The output is committed so `npx breakhound ./test/fixtures/buggy-lib` works after a clone.
// Usage: npm run fixture
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const dir = fileURLToPath(new URL('../test/fixtures/buggy-lib/', import.meta.url));
const program = ts.createProgram([`${dir}src/index.ts`], {
  target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.ESNext,
  declaration: true,
  outDir: `${dir}dist`,
  rootDir: `${dir}src`,
  strict: true,
  newLine: ts.NewLineKind.LineFeed,
  removeComments: false,
  skipLibCheck: true,
  types: [],
});
const result = program.emit();
const errors = ts.getPreEmitDiagnostics(program).concat(result.diagnostics);
if (errors.length) {
  console.error(ts.formatDiagnostics(errors, { getCanonicalFileName: (f) => f, getCurrentDirectory: () => dir, getNewLine: () => '\n' }));
  process.exit(1);
}
console.log('built test/fixtures/buggy-lib/dist');
