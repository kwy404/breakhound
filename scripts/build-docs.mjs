// Builds the docs site in docs/ from the sources in site/.
//   site/guides/*.html   guide sources: a meta comment, then prose sections
//   site/data/*          real output captured by scripts/build-demo.mjs
//   site/*.mjs           layout, landing page, guide and index templates, art
// Code samples are highlighted at build time with Shiki (light-plus and
// dark-plus) so the pages ship no highlighter.
// Usage: npm run docs            (npm run demo first to refresh site/data)
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { standalone } from '../site/art.mjs';
import { FAQ, ORACLES, homeBody, homeJsonLd } from '../site/home.mjs';
import { GUIDES, SITE, esc, page } from '../site/layout.mjs';
import { NOTES } from '../site/notes.mjs';
import { UPDATED, guideBody, guideJsonLd, indexBody, indexJsonLd, notFoundBody } from '../site/pages.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const docs = join(root, 'docs');
const data = join(root, 'site', 'data');
const check = process.argv.includes('--check');

// Shiki: the local dev dependency, or a sibling checkout that has it installed.
async function loadShiki() {
  const require = createRequire(import.meta.url);
  const candidates = ['shiki', join(root, '..', 'graphemely', 'node_modules', 'shiki')];
  for (const c of candidates) {
    try {
      const resolved = c === 'shiki' ? require.resolve('shiki') : join(c, 'dist', 'index.mjs');
      if (c !== 'shiki' && !existsSync(resolved)) continue;
      return await import(c === 'shiki' ? 'shiki' : pathToFileURL(resolved).href);
    } catch {
      // try the next one
    }
  }
  throw new Error('shiki is not installed: run npm install');
}
const shiki = await loadShiki();
const highlighter = await shiki.createHighlighter({ themes: ['light-plus', 'dark-plus'], langs: ['ts', 'js', 'yaml', 'bash', 'json', 'text'] });

// ---------- Code frames ----------

const FILE_ICONS = {
  ts: ['#3178c6', 'TS'],
  js: ['#c9a400', 'JS'],
  yaml: ['#cb171e', 'YML'],
  json: ['#8a6d00', '{}'],
  bash: ['#3f8f4f', '$_'],
  text: ['#6b7280', '>_'],
};
function fileIcon(lang) {
  const [color, label] = FILE_ICONS[lang] || FILE_ICONS.text;
  const size = label.length > 2 ? 5.2 : 6.4;
  return `<svg class="file-ic" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect width="16" height="16" rx="3" fill="${color}"/><text x="8" y="11" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${size}" font-weight="700" fill="#fff">${esc(label)}</text></svg>`;
}

let codeId = 0;
/**
 * A VS Code style frame around Shiki output.
 * kind: editor (file tab), terminal (commands, prefixed with $) or output.
 */
function frame(code, opts = {}) {
  const lang = opts.lang || 'text';
  const kind = opts.kind || 'editor';
  const title = opts.title || (kind === 'terminal' ? 'Terminal' : kind === 'output' ? 'Terminal output' : 'snippet');
  const bad = new Set(opts.bad || []);
  const ok = new Set(opts.ok || []);
  const html = highlighter.codeToHtml(code, {
    lang: lang === 'text' ? 'text' : lang,
    themes: { light: 'light-plus', dark: 'dark-plus' },
    defaultColor: false,
    transformers: [
      {
        line(node, line) {
          if (bad.has(line)) this.addClassToHast(node, 'bad');
          if (ok.has(line)) this.addClassToHast(node, 'ok');
        },
      },
    ],
  });
  const inner = /<code>([\s\S]*)<\/code>/.exec(html)[1];
  const id = `code-${++codeId}`;
  const cls = ['frame', `frame-${kind}`, opts.compact ? 'frame-compact' : ''].filter(Boolean).join(' ');
  const pre = ['shiki', opts.numbered ? 'numbered' : ''].filter(Boolean).join(' ');
  return `<figure class="${cls}" data-lang="${lang}"><div class="frame-bar"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="frame-tab">${fileIcon(kind === 'terminal' ? 'bash' : lang)}<span>${esc(title)}</span></span><button type="button" class="frame-copy" v-copy-from="#${id}" aria-label="Copy ${esc(title)}"><svg class="ic" aria-hidden="true"><use href="#i-copy"/></svg><span>Copy</span></button></div><pre class="${pre}" tabindex="0"><code id="${id}">${inner}</code></pre></figure>`;
}

const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

/** Replaces source code blocks in guide bodies with highlighted frames. */
function renderBlocks(body) {
  return body.replace(/<pre data-kind="(\w+)"([^>]*)>\n([\s\S]*?)\n<\/pre>/g, (_, kind, attrs, code) => {
    const attr = (name) => (new RegExp(`data-${name}="([^"]*)"`).exec(attrs) || [])[1];
    const nums = (v) => (v ? v.split(',').map(Number) : []);
    return frame(unescape(code), {
      kind,
      lang: attr('lang') || 'text',
      title: attr('title'),
      numbered: /data-numbered/.test(attrs),
      bad: nums(attr('bad')),
      ok: nums(attr('ok')),
    });
  });
}

