// Seasonal art for the special dates: Sniff in costume, three icons per
// season in the site's line icon style and a hero accent strip, each in a
// light and a dark version. scripts/build-docs.mjs writes the files to
// assets/seasons/<id>/ (the source of record) and docs/assets/seasons/<id>/.

export const SEASONS = {
  newyear: { name: 'New Year', icons: ['firework', 'star', 'clock'] },
  carnival: { name: 'Carnival', icons: ['mask', 'confetti', 'streamer'] },
  easter: { name: 'Easter', icons: ['egg', 'bunny', 'basket'] },
  valentine: { name: "Valentine's", icons: ['heart', 'balloon', 'letter'] },
  junina: { name: 'Midsummer', icons: ['bonfire', 'flags', 'hat'] },
  halloween: { name: 'Halloween', icons: ['pumpkin', 'bat', 'witch-hat'] },
  christmas: { name: 'Christmas', icons: ['snowflake', 'gift', 'tree'] },
};

const PALETTE = {
  light: { badge: '#1FA393', ring: '#FFF4E3', ink: '#1B2440', fur: '#9C5A2E', tan: '#E9B97A', lens: '#FFF4E3', line: '#1B2440', soft: '#5b6478' },
  dark: { badge: '#17786d', ring: '#d9cdb8', ink: '#0d1220', fur: '#8e5129', tan: '#dcaa6a', lens: '#efe4cf', line: '#d6deeb', soft: '#93a0ba' },
};

/** Season colors: main accent, second accent, light detail. Muted on purpose. */
const TONES = {
  light: {
    newyear: ['#c79a2b', '#2f5fb3', '#f3e2b0'],
    carnival: ['#b5367a', '#2f8f83', '#f2c14e'],
    easter: ['#8a6fc4', '#5ea58a', '#f4d9e4'],
    valentine: ['#c43c5c', '#e88aa0', '#fbe1e7'],
    junina: ['#c9692a', '#3f7d4a', '#e7c46a'],
    halloween: ['#d2691e', '#4b3470', '#f0b26b'],
    christmas: ['#b8323a', '#2f6e4f', '#f4efe6'],
  },
  dark: {
    newyear: ['#e2b84a', '#7aa2ec', '#f6e6bb'],
    carnival: ['#e070aa', '#4fc2b3', '#f4cd6b'],
    easter: ['#b29ae6', '#7cc7a8', '#f1d3df'],
    valentine: ['#f07590', '#f4a3b6', '#fbe1e7'],
    junina: ['#f0954c', '#6fb07a', '#f0d27e'],
    halloween: ['#f08a3c', '#9b7ad0', '#f6c587'],
    christmas: ['#e8575f', '#5fae86', '#f4efe6'],
  },
};

// ---------- Sniff ----------

/** The mascot from assets/mascot.svg, with its colors taken from a palette. */
function base(c) {
  return `<circle cx="200" cy="200" r="188" fill="${c.badge}" stroke="${c.ink}" stroke-width="8"/>
<circle cx="200" cy="200" r="170" fill="none" stroke="${c.ring}" stroke-width="4" stroke-dasharray="2 14" stroke-linecap="round"/>
BACK
<g stroke="${c.ink}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">
<g clip-path="url(#sb)"><path d="M62 410C70 330 130 296 200 296C270 296 330 330 338 410Z" fill="${c.fur}"/><path d="M150 300L200 352L250 300" fill="${c.tan}"/></g>
<path d="M146 136C104 134 84 186 88 246C91 290 108 318 130 314C152 310 154 262 150 220Z" fill="${c.fur}"/>
<path d="M254 136C296 134 316 186 312 246C309 290 292 318 270 314C248 310 246 262 250 220Z" fill="${c.fur}"/>
<path d="M138 140C138 104 262 104 262 140L266 236C268 284 240 300 200 300C160 300 132 284 134 236Z" fill="${c.fur}"/>
<circle cx="172" cy="200" r="13" fill="${c.ink}" stroke="none"/><circle cx="228" cy="200" r="13" fill="${c.ink}" stroke="none"/>
<circle cx="167" cy="195" r="4.5" fill="#fff" stroke="none"/><circle cx="223" cy="195" r="4.5" fill="#fff" stroke="none"/>
<path d="M154 180C162 172 176 168 188 170M212 170C224 168 238 172 246 180" fill="none" stroke-width="6"/>
<path d="M158 228C166 212 234 212 242 228C254 250 256 290 232 302C218 310 206 302 200 292C194 302 182 310 168 302C144 290 146 250 158 228Z" fill="${c.tan}"/>
<ellipse cx="200" cy="234" rx="27" ry="18" fill="${c.ink}"/><ellipse cx="190" cy="228" rx="8" ry="4" fill="#fff" stroke="none"/>
<path d="M200 252V266C193 276 180 275 175 267M200 266C207 276 220 275 225 267" fill="none" stroke-width="6"/>
CAP
<path d="M270 238L236 300" fill="none" stroke-width="18"/>
<circle cx="300" cy="196" r="44" fill="${c.lens}" stroke-width="12"/>
<path d="M276 184C280 172 290 164 302 162" fill="none" stroke="#fff" stroke-width="7"/>
<ellipse cx="240" cy="300" rx="24" ry="20" fill="${c.fur}"/><path d="M232 284V296M246 284V296" fill="none" stroke-width="5"/>
LENS
</g>`;
}

