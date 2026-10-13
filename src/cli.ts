#!/usr/bin/env node
import { runCli } from './run-cli';

runCli(process.argv.slice(2), { stdout: process.stdout, stderr: process.stderr, env: process.env, cwd: process.cwd() }).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(`breakhound: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  },
);