// ---------- ANSI terminal output ----------

const FG = { 30: 'k', 31: 'r', 32: 'g', 33: 'y', 34: 'b', 35: 'm', 36: 'c', 37: 'w', 90: 'k2', 91: 'r2', 92: 'g2', 93: 'y2', 94: 'b2', 95: 'm2', 96: 'c2', 97: 'w2' };
const BG = { 41: 'r', 42: 'g', 43: 'y', 44: 'b', 45: 'm', 46: 'c', 47: 'w', 100: 'k2' };

/** Converts one ANSI colored text to an array of HTML lines. */
function ansiLines(text) {
  const st = { b: false, d: false, fg: '', bg: '' };
  const lines = [];
  for (const raw of text.replace(/\n$/, '').split('\n')) {
    let out = '';
    const re = /\u001b\[([0-9;]*)m/g;
    let last = 0;
    let m;
    const flush = (chunk) => {
      if (!chunk) return;
      const cls = [st.b && 'a-b', st.d && 'a-d', st.fg && `f-${st.fg}`, st.bg && `bg-${st.bg}`].filter(Boolean).join(' ');
      out += cls ? `<span class="${cls}">${esc(chunk)}</span>` : esc(chunk);
    };
    while ((m = re.exec(raw))) {
      flush(raw.slice(last, m.index));
      last = re.lastIndex;
      for (const p of (m[1] || '0').split(';').map(Number)) {
        if (p === 0) Object.assign(st, { b: false, d: false, fg: '', bg: '' });
        else if (p === 1) st.b = true;
        else if (p === 2) st.d = true;
        else if (p === 22) st.b = st.d = false;
        else if (FG[p]) st.fg = FG[p];
        else if (BG[p]) st.bg = BG[p];
        else if (p === 39) st.fg = '';
        else if (p === 49) st.bg = '';
      }
    }
    flush(raw.slice(last));
    lines.push(out);
  }
  return lines;
}

// ---------- Data ----------

const readData = (f) => readFileSync(join(data, f), 'utf8');
const report = JSON.parse(readData('report.json'));
const github = JSON.parse(readData('github.json'));
const version = readData('version.txt').trim();
const progress = JSON.parse(readData('progress.json'));

const runData = {
  version,
  findings: report.findings.length,
  help: ansiLines(readData('help.txt')),
  progress: progress.map(([t, text]) => [t, ansiLines(text)[0]]),
  wide: ansiLines(readData('run-80.ansi')),
  narrow: ansiLines(readData('run-46.ansi')),
};

// ---------- Guides ----------

const guides = readdirSync(join(root, 'site', 'guides'))
  .filter((f) => f.endsWith('.html'))
  .map((f) => {
    const src = readFileSync(join(root, 'site', 'guides', f), 'utf8');
    const m = /^<!--meta\n([\s\S]*?)\n-->\n([\s\S]*)$/.exec(src);
    if (!m) throw new Error(`site/guides/${f}: missing meta comment`);
    return { meta: JSON.parse(m[1]), body: m[2] };
  });
for (const g of GUIDES) if (!guides.find((x) => x.meta.slug === g.slug)) throw new Error(`missing guide source ${g.slug}`);
for (const slug of Object.keys(NOTES)) if (!guides.find((x) => x.meta.slug === slug)) throw new Error(`notes for unknown guide ${slug}`);

// ---------- Pages ----------

const out = {};
const ctx = { report, github, version, frame };

out['index.html'] = page(
  {
    kind: 'home',
    path: '',
    nav: '',
    title: 'breakhound: find bugs in JavaScript libraries automatically',
    description: 'Find bugs in any JavaScript or TypeScript library with one command, no tests needed. Edge cases, time zones, unicode, plus a Vitest test per bug.',
    jsonld: homeJsonLd(),
  },
  homeBody(ctx),
);

for (const g of guides) {
  codeId = 0;
  const rendered = { ...g, body: renderBlocks(g.body) };
  out[`${g.meta.slug}.html`] = page(
    { kind: 'guide', path: `${g.meta.slug}.html`, nav: 'index', ogType: 'article', title: g.meta.title, description: g.meta.description, jsonld: guideJsonLd(g.meta) },
    guideBody(rendered, guides),
  );
}

out['guides.html'] = page(
  {
    kind: 'index',
    path: 'guides.html',
    nav: 'index',
    title: 'breakhound guides: the case index of JavaScript bugs',
    description: 'Guides on finding JavaScript bugs automatically: timezone bugs, surrogate pairs, negative zero, roundtrips, property testing, fuzzing and CI.',
    jsonld: indexJsonLd(guides),
  },
  indexBody(guides),
);

// The 404 page is served at any missing path, so its links are rooted.
const rootLinks = (html) => html.replace(/\b(href|src)="(?![a-z]+:|#|\/)([^"]*)"/g, (_, a, v) => `${a}="/breakhound/${v.replace(/^\.\//, '')}"`);
out['404.html'] = rootLinks(
  page(
    {
      kind: 'notfound',
      path: '404.html',
      noindex: true,
      title: 'Page not found | breakhound',
      description: 'This page could not be found. Sniff lost the trail. Head back to breakhound and find bugs in any JavaScript library automatically.',
    },
    notFoundBody(),
  ),
);

// ---------- Search index ----------

const search = [];
search.push({ kind: 'Page', title: 'Live terminal', sub: 'Run breakhound on the buggy fixture', url: './#terminal' });
search.push({ kind: 'Page', title: 'Case index', sub: 'Every guide and oracle', url: 'guides.html' });
search.push({ kind: 'Page', title: 'Evidence board', sub: 'The merged fixes behind each oracle', url: './#board' });
search.push({ kind: 'Page', title: 'CI job summary', sub: 'GitHub Actions annotations and summary', url: './#ci' });
ORACLES.forEach((o, i) => search.push({ kind: 'Oracle', title: `${o.name} (${o.rule})`, sub: `Case ${String(i + 1).padStart(2, '0')}: ${o.sum}`, url: `./#case-${o.rule}` }));
for (const g of GUIDES) {
  const src = guides.find((x) => x.meta.slug === g.slug);
  search.push({ kind: 'Guide', title: src.meta.h1, sub: src.meta.description, url: `${g.slug}.html` });
  for (const m of src.body.matchAll(/<section id="([^"]+)"><h2>([\s\S]*?)<\/h2>/g)) {
    search.push({ kind: 'Section', title: m[2].replace(/<[^>]+>/g, ''), sub: g.short, url: `${g.slug}.html#${m[1]}` });
  }
  for (const f of src.meta.faq) search.push({ kind: 'Question', title: f.q.replace(/<[^>]+>/g, ''), sub: g.short, url: `${g.slug}.html#faq` });
}
for (const [q] of FAQ) search.push({ kind: 'Question', title: q, sub: 'Home FAQ', url: './#faq' });

// ---------- Sitemap ----------

const urls = ['', 'guides.html', ...GUIDES.map((g) => `${g.slug}.html`)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${UPDATED}</lastmod><changefreq>${u ? 'monthly' : 'weekly'}</changefreq><priority>${u ? (u === 'guides.html' ? '0.9' : '0.8') : '1.0'}</priority></url>`).join('\n')}
</urlset>
`;

// ---------- Write, or check that docs/ is current ----------

const files = {
  ...out,
  'search.json': `${JSON.stringify(search)}\n`,
  'assets/run.json': `${JSON.stringify(runData)}\n`,
  'sitemap.xml': sitemap,
  'robots.txt': `User-agent: *\nAllow: /\nDisallow: /404.html\n\nSitemap: ${SITE}sitemap.xml\n`,
  '.nojekyll': '',
};
for (const theme of ['light', 'dark']) {
  for (const [name, svg] of Object.entries(standalone(theme))) files[`assets/art/${theme}/${name}`] = svg;
}

// House rules for every generated file.
const problems = [];
for (const [name, content] of Object.entries(files)) {
  if (content.includes(String.fromCharCode(0x2013)) || content.includes(String.fromCharCode(0x2014))) problems.push(`${name}: contains an en or em dash`);
  if (/\p{Extended_Pictographic}/u.test(content.replace(/\\u\{1F600\}/g, ''))) problems.push(`${name}: contains an emoji`);
  if (/tailwind/i.test(content)) problems.push(`${name}: names another CSS framework`);
  if (name.endsWith('.html')) {
    // Voodoo reads { expressions } in text, so braces must stay inside code.
    const text = content
      .replace(/<(script|style|pre|code|kbd|samp|textarea|template|noscript)\b[\s\S]*?<\/\1>/g, '')
      .replace(/<[^>]+>/g, '');
    const brace = /.{0,40}[{}].{0,40}/.exec(text);
    if (brace) problems.push(`${name}: braces outside code would be read by Voodoo: ${brace[0]}`);
  }
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

if (check) {
  const stale = Object.entries(files).filter(([name, content]) => !existsSync(join(docs, name)) || readFileSync(join(docs, name), 'utf8') !== content);
  if (stale.length) {
    console.error(`docs/ is out of date, run npm run docs:\n${stale.map(([n]) => `  ${n}`).join('\n')}`);
    process.exit(1);
  }
  console.log('docs/ is up to date');
} else {
  rmSync(join(docs, 'assets', 'art'), { recursive: true, force: true });
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(docs, name, '..'), { recursive: true });
    writeFileSync(join(docs, name), content);
  }
  console.log(`built ${Object.keys(out).length} pages and ${Object.keys(files).length - Object.keys(out).length} other files in docs/`);
}