const deerstalker = (c) => `<g transform="rotate(-8 200 120) translate(200 142) scale(1.12) translate(-200 -142)">
<path d="M136 132C126 112 132 92 150 84L164 124Z" fill="${c.fur}"/><path d="M264 132C274 112 268 92 250 84L236 124Z" fill="${c.fur}"/>
<path d="M138 140C138 96 166 74 200 74C234 74 262 96 262 140Z" fill="${c.tan}"/>
<g clip-path="url(#sc)" fill="none" stroke="${c.fur}" stroke-width="6"><path d="M176 60V150M224 60V150M120 108H280"/></g>
<path d="M138 140C138 96 166 74 200 74C234 74 262 96 262 140Z" fill="none"/>
<path d="M140 138C166 168 234 168 260 138C232 150 168 150 140 138Z" fill="${c.tan}"/>
<path d="M200 76C188 62 174 64 176 72C178 80 192 80 200 76C208 80 222 80 224 72C226 64 212 62 200 76Z" fill="${c.fur}" stroke-width="5"/></g>`;

const bugInLens = (c) => `<g fill="${c.ink}" stroke="none"><ellipse cx="306" cy="210" rx="11" ry="14"/><circle cx="306" cy="192" r="7"/></g>
<path d="M296 200L288 196M316 200L324 196M295 212H287M317 212H325M296 222L289 227M316 222L323 227M302 186L298 180M310 186L314 180" fill="none" stroke-width="3"/>`;

/** A paper hat brim band, used under several hats so they sit on the head. */
const capBase = (c) => `<g transform="rotate(-8 200 120)"><path d="M138 140C138 100 166 80 200 80C234 80 262 100 262 140Z" fill="${c.tan}"/></g>`;

function burst(x, y, r, color, n = 10) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x1 = x + Math.cos(a) * r * 0.35;
    const y1 = y + Math.sin(a) * r * 0.35;
    const x2 = x + Math.cos(a) * r;
    const y2 = y + Math.sin(a) * r;
    d += `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"/><circle cx="${x}" cy="${y}" r="${(r * 0.14).toFixed(1)}" fill="${color}" stroke="none"/>`;
}

