<div align="center">

<img src="https://cdn.jsdelivr.net/gh/kwy404/breakhound@main/assets/mascot.svg" alt="Sniff, the breakhound bloodhound detective with a magnifying glass" width="160">

# breakhound

**Point it at any JavaScript package. It sniffs out the bugs.**

[![npm version](https://img.shields.io/npm/v/breakhound.svg)](https://www.npmjs.com/package/breakhound)
[![CI](https://github.com/kwy404/breakhound/actions/workflows/ci.yml/badge.svg)](https://github.com/kwy404/breakhound/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/kwy404/breakhound/blob/main/LICENSE)

English | [Português (Brasil)](https://github.com/kwy404/breakhound/blob/main/i18n/README.pt-BR.md)

[Website and live demo](https://kwy404.github.io/breakhound/) · [Guides](https://kwy404.github.io/breakhound/guides.html) · [npm](https://www.npmjs.com/package/breakhound)

</div>

breakhound reads the TypeScript declarations of a library, feeds every exported function edge case inputs (time zones, dates before 1970, emoji, `-0`, `NaN` and more), runs each call in a child process with a timeout and checks a few rules that real libraries break all the time. Every finding comes with a minimal reproduction and a ready to paste Vitest test.

## Quick start

```bash
npx breakhound date-fns          # a package from npm
npx breakhound ./path/to/my-lib  # a local folder
npx breakhound                   # the package in the current folder
```

Useful options:

```bash
npx breakhound my-lib --fail-on high            # exit with code 1 on high findings
npx breakhound my-lib --json --output report.json
npx breakhound my-lib --only 'format*' --rules nan-leak,roundtrip
```

Run `npx breakhound --help` for every option. A typo such as `--jsn` gets a "did you mean" hint.

## Compare two versions

Save a report, then pass it as the baseline of a later run. breakhound lists the findings that are new and the ones that were fixed, and `--fail-on` counts only the new ones.

```bash
npx breakhound my-lib@1 --json --output v1.json
npx breakhound my-lib@2 --baseline v1.json --fail-on high
```

`--baseline last` compares with the previous run saved in `.breakhound/report.json`. The [website](https://kwy404.github.io/breakhound/#try) also has a small in-browser demo: paste two versions of one function and see every input where the answers differ.

## What it checks

| Rule | What breaks |
| --- | --- |
| `lone-surrogate-output` | An emoji or astral character is cut in half |
| `timezone-dependent` | The same input gives a different result when `TZ` changes |
| `unexpected-crash` | A value the types allow throws a `TypeError` |
| `nan-leak` | `NaN` comes out of finite input |
| `roundtrip` | `decode(encode(x))` is not `x` |
| `not-idempotent` | `normalize(normalize(x))` differs from `normalize(x)` |
| `negative-zero-sign` | `-0.5` is printed without its minus sign |
| `nondeterministic` | The same call returns different results |

Inputs come from [edgegoat](https://kwy404.github.io/edgegoat/), a catalog of edge cases for JavaScript. breakhound needs TypeScript declarations (bundled `.d.ts` files or `@types`); without them it stops with a clear message.

Each finding includes a test like this one:

```ts
import { expect, test } from 'vitest';
import { formatFixed } from 'buggy-lib';

test("formatFixed keeps the sign of -0.5", () => {
  expect(formatFixed(-0.5)).not.toBe(formatFixed(0.5));
});
```

## Use it in CI

```yaml
- run: npm ci --ignore-scripts
- run: npx breakhound . --fail-on high
```

Inside GitHub Actions, breakhound also writes annotations and a job summary. See the [GitHub Actions guide](https://kwy404.github.io/breakhound/automated-testing-in-github-actions.html).

## Safety

breakhound **executes the code it scans**. Run it on code you trust, or inside a container. npm installs use `--ignore-scripts`, and every call runs in a child process with a timeout. That isolation keeps a hang or a crash from stopping the run; it is not a security sandbox.

## Where the rules come from

Each rule comes from a bug that Alexandre Kohler fixed in open source, for example [github/relative-time-element#384](https://github.com/github/relative-time-element/pull/384) (time zone), [google/budoux#1411](https://github.com/google/budoux/pull/1411) (split surrogate pairs) and [mozilla/pdf.js#22017](https://github.com/mozilla/pdf.js/pull/22017) (lost minus sign).

## More from kwy404

- [graphemely](https://kwy404.github.io/graphemely/): grapheme aware string utilities.
- [edgegoat](https://kwy404.github.io/edgegoat/): edge case inputs for JavaScript testing.
- [vueleap](https://kwy404.github.io/vueleap/): migrate Vue 2 to Vue 3 with one command.
- [numberparrot](https://kwy404.github.io/numberparrot/): parse localized number and currency strings.
- [Voodoo.js](https://kwy404.github.io/Voodoo.js/): tiny reactive attributes for plain HTML.
- [Monsoon](https://kwy404.github.io/monsoon/): utility-first CSS with no build step.
- [cookieowl](https://kwy404.github.io/cookieowl/): cookie consent banner for LGPD and GDPR that blocks trackers until consent.
- [installkite](https://kwy404.github.io/installkite/): make a website installable and offline capable.
- [a11ymedic](https://kwy404.github.io/a11ymedic/): an accessibility checker that explains each problem and its fix.
- [fontsketch](https://kwy404.github.io/fontsketch/): turn your handwriting into a font in the browser.
- [kastor](https://kwy404.github.io/kastor/): a TypeScript ORM for many databases.

## Author

Made by Alexandre Kohler ([GitHub](https://github.com/kwy404), [LinkedIn](https://www.linkedin.com/in/alexandre-silva-173687256/)).

The [website](https://kwy404.github.io/breakhound/) is built with [Monsoon](https://kwy404.github.io/monsoon/), and its interactive parts are built with [Voodoo.js](https://kwy404.github.io/Voodoo.js/).

## License

[MIT](https://github.com/kwy404/breakhound/blob/main/LICENSE). Copyright (c) Alexandre Kohler
