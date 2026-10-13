# Contributing to breakhound

Thanks for your interest. Pull requests are welcome, from typo fixes to new
oracles.

## Setup

You need Node.js 18.18 or newer.

```sh
npm ci
npm test
```

Before opening a pull request, also run:

```sh
npm run build
npm run typecheck
npm run lint
```

## Adding an oracle

An oracle is a check that looks at how a function behaved and decides whether
that behavior is a bug.

1. Add a function in `src/oracles` that receives the observed calls and returns
   findings. Give it a unique rule id (for example `nan-leak`) and a severity.
2. Add a fixture in `test/fixtures/buggy-lib` with two exports:
   - a buggy function that the oracle must flag;
   - a correct twin that does the same job without the bug. The twin must
     produce no findings, which keeps false positives out.
3. Add tests that assert the buggy function is reported with your rule id and
   the twin is not reported at all.
4. Document the rule in the README.

## Commit style

- Small, focused commits with a short imperative subject, for example
  `Add negative zero oracle` or `Fix timeout handling in runner`.
- Keep the subject under 72 characters. Use the body to explain why.
- One logical change per pull request.

## Pull requests

Open an issue first for large changes so we can agree on the approach. For
small fixes, just send the pull request. Make sure CI passes.

By contributing, you agree that your contributions are licensed under the MIT
License.
