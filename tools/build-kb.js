// Builds the CHINTHE encyclopedia.
//   node tools/build-kb.js
// Reads every kb/*.js source file, validates the entries against the core
// database in knowledge.html, then writes:
//   encyclopedia.js        — the data the Knowledge page merges at load
//   chinthe.js             — regenerates the global-search block between the KB markers
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// ── Core database (inline in knowledge.html) ──────────────────────────────
const kh = read('knowledge.html');
const dbStart = kh.indexOf('const DB = [');
const DB = vm.runInNewContext(kh.slice(dbStart + 11, kh.indexOf('\n];', dbStart) + 2));
const mStart = kh.indexOf('const META = ') + 13;
const META = JSON.parse(kh.slice(mStart, kh.indexOf(';\n', mStart)));
const gStart = kh.indexOf('const GROUPS = ') + 15;
const CORE_GROUPS = JSON.parse(kh.slice(gStart, kh.indexOf(';\n', gStart)));

// ── Sources ────────────────────────────────────────────────────────────────
const groups = [], entries = [];
const KB = {
  group: g => groups.push(g),
  add: (...e) => entries.push(...e),
};
const srcDir = path.join(ROOT, 'kb');
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.js')).sort();
for (const f of files) {
  const before = entries.length;
  vm.runInNewContext(fs.readFileSync(path.join(srcDir, f), 'utf8'), { KB }, { filename: 'kb/' + f });
  entries.slice(before).forEach(e => (e._src = f));
}

// ── Validation ─────────────────────────────────────────────────────────────
const errors = [], warnings = [];
const CATS = ['position', 'submission', 'sweep', 'pass', 'takedown', 'judo', 'transition', 'strike', 'defence', 'concept'];
const LVLS = ['F', 'I', 'A'];
const FMTS = ['No-Gi', 'Gi', 'Gi & No-Gi', 'Wrestling', 'Judo', 'MMA', 'Muay Thai', 'Lethwei'];
const TEXT = ['tagline', 'objective', 'mechanics', 'defense', 'mistake', 'drill'];
const coreIds = new Set(DB.map(d => d.id));
const allIds = new Set(coreIds);
const groupIds = new Set(CORE_GROUPS.map(g => g.id).concat(groups.map(g => g.id)));
for (const e of entries) {
  const where = `${e._src}:${e.id}`;
  if (!/^[a-z0-9_]+$/.test(e.id || '')) errors.push(`${where}: bad id`);
  if (allIds.has(e.id)) errors.push(`${where}: duplicate id`);
  allIds.add(e.id);
  if (!CATS.includes(e.cat)) errors.push(`${where}: bad cat ${e.cat}`);
  if (!LVLS.includes(e.lvl)) errors.push(`${where}: bad lvl ${e.lvl}`);
  if (!FMTS.includes(e.fmt)) errors.push(`${where}: bad fmt ${e.fmt}`);
  if (!e.name) errors.push(`${where}: no name`);
  for (const k of TEXT) if (!e[k] || e[k].length < 25) errors.push(`${where}: ${k} missing or thin`);
  if (!(e.groups || []).length) errors.push(`${where}: no groups`);
  (e.groups || []).forEach(g => groupIds.has(g) || errors.push(`${where}: unknown group ${g}`));
  if (/<|>/.test(TEXT.map(k => e[k]).join('') + e.name)) errors.push(`${where}: markup in text`);
  if (e.video && !/^https:\/\/(www\.youtube\.com\/watch\?v=|youtu\.be\/|vimeo\.com\/)[\w\-?=&]+$/.test(e.video)) errors.push(`${where}: video must be a YouTube or Vimeo link`);
}
for (const g of groups) {
  if (!allIds.has(g.anchor)) errors.push(`group ${g.id}: anchor ${g.anchor} not found`);
  (g.include || []).forEach(i => allIds.has(i) || errors.push(`group ${g.id}: include ${i} not found`));
}
for (const e of entries) {
  const bad = (e.rel || []).filter(r => !allIds.has(r));
  if (bad.length) warnings.push(`${e.id}: dropped related ${bad.join(', ')}`);
  e.rel = (e.rel || []).filter(r => allIds.has(r) && r !== e.id);
}
// Names should be unique across the whole encyclopedia
const names = new Map();
DB.concat(entries).forEach(e => {
  const n = e.name.toLowerCase().replace(/\s*\(.*?\)/g, '').trim();
  if (names.has(n) && !coreIds.has(e.id)) errors.push(`duplicate name "${e.name}" (${names.get(n)} / ${e.id})`);
  names.set(n, e.id);
});
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
warnings.forEach(w => console.warn('warn:', w));

// ── encyclopedia.js ────────────────────────────────────────────────────────
const out = {
  groups: groups.map(({ id, name, anchor, desc, after, include }) => ({ id, name, anchor, desc, after, include: include || [] })),
  entries: entries.map(e => ({
    id: e.id, cat: e.cat, name: e.name, tagline: e.tagline, tags: e.tags || [],
    objective: e.objective, mechanics: e.mechanics, defense: e.defense, mistake: e.mistake, drill: e.drill,
    groups: e.groups, meta: Object.fromEntries(Object.entries({ lvl: e.lvl, fmt: e.fmt, aka: e.aka && e.aka.length ? e.aka : undefined, pts: e.pts, rel: e.rel, node: e.node, video: e.video }).filter(([, v]) => v !== undefined)),
  })),
  // A short index of the core entries (full text stays in knowledge.html), for
  // pages that need every technique: the game plan builder.
  core: DB.map(d => ({
    id: d.id, cat: d.cat, name: d.name, tagline: d.tagline, drill: d.drill,
    groups: CORE_GROUPS.filter(g => g.ids.includes(d.id)).map(g => g.id),
    lvl: (META[d.id] || {}).lvl || 'F', fmt: (META[d.id] || {}).fmt || 'No-Gi',
  })),
};
fs.writeFileSync(path.join(ROOT, 'encyclopedia.js'),
  '/* CHINTHE encyclopedia — generated by tools/build-kb.js from kb/*.js. Do not edit by hand. */\n' +
  'window.CHINTHE_KB=' + JSON.stringify(out) + ';\n');

// ── Global search block in chinthe.js ──────────────────────────────────────
const START = '    // KB:START (generated by tools/build-kb.js)', END = '    // KB:END';
let js = read('chinthe.js');
const a = js.indexOf(START), b = js.indexOf(END);
if (a < 0 || b < 0) { console.error('chinthe.js: KB markers not found'); process.exit(1); }
const esc = s => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const lines = entries.map(e => `    k("${e.id}", "${esc(e.name)}");`).join('\n');
js = js.slice(0, a) + START + '\n' + lines + '\n' + js.slice(b);
fs.writeFileSync(path.join(ROOT, 'chinthe.js'), js);

const by = {};
DB.concat(entries).forEach(e => (by[e.cat] = (by[e.cat] || 0) + 1));
console.log(`encyclopedia: ${DB.length} core + ${entries.length} new = ${DB.length + entries.length} entries; ${groups.length} new groups`);
console.log(JSON.stringify(by));
