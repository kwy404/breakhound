// Interactive parts of the breakhound site, built with Voodoo.js
// (https://kwy404.github.io/Voodoo.js/). Voodoo is loaded with data-manual:
// this module publishes reactive stores and helpers on V.config.globals, then
// calls V.start(). Pages declare behavior in HTML (v-data, @click, v-model,
// v-show, v-tabs, v-copy-from, v-theme-toggle, v-hotkey). Plain JavaScript is
// used where Voodoo cannot help: streaming the recorded terminal session line
// by line and fetching the search index.

const V = window.V;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const S = V.reactive({ ready: 0 });
const T = V.reactive({ cmd: '', state: 'idle', phase: '', announce: '' });

// ---------- Search (Ctrl K) ----------

let index = [];
let loading = null;
function loadSearch() {
  if (!loading) {
    loading = fetch('search.json')
      .then((r) => r.json())
      .then((j) => {
        index = j.map((e) => ({ ...e, hay: `${e.title} ${e.sub} ${e.kind}`.toLowerCase() }));
        S.ready++;
      })
      .catch(() => {
        loading = null;
      });
  }
  return loading;
}
function hits(q) {
  const query = String(q || '').trim().toLowerCase();
  if (!query) return index.filter((e) => e.kind === 'Page' || e.kind === 'Guide').slice(0, 8);
  const words = query.split(/\s+/);
  return index
    .map((e) => {
      if (!words.every((w) => e.hay.includes(w))) return null;
      const t = e.title.toLowerCase();
      const score = (t.startsWith(query) ? 4 : t.includes(query) ? 2 : 0) + (e.kind === 'Guide' || e.kind === 'Oracle' ? 1 : 0);
      return { e, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map((x) => x.e);
}
const dialog = $('#search');
function openSearch() {
  if (!dialog) return;
  loadSearch();
  if (!dialog.open) dialog.showModal();
  requestAnimationFrame(() => $('#search-input')?.focus());
}
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-search-open]')) openSearch();
  // Same page anchors from the dialog: close it so the target is visible.
  if (dialog?.open && e.target.closest('#search a[href]')) dialog.close();
});
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !e.target.closest('input, textarea, [contenteditable]')) {
    e.preventDefault();
    openSearch();
  }
});

// ---------- Evidence board ----------

const boardEl = $('.board[data-rel]');
const rel = boardEl ? JSON.parse(boardEl.dataset.rel) : {};

// ---------- Case index ----------

