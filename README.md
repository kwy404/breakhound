<div align="center">

<img src="https://cdn.jsdelivr.net/gh/kwy404/breakhound@main/assets/mascot.svg" alt="Sniff, the breakhound bloodhound detective with a magnifying glass" width="160">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/breakhound@main/assets/banner-dark.svg">
  <img src="https://cdn.jsdelivr.net/gh/kwy404/breakhound@main/assets/banner.svg" alt="breakhound banner: point it at any JavaScript package, it sniffs out the bugs" width="100%">
</picture>

# breakhound: find bugs in any JavaScript library automatically, no tests required

**Point it at any JavaScript package. It sniffs out the bugs.**

[![npm version](https://img.shields.io/npm/v/breakhound.svg)](https://www.npmjs.com/package/breakhound)
[![npm downloads](https://img.shields.io/npm/dm/breakhound.svg)](https://www.npmjs.com/package/breakhound)
[![CI](https://github.com/kwy404/breakhound/actions/workflows/ci.yml/badge.svg)](https://github.com/kwy404/breakhound/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/kwy404/breakhound/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178C6.svg)](https://www.typescriptlang.org/)

English | [Português (Brasil)](https://github.com/kwy404/breakhound/blob/main/i18n/README.pt-BR.md)

[Website](https://kwy404.github.io/breakhound/) · [Guides](https://kwy404.github.io/breakhound/find-bugs-automatically-javascript.html) · [npm](https://www.npmjs.com/package/breakhound)

</div>

breakhound is a zero config bug finder for JavaScript and TypeScript libraries. It reads the package's TypeScript types, generates nasty inputs for every parameter (time zones, DST transitions, emoji and unicode, `-0`, `NaN`, dates before 1970), runs each call in an isolated child process with timeouts, and checks invariants that real libraries break all the time. Every finding ships with a minimal reproduction and a ready to paste Vitest test.

## Table of contents

- [Quick start](#quick-start)
- [What it checks](#what-it-checks)
- [Example output](#example-output)
- [Use it in CI](#use-it-in-ci)
- [Safety](#safety)
- [FAQ](#faq)
- [Comparison with fast-check and Jazzer.js](#comparison-with-fast-check-and-jazzerjs)
- [Born from 130 real bug fixes](#born-from-130-real-bug-fixes)
- [More from kwy404](#more-from-kwy404)
- [Author](#author)
- [License](#license)

## Quick start

No install, no config, no tests to write:

```bash
# any package from npm
npx breakhound date-fns

# a local project or library folder
npx breakhound ./path/to/your-lib
```

Machine readable output and CI gating:

```bash
npx breakhound my-lib --json > findings.json
npx breakhound my-lib --fail-on high
```

## What it checks

| Invariant | What breaks | Typical real world cause |
| --- | --- | --- |
| Lone surrogate in output | An emoji or astral character is split in half | `str.slice`, `substr` or `charAt` cutting UTF-16 code units |
| Host time zone dependence | Same input gives different output when `TZ` changes | Mixing `getUTC*` and local getters, formatting in the wrong zone |
| Crash on valid input | Unexpected `TypeError` for a value the types allow | Missing handling of empty strings, `-0`, old dates, unicode |
| NaN leak | `NaN` returned where a number was expected | Parsing or math on edge values without guards |
| Broken roundtrip | `decode(encode(x))` is not `x` | Lossy escaping, surrogate handling, precision loss |
| Normalize not idempotent | `normalize(normalize(x))` differs from `normalize(x)` | Order dependent replacements, partial trimming |
| Lost negative sign | `-0.5` formats as `0.5` | Sign taken from the integer part, `Math.trunc` of values above -1 |
| Nondeterminism | Same call, same input, different result | Hidden global state, `Date.now`, `Math.random` |

Inputs come from [edgegoat](https://kwy404.github.io/edgegoat/), a curated catalog of edge cases for JavaScript.

## Example output

> Example output, illustrative only. Real output depends on the package you scan.

```text
breakhound v0.1.0  scanning example-format@2.3.1

  Sniffing 14 exported functions, 1,820 calls, 4 time zones

  HIGH  formatRelative  output depends on host time zone
        input:  new Date("2024-12-31T23:30:00Z")
        TZ=UTC            "this year"
        TZ=Asia/Tokyo     "last year"

  HIGH  truncate        lone surrogate in output (emoji split)
        input:  ("hi \u{1F44B} there", 4)
        output: "hi \uD83D"

  MED   formatNumber    negative number lost its sign
        input:  -0.5
        output: "0.5"

  3 findings  (2 high, 1 medium)
  Vitest tests written to ./breakhound-tests/
```

Each finding also produces a test you can drop into your suite:

```ts
import { test, expect } from "vitest";
import { formatNumber } from "example-format";

test("formatNumber keeps the sign of values between -1 and 0", () => {
  expect(formatNumber(-0.5)).toBe("-0.5");
});
```

## Use it in CI

```yaml
# .github/workflows/breakhound.yml
name: breakhound
on: [push, pull_request]
jobs:
  sniff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci --ignore-scripts
      - run: npx breakhound . --fail-on high
```

`--fail-on` exits with a non zero code when a finding at or above the given severity is found. Combine it with `--json` to store the report as a build artifact.

## Safety

breakhound **executes the code it scans**. That is how it finds real bugs instead of guessing.

- Run it on code you trust, or inside a container or disposable VM.
- When breakhound installs a package from npm it uses `--ignore-scripts`, so install hooks do not run.
- Every call runs in an isolated child process with a timeout, so a hanging or crashing function cannot take down the scan. This is isolation for robustness, not a security sandbox.

## FAQ

### How do I find bugs automatically in a JavaScript library?

Run `npx breakhound <package or path>`. breakhound reads the TypeScript types to learn what each exported function accepts, feeds it edge case inputs, and reports calls that violate invariants such as roundtrips, idempotence, sign preservation or time zone independence. You do not need to write any test first.

### How is this different from property based testing?

Property based testing tools such as fast-check ask you to write the properties and generators yourself. breakhound ships the properties (a fixed set of invariants that hold for most libraries) and derives the generators from the type signatures, so it works on code you have never read. When it finds something, it hands you a regular Vitest test you can keep.

### Is it safe to run on any package?

It runs the package code, so treat it like running the package's own test suite. Installs use `--ignore-scripts` and calls run in child processes with timeouts, but you should still scan untrusted packages inside a container.

### Does it work with plain JavaScript without types?

It works best with TypeScript declarations (bundled `.d.ts` files or DefinitelyTyped). Without types it falls back to a smaller set of generic inputs.

### Will it report false positives?

Some invariants, such as time zone dependence, can be intentional for a given function. Every finding includes a minimal reproduction so you can judge it in seconds.

## Comparison with fast-check and Jazzer.js

breakhound complements these tools rather than replacing them.

| | breakhound | fast-check | Jazzer.js |
| --- | --- | --- | --- |
| Approach | Type driven invariant checks | Property based testing library | Coverage guided fuzzing |
| You write | Nothing | Properties and arbitraries | Fuzz targets |
| Input source | Types plus edgegoat edge cases | Your arbitraries, with shrinking | Mutation guided by coverage |
| Best at | Unicode, time zone, number formatting bugs in public APIs | Precise properties of your own code | Crashes and security issues in parsers |
| Output | Repro plus ready Vitest test | Failing counterexample | Crashing input |

A good workflow: run breakhound first for a free sweep, then encode the important properties with fast-check, and fuzz parsers with Jazzer.js.

## Born from 130 real bug fixes

breakhound is built by Alexandre Kohler ([kwy404](https://github.com/kwy404)), who has landed 130 merged bug fixes in projects at Google, Microsoft, GitHub, Vue and more. The invariants come straight from that work:

- [github/relative-time-element#384](https://github.com/github/relative-time-element/pull/384): the year check used UTC instead of the display time zone.
- [google/budoux#1411](https://github.com/google/budoux/pull/1411): surrogate pairs were split.
- [microsoft/vscode-js-debug#2423](https://github.com/microsoft/vscode-js-debug/pull/2423): surrogate pairs were split.
- [mozilla/pdf.js#22017](https://github.com/mozilla/pdf.js/pull/22017): negative numbers above -1 lost their sign.
- [vuejs/core#15618](https://github.com/vuejs/core/pull/15618)

Each of these would have been caught by one of the checks above.

## More from kwy404

- [graphemely](https://kwy404.github.io/graphemely/): grapheme aware string utilities.
- [edgegoat](https://kwy404.github.io/edgegoat/): edge case inputs for JavaScript testing.
- [vueleap](https://kwy404.github.io/vueleap/)
- [numberparrot](https://kwy404.github.io/numberparrot/)
- [Voodoo.js](https://kwy404.github.io/Voodoo.js/): tiny reactive attributes for plain HTML.
- [Monsoon](https://kwy404.github.io/monsoon/): utility-first CSS with no build step.

## Author

Made by Alexandre Kohler ([GitHub](https://github.com/kwy404), [LinkedIn](https://www.linkedin.com/in/alexandre-silva-173687256/)).

The [website](https://kwy404.github.io/breakhound/) is built with [Monsoon](https://kwy404.github.io/monsoon/), and its interactive parts are built with [Voodoo.js](https://kwy404.github.io/Voodoo.js/).

## License

[MIT](https://github.com/kwy404/breakhound/blob/main/LICENSE). Copyright (c) Alexandre Kohler