const COSTUMES = {
  halloween: (c, t) => ({
    back: `<g stroke-width="6">${bat(318, 64, 1.1, c.ink)}${bat(84, 112, 0.8, c.ink)}</g>`,
    cap: `<g transform="rotate(-8 200 120)">
<path d="M146 116C150 80 176 40 214 12C220 8 228 12 224 20C214 44 236 70 254 116Z" fill="${t[1]}"/>
<path d="M150 104C176 96 226 96 252 104L254 116C226 108 176 108 148 116Z" fill="${t[0]}" stroke-width="5"/>
<rect x="190" y="100" width="20" height="14" rx="3" fill="${t[2]}" stroke-width="4"/>
<ellipse cx="200" cy="122" rx="96" ry="16" fill="${t[1]}"/></g>`,
    front: `<g>${pumpkin(96, 330, 1, t, c)}</g>`,
  }),
  christmas: (c, t) => ({
    back: `<g fill="#fff" stroke="none" opacity=".85"><circle cx="70" cy="140" r="5"/><circle cx="110" cy="80" r="4"/><circle cx="330" cy="110" r="5"/><circle cx="350" cy="250" r="4"/><circle cx="62" cy="230" r="3.5"/><circle cx="290" cy="58" r="3.5"/></g>`,
    cap: `<g transform="rotate(-8 200 120)">
<path d="M144 116C150 70 190 44 236 48C270 52 296 74 304 104C292 96 278 92 266 96L256 116Z" fill="${t[0]}"/>
<circle cx="306" cy="108" r="17" fill="${t[2]}"/>
<rect x="134" y="104" width="134" height="26" rx="13" fill="${t[2]}"/></g>`,
    front: `<g><path d="M146 296C172 312 228 312 254 296L258 318C230 334 170 334 142 318Z" fill="${t[0]}"/>
<path d="M232 312L246 372L274 366L256 306Z" fill="${t[0]}"/>
<path d="M166 304L160 324M190 310L186 330M214 310L214 330M238 304L242 322M248 330L268 326M252 350L272 346" fill="none" stroke="${t[2]}" stroke-width="6"/></g>`,
  }),
  carnival: (c, t) => ({
    back: confetti([[70, 120, t[0]], [96, 76, t[2]], [320, 74, t[1]], [344, 150, t[0]], [60, 250, t[1]], [338, 300, t[2]], [120, 360, t[0]], [280, 360, t[1]]]),
    cap: deerstalker(c),
    front: `<g><path d="M140 196C150 176 182 174 200 186C218 174 250 176 260 196C262 212 248 222 230 220C216 218 208 210 200 206C192 210 184 218 170 220C152 222 138 212 140 196Z" fill="${t[0]}"/>
<ellipse cx="172" cy="200" rx="13" ry="10" fill="${c.ink}"/><ellipse cx="228" cy="200" rx="13" ry="10" fill="${c.ink}"/>
<circle cx="168" cy="196" r="4" fill="#fff" stroke="none"/><circle cx="224" cy="196" r="4" fill="#fff" stroke="none"/>
<path d="M256 188C270 160 268 132 252 108C276 124 290 156 268 192Z" fill="${t[1]}" stroke-width="5"/>
<path d="M262 194C290 176 312 150 314 120C326 150 312 184 270 200Z" fill="${t[2]}" stroke-width="5"/>
<circle cx="200" cy="190" r="5" fill="${t[2]}" stroke-width="3"/></g>
<path d="M80 320C96 300 112 330 128 310S156 300 170 318" fill="none" stroke="${t[2]}" stroke-width="6"/>`,
  }),
  junina: (c, t) => ({
    back: flags(40, 156, 360, 156, 30, [t[0], t[1], t[2]], c.ink, 7),
    cap: `<g transform="rotate(-8 200 120)">
<ellipse cx="200" cy="126" rx="122" ry="22" fill="${t[2]}"/>
<path d="M146 122C146 82 172 66 200 66C228 66 254 82 254 122Z" fill="${t[2]}"/>
<path d="M148 110C176 118 224 118 252 110L254 122C226 130 174 130 146 122Z" fill="${t[0]}" stroke-width="5"/>
<path d="M98 126L120 136M126 140L148 142M252 142L274 140M280 136L302 126M176 82L170 104M200 74V100M224 82L230 104" fill="none" stroke="${c.fur}" stroke-width="4"/></g>`,
    front: `<g>${bonfire(92, 340, t, c)}</g>`,
  }),
  valentine: (c, t) => ({
    back: `<path d="M240 290C250 230 300 170 318 118" fill="none" stroke="${c.ink}" stroke-width="4"/>
<path d="M318 120C292 102 278 80 282 62C286 44 308 40 318 58C328 40 350 44 354 62C358 80 344 102 318 120Z" fill="${t[0]}" stroke="${c.ink}" stroke-width="6" stroke-linejoin="round"/>
<path d="M296 62C298 54 304 52 308 56" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`,
    cap: deerstalker(c),
    front: `<g stroke="none" fill="${t[1]}" opacity=".7"><ellipse cx="150" cy="246" rx="13" ry="8"/><ellipse cx="250" cy="246" rx="13" ry="8"/></g>
${heart(80, 120, 0.7, t[1], c.ink)}${heart(104, 300, 0.5, t[0], c.ink)}`,
  }),
  easter: (c, t) => ({
    back: `<g fill="${t[1]}" stroke="none" opacity=".55"><circle cx="72" cy="150" r="6"/><circle cx="330" cy="96" r="5"/><circle cx="346" cy="300" r="6"/></g>`,
    cap: `<g transform="rotate(-8 200 120)">
<path d="M166 92C150 64 146 26 162 14C178 4 190 40 188 86Z" fill="#fff"/><path d="M166 80C158 60 158 36 164 30C172 26 178 52 178 82Z" fill="${t[2]}" stroke="none"/>
<path d="M214 86C214 40 228 6 246 14C262 24 254 64 236 92Z" fill="#fff"/><path d="M222 82C224 50 232 28 240 30C248 36 242 64 232 86Z" fill="${t[2]}" stroke="none"/>
<path d="M140 120C166 102 234 102 262 120" fill="none" stroke="${t[0]}" stroke-width="10"/></g>`,
    front: `<g>${basket(96, 334, t, c)}</g>`,
  }),
  newyear: (c, t) => ({
    back: `${burst(80, 92, 44, t[0])}${burst(328, 70, 36, t[1])}${burst(346, 300, 26, t[0], 8)}${burst(58, 270, 22, t[1], 8)}`,
    cap: `<g transform="rotate(-8 200 120)">
<path d="M150 118L206 10L256 118Z" fill="${t[1]}"/>
<path d="M164 92L232 72M176 66L220 52M154 112L248 92" fill="none" stroke="${t[0]}" stroke-width="8"/>
<path d="M150 118L206 10L256 118Z" fill="none"/>
<circle cx="206" cy="10" r="12" fill="${t[0]}"/>
<path d="M138 122C170 112 232 112 264 122" fill="none" stroke="${t[2]}" stroke-width="8"/></g>`,
    front: `<g><path d="M110 300L132 360" fill="none" stroke="${c.ink}" stroke-width="5"/>${burst(108, 296, 22, t[0], 9)}</g>`,
  }),
};

