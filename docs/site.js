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

// ---------- Motion: reveal on scroll and counting numbers ----------

if (!reduced && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('motion');
  const seen = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        seen.unobserve(e.target);
        for (const dd of $$('[data-count]', e.target)) countUp(dd);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  for (const el of $$('.reveal')) seen.observe(el);
}
function countUp(el) {
  const to = Number(el.dataset.count);
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / 900);
    el.textContent = Math.round(to * (1 - (1 - t) ** 3)).toLocaleString('en-US');
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------- Special dates ----------
// seasons.js (loaded in the head) picks the season and sets data-season on
// <html>. Here: Sniff in costume, the hero accent, the off switch chip and
// one small particle canvas in the hero.

const seasons = window.BreakhoundSeasons;
const season = seasons && seasons.state;
const ICONS_BY_SEASON = {
  newyear: 'firework', carnival: 'mask', easter: 'egg', valentine: 'heart', junina: 'bonfire', halloween: 'pumpkin', christmas: 'snowflake',
};
const SEASON_ICONS = {
  newyear: ['firework', 'star', 'clock'], carnival: ['mask', 'confetti', 'streamer'], easter: ['egg', 'bunny', 'basket'], valentine: ['heart', 'balloon', 'letter'],
  junina: ['bonfire', 'flags', 'hat'], halloween: ['pumpkin', 'bat', 'witch-hat'], christmas: ['snowflake', 'gift', 'tree'],
};
function seasonImg(file, cls, alt = '') {
  return `<img class="${cls} season-light" src="assets/seasons/${file}-light.svg" alt="${alt}" decoding="async"><img class="${cls} season-dark" src="assets/seasons/${file}-dark.svg" alt="" aria-hidden="true" decoding="async">`;
}
let particles = null;
function dress(on) {
  for (const slot of $$('[data-season-slot]')) {
    const kind = slot.dataset.seasonSlot;
    if (slot.dataset.plain === undefined) slot.dataset.plain = slot.innerHTML;
    if (!on) {
      slot.innerHTML = slot.dataset.plain;
      continue;
    }
    if (kind === 'sniff') slot.innerHTML = seasonImg(`${season.id}/sniff`, 'season-sniff', `Sniff, the breakhound mascot, dressed for ${season.name}`);
    if (kind === 'accent') slot.innerHTML = seasonImg(`${season.id}/accent`, 'season-accent-img');
    if (kind === 'icons') slot.innerHTML = SEASON_ICONS[season.id].map((n) => `<img src="assets/seasons/${season.id}/icon-${n}-dark.svg" alt="" width="20" height="20">`).join('');
  }
  if (on && !reduced) particles = particles || startParticles(season.id);
  if (particles) particles.toggle(on && !reduced);
}
function chip() {
  const el = document.createElement('div');
  el.className = 'season-chip';
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', `${season.name} mode`);
  const icon = `assets/seasons/${season.id}/icon-${ICONS_BY_SEASON[season.id]}`;
  el.innerHTML = `<span class="season-chip-ic" aria-hidden="true"><img class="season-light" src="${icon}-light.svg" alt="" width="18" height="18"><img class="season-dark" src="${icon}-dark.svg" alt="" width="18" height="18"></span><span class="season-chip-label">${season.name} mode</span><button type="button" class="season-switch" role="switch" aria-checked="${season.on}" aria-label="${season.name} mode"><span></span></button>`;
  const btn = el.querySelector('button');
  btn.addEventListener('click', () => {
    seasons.set(!season.on);
    btn.setAttribute('aria-checked', String(season.on));
    el.classList.toggle('is-off', !season.on);
    dress(season.on);
  });
  el.classList.toggle('is-off', !season.on);
  document.body.append(el);
}

