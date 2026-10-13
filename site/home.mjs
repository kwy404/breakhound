// The landing page: a live terminal session, the eight oracles as case files,
// an evidence board, the procedure, a mock CI job summary, the comparison and
// the FAQ. Every number and finding comes from site/data, captured from a real
// run of breakhound on test/fixtures/buggy-lib (npm run demo).
import { icon, illustration } from './art.mjs';
import { GITHUB, SITE, esc } from './layout.mjs';

/** Human labels for each oracle, and the guide that covers it. */
export const ORACLES = [
  { rule: 'lone-surrogate-output', name: 'Split emoji', sum: 'A string result holds half of a surrogate pair, so an emoji is cut in two.', fn: 'truncate', guide: 'unicode-surrogate-pair-bugs', topic: 'unicode' },
  { rule: 'timezone-dependent', name: 'Time zone dependence', sum: 'The same call answers differently when only the host TZ changes.', fn: 'yearLabel', guide: 'timezone-bugs-javascript', topic: 'time' },
  { rule: 'unexpected-crash', name: 'Crash on valid input', sum: 'A value the types allow makes the engine throw a TypeError.', fn: 'initials', guide: 'fuzz-testing-typescript', topic: 'workflow' },
  { rule: 'nan-leak', name: 'NaN leak', sum: 'Finite numbers go in and NaN comes out where a number was expected.', fn: 'average', guide: 'find-bugs-automatically-javascript', topic: 'numbers' },
  { rule: 'roundtrip', name: 'Broken roundtrip', sum: 'A decode and encode pair does not give the input back.', fn: 'encodeBase', guide: 'roundtrip-testing-encode-decode', topic: 'invariants' },
  { rule: 'not-idempotent', name: 'Not idempotent', sum: 'Normalizing twice changes the result again.', fn: 'slugify', guide: 'property-based-testing-without-writing-tests', topic: 'invariants' },
  { rule: 'negative-zero-sign', name: 'Lost minus sign', sum: 'Values between -1 and 0 are printed as if they were positive.', fn: 'formatFixed', guide: 'negative-zero-javascript-bugs', topic: 'numbers' },
  { rule: 'nondeterministic', name: 'Nondeterminism', sum: 'Same call, same input, a different result from hidden state.', fn: 'label', guide: 'property-based-testing-without-writing-tests', topic: 'invariants' },
];

/** Merged pull requests by the author that each oracle comes from. */
export const PRECEDENTS = [
  { id: 'p1', repo: 'github/relative-time-element', pr: 384, note: 'The year check used UTC instead of the display time zone.', rule: 'timezone-dependent' },
  { id: 'p2', repo: 'google/budoux', pr: 1411, note: 'Surrogate pairs were split when breaking text into phrases.', rule: 'lone-surrogate-output' },
  { id: 'p3', repo: 'microsoft/vscode-js-debug', pr: 2423, note: 'Surrogate pairs were split in debugger output.', rule: 'lone-surrogate-output' },
  { id: 'p4', repo: 'mozilla/pdf.js', pr: 22017, note: 'Negative numbers above -1 lost their minus sign.', rule: 'negative-zero-sign' },
  { id: 'p5', repo: 'vuejs/core', pr: 15618, note: 'Components compiled from script setup crashed in the compat build.', rule: 'unexpected-crash' },
];

export const FAQ = [
  ['How do I find bugs automatically in a JavaScript library?', 'Run npx breakhound with a package name or a path. breakhound reads the TypeScript types to learn what each exported function accepts, feeds it edge case inputs, and reports calls that break invariants such as roundtrips, idempotence, sign preservation or time zone independence. You do not need to write any test first.'],
  ['How is this different from property based testing?', 'Tools such as fast-check ask you to write the properties and generators yourself. breakhound ships the properties, a fixed set of invariants that hold for most libraries, and derives the generators from the type signatures, so it works on code you have never read. When it finds something, it hands you a regular Vitest test you can keep.'],
  ['Is it safe to run on any package?', "breakhound executes the code it scans, so treat it like running the package's own test suite. Installs use --ignore-scripts and every call runs in a child process with a timeout, which is isolation for robustness, not a security sandbox. Scan untrusted packages inside a container or a disposable VM."],
  ['Does it work with plain JavaScript without types?', 'It works best with TypeScript declarations, either bundled .d.ts files or DefinitelyTyped. Without types it falls back to a smaller set of generic inputs.'],
  ['Will it report false positives?', 'Some invariants, such as time zone dependence, can be intentional for a given function. Every finding has a confidence level and a minimal reproduction so you can judge it in seconds, and --rules, --only and --exclude let you narrow the hunt.'],
  ['Are runs reproducible?', 'Yes. Inputs come from a seeded generator (seed 42 by default, change it with --seed), the call budget is fixed with --max-calls, and each run is saved to .breakhound/last-run.jsonl and .breakhound/report.json unless you pass --no-save.'],
];

