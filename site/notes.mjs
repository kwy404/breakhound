// Margin notes for the guides, keyed by guide slug and section id. Each note
// floats into the margin column next to the start of its section on wide
// screens and sits inline, as an annotated aside, on narrow ones.
// Kinds: def (definition), ev (evidence from a real fix), case (link to an
// oracle case file), cmd (a command to try).

export const NOTES = {
  'find-bugs-automatically-javascript': {
    'why-bugs-hide': ['def', 'Invariant', 'A rule that must hold for every input, so it can judge a result without knowing the exact answer.'],
    'a-bug-in-twelve-lines': ['case', 'Case 01', 'This is the split emoji case. See the <a href="./#case-lone-surrogate-output">recorded finding</a> for <code>truncate</code>.'],
    'run-breakhound': ['cmd', 'Try it', '<code>npx breakhound ./my-lib</code> works on a folder or any npm package name.'],
    'narrow-and-gate': ['def', 'Exit codes', '<code>--fail-on high</code> exits with 1 when a high finding exists, 0 otherwise.'],
  },
  'fuzz-testing-typescript': {
    'types-as-fuzz-input': ['def', 'Fuzzing', 'Feeding a program many generated inputs and watching for crashes or broken rules.'],
    'a-typed-bug': ['case', 'Case 07', 'The lost minus sign. The <a href="./#case-negative-zero-sign">recorded case</a> shows <code>formatFixed(-0.5)</code> printing a positive value.'],
    'how-types-drive-inputs': ['ev', 'Edge cases', 'Inputs come from <a href="https://kwy404.github.io/edgegoat/">edgegoat</a>, a curated catalog of the values that break JavaScript code.'],
    'make-it-repeatable': ['cmd', 'Same seed, same bugs', '<code>--seed 42</code> is the default. Change it to widen the hunt.'],
  },
  'timezone-bugs-javascript': {
    'why-timezone-bugs-happen': ['def', 'Instant vs wall time', 'A <code>Date</code> is one instant. Year, month and hour only exist once you pick a zone.'],
    'utc-vs-local-getters': ['ev', 'Evidence', 'Fixed in <a href="https://github.com/github/relative-time-element/pull/384">github/relative-time-element#384</a>: the year check used UTC instead of the display zone.'],
    'dates-before-1970': ['case', 'Case 02', 'Time zone dependence. The <a href="./#case-timezone-dependent">recorded case</a> catches <code>yearLabel(0)</code> answering 1969 in four zones.'],
    'how-breakhound-catches-it': ['cmd', 'Pick the zones', '<code>--zones UTC,Asia/Tokyo</code> replaces the six default zones. The first one is the reference.'],
  },
  'unicode-surrogate-pair-bugs': {
    'what-is-a-surrogate-pair': ['def', 'Code unit', 'One 16 bit slot of a JavaScript string. <code>length</code> counts these, not characters.'],
    'real-bugs': ['ev', 'Evidence', 'Fixed in <a href="https://github.com/google/budoux/pull/1411">google/budoux#1411</a> and <a href="https://github.com/microsoft/vscode-js-debug/pull/2423">microsoft/vscode-js-debug#2423</a>.'],
    'how-to-fix-it': ['ev', 'Graphemes', 'For user perceived characters, cut by grapheme with <a href="https://kwy404.github.io/graphemely/">graphemely</a> or <code>Intl.Segmenter</code>.'],
    'how-breakhound-catches-it': ['case', 'Case 01', 'Split emoji. The <a href="./#case-lone-surrogate-output">recorded case</a> shows the exact input and the generated test.'],
  },
  'property-based-testing-without-writing-tests': {
    'why-properties-are-hard-to-start': ['def', 'Property', 'A statement that holds for all inputs, such as "sorting twice equals sorting once".'],
    'invariants-you-can-check-for-free': ['case', 'Cases 05 to 08', 'Roundtrip, idempotence and determinism each have a <a href="./#cases">case file</a> with real evidence.'],
    'a-failing-example': ['case', 'Case 06', 'Not idempotent. The <a href="./#case-not-idempotent">recorded case</a> turns <code>x y</code> into <code>x_y</code>, then <code>x-y</code>.'],
    'when-to-keep-writing-properties': ['def', 'Division of labor', 'breakhound sweeps public APIs for free. Business rules still deserve hand written properties.'],
  },
  'roundtrip-testing-encode-decode': {
    'what-a-roundtrip-guarantees': ['def', 'Roundtrip', '<code>decode(encode(x))</code> equals <code>x</code> for every valid <code>x</code>.'],
    'how-partners-are-found': ['def', 'Partners', 'Pairs are matched by name: <code>encodeX</code> and <code>decodeX</code>, <code>toY</code> and <code>fromY</code>, <code>stringify</code> and <code>parse</code>.'],
    'running-the-roundtrip-oracle': ['case', 'Case 05', 'Broken roundtrip. The <a href="./#case-roundtrip">recorded case</a> sends <code>_</code> through and gets a space back.'],
    'the-idempotence-sibling': ['case', 'Case 06', 'The <a href="./#case-not-idempotent">idempotence case</a> applies the same check to normalizers.'],
  },
  'negative-zero-javascript-bugs': {
    'two-zeros': ['def', 'Signed zero', '<code>Object.is(-0, 0)</code> is false, but <code>-0 === 0</code> is true and <code>String(-0)</code> is "0".'],
    'pdfjs': ['ev', 'Evidence', 'Fixed in <a href="https://github.com/mozilla/pdf.js/pull/22017">mozilla/pdf.js#22017</a>: negative numbers above -1 lost their minus sign.'],
    'breakhound': ['case', 'Case 07', 'Lost minus sign. The <a href="./#case-negative-zero-sign">recorded case</a> and its generated test.'],
  },
  'automated-testing-in-github-actions': {
    'why': ['def', 'Gate', 'A CI step that fails the build when a rule is broken, so the bug never reaches main.'],
    'correct-workflow': ['cmd', 'One step', '<code>npx breakhound . --fail-on high</code> after <code>npm ci --ignore-scripts</code>.'],
    'annotations': ['case', 'See it', 'The <a href="./#ci">mock job summary</a> on the home page is real output from the fixture.'],
    'seeds': ['def', 'Reproducible', 'A fixed seed and call budget make the same commit find the same bugs on every runner.'],
  },
};
