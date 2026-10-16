// Guide pages (long reads with a margin notes column), the case index and the
// 404 page.
import { icon, illustration } from './art.mjs';
import { GUIDES, SITE, esc } from './layout.mjs';
import { ORACLES } from './home.mjs';
import { NOTES } from './notes.mjs';

export const TOPICS = {
  unicode: 'Unicode',
  time: 'Dates and time',
  numbers: 'Numbers',
  invariants: 'Invariants',
  ci: 'CI',
};

export const UPDATED = '2026-10-15';
const UPDATED_LABEL = 'October 15, 2026';

function crumbs(items) {
  const lis = items
    .map(([label, href], i) => (i === items.length - 1 ? `<li><span aria-current="page">${label}</span></li>` : `<li><a href="${href}">${label}</a></li>`))
    .join('');
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol class="breadcrumbs">${lis}</ol></nav>`;
}

function note([kind, label, html]) {
  const ic = { def: 'book', ev: 'pin', case: 'folder', cmd: 'terminal' }[kind];
  return `<aside class="mnote mnote-${kind}"><p class="mnote-label">${icon(ic)}${label}</p><p>${html}</p></aside>`;
}

/** Renders one guide. `guide` holds the parsed source: meta and body html. */
export function guideBody(guide, all) {
  const { meta } = guide;
  const g = GUIDES.find((x) => x.slug === meta.slug);
  const notes = NOTES[meta.slug] || {};
  const sections = [...guide.body.matchAll(/<section id="([^"]+)"><h2>([\s\S]*?)<\/h2>/g)].map((m) => [m[1], m[2]]);
  let body = guide.body.replace(/<section id="([^"]+)"><h2>([\s\S]*?)<\/h2>/g, (all, id, h) => {
    const n = notes[id] ? note(notes[id]) : '';
    return `<section id="${id}" class="chapter"><h2><a href="#${id}" class="anchor" aria-hidden="true" tabindex="-1">#</a>${h}</h2>${n}`;
  });
  body = body.replace(/<div class="callout"><p>([\s\S]*?)<\/p><\/div>/g, `<div class="callout callout-warning"><p class="callout-title">${icon('isolation')}Handle with care</p><p>$1</p></div>`);
  const toc = [...sections, ['faq', 'Questions on the record'], ['related', 'Related case files']]
    .map(([id, h]) => `<li><a href="#${id}">${h.replace(/<[^>]+>/g, '')}</a></li>`)
    .join('');
  const faq = meta.faq
    .map((f, i) => `<details class="collapse q"${i === 0 ? ' open' : ''}><summary class="collapse-title"><span class="q-no">Q${i + 1}</span>${f.q}</summary><div class="collapse-content">${f.a}</div></details>`)
    .join('');
  const related = meta.related
    .map((slug) => {
      const r = all.find((x) => x.meta.slug === slug);
      const rg = GUIDES.find((x) => x.slug === slug);
      return `<a href="${slug}.html" class="rel"><span class="rel-no">Case file ${rg.file}</span><strong>${esc(r.meta.h1)}</strong><span>${esc(r.meta.description)}</span></a>`;
    })
    .join('');
  const oracle = ORACLES.find((o) => o.guide === meta.slug);
  return `<div class="read-progress" aria-hidden="true"></div>
<div class="wrap">
  ${crumbs([['breakhound', './'], ['Guides', 'guides.html'], [meta.crumb, '']])}
  <header class="cover">
    <div class="cover-text">
      <p class="cover-file"><span class="file-no">Case file ${g.file}</span><span class="file-topic">${TOPICS[g.topic]}</span></p>
      <h1>${esc(meta.h1)}</h1>
      <p class="lead">${meta.lead}</p>
      <p class="cover-meta"><span>By <a href="https://github.com/kwy404" rel="author">Alexandre Kohler</a></span><span>Updated <time datetime="${UPDATED}">${UPDATED_LABEL}</time></span><span>${meta.readTime}</span></p>
    </div>
    <div class="cover-art" aria-hidden="true">${illustration('folders', 'ill cover-folders')}<span class="cover-ic">${icon(oracle ? oracle.rule : g.topic === 'ci' ? 'ci' : 'magnifier')}</span></div>
  </header>
  <div class="read">
    <article class="read-main">
      <aside class="mnote mnote-toc" aria-labelledby="toc-title"><p class="mnote-label" id="toc-title">${icon('folder')}In this file</p><ol>${toc}</ol></aside>
${body}
      <section id="faq" class="chapter"><h2><a href="#faq" class="anchor" aria-hidden="true" tabindex="-1">#</a>Questions on the record</h2><div class="accordion collapse-plus">${faq}</div></section>
      <aside class="guide-cta" aria-label="Get started">
        <img src="assets/mascot.svg" width="96" height="96" alt="" loading="lazy">
        <div><h2>Let Sniff work your library</h2><p>No install, no config, no tests to write. You get a reproduction and a Vitest test for every bug.</p>
        <div class="close-cmd"><code id="cta-cmd">npx breakhound ./my-lib</code><button type="button" class="copy-btn" v-copy-from="#cta-cmd" aria-label="Copy the command">${icon('copy')}Copy</button></div></div>
      </aside>
      <section id="related" class="chapter"><h2><a href="#related" class="anchor" aria-hidden="true" tabindex="-1">#</a>Related case files</h2><div class="related">${related}</div></section>
    </article>
  </div>
</div>`;
}