export function homeJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'breakhound',
        url: SITE,
        description: 'Find bugs in any JavaScript or TypeScript library automatically, no tests required. Reads types, generates edge case inputs, checks invariants and writes Vitest tests.',
        applicationCategory: 'DeveloperApplication',
        applicationSubCategory: 'Testing tool',
        operatingSystem: 'Windows, macOS, Linux',
        softwareRequirements: 'Node.js',
        softwareVersion: '1.0.0',
        license: 'https://opensource.org/licenses/MIT',
        downloadUrl: 'https://www.npmjs.com/package/breakhound',
        codeRepository: GITHUB,
        image: `${SITE}og.png`,
        author: { '@type': 'Person', name: 'Alexandre Kohler', url: 'https://github.com/kwy404', sameAs: ['https://github.com/kwy404', 'https://www.linkedin.com/in/alexandre-silva-173687256/'] },
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
      { '@type': 'WebSite', name: 'breakhound', url: SITE },
      {
        '@type': 'FAQPage',
        mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
      },
    ],
  };
}

const n = (x) => Number(x).toLocaleString('en-US');

function sectionHead(kicker, id, title, lead, iconName) {
  return `<header class="sec-head">
  <p class="kicker">${icon(iconName)}${kicker}</p>
  <h2 id="${id}">${title}</h2>
  ${lead ? `<p class="sec-lead">${lead}</p>` : ''}
</header>`;
}