const ixData = $('#ix-data') ? JSON.parse($('#ix-data').textContent) : [];
function cardMatch(i, q, kind, topic) {
  const c = ixData[i];
  if (!c) return false;
  if (kind !== 'all' && c.kind !== kind) return false;
  if (topic !== 'all' && c.topic !== topic) return false;
  const words = String(q || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  return words.every((w) => c.text.includes(w));
}

Object.assign(V.config.globals, {
  S,
  T,
  hits: (q) => hits(q),
  go(q, sel) {
    const r = hits(q)[sel];
    if (!r) return;
    dialog?.close();
    location.href = r.url;
  },
  linked: (a, b) => a === b || Boolean(rel[a] && rel[a].includes(b)),
  cardMatch,
  cardCount: (q, kind, topic) => ixData.filter((_, i) => cardMatch(i, q, kind, topic)).length,
});

// ---------- Terminal ----------

const term = $('[data-term]');
const out = term && $('[data-term-out] code', term);
const body = term && $('[data-term-body]', term);
const input = term && $('#term-cmd');
let run = null;
let skip = false;
const history = [];
let hpos = 0;
const welcome = out ? out.innerHTML : '';

function loadRun() {
  if (!run) run = fetch('assets/run.json').then((r) => r.json());
  return run;
}
function atBottom() {
  return body.scrollHeight - body.scrollTop - body.clientHeight < 40;
}
function print(html, cls = '') {
  const stick = atBottom();
  const line = document.createElement('span');
  line.className = cls ? `ln ${cls}` : 'ln';
  line.innerHTML = html;
  out.append(line, '\n');
  if (stick) body.scrollTop = body.scrollHeight;
  return line;
}
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function echo(cmd) {
  print(`<span class="f-g">~/cases</span> <span class="a-d">$</span> ${escapeHtml(cmd)}`, 'cmd');
}
/** Which recorded width fits: the 80 column run, or the 46 column one on phones. */
function fitsWide() {
  const probe = document.createElement('span');
  probe.textContent = '0'.repeat(10);
  probe.style.visibility = 'hidden';
  out.append(probe);
  const ch = probe.getBoundingClientRect().width / 10;
  probe.remove();
  return body.clientWidth - 24 >= ch * 81;
}

async function hunt() {
  T.state = 'running';
  T.announce = 'Running breakhound on buggy-lib';
  skip = reduced;
  const data = await loadRun();
  // The live progress line, replayed at its recorded pace.
  const bar = print('', 'progress');
  let prev = 0;
  for (const [t, html] of data.progress) {
    if (!skip) await sleep(Math.min(240, t - prev));
    prev = t;
    bar.innerHTML = html;
    T.phase = (/(resolving|reading types|hunting|shrinking|confirming|[a-z ]+?) \[/.exec(bar.textContent) || [])[1] || 'hunting';
  }
  bar.remove();
  // The report, streamed line by line.
  const lines = fitsWide() ? data.wide : data.narrow;
  T.phase = 'writing report';
  for (let i = 0; i < lines.length; i++) {
    print(lines[i]);
    if (!skip && i % 2 === 1) await sleep(lines[i].includes('╭') ? 70 : 12);
  }
  T.state = 'done';
  T.phase = '';
  T.announce = `Run finished: ${data.findings} findings, each with a reproduction and a Vitest test.`;
}

async function exec(raw) {
  const cmd = raw.trim().replace(/\s+/g, ' ');
  if (T.state === 'running') return;
  T.cmd = '';
  if (cmd) {
    history.push(cmd);
    hpos = history.length;
  }
  echo(cmd);
  if (!cmd) return;
  const words = cmd.split(' ');
  const tool = words[0] === 'npx' ? words.slice(1) : words;
  if (cmd === 'clear') {
    out.innerHTML = '';
    T.state = 'idle';
    return;
  }
  if (cmd === 'ls' || cmd === 'ls -la') {
    print('<span class="f-b a-b">buggy-lib/</span>  <span class="a-d">README.md</span>');
    return;
  }
  if (cmd === 'help') {
    print('<span class="a-d">Commands: npx breakhound ./buggy-lib, npx breakhound --help, npx breakhound --version, ls, clear</span>');
    return;
  }
  if (tool[0] !== 'breakhound') {
    print(`<span class="f-r">command not found: ${escapeHtml(words[0])}</span>`);
    print('<span class="a-d">Try: npx breakhound ./buggy-lib</span>');
    return;
  }
  const args = tool.slice(1);
  const data = await loadRun();
  if (args.includes('-h') || args.includes('--help') || !args.length) {
    for (const l of data.help) print(l);
    return;
  }
  if (args.includes('-V') || args.includes('--version')) {
    print(escapeHtml(data.version));
    return;
  }
  const target = args.find((a) => !a.startsWith('-')) || '';
  if (!/^(\.\/)?(test\/fixtures\/)?buggy-lib\/?$/.test(target)) {
    print(`<span class="a-d">Only the buggy-lib fixture is recorded on this page. On your machine,</span>`);
    print(`<span class="a-d">npx breakhound ${escapeHtml(target || './my-lib')} runs the same hunt on that package.</span>`);
    return;
  }
  await hunt();
}

/** Types a command into the prompt, then runs it. */
async function typeAndRun(cmd) {
  if (!term || T.state === 'running') return;
  term.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  if (!reduced) {
    T.cmd = '';
    for (const ch of cmd) {
      T.cmd += ch;
      await sleep(18);
    }
    await sleep(120);
  }
  exec(cmd);
}

if (term) {
  $('[data-term-form]', term).addEventListener('submit', (e) => {
    e.preventDefault();
    exec(input.value);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' && history.length) {
      hpos = Math.max(0, hpos - 1);
      T.cmd = history[hpos];
      e.preventDefault();
    } else if (e.key === 'ArrowDown' && history.length) {
      hpos = Math.min(history.length, hpos + 1);
      T.cmd = history[hpos] || '';
      e.preventDefault();
    } else if (e.key === 'Tab' && !input.value) {
      T.cmd = input.placeholder;
      e.preventDefault();
    } else if (e.key === 'l' && e.ctrlKey) {
      out.innerHTML = '';
      e.preventDefault();
    }
  });
  body.addEventListener('click', (e) => {
    if (!getSelection().toString() && !e.target.closest('a, button')) input.focus({ preventScroll: true });
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-term-run], [data-term-cmd], [data-term-skip], [data-term-clear]');
    if (!b) return;
    if (b.matches('[data-term-skip]')) skip = true;
    else if (b.matches('[data-term-clear]')) {
      out.innerHTML = welcome;
      T.state = 'idle';
    } else typeAndRun(b.dataset.termCmd || 'npx breakhound ./buggy-lib');
  });
  // Fetch the recording when the browser is idle, so Run starts at once.
  setTimeout(loadRun, 1500);
}

setTimeout(loadSearch, 2500);
V.start();