/** JSON-LD for a guide: the original graph with a fresh modified date and the guides hub in the breadcrumb. */
export function guideJsonLd(meta) {
  const ld = structuredClone(meta.jsonld);
  for (const node of ld['@graph']) {
    if (node['@type'] === 'TechArticle') {
      node.dateModified = UPDATED;
      node.author = { '@type': 'Person', name: 'Alexandre Kohler', url: 'https://github.com/kwy404', sameAs: ['https://github.com/kwy404', 'https://www.linkedin.com/in/alexandre-silva-173687256/'] };
    }
    if (node['@type'] === 'BreadcrumbList') {
      const item = node.itemListElement.find((x) => x.position === 2);
      if (item) item.item = `${SITE}guides.html`;
    }
  }
  return ld;
}

/** The case index: every guide and every oracle, with a top filter bar. */
export function indexBody(guides) {
  const cards = [];
  for (const g of GUIDES) {
    const m = guides.find((x) => x.meta.slug === g.slug).meta;
    cards.push({ kind: 'guide', topic: g.topic, no: `Case file ${g.file}`, title: m.h1, sum: m.description, href: `${g.slug}.html`, foot: m.readTime, ic: ORACLES.find((o) => o.guide === g.slug && o.topic === g.topic)?.rule || (g.topic === 'ci' ? 'ci' : 'magnifier') });
  }
  ORACLES.forEach((o, i) => {
    cards.push({ kind: 'oracle', topic: o.topic, no: `Case ${String(i + 1).padStart(2, '0')}`, title: o.name, sum: `${o.sum} Oracle id ${o.rule}.`, href: `./#case-${o.rule}`, foot: `Recorded on ${o.fn}`, ic: o.rule });
  });
  const data = cards.map((c) => ({ kind: c.kind, topic: c.topic, text: `${c.title} ${c.sum} ${c.no} ${TOPICS[c.topic]}`.toLowerCase() }));
  const html = cards
    .map(
      (c, i) => `<a href="${c.href}" class="icard icard-${c.kind}" v-show="cardMatch(${i}, q, kind, topic)">
  <span class="icard-tab"><span>${c.no}</span><span class="icard-kind">${c.kind === 'guide' ? 'Guide' : 'Oracle'}</span></span>
  <span class="icard-body"><span class="icard-ic">${icon(c.ic)}</span><strong>${esc(c.title)}</strong><span class="icard-sum">${esc(c.sum)}</span></span>
  <span class="icard-foot"><span class="tag">${TOPICS[c.topic]}</span><span>${esc(c.foot)}</span></span>
</a>`,
    )
    .join('\n');
  const topicBtns = [['all', 'All topics'], ...Object.entries(TOPICS)]
    .map(([k, v]) => `<button type="button" class="chip-btn" :aria-pressed="topic === '${k}' ? 'true' : 'false'" aria-pressed="${k === 'all'}" @click="topic = '${k}'">${v}</button>`)
    .join('');
  const kindBtns = [['all', 'Everything'], ['guide', 'Guides'], ['oracle', 'Oracles']]
    .map(([k, v]) => `<button type="button" class="seg-btn" :aria-pressed="kind === '${k}' ? 'true' : 'false'" aria-pressed="${k === 'all'}" @click="kind = '${k}'">${v}</button>`)
    .join('');
  return `<section class="ix-hero">
  <div class="wrap ix-hero-in">
    <div>
      ${crumbs([['breakhound', './'], ['Guides', '']])}
      <p class="kicker">${icon('folder')}Case index</p>
      <h1>Every case Sniff has worked</h1>
      <p class="lead">Four guides on the bugs breakhound looks for and on running it in CI, plus the eight oracles. Filter by topic or search for a rule.</p>
    </div>
    ${illustration('board', 'ill ix-ill')}
  </div>
</section>
<div class="ix" v-data="{ q: '', kind: 'all', topic: 'all' }">
  <script type="application/json" id="ix-data">${JSON.stringify(data)}</script>
  <div class="filterbar">
    <div class="wrap filterbar-in">
      <label class="ix-search">${icon('search')}<input type="search" v-model="q" placeholder="Search the case index" aria-label="Search the case index"></label>
      <div class="seg" role="group" aria-label="Kind">${kindBtns}</div>
      <div class="ix-topics" role="group" aria-label="Topic">${topicBtns}</div>
      <p class="ix-count" aria-live="polite"><strong v-text="cardCount(q, kind, topic)">${cards.length}</strong> of ${cards.length} files</p>
    </div>
  </div>
  <div class="wrap">
    <div class="icards">
${html}
    </div>
    <div class="ix-empty" v-show="!cardCount(q, kind, topic)" style="display: none">${illustration('lens', 'ill ix-empty-ill')}<p><strong>No case matches.</strong> Sniff is still searching. Try another word or clear the filters.</p><button type="button" class="btn btn-outline btn-sm" @click="q = ''; kind = 'all'; topic = 'all'">Clear filters</button></div>
  </div>
</div>`;
}