/** The hero with the interactive terminal. */
function hero(ctx) {
  const { report, version } = ctx;
  const s = report.stats;
  const total = report.findings.length;
  return `<section class="hero-band dark" aria-labelledby="hero-title">
  <div class="wrap">
    <div class="hero-head">
      <div>
        <p class="kicker">${icon('magnifier')}Zero config bug finder for JavaScript and TypeScript</p>
        <h1 id="hero-title">Find bugs in any JavaScript library <em>automatically</em></h1>
      </div>
      <div class="hero-side">
        <p class="lead">Point <strong>breakhound</strong> at an npm package or a local folder. It reads the TypeScript types, attacks every exported function with edge cases, checks eight oracles and files a minimal reproduction plus a ready Vitest test for every bug. No tests to write first.</p>
        <div class="hero-cta">
          <button type="button" class="btn btn-accent" data-term-run>${icon('play')}Run the demo</button>
          <a class="btn btn-outline" href="guides.html">${icon('folder')}Open the case index</a>
        </div>
      </div>
    </div>
    <div class="term-wrap" id="terminal">
      <img class="term-sniff" src="assets/mascot.svg" width="112" height="112" alt="Sniff, the breakhound bloodhound detective, peeking over the terminal">
      <div class="term" :class="'is-' + T.state" data-term>
        <div class="term-bar">
          <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="term-title">${icon('terminal')}<span>sniff@agency: ~/cases</span></span>
          <span class="term-rec" title="Output recorded from breakhound ${version} on test/fixtures/buggy-lib"><span class="rec-dot" aria-hidden="true"></span>recorded from v${version}</span>
          <span class="term-actions">
            <button type="button" class="term-btn" data-term-run :disabled="T.state === 'running'">${icon('play')}<span>Run</span></button>
            <button type="button" class="term-btn" data-term-skip v-show="T.state === 'running'">${icon('skip')}<span>Skip</span></button>
            <button type="button" class="term-btn" data-term-clear v-show="T.state !== 'running'">${icon('replay')}<span>Reset</span></button>
          </span>
        </div>
        <div class="term-body" data-term-body>
          <pre class="term-out" data-term-out aria-label="Terminal output"><code><span class="t-dim">Sniff's terminal: a real run of breakhound</span>
<span class="t-dim">${version} on test/fixtures/buggy-lib,</span>
<span class="t-dim">replayed line by line.</span>
<span class="t-dim">Type a command and press Enter, or press Run.</span>

<noscript><span class="t-dim">Scripts are off, so here is the summary of the recorded run:</span>
${report.findings.filter((f) => f.severity !== 'info').map((f) => `${f.severity.toUpperCase().padEnd(6)} ${f.rule.padEnd(22)} ${esc(f.function)}`).join('\n')}
</noscript></code></pre>
          <form class="term-prompt" data-term-form autocomplete="off">
            <label for="term-cmd" class="term-ps1"><span class="t-green">~/cases</span> <span class="t-dim">$</span></label>
            <input id="term-cmd" class="term-input" v-model="T.cmd" :disabled="T.state === 'running'" spellcheck="false" autocapitalize="off" placeholder="npx breakhound ./buggy-lib" aria-describedby="term-hint">
          </form>
        </div>
        <div class="term-hints" id="term-hint">
          <span class="t-dim">Try</span>
          <button type="button" class="term-chip" data-term-cmd="npx breakhound ./buggy-lib">npx breakhound ./buggy-lib</button>
          <button type="button" class="term-chip" data-term-cmd="npx breakhound --help">--help</button>
          <button type="button" class="term-chip" data-term-cmd="ls">ls</button>
          <button type="button" class="term-chip" data-term-cmd="clear">clear</button>
        </div>
        <div class="term-status" aria-hidden="true">
          <span>${icon('ci')}main</span><span>buggy-lib@1.0.0</span><span>seed 42</span><span class="term-status-end" v-text="T.state === 'running' ? T.phase : (T.state === 'done' ? '${total} findings' : 'ready')">ready</span>
        </div>
      </div>
      <p class="sr-only" aria-live="polite" v-text="T.announce"></p>
    </div>
    <dl class="ledger" aria-label="Numbers from the recorded run">
      <div><dt>functions analyzed</dt><dd>${s.analyzed}</dd></div>
      <div><dt>calls in isolated processes</dt><dd>${n(s.calls)}</dd></div>
      <div><dt>time zones per call</dt><dd>${report.options.zones.length}</dd></div>
      <div><dt>findings, each with a test</dt><dd>${total}</dd></div>
    </dl>
  </div>
</section>`;
}

function pickFinding(report, o) {
  return report.findings.find((f) => f.rule === o.rule && f.function === o.fn) || report.findings.find((f) => f.rule === o.rule);
}

