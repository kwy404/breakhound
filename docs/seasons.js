(function (w) {
var IDS = ['newyear', 'carnival', 'easter', 'valentine', 'junina', 'halloween', 'christmas'];
var NAMES = { newyear: 'New Year', carnival: 'Carnival', easter: 'Easter', valentine: "Valentine's", junina: 'Midsummer', halloween: 'Halloween', christmas: 'Christmas' };
var KEY = 'breakhound-season-off:';
function easter(y) {
var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
var f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
var i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
var n = h + l - 7 * m + 114;
return new Date(y, Math.floor(n / 31) - 1, (n % 31) + 1);
}
function add(d, days) {
return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}
var br = function (lang) {
return /^pt-br/i.test(lang || '');
};
function detect(date, lang) {
var y = date.getFullYear(), md = (date.getMonth() + 1) * 100 + date.getDate();
var t = new Date(y, date.getMonth(), date.getDate()).getTime();
var within = function (a, b) {
return t >= a.getTime() && t <= b.getTime();
};
if (md >= 1230 || md <= 102) return 'newyear';
if (md === 214 || (br(lang) && md === 612)) return 'valentine';
var sunday = easter(y), ash = add(sunday, -46);
if (within(add(ash, -4), ash)) return 'carnival';
if (within(add(sunday, -2), sunday)) return 'easter';
if (md >= 613 && md <= 629) return 'junina';
if (md >= 1024 && md <= 1031) return 'halloween';
if (md >= 1218 && md <= 1226) return 'christmas';
return '';
}
function name(id, lang) {
return id === 'junina' && br(lang) ? 'Festa Junina' : NAMES[id] || '';
}
function isOff(id) {
try {
return w.localStorage.getItem(KEY + id) === '1';
} catch {
return false;
}
}
function resolve(search, date, lang, off) {
var m = /[?&]season=([a-z]+)/.exec(search || '');
if (m && m[1] === 'off') return { id: '', on: false, forced: true };
if (m && IDS.indexOf(m[1]) >= 0) return { id: m[1], on: true, forced: true };
var id = detect(date, lang);
return { id: id, on: !!id && !(off || isOff)(id), forced: false };
}
var api = { ids: IDS, easter: easter, detect: detect, name: name, resolve: resolve, state: null };
api.set = function (on) {
var s = api.state, root = w.document.documentElement;
if (!s || !s.id) return;
s.on = on;
if (!s.forced) {
try {
if (on) w.localStorage.removeItem(KEY + s.id);
else w.localStorage.setItem(KEY + s.id, '1');
} catch {
}
}
if (on) root.setAttribute('data-season', s.id);
else root.removeAttribute('data-season');
};
w.BreakhoundSeasons = api;
if (!w.document || !w.location) return;
var lang = (w.navigator && w.navigator.language) || '';
var s = resolve(w.location.search, new Date(), lang);
s.name = name(s.id, lang);
api.state = s;
if (s.on) w.document.documentElement.setAttribute('data-season', s.id);
})(window);
