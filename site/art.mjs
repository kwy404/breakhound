// The breakhound noir icon and illustration set. Line art drawn on a 24 px grid
// for icons and on larger canvases for illustrations. Strokes use currentColor,
// accents use the --ev (evidence amber) custom property and paper fills use
// --paper, so one source renders correctly in light and dark themes when it
// is inlined. Static light and dark files are exported by build-docs.mjs.

const EV = 'style="stroke:var(--ev,#e8a33d)"';
const EVF = 'style="fill:var(--ev,#e8a33d);stroke:none"';
const PAPER = 'style="fill:var(--paper,#f6ecd2)"';
const STROKE = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';

/** 24 by 24 icons, stroked. Key is the symbol id without the i- prefix. */
export const ICONS = {
  magnifier: `<circle cx="10" cy="10" r="6.25"/><path d="M14.6 14.6 20.5 20.5"/><path d="M7.2 8.4a3.2 3.2 0 0 1 2.6-2.3" ${EV}/>`,
  paw: `<g fill="currentColor" stroke="none"><path d="M8.4 16c0-2.3 1.7-4 3.6-4s3.6 1.7 3.6 4c0 1.7-1.2 2.6-2.4 2.6-.6 0-.9-.4-1.2-.4s-.6.4-1.2.4c-1.2 0-2.4-.9-2.4-2.6Z"/><ellipse cx="6.6" cy="11" rx="1.3" ry="1.8" transform="rotate(-20 6.6 11)"/><ellipse cx="9.8" cy="7.6" rx="1.3" ry="1.9"/><ellipse cx="14.2" cy="7.6" rx="1.3" ry="1.9"/><ellipse cx="17.4" cy="11" rx="1.3" ry="1.8" transform="rotate(20 17.4 11)"/></g>`,
  folder: `<path d="M3 7V18a1.5 1.5 0 0 0 1.5 1.5h15A1.5 1.5 0 0 0 21 18V9.5A1.5 1.5 0 0 0 19.5 8H11.2L9.4 5.5H4.5A1.5 1.5 0 0 0 3 7Z"/><path d="M7 12.5h6M7 15.5h3.5" ${EV}/>`,
  tag: `<path d="M8.5 5H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8.5L4 15V9Z"/><circle cx="8" cy="12" r="1.3"/><path d="M6.8 12.4C4.2 13 2.4 10.8 3 7.5" ${EV}/><path d="M12 10h5.5M12 14h3.5"/>`,
  pin: `<path d="M9 3.5h6l-1 4.5 3 3H7l3-3Z" ${EV}/><path d="M12 11v9.5"/>`,
  terminal: `<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="m7 10 3 2.5L7 15"/><path d="M12.5 15.5H17" ${EV}/>`,
  play: `<path d="M8 5.5v13l10.5-6.5Z"/>`,
  replay: `<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4.2h4.2"/>`,
  skip: `<path d="M5 6v12l8.5-6Z"/><path d="M18 6v12"/>`,
  copy: `<rect x="9" y="9" width="11.5" height="11.5" rx="2"/><path d="M5.5 15H5a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 5 3.5h8.5A1.5 1.5 0 0 1 15 5v.5"/>`,
  check: `<path d="m5 12.5 4.5 4.5L19 7.5"/>`,
  arrow: `<path d="M5 12h14M13 6l6 6-6 6"/>`,
  search: `<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/>`,
  sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>`,
  moon: `<path d="M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a6.6 6.6 0 0 0 9.7 9.7Z"/>`,
  system: `<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8.5 20h7M12 16.5V20"/>`,
  menu: `<path d="M4 7h16M4 12h16M4 17h16"/>`,
  close: `<path d="M6 6l12 12M18 6 6 18"/>`,
  book: `<path d="M4 18.5V5.5A2 2 0 0 1 6 3.5h13.5v14H6a2 2 0 0 0-2 2 2 2 0 0 0 2 2h13.5"/><path d="M8 8h7.5" ${EV}/>`,
  filter: `<path d="M4 5h16l-6.2 7.4V18l-3.6 2v-7.6Z"/>`,
  external: `<path d="M14 4h6v6M20 4l-8.5 8.5"/><path d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>`,
  // Oracles.
  'lone-surrogate-output': `<path d="M10.6 4.1A8 8 0 0 0 10.6 19.9L12 17l-1.4-2.6 1.4-2.4-1.4-2.6L12 7Z"/><path d="M13.6 4.6a8 8 0 0 1 0 15.3" /><path d="M13.6 4.6 15 7.4l-1.4 2.4 1.4 2.6-1.4 2.4 1.4 2.6-1.4 2.5" ${EV}/><path d="M7.4 10v.01M17 10v.01M6.8 14.5c.8 1 1.9 1.6 3 1.7M14.4 16.3c1.2-.2 2.2-.8 2.9-1.8"/>`,
  'timezone-dependent': `<circle cx="10.5" cy="11" r="7.5"/><path d="M3 11h15M10.5 3.5c2.2 2.1 3.2 4.7 3.2 7.5M10.5 3.5C8.3 5.6 7.3 8.2 7.3 11s1 5.4 3.2 7.5"/><circle cx="17.5" cy="17.5" r="4" ${PAPER}/><path d="M17.5 15.6v2l1.3 1" ${EV}/>`,
  'unexpected-crash': `<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M12.8 4.5 10.6 9.8l3 2-2.4 7.7" ${EV}/><path d="M6.5 8.5h1.5M6.5 11.5h1M16.5 14.5h1.5"/>`,
  'nan-leak': `<path d="M9.5 3.5h5M10.5 3.5V9L5.6 17.6A1.6 1.6 0 0 0 7 20h10a1.6 1.6 0 0 0 1.4-2.4L13.5 9V3.5"/><path d="M7.8 14h8.4"/><path d="M19.5 3.8c1 1.4 1.7 2.4 1.7 3.3a1.7 1.7 0 0 1-3.4 0c0-.9.7-1.9 1.7-3.3Z" ${EV}/>`,
  roundtrip: `<path d="M19.6 10A7.8 7.8 0 0 0 6 6.3"/><path d="M5.5 3v3.8h3.8"/><path d="M4.4 14A7.8 7.8 0 0 0 18 17.7"/><path d="M18.5 21v-3.8h-3.8"/><path d="M20.4 12.6 21.6 14M2.4 9.8 3.6 11.2" ${EV}/>`,
  'not-idempotent': `<path d="M10 3.5h4v4.5h-4Z"/><path d="M8 8h8l1 3H7Z"/><path d="M5.5 11h13v2.5h-13Z"/><path d="M5.5 17h13"/><path d="M7.5 20.5h13" ${EV}/>`,
  'negative-zero-sign': `<ellipse cx="15.5" cy="12" rx="4.5" ry="7"/><path d="M12.4 17.2 18.6 6.8"/><path d="M2.8 12h6" stroke-dasharray="2 2.2" ${EV}/>`,
  nondeterministic: `<rect x="2.8" y="8.2" width="11" height="11" rx="2"/><path d="M14.3 5.5 19.6 4a1.6 1.6 0 0 1 2 1.1l1.2 4.6a1.6 1.6 0 0 1-1.1 2l-4.2 1.1" ${EV}/><path d="M6 11.4h.01M10.6 16h.01M8.3 13.7h.01M18.6 7.4h.01"/>`,
  // How it works.
  types: `<path d="M6 3.5h8.5L19 8v12.5H6Z"/><path d="M14.5 3.5V8H19"/><path d="M10.5 11.5c-1 0-1.2.6-1.2 1.3s-.6 1.2-1.1 1.2c.5 0 1.1.4 1.1 1.2s.2 1.3 1.2 1.3M14.5 11.5c1 0 1.2.6 1.2 1.3s.6 1.2 1.1 1.2c-.5 0-1.1.4-1.1 1.2s-.2 1.3-1.2 1.3" ${EV}/>`,
  inputs: `<path d="M5 7h14l-1.2 13.5H6.2Z"/><path d="M4 7h16M6.5 4.5h11L19 7H5Z"/><rect x="8.5" y="11" width="7" height="5" rx="1" ${EV}/>`,
  isolation: `<path d="M12 2.5v4"/><path d="M7 13.5 9 6.5h6l2 7Z"/><path d="M5 17.5l-1.5 1.5M12 17v3M19 17.5l1.5 1.5M8.4 16.2l-.8 1.2M15.6 16.2l.8 1.2" ${EV}/>`,
  report: `<path d="M6 3.5h12v17H6Z"/><path d="M9 7.5h6M9 10.5h6M9 13.5h2.5"/><circle cx="15" cy="16.5" r="2.5" ${EV}/>`,
  ci: `<circle cx="5.5" cy="6" r="2.5"/><circle cx="5.5" cy="18" r="2.5"/><circle cx="18.5" cy="12" r="2.5" ${EV}/><path d="M5.5 8.5v7M8 6c4 0 4.5 6 8 6M8 18c4 0 4.5-6 8-6"/>`,
  github: `<path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>`,
  linkedin: `<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M7.5 10.5v6M7.5 7.5v.01M11.5 16.5v-6M11.5 13c0-1.6 1-2.6 2.5-2.6s2.5 1 2.5 2.6v3.5"/>`,
  npm: `<rect x="3" y="7" width="18" height="10" rx="1"/><path d="M6.5 14.5v-5h3v5M9.5 11v3.5M12 14.5v-5h3v3.5h-3M16.5 14.5v-5h2.5"/>`,
};