/** The eight oracles as manila case files. */
function cases(ctx) {
  const cards = ORACLES.map((o, i) => {
    const f = pickFinding(ctx.report, o);
    const num = String(i + 1).padStart(2, '0');
    const evidence = f.evidence
      .slice(0, 3)
      .map((e) => `<li>${e.tz ? `<span class="tz">TZ=${esc(e.tz)}</span>` : ''}<code>${esc(e.call)}</code><span class="arrow" aria-hidden="true">${icon('arrow')}</span><code class="res">${esc(e.result)}</code></li>`)
      .join('');
    const test = ctx.frame(f.test.trimEnd(), { lang: 'ts', title: `${f.function}.test.ts`, kind: 'editor', numbered: true });
    return `<article class="case" id="case-${o.rule}" data-sev="${f.severity}" v-show="sev === 'all' || sev === '${f.severity}'">
  <div class="case-tab"><span class="case-no">Case ${num}</span><span class="case-rule">${o.rule}</span></div>
  <div class="case-sheet">
    <header class="case-head">
      <span class="case-ic">${icon(o.rule)}</span>
      <div class="min-w-0"><h3>${o.name}</h3><p>${o.sum}</p></div>
      <span class="stamp stamp-${f.severity}" aria-label="Severity ${f.severity}">${f.severity}</span>
    </header>
    <dl class="case-facts">
      <div><dt>Suspect</dt><dd><code>${esc(f.signature)}</code></dd></div>
      <div><dt>Evidence</dt><dd><span class="evtag">${icon('tag')}<code>${esc(f.input.join(', ') || '(no arguments)')}</code></span></dd></div>
      <div><dt>Findings</dt><dd><ul class="case-ev">${evidence}</ul></dd></div>
      <div><dt>Verdict</dt><dd>${esc(f.title)}. <span class="text-muted-foreground">Expected: ${esc(f.expected)}</span></dd></div>
    </dl>
    <details class="case-test">
      <summary>${icon('book')}Generated test <span class="text-muted-foreground">confidence ${f.confidence}</span></summary>
      ${test}
    </details>
    <a class="case-link" href="${o.guide}.html">Read the case notes ${icon('arrow')}</a>
  </div>
</article>`;
  }).join('\n');
  const counts = ctx.report.counts;
  return `<section class="sec" id="cases" aria-labelledby="cases-title" v-data="{ sev: 'all' }">
  <div class="wrap">
    ${sectionHead('Eight oracles', 'cases-title', 'Every oracle is an open case file', 'An oracle is an invariant that almost every library should keep. Each file below is a real finding from the recorded run: the suspect function, the evidence that broke it, the verdict and the Vitest test breakhound wrote.', 'folder')}
    <div class="case-filter" role="group" aria-label="Filter case files by severity">
      ${icon('filter')}
      <button type="button" class="chip-btn" :aria-pressed="sev === 'all' ? 'true' : 'false'" aria-pressed="true" @click="sev = 'all'">All files <span>8</span></button>
      <button type="button" class="chip-btn" :aria-pressed="sev === 'high' ? 'true' : 'false'" aria-pressed="false" @click="sev = 'high'">High <span>${ORACLES.filter((o) => pickFinding(ctx.report, o).severity === 'high').length}</span></button>
      <button type="button" class="chip-btn" :aria-pressed="sev === 'medium' ? 'true' : 'false'" aria-pressed="false" @click="sev = 'medium'">Medium <span>${ORACLES.filter((o) => pickFinding(ctx.report, o).severity === 'medium').length}</span></button>
      <span class="case-filter-note">${counts.high} high, ${counts.medium} medium, ${counts.info} info findings in the full report</span>
    </div>
    <div class="cases">
${cards}
    </div>
  </div>
</section>`;
}

/** The evidence board linking cases to the merged fixes they come from. */
function board() {
  // Positions on a 1200 by 660 board: x is the center, y the top, w the width.
  const pos = {
    'timezone-dependent': [140, 40], 'lone-surrogate-output': [400, 40], 'unexpected-crash': [800, 40], 'nan-leak': [1060, 40],
    roundtrip: [140, 500], 'not-idempotent': [400, 500], 'negative-zero-sign': [800, 500], nondeterministic: [1060, 500],
    p1: [150, 262, 200], p2: [600, 28, 186], p3: [378, 282, 196], p4: [600, 512, 186], p5: [1050, 262, 200], note: [828, 292, 170], sniff: [600, 196, 180],
  };
  const pin = (id) => [pos[id][0], pos[id][1] + 9];
  const links = [];
  for (const o of ORACLES) links.push({ a: o.rule, b: 'sniff', kind: 'thread' });
  for (const p of PRECEDENTS) links.push({ a: p.id, b: p.rule, kind: 'red' });
  links.push({ a: 'note', b: 'sniff', kind: 'thread' });
  const related = {};
  for (const l of links) {
    (related[l.a] ||= new Set([l.a])).add(l.b);
    (related[l.b] ||= new Set([l.b])).add(l.a);
  }
  const rel = Object.fromEntries(Object.entries(related).map(([k, v]) => [k, [...v]]));
  const place = (id, w = 180) => {
    const [x, y, ww] = pos[id];
    const width = ww || w;
    return `style="--x:${(((x - width / 2) / 1200) * 100).toFixed(3)}%;--y:${((y / 660) * 100).toFixed(3)}%;--w:${((width / 1200) * 100).toFixed(3)}%"`;
  };
  const hover = (id) => `@mouseenter="on = '${id}'" @mouseleave="on = ''" @focusin="on = '${id}'" @focusout="on = ''" :class="{ 'is-hot': on === '${id}', 'is-dim': on && !linked(on, '${id}') }"`;
  const strings = links
    .map((l) => {
      const [x1, y1] = pin(l.a);
      const [x2, y2] = pin(l.b);
      const sag = l.kind === 'red' ? 26 : 16;
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2 + sag;
      return `<path class="str str-${l.kind}" d="M${x1} ${y1}Q${mx} ${my} ${x2} ${y2}" :class="{ 'is-hot': on === '${l.a}' || on === '${l.b}' }"/>`;
    })
    .join('');
  const caseCards = ORACLES.map(
    (o, i) => `<a href="#case-${o.rule}" class="bd bd-case" ${place(o.rule)} ${hover(o.rule)}><span class="bd-pin" aria-hidden="true"></span><span class="bd-no">Case ${String(i + 1).padStart(2, '0')}</span><span class="bd-ic">${icon(o.rule)}</span><strong>${o.name}</strong><code>${o.fn}</code></a>`,
  ).join('');
  const clips = PRECEDENTS.map((p) => {
    const ci = ORACLES.findIndex((o) => o.rule === p.rule) + 1;
    return `<a href="https://github.com/${p.repo}/pull/${p.pr}" class="bd bd-clip" ${place(p.id)} ${hover(p.id)}><span class="bd-pin" aria-hidden="true"></span><span class="bd-merged">Merged</span><strong>${p.repo}#${p.pr}</strong><span class="bd-note">${p.note}</span><span class="bd-link">Links to case ${String(ci).padStart(2, '0')}</span></a>`;
  }).join('');
  return `<section class="sec sec-board" id="board" aria-labelledby="board-title">
  <div class="wrap">
    ${sectionHead('Evidence board', 'board-title', 'Every oracle traces back to a merged fix', 'breakhound is built by Alexandre Kohler, who has landed 130 merged bug fixes in projects at Google, Microsoft, GitHub, Mozilla, Vue and more. Hover a card to follow the string from a real pull request to the case it became.', 'pin')}
    <div class="board" v-data="{ on: '' }" data-rel='${JSON.stringify(rel)}'>
      <svg class="board-strings" viewBox="0 0 1200 660" preserveAspectRatio="none" aria-hidden="true">${strings}</svg>
      <div class="bd bd-photo" ${place('sniff')} ${hover('sniff')} tabindex="0"><span class="bd-pin" aria-hidden="true"></span><img src="assets/mascot.svg" width="150" height="150" alt="Sniff, the lead detective" loading="lazy"><span class="bd-caption">Lead detective: Sniff</span></div>
      <div class="bd bd-sticky" ${place('note')} ${hover('note')} tabindex="0"><span class="bd-pin" aria-hidden="true"></span><strong>130</strong><span>merged bug fixes across open source. Each pattern became an oracle.</span></div>
      ${caseCards}
      ${clips}
    </div>
  </div>
</section>`;
}

