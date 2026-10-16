// Shared page chrome for the breakhound site: head, top bar, search dialog
// and footer. Used by scripts/build-docs.mjs.
import { icon, sprite } from './art.mjs';

export const SITE = 'https://kwy404.github.io/breakhound/';
export const MONSOON_CSS = 'https://cdn.jsdelivr.net/npm/monsooncss@0.2.0/dist/monsoon.min.css';
export const VOODOO_JS = 'https://cdn.jsdelivr.net/npm/voodoojs@1.0.0/dist/voodoo.full.min.js';
export const GITHUB = 'https://github.com/kwy404/breakhound';
export const NPM = 'https://www.npmjs.com/package/breakhound';
export const AUTHOR_GH = 'https://github.com/kwy404';
export const AUTHOR_IN = 'https://www.linkedin.com/in/alexandre-silva-173687256/';

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The guides, in reading order. Titles are short labels for navigation. */
export const GUIDES = [
  { slug: 'timezone-bugs-javascript', short: 'Time zone bugs', topic: 'time', file: 'G-01' },
  { slug: 'unicode-surrogate-pair-bugs', short: 'Surrogate pairs', topic: 'unicode', file: 'G-02' },
  { slug: 'negative-zero-javascript-bugs', short: 'Negative zero', topic: 'numbers', file: 'G-03' },
  { slug: 'automated-testing-in-github-actions', short: 'GitHub Actions', topic: 'ci', file: 'G-04' },
];

export const MORE = [
  ['Monsoon', 'https://kwy404.github.io/monsoon/', 'Utility-first CSS with no build step'],
  ['Voodoo.js', 'https://kwy404.github.io/Voodoo.js/', 'Reactive attributes for plain HTML'],
  ['vueleap', 'https://kwy404.github.io/vueleap/', 'Vue 2 to Vue 3 migration'],
  ['graphemely', 'https://kwy404.github.io/graphemely/', 'Grapheme aware string utilities'],
  ['numberparrot', 'https://kwy404.github.io/numberparrot/', 'Parse localized numbers'],
  ['edgegoat', 'https://kwy404.github.io/edgegoat/', 'Edge case inputs for JavaScript testing'],
  ['cookieowl', 'https://kwy404.github.io/cookieowl/', 'Cookie consent for LGPD and GDPR'],
  ['installkite', 'https://kwy404.github.io/installkite/', 'Make any website installable and offline capable'],
  ['a11ymedic', 'https://kwy404.github.io/a11ymedic/', 'Accessibility checker with the exact fix'],
  ['fontsketch', 'https://kwy404.github.io/fontsketch/', 'Turn your handwriting into a font'],
  ['kastor', 'https://kwy404.github.io/kastor/', 'The TypeScript ORM for almost every database'],
];

const THEME_SNIPPET = `<script>(function(){try{var t=localStorage.getItem('voodoo:theme');if(t&&t.charAt(0)==='"')t=JSON.parse(t);var r=document.documentElement;if(t==='light'||t==='dark'){r.setAttribute('data-theme',t);r.style.colorScheme=t}else{r.removeAttribute('data-theme')}}catch(e){}})();</script>`;

/** The document head. */
export function head(p) {
  const url = SITE + (p.path || '');
  const ld = p.jsonld ? `\n<script type="application/ld+json">\n${JSON.stringify(p.jsonld, null, 2)}\n</script>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
${THEME_SNIPPET}
<script src="seasons.js"></script>
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}">
${p.noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${url}">`}
<meta name="author" content="Alexandre Kohler">
<meta name="theme-color" content="#f8faff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0d1220" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="${p.ogType || 'website'}">
<meta property="og:site_name" content="breakhound">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}og.png">
<meta property="og:image:width" content="1280">
<meta property="og:image:height" content="640">
<meta property="og:image:alt" content="breakhound: find bugs in any JavaScript library automatically">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(p.title)}">
<meta name="twitter:description" content="${esc(p.description)}">
<meta name="twitter:image" content="${SITE}og.png">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Special+Elite&amp;display=swap">
<link rel="stylesheet" href="${MONSOON_CSS}">
<link rel="stylesheet" href="site.css">
<script src="${VOODOO_JS}" data-manual defer></script>
<script type="module" src="site.js"></script>${p.kind === 'home' ? '\n<script type="module" src="demo.js"></script>' : ''}${ld}
</head>`;
}

const NAV = [
  ['try', 'Try it', './#try'],
  ['terminal', 'Terminal', './#terminal'],
  ['cases', 'Case files', './#cases'],
  ['ci', 'CI', './#ci'],
  ['index', 'Guides', 'guides.html'],
];

/** The sticky top bar. `current` marks the active nav item. */
export function topbar(current = '') {
  const links = NAV.map(
    ([key, label, href]) => `<a href="${href}" class="top-link"${key === current ? ' aria-current="page"' : ''}>${label}</a>`,
  ).join('');
  return `<a href="#main" class="skip-link">Skip to content</a>