/** Larger noir illustrations. Coordinates are in the given viewBox. */
export const ILLUSTRATIONS = {
  // A trail of paw prints walking to the right, used as a section divider.
  'paw-trail': {
    viewBox: '0 0 640 80',
    body: (() => {
      const prints = [];
      for (let i = 0; i < 9; i++) {
        const x = 30 + i * 70;
        const y = i % 2 ? 54 : 26;
        const o = (0.25 + (i / 8) * 0.75).toFixed(2);
        const fill = i === 8 ? EVF : 'fill="currentColor" stroke="none"';
        prints.push(
          `<g transform="translate(${x} ${y}) rotate(90) scale(1.6)" opacity="${o}"><path ${fill} d="M-4.2 3.6c0-2.6 1.9-4.6 4.2-4.6s4.2 2 4.2 4.6c0 2-1.4 3-2.8 3-.7 0-1-.4-1.4-.4s-.7.4-1.4.4c-1.4 0-2.8-1-2.8-3Z"/><ellipse ${fill} cx="-6.2" cy="-2.4" rx="1.5" ry="2.1"/><ellipse ${fill} cx="-2.4" cy="-6" rx="1.5" ry="2.2"/><ellipse ${fill} cx="2.4" cy="-6" rx="1.5" ry="2.2"/><ellipse ${fill} cx="6.2" cy="-2.4" rx="1.5" ry="2.1"/></g>`,
        );
      }
      return prints.join('');
    })(),
  },
  // A stack of manila case folders tied with string.
  folders: {
    viewBox: '0 0 240 170',
    body: `<g stroke-width="2.2">
<path d="M46 40h52l10 12h86a8 8 0 0 1 8 8v82a8 8 0 0 1-8 8H46a8 8 0 0 1-8-8V48a8 8 0 0 1 8-8Z" ${PAPER} transform="rotate(-6 120 95)"/>
<path d="M40 52h52l10 12h92a8 8 0 0 1 8 8v78a8 8 0 0 1-8 8H40a8 8 0 0 1-8-8V60a8 8 0 0 1 8-8Z" ${PAPER} transform="rotate(3 120 105)"/>
<path d="M30 64h56l10 12h104a8 8 0 0 1 8 8v70a8 8 0 0 1-8 8H30a8 8 0 0 1-8-8V72a8 8 0 0 1 8-8Z" ${PAPER}/>
<path d="M22 84h186"/>
<rect x="44" y="96" width="78" height="22" rx="2"/>
<path d="M52 107h44" ${EV}/>
<circle cx="168" cy="122" r="9"/><circle cx="168" cy="122" r="3" ${EVF}/>
<path d="M168 131c-6 10-20 14-34 10M177 122c14 4 22 14 18 26" ${EV}/>
<path d="M150 98l16 4-3 6-16-4Z" ${EV} transform="rotate(-8 158 103)"/>
</g>`,
  },
  // A cork board with pinned cards and string.
  board: {
    viewBox: '0 0 240 170',
    body: `<g stroke-width="2.2">
<rect x="14" y="14" width="212" height="142" rx="6"/>
<rect x="22" y="22" width="196" height="126" rx="3" stroke-dasharray="1 7"/>
<rect x="36" y="36" width="56" height="40" rx="2" ${PAPER} transform="rotate(-4 64 56)"/>
<rect x="150" y="32" width="54" height="42" rx="2" ${PAPER} transform="rotate(5 177 53)"/>
<rect x="92" y="96" width="62" height="44" rx="2" ${PAPER} transform="rotate(-2 123 118)"/>
<path d="M48 50h28M48 58h18M162 48h28M162 56h20M104 112h36M104 120h24"/>
<path d="M64 38 123 98 177 34M64 38 177 34" ${EV}/>
<circle cx="64" cy="38" r="4.5" ${EVF}/><circle cx="177" cy="34" r="4.5" ${EVF}/><circle cx="123" cy="98" r="4.5" ${EVF}/>
</g>`,
  },
  // A big magnifier over a paw print, for empty states and the 404 page.
  lens: {
    viewBox: '0 0 200 200',
    body: `<g stroke-width="3">
<circle cx="84" cy="84" r="54" ${PAPER}/>
<circle cx="84" cy="84" r="44" stroke-dasharray="2 9"/>
<path d="M124 124 176 176" stroke-width="12"/>
<path d="M124 124 136 136" stroke-width="16"/>
<path d="M56 70a32 32 0 0 1 24-22" ${EV}/>
<g transform="translate(86 92) scale(2.4)" fill="currentColor" stroke="none"><path d="M-4.2 3.6c0-2.6 1.9-4.6 4.2-4.6s4.2 2 4.2 4.6c0 2-1.4 3-2.8 3-.7 0-1-.4-1.4-.4s-.7.4-1.4.4c-1.4 0-2.8-1-2.8-3Z"/><ellipse cx="-6.2" cy="-2.4" rx="1.5" ry="2.1"/><ellipse cx="-2.4" cy="-6" rx="1.5" ry="2.2"/><ellipse cx="2.4" cy="-6" rx="1.5" ry="2.2"/><ellipse cx="6.2" cy="-2.4" rx="1.5" ry="2.1"/></g>
</g>`,
  },
  // A luggage style evidence tag on a string.
  'evidence-tag': {
    viewBox: '0 0 200 120',
    body: `<g stroke-width="2.4">
<path d="M58 24h118a8 8 0 0 1 8 8v56a8 8 0 0 1-8 8H58L30 72V48Z" ${PAPER}/>
<circle cx="50" cy="60" r="7"/>
<path d="M44 62C26 70 12 60 10 40S22 10 40 14" ${EV}/>
<path d="M76 44h84M76 60h60M76 76h72"/>
<rect x="128" y="36" width="44" height="18" rx="3" ${EV} transform="rotate(-8 150 45)"/>
</g>`,
  },
};