function bat(x, y, s, ink) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0C-8 -10 -22 -12 -34 -6C-28 -2 -26 4 -28 10C-20 6 -12 8 -8 12C-6 6 -4 4 0 4C4 4 6 6 8 12C12 8 20 6 28 10C26 4 28 -2 34 -6C22 -12 8 -10 0 0Z" fill="${ink}" stroke="none"/><path d="M-3 -2L-5 -8M3 -2L5 -8" stroke="${ink}" stroke-width="3"/></g>`;
}
function pumpkin(x, y, s, t, c) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 -30C-2 -38 2 -46 10 -48" fill="none" stroke="#3f6b3a" stroke-width="7"/>
<ellipse cx="-16" cy="0" rx="22" ry="30" fill="${t[0]}"/><ellipse cx="16" cy="0" rx="22" ry="30" fill="${t[0]}"/><ellipse cx="0" cy="0" rx="18" ry="32" fill="${t[0]}"/>
<path d="M-14 -8L-6 -2L-16 0ZM14 -8L6 -2L16 0Z" fill="${c.ink}" stroke-width="3"/><path d="M-14 12C-6 20 6 20 14 12L8 14L4 10L0 15L-4 10L-8 14Z" fill="${c.ink}" stroke-width="3"/></g>`;
}
function bonfire(x, y, t, c) {
  return `<g transform="translate(${x} ${y})"><path d="M-30 18L30 -2M-30 -2L30 18" fill="none" stroke="${c.fur}" stroke-width="12"/>
<path d="M0 -50C14 -34 24 -22 20 -6C18 4 10 10 0 10C-10 10 -18 4 -20 -6C-22 -20 -10 -28 -4 -40C-2 -30 2 -26 6 -26C4 -34 2 -42 0 -50Z" fill="${t[0]}"/>
<path d="M0 -20C6 -14 10 -8 8 -2C6 4 -6 4 -8 -2C-9 -8 -4 -12 0 -20Z" fill="${t[2]}" stroke-width="4"/></g>`;
}
function basket(x, y, t, c) {
  return `<g transform="translate(${x} ${y})"><path d="M-34 -6C-34 -40 34 -40 34 -6" fill="none" stroke="${c.fur}" stroke-width="7"/>