<header class="topbar" v-data="{ open: false }" @keydown.escape="open = false">
  <div class="wrap topbar-in">
    <a href="./" class="brand" aria-label="breakhound home"><img src="assets/mascot.svg" width="34" height="34" alt=""><span class="brand-name">breakhound</span><span class="brand-file">case files</span></a>
    <nav id="topnav" class="topnav" :class="{ 'is-open': open }" aria-label="Main" @click="open = false">${links}</nav>
    <div class="top-right">
      <button type="button" class="search-btn" data-search-open v-hotkey="mod+k" aria-haspopup="dialog" aria-label="Search the site">${icon('search')}<span class="search-label">Search</span><kbd class="kbd kbd-sm">Ctrl K</kbd></button>
      <a href="${GITHUB}" class="icon-btn" aria-label="breakhound on GitHub">${icon('github')}</a>
      <button type="button" class="icon-btn theme-btn" v-theme-toggle.cycle aria-label="Switch theme" title="Theme: system, light or dark">${icon('system', 'ic ti-system')}${icon('sun', 'ic ti-light')}${icon('moon', 'ic ti-dark')}</button>
      <button type="button" class="icon-btn nav-btn" aria-controls="topnav" :aria-expanded="open ? 'true' : 'false'" aria-expanded="false" @click="open = !open" aria-label="Menu">${icon('menu')}</button>
    </div>
  </div>
</header>`;
}

/** The Ctrl K search dialog, filled by site.js from search.json. */
export function searchDialog() {
  return `<dialog id="search" class="modal modal-top search-dlg" aria-label="Search the site">
  <div class="command-palette" v-data="{ q: '', sel: 0 }" @keydown.down.prevent="sel = Math.min(sel + 1, hits(q, S.ready).length - 1)" @keydown.up.prevent="sel = Math.max(sel - 1, 0)" @keydown.enter.prevent="go(q, sel)">
    <label class="command-palette-search">${icon('search')}<input id="search-input" class="command-palette-input" v-model="q" @input="sel = 0" placeholder="Search cases, guides and oracles" autocomplete="off" spellcheck="false" aria-label="Search" aria-controls="search-results"></label>
    <div id="search-results" class="command-palette-list" role="listbox" aria-label="Results">
      <p class="command-palette-heading" v-if="!q">Suggestions</p>
      <a v-for="(r, i) in hits(q, S.ready)" :key="r.url" :href="r.url" class="command-palette-item" role="option" :aria-selected="i === sel ? 'true' : 'false'" @mouseenter="sel = i"><span class="hit-kind" v-text="r.kind"></span><span class="hit-text"><span class="hit-title" v-text="r.title"></span><span class="hit-sub" v-text="r.sub"></span></span></a>
      <p class="command-palette-empty" v-if="q && !hits(q, S.ready).length">No case matches. Sniff is still searching.</p>
    </div>
    <div class="command-palette-footer"><span><kbd class="kbd kbd-xs">Enter</kbd> open</span><span><kbd class="kbd kbd-xs">Esc</kbd> close</span></div>
  </div>
  <form method="dialog" class="modal-backdrop"><button aria-label="Close search">Close</button></form>
</dialog>`;
}

/** The footer, the same on every page. */
export function footer() {
  const guides = GUIDES.map((g) => `<li><a href="${g.slug}.html">${g.short}</a></li>`).join('');
  const more = MORE.map(([n, u, d]) => `<li><a href="${u}">${n}</a><small>${d}</small></li>`).join('');
  return `<footer class="site-foot">
  <div class="wrap">
    <div class="foot-grid">
      <div class="foot-about">
        <a href="./" class="brand"><img src="assets/mascot.svg" width="40" height="40" alt="" loading="lazy"><span class="brand-name">breakhound</span></a>
        <p>Point it at any JavaScript package. Sniff reads the types, attacks every function with edge cases and files a report with a reproduction and a Vitest test for each bug.</p>
        <p class="foot-links"><a href="${GITHUB}">${icon('github')}GitHub</a><a href="${NPM}">${icon('npm')}npm</a><a href="${GITHUB}/blob/main/CHANGELOG.md">${icon('book')}Changelog</a></p>
      </div>
      <nav aria-labelledby="f-cases"><h2 id="f-cases" class="foot-title">Case files</h2><ul>
        <li><a href="./#try">Paste and see</a></li><li><a href="./#terminal">Live terminal</a></li><li><a href="./#cases">The eight oracles</a></li><li><a href="./#board">Evidence board</a></li><li><a href="./#ci">CI job summary</a></li><li><a href="guides.html">Case index</a></li><li><a href="./#faq">FAQ</a></li>
      </ul></nav>
      <nav aria-labelledby="f-guides"><h2 id="f-guides" class="foot-title">Guides</h2><ul>${guides}</ul></nav>
      <nav aria-labelledby="f-more"><h2 id="f-more" class="foot-title">More from kwy404</h2><ul class="foot-more">${more}</ul></nav>
    </div>
    <div class="foot-bottom">
      <p>Made by <a href="${AUTHOR_GH}" rel="me noopener">Alexandre Kohler</a><a href="${AUTHOR_GH}" class="foot-ic" rel="me noopener" aria-label="Alexandre Kohler on GitHub">${icon('github')}</a><a href="${AUTHOR_IN}" class="foot-ic" rel="me noopener" aria-label="Alexandre Kohler on LinkedIn">${icon('linkedin')}</a></p>
      <p>Built with <a href="https://kwy404.github.io/monsoon/">Monsoon</a>. Interactive parts built with <a href="https://kwy404.github.io/Voodoo.js/">Voodoo.js</a>. MIT licensed.</p>
    </div>
  </div>
</footer>`;
}

/** Wraps a page body with the shared chrome. */
export function page(p, body) {
  return `${head(p)}
<body class="antialiased bg-background text-foreground page-${p.kind}">
${sprite()}
${topbar(p.nav)}
<main id="main">
${body}
</main>
${footer()}
${searchDialog()}
</body>
</html>
`;
}
