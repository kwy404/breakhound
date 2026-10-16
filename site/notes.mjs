// Margin notes for the guides, keyed by guide slug and section id. Each note
// floats into the margin column next to the start of its section on wide
// screens and sits inline, as an annotated aside, on narrow ones.
// Kinds: def (definition), ev (evidence from a real fix), case (link to an
// oracle case file), cmd (a command to try).

export const NOTES = {
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
  'negative-zero-javascript-bugs': {
    'two-zeros': ['def', 'Signed zero', '<code>Object.is(-0, 0)</code> is false, but <code>-0 === 0</code> is true and <code>String(-0)</code> is "0".'],
    'pdfjs': ['ev', 'Evidence', 'Fixed in <a href="https://github.com/mozilla/pdf.js/pull/22017">mozilla/pdf.js#22017</a>: negative numbers above -1 lost their minus sign.'],
    'breakhound': ['case', 'Case 07', 'Lost minus sign. The <a href="./#case-negative-zero-sign">recorded case</a> and its generated test.'],
  },
  'automated-testing-in-github-actions': {
    'why': ['def', 'Gate', 'A CI step that fails the build when a rule is broken, so the bug never reaches main.'],
    'correct-workflow': ['cmd', 'One step', '<code>npx breakhound . --fail-on high</code> after <code>npm ci --ignore-scripts</code>.'],
    'annotations': ['case', 'See it', 'The <a href="./#ci">mock job summary</a> on the home page is real output from the fixture.'],
    'baseline': ['cmd', 'Regressions only', '<code>--baseline baseline.json --fail-on high</code> fails on new findings, not on old ones.'],
    'seeds': ['def', 'Reproducible', 'A fixed seed and call budget make the same commit find the same bugs on every runner.'],
  },
};