function procedure() {
  const steps = [
    ['types', 'Read the types', 'breakhound installs the package with <code>--ignore-scripts</code> or opens your folder, then reads its TypeScript declarations to learn every exported function and parameter.'],
    ['inputs', 'Bag the evidence', 'Each parameter gets values from <a href="https://kwy404.github.io/edgegoat/">edgegoat</a>: DST transitions, dates before 1970, emoji, lone surrogates, <code>-0</code> and <code>NaN</code>. Callbacks are generated too.'],
    ['isolation', 'Interrogate in isolation', 'Every call runs in a child process with a timeout, repeated under several <code>TZ</code> values, with a fixed seed so the same command finds the same bugs.'],
    ['report', 'File the report', 'Eight oracles judge the results. Each finding is shrunk to a minimal input and confirmed in a fresh process, then written up with a reproduction and a Vitest test.'],
  ];
  const items = steps
    .map(([ic, t, d], i) => `<li class="proc-step"><span class="proc-no">${String(i + 1).padStart(2, '0')}</span><span class="proc-ic">${icon(ic)}</span><h3>${t}</h3><p>${d}</p></li>`)
    .join('');
  return `<section class="sec sec-proc" id="how" aria-labelledby="how-title">
  <div class="wrap">
    ${sectionHead('Procedure', 'how-title', 'From package name to failing test in one command', 'Everything below happens inside <code>npx breakhound</code>. You keep only the part you care about: the tests.', 'paw')}
    <ol class="proc">${items}</ol>
  </div>
</section>`;
}