/** One canvas in the hero, a few dozen particles, paused when hidden or off screen. */
function startParticles(id) {
  const host = $('.hero-band') || $('.nf');
  if (!host) return null;
  const canvas = document.createElement('canvas');
  canvas.className = 'season-fx';
  canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);
  const ctx = canvas.getContext('2d');
  const style = getComputedStyle(document.documentElement);
  const colors = ['--season-a', '--season-b', '--season-c'].map((v) => style.getPropertyValue(v).trim() || '#e8a33d');
  let w = 0;
  let h = 0;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const resize = () => {
    w = host.clientWidth;
    h = host.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  new ResizeObserver(resize).observe(host);
  const rand = (a, b) => a + Math.random() * (b - a);
  const count = Math.round(Math.min(34, Math.max(14, w / 45)));
  const up = id === 'junina';
  const make = (first) => {
    const p = makeOne(first);
    if (id === 'halloween' && Math.random() < 0.22) Object.assign(p, { bat: true, x: first ? rand(0, w) : -20, y: rand(h * 0.05, h * 0.5), vx: rand(0.6, 1.2), vy: rand(-0.08, 0.08), r: rand(6, 9) });
    return p;
  };
  const makeOne = (first) => ({
    x: rand(0, w),
    y: first ? rand(0, h) : up ? h + 10 : -12,
    vx: rand(-0.25, 0.25),
    vy: up ? rand(-0.9, -0.4) : rand(0.35, 0.9),
    r: rand(2, id === 'christmas' ? 3.4 : 5),
    a: rand(0, Math.PI * 2),
    va: rand(-0.04, 0.04),
    c: colors[Math.floor(rand(0, colors.length))],
    life: 1,
  });
  let list = Array.from({ length: count }, () => make(true));
  let bursts = [];
  let raf = 0;
  let running = false;
  let visible = true;
  let last = 0;
  function draw(t) {
    raf = requestAnimationFrame(draw);
    const dt = Math.min(3, (t - (last || t)) / 16.7);
    last = t;
    ctx.clearRect(0, 0, w, h);
    if (id === 'newyear') {
      if (bursts.length < 3 && Math.random() < 0.02 * dt) {
        bursts.push({ x: rand(w * 0.1, w * 0.9), y: rand(h * 0.08, h * 0.4), c: colors[Math.floor(rand(0, 2))], t: 0, n: 18 });
      }
      bursts = bursts.filter((b) => b.t < 1);
      for (const b of bursts) {
        b.t += 0.012 * dt;
        const r = 70 * (1 - (1 - b.t) ** 2);
        ctx.globalAlpha = Math.max(0, 0.7 * (1 - b.t));
        ctx.fillStyle = b.c;
        for (let i = 0; i < b.n; i++) {
          const a = (i / b.n) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r + b.t * 14, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      return;
    }
    for (const p of list) {
      p.x += (p.vx + Math.sin(p.a) * 0.3) * dt;
      p.y += p.vy * dt;
      p.a += p.va * dt;
      if (up) p.life -= 0.004 * dt;
      if (p.y > h + 14 || p.y < -14 || p.x > w + 30 || p.life <= 0) Object.assign(p, make(false));
      if (p.bat) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = colors[1];
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(p.r / 10, (p.r / 10) * (0.55 + 0.45 * Math.abs(Math.sin(t / 110 + p.a))));
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-4, -6, -12, -6, -18, -2);
        ctx.quadraticCurveTo(-12, 0, -12, 5);
        ctx.quadraticCurveTo(-6, 2, -3, 5);
        ctx.lineTo(0, 2);
        ctx.lineTo(3, 5);
        ctx.quadraticCurveTo(6, 2, 12, 5);
        ctx.quadraticCurveTo(12, 0, 18, -2);
        ctx.bezierCurveTo(12, -6, 4, -6, 0, 0);
        ctx.fill();
        ctx.restore();
        continue;
      }
      ctx.globalAlpha = up ? Math.max(0, p.life) * 0.8 : 0.55;
      ctx.fillStyle = p.c;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      ctx.beginPath();
      if (id === 'carnival') ctx.rect(-p.r, -p.r / 2.4, p.r * 2, p.r / 1.2);
      else if (id === 'christmas' || up) ctx.arc(0, 0, p.r * (up ? 0.5 : 0.7), 0, Math.PI * 2);
      else ctx.ellipse(0, 0, p.r, p.r / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  const sync = () => {
    const should = running && visible && !document.hidden;
    if (should && !raf) {
      last = 0;
      raf = requestAnimationFrame(draw);
    } else if (!should && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
  document.addEventListener('visibilitychange', sync);
  new IntersectionObserver((e) => {
    visible = e[0].isIntersecting;
    sync();
  }).observe(host);
  return {
    toggle(on) {
      running = on;
      canvas.hidden = !on;
      if (!on) ctx.clearRect(0, 0, w, h);
      else list = Array.from({ length: count }, () => make(true));
      sync();
    },
  };
}
if (season && season.id) {
  chip();
  dress(season.on);
}

setTimeout(loadSearch, 2500);
V.start();
