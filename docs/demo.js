// The paste and see demo on the home page. The two editors hold an old and a
// new version of one function; every edit reruns the comparison in a worker
// (demo-worker.js) on the edge case pools in assets/edge-values.json, which
// the site build takes from the breakhound library itself.

const root = document.querySelector('[data-demo]');
if (root) {
  const $ = (s) => root.querySelector(s);
  const oldEd = $('#demo-old');
  const newEd = $('#demo-new');
  const out = $('[data-demo-out]');
  const panel = $('.demo-out');
  const status = $('[data-demo-status]');
  const presets = JSON.parse($('#demo-presets').textContent);
  const live = document.createElement('p');
  live.className = 'sr-only';
  live.setAttribute('aria-live', 'polite');
  root.append(live);

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
  let pools = null;
  let worker = null;
  let timer = 0;
  let stopTimer = 0;
  let lastCall = '';
  let runId = 0;

  const CLOSED = {
    halloween: 'Not a single ghost in the output.',
    christmas: 'Nothing naughty on the list.',
    newyear: 'A clean start for the new year.',
    carnival: 'No masks, no surprises.',
    easter: 'No hidden eggs in this one.',
    valentine: 'A perfect match.',
    junina: 'Nothing caught fire.',
  };

  function setState(state, text) {
    panel.dataset.demoState = state;
    status.textContent = text;
  }

  function loadPools() {
    if (!pools) pools = fetch('assets/edge-values.json').then((r) => r.json());
    return pools;
  }

  function stop() {
    clearTimeout(stopTimer);
    if (worker) worker.terminate();
    worker = null;
  }

  function errorView(which, message) {
    const where = which === 'old' ? 'the old version' : 'the new version';
    return `<div class="dr-wait"><p class="dr-wait-title">Waiting for valid JavaScript in ${where}</p><p><code>${esc(message)}</code></p><p class="t-dim">The demo runs plain JavaScript. Types are fine on the parameters and the return value, not inside the body.</p></div>`;
  }

  function row(kind, label, c, i) {
    return `<li class="dr-row" style="--i:${i}"><span class="dr-kind dr-${kind}">${label}</span><code class="dr-call">${esc(c.call)}</code><span class="dr-cmp"><span class="dr-side"><b>old</b><code>${esc(c.before)}</code></span><span class="dr-side dr-new"><b>new</b><code>${esc(c.after)}</code></span></span></li>`;
  }

  function doneView(r) {
    const total = r.counts.throws + r.counts.differs + r.counts.accepts;
    const newBugs = r.bugs.filter((b) => b.inOld !== true);
    const parts = [];
    let i = 0;
    if (r.compared) {
      const head = total
        ? `<strong>${plural(total, 'input')} ${total === 1 ? 'gives' : 'give'} a different answer</strong> in ${plural(r.calls, 'call')}.`
        : `<strong>Same answers for all ${plural(r.inputs, 'input')}.</strong> ${CLOSED[document.documentElement.dataset.season] || 'Case closed.'}`;
      const bugLine = newBugs.length ? ` ${plural(newBugs.length, 'bug')} ${newBugs.length === 1 ? 'is' : 'are'} new in this version.` : '';
      parts.push(`<div class="dr-sum"><span class="stamp ${total ? 'stamp-high' : 'stamp-ok'}">${total ? 'breaking' : 'clean'}</span><p>${head}${bugLine}</p></div>`);
      if (total) {
        parts.push('<h3 class="dr-h">Breaking changes</h3><ul class="dr-list">');
        const groups = [
          ['throws', 'Now throws'],
          ['differs', 'New answer'],
          ['accepts', 'Now accepts'],
        ];
        for (const [kind, label] of groups) for (const c of r.changes[kind]) parts.push(row(kind, label, c, i++));
        parts.push('</ul>');
        const shown = r.changes.throws.length + r.changes.differs.length + r.changes.accepts.length;
        if (total > shown) parts.push(`<p class="dr-more">and ${plural(total - shown, 'more input')} with a different answer</p>`);
      }
    } else {
      parts.push(
        `<div class="dr-sum"><span class="stamp ${r.bugs.length ? 'stamp-high' : 'stamp-ok'}">${r.bugs.length ? 'bugs' : 'clean'}</span><p>${
          r.bugs.length ? `<strong>${plural(r.bugs.length, 'bug')} found</strong> in ${plural(r.calls, 'call')}.` : `<strong>No bugs found in ${plural(r.calls, 'call')}.</strong> ${CLOSED[document.documentElement.dataset.season] || 'Case closed.'}`
        } Paste an older version on the left to see what changed.</p></div>`,
      );
    }
    if (r.bugs.length) {
      parts.push(`<h3 class="dr-h">Bugs in ${r.compared ? 'the new version' : esc(r.name)}</h3><ul class="dr-list">`);
      for (const b of r.bugs) {
        const tag = b.inOld === null ? '' : b.inOld ? '<span class="dr-tag">also in the old one</span>' : '<span class="dr-tag dr-tag-new">new in this version</span>';
        parts.push(
          `<li class="dr-row dr-bug" style="--i:${i++}"><span class="dr-kind dr-bugk">${esc(b.title)}</span>${tag}<code class="dr-call">${esc(b.call)}</code><span class="dr-cmp"><span class="dr-side dr-new"><b>gives</b><code>${esc(b.result)}</code></span></span><span class="dr-why">${esc(b.why)}${b.count > 1 ? `, ${plural(b.count - 1, 'more input')} too` : ''}.</span></li>`,
        );
      }
      parts.push('</ul>');
    }
    return parts.join('');
  }

  async function run() {
    const id = ++runId;
    stop();
    if (!newEd.value.trim()) {
      setState('idle', 'ready');
      out.innerHTML = '<div class="dr-wait"><p class="dr-wait-title">Paste a function in the new version</p><p class="t-dim">Leave the old version empty to hunt for bugs in one function, or fill both to see what changed.</p></div>';
      return;
    }
    setState('running', 'sniffing');
    const data = await loadPools();
    if (id !== runId) return;
    const started = performance.now();
    worker = new Worker('demo-worker.js');
    worker.onmessage = (e) => {
      const m = e.data;
      if (id !== runId) return;
      if (m.type === 'progress') lastCall = m.current;
      else if (m.type === 'start') status.textContent = `${m.total} inputs`;
      else if (m.type === 'error') {
        stop();
        setState('error', 'waiting');
        out.innerHTML = errorView(m.which, m.message);
      } else if (m.type === 'done') {
        stop();
        // Let the trail animation finish one stride, so the result does not flash.
        const wait = Math.max(0, 280 - (performance.now() - started));
        setTimeout(() => {
          if (id !== runId) return;
          setState('done', `${m.calls} calls`);
          out.innerHTML = doneView(m);
          out.scrollTop = 0;
          live.textContent = out.querySelector('.dr-sum p')?.textContent || '';
        }, wait);
      }
    };
    worker.onerror = (e) => {
      e.preventDefault();
      stop();
      setState('error', 'waiting');
      out.innerHTML = errorView('new', e.message || 'the code could not run');
    };
    worker.postMessage({ oldCode: oldEd.value, newCode: newEd.value, pools: data });
    stopTimer = setTimeout(() => {
      if (id !== runId) return;
      stop();
      setState('error', 'stopped');
      out.innerHTML = `<div class="dr-wait"><p class="dr-wait-title">Sniff stopped after 4 seconds</p><p>A call did not return, so the function may loop forever${lastCall ? ` near <code>${esc(lastCall)}</code>` : ''}.</p><p class="t-dim">On your machine the CLI runs every call in a child process with a timeout and reports hangs as findings.</p></div>`;
    }, 4000);
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(run, 450);
  }

  for (const ed of [oldEd, newEd]) ed.addEventListener('input', () => {
    for (const b of root.querySelectorAll('[data-preset]')) b.setAttribute('aria-pressed', 'false');
    schedule();
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-preset]');
    if (!b) return;
    const p = presets.find((x) => x.id === b.dataset.preset);
    if (!p) return;
    for (const x of root.querySelectorAll('[data-preset]')) x.setAttribute('aria-pressed', String(x === b));
    oldEd.value = p.old;
    newEd.value = p.new;
    if (p.id === 'blank') {
      newEd.focus();
      newEd.select();
    }
    run();
  });

  // First result without a click: run once the page is idle.
  (window.requestIdleCallback || ((f) => setTimeout(f, 200)))(run, { timeout: 1200 });
}