export function indexJsonLd(guides) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: 'breakhound guides: the case index',
        url: `${SITE}guides.html`,
        description: 'Four guides on the bugs breakhound looks for and on running it in CI.',
        inLanguage: 'en',
        isPartOf: { '@type': 'WebSite', name: 'breakhound', url: SITE },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: GUIDES.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}${g.slug}.html`, name: guides.find((x) => x.meta.slug === g.slug).meta.h1 })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'breakhound', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Guides', item: `${SITE}guides.html` },
        ],
      },
    ],
  };
}

export function notFoundBody() {
  return `<section class="nf">
  <div class="wrap nf-in">
    <div class="nf-art" aria-hidden="true">${illustration('lens', 'ill nf-lens')}${illustration('paw-trail', 'ill nf-trail')}</div>
    <div>
      <p class="kicker">${icon('paw')}Error 404</p>
      <h1>Sniff lost the trail</h1>
      <p class="lead">This page could not be found. The scent stops here, but the case files are still on the desk.</p>
      <div class="nf-term"><pre><code><span class="t-green">~/cases</span> <span class="t-dim">$</span> npx breakhound ./this-page
<span class="t-red">breakhound: not a path and not a valid npm package name</span>
<span class="t-dim">Hints: try the home page or the case index</span></code></pre></div>
      <p class="nf-moved" data-moved hidden></p>
      <div class="nf-cta"><a class="btn btn-primary" href="./">${icon('terminal')}Back to the home page</a><a class="btn btn-outline" href="guides.html">${icon('folder')}Open the guides</a></div>
    </div>
  </div>
</section>
<script>
(function () {
  // Guides that were merged into the home page and the remaining guides.
  var moved = {
    'find-bugs-automatically-javascript': ['/breakhound/#try', 'the home page, which now starts with a live demo'],
    'fuzz-testing-typescript': ['/breakhound/#how', 'the procedure on the home page'],
    'property-based-testing-without-writing-tests': ['/breakhound/#cases', 'the eight case files on the home page'],
    'roundtrip-testing-encode-decode': ['/breakhound/#case-roundtrip', 'the roundtrip case file'],
  };
  var slug = location.pathname.replace(/^.*\\//, '').replace(/\\.html$/, '');
  var to = moved[slug];
  var el = document.querySelector('[data-moved]');
  if (!to || !el) return;
  var a = document.createElement('a');
  a.href = to[0];
  a.textContent = to[1];
  el.append('This guide was retired. Its content lives on in ', a, '.');
  el.hidden = false;
})();
</script>`;
}