<ellipse cx="-14" cy="-12" rx="10" ry="13" fill="${t[2]}"/><ellipse cx="6" cy="-16" rx="10" ry="13" fill="${t[1]}"/><ellipse cx="22" cy="-10" rx="9" ry="12" fill="${t[0]}"/>
<path d="M-40 -6H40L32 26H-32Z" fill="${c.tan}"/><path d="M-36 6H36M-34 16H34M-20 -6L-16 26M0 -6V26M20 -6L16 26" fill="none" stroke="${c.fur}" stroke-width="4"/></g>`;
}
function heart(x, y, s, fill, ink) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 22C-26 4 -36 -12 -30 -24C-24 -36 -6 -36 0 -22C6 -36 24 -36 30 -24C36 -12 26 4 0 22Z" fill="${fill}" stroke="${ink}" stroke-width="6" stroke-linejoin="round"/></g>`;
}
function confetti(list) {
  return list.map(([x, y, col], i) => `<rect x="${x - 6}" y="${y - 3}" width="12" height="6" rx="1.5" fill="${col}" stroke="none" transform="rotate(${(i * 47) % 180} ${x} ${y})"/>`).join('');
}
function flags(x1, y1, x2, y2, sag, colors, ink, n) {
  const mx = (x1 + x2) / 2;
  const my = y1 + sag * 2;
  let out = `<path d="M${x1} ${y1}Q${mx} ${my} ${x2} ${y2}" fill="none" stroke="${ink}" stroke-width="3"/>`;
  for (let i = 1; i <= n; i++) {
    const u = i / (n + 1);
    const x = (1 - u) * (1 - u) * x1 + 2 * (1 - u) * u * mx + u * u * x2;
    const y = (1 - u) * (1 - u) * y1 + 2 * (1 - u) * u * my + u * u * y2;
    out += `<path d="M${(x - 11).toFixed(1)} ${y.toFixed(1)}H${(x + 11).toFixed(1)}L${x.toFixed(1)} ${(y + 24).toFixed(1)}Z" fill="${colors[i % colors.length]}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>`;
  }
  return out;
}