/** Converts the GitHub job summary markdown that breakhound writes into HTML. */
function summaryHtml(md, ctx) {
  const inline = (t) =>
    esc(t)
      .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  const out = [];
  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim()) continue;
    if (l.startsWith('```')) {
      const lang = l.slice(3).trim() || 'text';
      const code = [];
      while (++i < lines.length && !lines[i].startsWith('```')) code.push(lines[i]);
      out.push(ctx.frame(code.join('\n'), { lang, title: lang === 'ts' ? 'Vitest test' : 'Reproduction', kind: 'editor', compact: true }));
    } else if (l.startsWith('### ')) out.push(`<h4>${inline(l.slice(4))}</h4>`);
    else if (l.startsWith('## ')) out.push(`<h3>${inline(l.slice(3))}</h3>`);
    else if (l.startsWith('| ')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      i--;
      const cells = (r) => r.split('|').slice(1, -1).map((c) => c.trim());
      const [h, , ...body] = rows;
      out.push(`<div class="gh-table"><table><thead><tr>${cells(h).map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
    } else if (l.startsWith('<details>')) out.push('<details class="gh-details">');
    else if (l.startsWith('</details>')) out.push('</details>');
    else if (l.startsWith('<summary>')) out.push(`<summary>${l.replace(/<\/?summary>/g, '').replace(/<\/?strong>/g, '')}</summary>`.replace(/^<summary>(\w+) /, '<summary><span class="sev sev-$1">$1</span> '));
    else if (l.startsWith('- ')) out.push(`<ul><li>${inline(l.slice(2))}</li></ul>`);
    else out.push(`<p>${inline(l)}</p>`);
  }
  return out.join('\n');
}

function ci(ctx) {
  const yaml = `name: breakhound
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
      # annotations and a job summary are written automatically
      - run: npx breakhound . --fail-on high`;
  const gh = ctx.github;
  const anns = gh.annotations
    .map((a) => {
      const m = /^::(\w+) title=([^:]+)::(.*)$/.exec(a);
      if (!m) return '';
      const [, level, title, msg] = m;
      const [fn, ...rest] = msg.split(': ');
      return `<li class="ann ann-${level}"><span class="ann-ic" aria-hidden="true"></span><div><p class="ann-title"><span class="ann-level">${level}</span>${esc(title)}</p><p class="ann-msg"><code>${esc(fn)}</code> ${esc(rest.join(': ')).replace(/\(input: (.*)\)$/, 'with input <code>$1</code>')}</p></div></li>`;
    })
    .join('');
  const counts = ctx.report.counts;
  const log = ctx.frame(
    `$ npx breakhound . --fail-on high
breakhound v${ctx.version}  buggy-lib@1.0.0 (local)
23 functions analyzed, 1 skipped | 4444 calls | 6 time zones | seed 42

HIGH (5)
  [lone-surrogate-output] initials returns a string with a lone surrogate
  [lone-surrogate-output] truncate returns a string with a lone surrogate
  [timezone-dependent] yearLabel returns different results in different time zones
  [unexpected-crash] initials throws TypeError
  [unexpected-crash] mapWords throws TypeError

MEDIUM (5)
  ...

Summary: ${counts.high} high, ${counts.medium} medium, ${counts.low} low, ${counts.info} info
Error: Process completed with exit code ${gh.exitCode}.`,
    { lang: 'text', title: 'sniff', kind: 'output', compact: true },
  );
  return `<section class="sec sec-ci" id="ci" aria-labelledby="ci-title">
  <div class="wrap">
    ${sectionHead('Continuous integration', 'ci-title', 'File the report on every pull request', 'Add one step to GitHub Actions. <code>--fail-on high</code> fails the job on serious findings, and inside Actions breakhound writes annotations and a job summary on its own. This summary was produced by the same recorded run. <a href="automated-testing-in-github-actions.html">Read the CI guide</a>.', 'ci')}
    <div class="ci-grid">
      <div class="ci-left">
        ${ctx.frame(yaml, { lang: 'yaml', title: '.github/workflows/breakhound.yml', kind: 'editor', numbered: true, ok: [14] })}
        <ul class="ci-notes">
          <li>${icon('check')}<span><code>--fail-on high</code> exits with code ${gh.exitCode} when a high finding exists.</span></li>
          <li>${icon('check')}<span>Each finding becomes an error, warning or notice annotation.</span></li>
          <li>${icon('check')}<span>The job summary lists every finding with its reproduction and test.</span></li>
        </ul>
      </div>
      <div class="gh" v-tabs>
        <div class="gh-top"><span class="gh-x" aria-hidden="true">${icon('close')}</span><div><p class="gh-job">breakhound <span>/</span> sniff</p><p class="gh-meta">Failed in 38s on pull request #42</p></div></div>
        <div class="gh-tabs" role="tablist" aria-label="Job views">
          <button type="button" class="gh-tab" v-tab="summary">Summary</button>
          <button type="button" class="gh-tab" v-tab="annotations">Annotations <span class="gh-count">${gh.annotations.length}</span></button>
          <button type="button" class="gh-tab" v-tab="log">Log</button>
        </div>
        <div class="gh-panel" v-tab-panel="summary"><div class="gh-md">${summaryHtml(gh.summary, ctx)}</div></div>
        <div class="gh-panel" v-tab-panel="annotations" hidden><ul class="anns">${anns}</ul></div>
        <div class="gh-panel" v-tab-panel="log" hidden>${log}</div>
      </div>
    </div>
  </div>
</section>`;
}

function compare() {
  const rows = [
    ['Approach', 'Type driven invariant checks', 'Examples you think of', 'Property based testing library', 'Coverage guided fuzzing'],
    ['You write', 'Nothing', 'Every case and assertion', 'Properties and arbitraries', 'Fuzz targets'],
    ['Input source', 'Types plus edgegoat edge cases', 'Your imagination', 'Your arbitraries, with shrinking', 'Mutation guided by coverage'],
    ['Best at', 'Unicode, time zone and number formatting bugs in public APIs', 'Documenting intended behavior', 'Precise properties of your own code', 'Crashes and security issues in parsers'],
    ['Works on code you never read', 'Yes', 'No', 'No', 'Partly, after writing a target'],
    ['Output', 'Reproduction plus ready Vitest test', 'Pass or fail', 'Failing counterexample', 'Crashing input'],
  ];
  return `<section class="sec" id="compare" aria-labelledby="compare-title">
  <div class="wrap">
    ${sectionHead('Line-up', 'compare-title', 'Where breakhound fits', 'breakhound complements these tools rather than replacing them. A good workflow: a free sweep with breakhound first, important properties in fast-check, parsers in Jazzer.js.', 'magnifier')}
    <div class="table-wrap lineup"><table class="table">
      <thead><tr><th scope="col">Aspect</th><th scope="col" class="us">breakhound</th><th scope="col">Tests by hand</th><th scope="col">fast-check</th><th scope="col">Jazzer.js</th></tr></thead>
      <tbody>${rows.map(([h, ...c]) => `<tr><th scope="row">${h}</th>${c.map((v, i) => `<td${i === 0 ? ' class="us"' : ''}>${v}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>
  </div>
</section>`;
}

function faq() {
  const items = FAQ.map(
    ([q, a], i) => `<details class="collapse q"${i === 0 ? ' open' : ''} name="faq"><summary class="collapse-title"><span class="q-no">Q${i + 1}</span>${q}</summary><div class="collapse-content"><p>${esc(a)}</p></div></details>`,
  ).join('');
  return `<section class="sec sec-faq" id="faq" aria-labelledby="faq-title">
  <div class="wrap faq-grid">
    <div>
      ${sectionHead('Interrogation', 'faq-title', 'Questions, answered on the record', '', 'magnifier')}
      ${illustration('lens', 'ill faq-ill')}
    </div>
    <div class="accordion collapse-plus">${items}</div>
  </div>
</section>`;
}

function closing() {
  return `<section class="sec sec-close" aria-labelledby="close-title">
  <div class="wrap">
    <div class="close-card dark">
      <img src="assets/mascot.svg" width="150" height="150" alt="" loading="lazy">
      <div>
        <h2 id="close-title">Let Sniff work your library</h2>
        <p>One command, no config, no tests to write. You get the bugs, the reproductions and the Vitest tests.</p>
        <div class="close-cmd"><code id="close-cmd">npx breakhound ./my-lib</code><button type="button" class="copy-btn" v-copy-from="#close-cmd" aria-label="Copy the command">${icon('copy')}Copy</button></div>
      </div>
      ${illustration('evidence-tag', 'ill close-ill')}
    </div>
  </div>
</section>`;
}

export function homeBody(ctx) {
  const trail = illustration('paw-trail', 'ill trail');
  return [hero(ctx), `<div class="wrap trail-wrap">${trail}</div>`, cases(ctx), board(), procedure(), ci(ctx), compare(), faq(), closing()].join('\n');
}