/** Renders the inline sprite with every icon as a symbol. */
export function sprite() {
  const symbols = Object.entries(ICONS)
    .map(([name, body]) => `<symbol id="i-${name}" viewBox="0 0 24 24" ${STROKE}>${body}</symbol>`)
    .join('');
  return `<svg class="sprite" aria-hidden="true" focusable="false">${symbols}</svg>`;
}

/** An icon reference. */
export function icon(name, cls = 'ic') {
  if (!ICONS[name]) throw new Error(`unknown icon ${name}`);
  return `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;
}

/** An inline illustration. */
export function illustration(name, cls = 'ill', label = '') {
  const art = ILLUSTRATIONS[name];
  if (!art) throw new Error(`unknown illustration ${name}`);
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="${cls}" viewBox="${art.viewBox}" ${a11y} fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${art.body}</svg>`;
}

/** Standalone SVG files for one theme, with the custom properties resolved. */
export function standalone(theme) {
  const ink = theme === 'dark' ? '#e6ebf5' : '#1b2440';
  const ev = theme === 'dark' ? '#f2b84b' : '#c97d10';
  const paper = theme === 'dark' ? '#2a2418' : '#f6ecd2';
  const resolve = (s) =>
    s
      .replace(/var\(--ev,#e8a33d\)/g, ev)
      .replace(/var\(--paper,#f6ecd2\)/g, paper)
      .replace(/currentColor/g, ink);
  const files = {};
  for (const [name, body] of Object.entries(ICONS)) {
    files[`icons/${name}.svg`] = resolve(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>\n`,
    );
  }
  for (const [name, art] of Object.entries(ILLUSTRATIONS)) {
    files[`${name}.svg`] = resolve(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${art.viewBox}" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${art.body}</svg>\n`,
    );
  }
  return files;
}