/** Sniff in costume for one season and theme. */
export function sniff(id, theme) {
  const c = PALETTE[theme];
  const t = TONES[theme][id];
  const k = COSTUMES[id](c, t);
  const body = base(c)
    .replace('CAP', `${k.cap === deerstalker(c) ? '' : capBase(c)}${k.cap}`)
    .replace('LENS', bugInLens(c))
    .replace('BACK', `<g stroke="${c.ink}" stroke-linejoin="round" stroke-linecap="round" stroke-width="6">${k.back}</g>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400" role="img" aria-label="Sniff, the breakhound mascot, dressed for ${SEASONS[id].name}">
<defs><clipPath id="sb"><circle cx="200" cy="200" r="184"/></clipPath><clipPath id="sc"><path d="M138 140C138 96 166 74 200 74C234 74 262 96 262 140Z"/></clipPath></defs>
${body}
<g stroke="${c.ink}" stroke-linejoin="round" stroke-linecap="round" stroke-width="6">${k.front}</g>
</svg>
`;
}

// ---------- Icons ----------

const ICONS = {
  firework: (a, b) => `<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" stroke="${a}"/><circle cx="12" cy="12" r="1.6" fill="${b}" stroke="none"/>`,
  star: (a, b) => `<path d="M12 3.5l2.5 5.2 5.7.8-4.1 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4.1-4 5.7-.8Z"/><path d="M12 8.5v5" stroke="${a}"/><circle cx="12" cy="15.6" r=".4" fill="${b}"/>`,
  clock: (a) => `<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2" stroke="${a}"/><path d="M9.5 3h5M12 3v2.5"/>`,
  mask: (a) => `<path d="M3 9.5c2.5-2 6-2 9 .5 3-2.5 6.5-2.5 9-.5-.3 4.2-2.4 6.5-5 6.5-1.8 0-3-1.2-4-2.6-1 1.4-2.2 2.6-4 2.6-2.6 0-4.7-2.3-5-6.5Z"/><path d="M6.5 11.3c.8-.6 1.8-.6 2.6 0M14.9 11.3c.8-.6 1.8-.6 2.6 0" stroke="${a}"/>`,
  confetti: (a, b) => `<path d="M4 20 8 8l8 8Z"/><path d="M14 4.5c.6 1.2 0 2.3-1 2.8M19 9.5c-1.2.6-2.3 0-2.8-1" stroke="${a}"/><circle cx="18.5" cy="4.5" r=".9" fill="${b}" stroke="none"/><circle cx="20" cy="14" r=".9" fill="${b}" stroke="none"/>`,
  streamer: (a) => `<path d="M4 6c4 0 4 4 8 4s4-4 8-4" stroke="${a}"/><path d="M4 12c4 0 4 4 8 4s4-4 8-4"/><path d="M4 18c2 0 3 1 4 2"/>`,
  egg: (a) => `<path d="M12 3.5c3.5 0 6.5 6 6.5 10.5A6.5 6.5 0 0 1 5.5 14C5.5 9.5 8.5 3.5 12 3.5Z"/><path d="M6 13.2l2-1.4 2 1.4 2-1.4 2 1.4 2-1.4 2 1.4" stroke="${a}"/>`,
  bunny: (a) => `<path d="M9 9.5C7.8 6.5 7.5 3.5 8.6 3c1.2-.5 2.4 2.6 2.6 6M15 9.5c1.2-3 1.5-6 .4-6.5-1.2-.5-2.4 2.6-2.6 6"/><circle cx="12" cy="14.5" r="5.5"/><path d="M10.6 15.8c.8.6 2 .6 2.8 0" stroke="${a}"/><path d="M10 13.2h.01M14 13.2h.01"/>`,
  basket: (a) => `<path d="M6 10a6 6 0 0 1 12 0"/><path d="M3.5 10h17l-1.6 9.5h-13.8Z"/><path d="M8 13.5l.6 3M12 13.5v3M16 13.5l-.6 3" stroke="${a}"/>`,
  heart: (a) => `<path d="M12 20c-5-3.3-8.5-6.4-8.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 8.5 2.4C20.5 13.6 17 16.7 12 20Z"/><path d="M7.4 9.4c.3-1 1.1-1.6 2-1.7" stroke="${a}"/>`,
  balloon: (a) => `<path d="M12 15.5c-3.5-2.3-6-4.6-6-7.3A3.1 3.1 0 0 1 12 6.4a3.1 3.1 0 0 1 6 1.8c0 2.7-2.5 5-6 7.3Z"/><path d="M12 15.5c-.8 2-.2 3 .6 4s.2 1.5-.6 1.5" stroke="${a}"/>`,
  letter: (a) => `<rect x="3.5" y="6" width="17" height="12.5" rx="1.6"/><path d="m3.8 6.6 8.2 6.4 8.2-6.4"/><path d="M12 16.4c-1.3-.8-2.2-1.6-2.2-2.5a1.1 1.1 0 0 1 2.2-.4 1.1 1.1 0 0 1 2.2.4c0 .9-.9 1.7-2.2 2.5Z" stroke="${a}"/>`,
  bonfire: (a) => `<path d="M4.5 20.5 19.5 16M4.5 16l15 4.5"/><path d="M12 3.5c2.6 2.6 4 4.6 3.6 7.3-.3 1.9-1.8 3.2-3.6 3.2s-3.3-1.3-3.6-3.2c-.2-1.6.6-2.8 1.6-4 .1 1.2.6 1.9 1.4 2.1-.4-1.8.1-3.6.6-5.4Z" stroke="${a}"/>`,
  flags: (a) => `<path d="M2.5 6c6 3 13 3 19 0"/><path d="M5.5 7.3 7 13l2.4-4.8M12 8.6l1.3 5.5 1.7-5.5" stroke="${a}"/><path d="m16.8 8.1 1.8 4.9 1.3-5.6"/>`,
  hat: (a) => `<ellipse cx="12" cy="15" rx="9.5" ry="3"/><path d="M7.5 14.5C7.5 9 9.5 6.5 12 6.5s4.5 2.5 4.5 8"/><path d="M7.7 12.2c2.8.8 5.8.8 8.6 0" stroke="${a}"/>`,
  pumpkin: (a) => `<path d="M12 7c-1-.2-1.5-1.6-1-3"/><path d="M12 7.2C9.5 5.8 4.5 6.5 4.5 13s5 7.5 7.5 6.3c2.5 1.2 7.5.7 7.5-6.3S14.5 5.8 12 7.2Z"/><path d="M9 11.5l1.2 1-1.6.4ZM15 11.5l-1.2 1 1.6.4ZM9.3 15.5c1.7 1 3.7 1 5.4 0" stroke="${a}"/>`,
  bat: (a) => `<path d="M12 10.5c-1.6-2-5-2.6-8.5-1.3 1.6 1 2 2.6 1.6 4.3 1.8-.8 3.6-.3 4.6 1 .5-1.1 1.2-1.7 2.3-1.7s1.8.6 2.3 1.7c1-1.3 2.8-1.8 4.6-1 -.4-1.7 0-3.3 1.6-4.3C17 7.9 13.6 8.5 12 10.5Z"/><path d="M11 9.4l-.5-1.4M13 9.4l.5-1.4" stroke="${a}"/>`,
  'witch-hat': (a) => `<path d="M3.5 18.5h17"/><path d="M6.5 18.5 10.5 7c.9-2.6 3.8-4 6.5-3.3-1.7 1.4-2.4 3.5-1.8 5.6l2.3 9.2"/><path d="M8.2 14.5h8.6" stroke="${a}"/>`,
  snowflake: (a) => `<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.8 4.8 12 7l2.2-2.2M9.8 19.2 12 17l2.2 2.2" stroke="${a}"/>`,
  gift: (a) => `<rect x="4" y="9" width="16" height="11" rx="1.4"/><path d="M3 9h18M12 9v11" /><path d="M12 9c-1.5-3-5.5-4-5.5-1.5S10 9 12 9Zm0 0c1.5-3 5.5-4 5.5-1.5S14 9 12 9Z" stroke="${a}"/>`,
  tree: (a) => `<path d="M12 3 6.5 10h3L5 16h14l-4.5-6h3Z"/><path d="M12 16v4.5"/><path d="M9.5 13h.01M14 11.5h.01M12 8.2h.01" stroke="${a}" stroke-width="2.4"/>`,
};

/** A 24 px seasonal icon with explicit colors, for a standalone file. */
export function seasonIcon(id, name, theme) {
  const t = TONES[theme][id];
  const ink = PALETTE[theme].line;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name](t[0], t[1])}</svg>
`;
}

// ---------- Hero accent ----------

/** A wide strip for the top of the hero: a garland or a scatter of season shapes. */
export function accent(id, theme) {
  const t = TONES[theme][id];
  const ink = PALETTE[theme].soft;
  const W = 1200;
  let body = '';
  const garland = (ornament, n = 13, sag = 26) => {
    let out = '';
    const seg = W / 3;
    for (let s = 0; s < 3; s++) {
      const x1 = s * seg;
      const x2 = x1 + seg;
      const mx = (x1 + x2) / 2;
      out += `<path d="M${x1} 6Q${mx} ${6 + sag * 2} ${x2} 6" fill="none" stroke="${ink}" stroke-width="1.6" opacity=".7"/>`;
      const per = Math.round(n / 3);
      for (let i = 1; i < per + 1; i++) {
        const u = i / (per + 1);
        const x = (1 - u) * (1 - u) * x1 + 2 * (1 - u) * u * mx + u * u * x2;
        const y = (1 - u) * (1 - u) * 6 + 2 * (1 - u) * u * (6 + sag * 2) + u * u * 6;
        out += ornament(x, y, s * per + i);
      }
    }
    return out;
  };
  switch (id) {
    case 'christmas':
      body = garland((x, y, i) => `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><rect x="-3" y="0" width="6" height="5" rx="1" fill="${ink}"/><path d="M0 5C-6 12 -6 20 0 24C6 20 6 12 0 5Z" fill="${t[i % 2]}"/></g>`, 18, 22);
      break;
    case 'junina':
      body = garland((x, y, i) => `<path d="M${(x - 12).toFixed(1)} ${y.toFixed(1)}H${(x + 12).toFixed(1)}L${x.toFixed(1)} ${(y + 26).toFixed(1)}Z" fill="${t[i % 3]}"/>`, 24, 18);
      break;
    case 'valentine':
      body = garland((x, y, i) => `<path transform="translate(${x.toFixed(1)} ${(y + 12).toFixed(1)}) scale(${i % 2 ? 0.34 : 0.26})" d="M0 22C-26 4 -36 -12 -30 -24C-24 -36 -6 -36 0 -22C6 -36 24 -36 30 -24C36 -12 26 4 0 22Z" fill="${t[i % 2]}"/>`, 18, 20);
      break;
    case 'halloween':
      body = garland((x, y, i) => (i % 3 === 0 ? `<path d="M${x.toFixed(1)} ${y.toFixed(1)}V${(y + 18).toFixed(1)}" stroke="${ink}" stroke-width="1.2"/><circle cx="${x.toFixed(1)}" cy="${(y + 22).toFixed(1)}" r="4" fill="${t[1]}"/>` : `<g transform="translate(${x.toFixed(1)} ${(y + 14).toFixed(1)}) scale(.42)"><path d="M0 0C-8 -10 -22 -12 -34 -6C-28 -2 -26 4 -28 10C-20 6 -12 8 -8 12C-6 6 -4 4 0 4C4 4 6 6 8 12C12 8 20 6 28 10C26 4 28 -2 34 -6C22 -12 8 -10 0 0Z" fill="${i % 2 ? t[0] : t[1]}"/></g>`), 18, 20);
      break;
    case 'easter':
      body = garland((x, y, i) => `<ellipse cx="${x.toFixed(1)}" cy="${(y + 14).toFixed(1)}" rx="7" ry="9.5" fill="${t[i % 3]}"/><path d="M${(x - 7).toFixed(1)} ${(y + 14).toFixed(1)}l3.5 -2.5 3.5 2.5 3.5 -2.5 3.5 2.5" fill="none" stroke="${ink}" stroke-width="1.2"/>`, 18, 18);
      break;
    case 'carnival': {
      for (let i = 0; i < 46; i++) {
        const x = (i * 263) % W;
        const y = 8 + ((i * 37) % 64);
        body += `<rect x="${x}" y="${y}" width="10" height="5" rx="1.2" fill="${t[i % 3]}" transform="rotate(${(i * 53) % 180} ${x + 5} ${y + 2.5})" opacity=".85"/>`;
      }
      body += `<path d="M0 14C60 40 120 -6 200 20S330 44 420 14" fill="none" stroke="${t[1]}" stroke-width="2" opacity=".7"/><path d="M780 18C860 44 930 0 1010 22S1130 40 1200 12" fill="none" stroke="${t[0]}" stroke-width="2" opacity=".7"/>`;
      break;
    }
    case 'newyear': {
      const bursts = [[90, 40, 26], [300, 28, 18], [520, 52, 22], [760, 30, 16], [960, 48, 28], [1140, 26, 18]];
      bursts.forEach(([x, y, r], i) => {
        body += burst(x, y, r, t[i % 2], 10).replace(/stroke-width="5"/, 'stroke-width="2"');
      });
      for (let i = 0; i < 24; i++) body += `<circle cx="${(i * 211) % W}" cy="${10 + ((i * 29) % 70)}" r="1.4" fill="${t[2]}" opacity=".8"/>`;
      break;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 96" width="${W}" height="96" preserveAspectRatio="xMidYMin slice" aria-hidden="true">${body}</svg>
`;
}

/** Every seasonal file, keyed by its path under assets/seasons/. */
export function seasonFiles() {
  const files = {};
  for (const [id, s] of Object.entries(SEASONS)) {
    for (const theme of ['light', 'dark']) {
      files[`${id}/sniff-${theme}.svg`] = sniff(id, theme);
      files[`${id}/accent-${theme}.svg`] = accent(id, theme);
      for (const name of s.icons) files[`${id}/icon-${name}-${theme}.svg`] = seasonIcon(id, name, theme);
    }
  }
  return files;
}
