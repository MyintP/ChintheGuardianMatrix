// Static content + page audit. Prints findings; dumps all content to text files for reading.
const fs = require('fs');
const R = require('path').join(__dirname, '..') + '/';
const read = f => fs.readFileSync(R + f, 'utf8');
const findings = [];
const flag = (area, msg) => findings.push(`[${area}] ${msg}`);

// ── Load data
const mx = read('chinthe-guardian-matrix.html');
const a = mx.indexOf('const NODES = {'), b = mx.indexOf('\n};', a) + 3;
const NODES = eval('(' + mx.slice(a + 14, b - 1) + ')');
const kb = read('knowledge.html');
const DB = eval(kb.slice(kb.indexOf('const DB = [') + 11, kb.indexOf('\n];', kb.indexOf('const DB = [')) + 2));
const pr = read('principles.html');
const PRINCIPLES = eval(pr.slice(pr.indexOf('const PRINCIPLES = [') + 19, pr.indexOf('\n];', pr.indexOf('const PRINCIPLES = [')) + 2));

// ── Matrix structure
const req = ['objective', 'mechanics', 'commonMistake', 'drill'];
const titles = {};
for (const [id, n] of Object.entries(NODES)) {
  if (id !== 'hub') for (const k of req) if (!n[k] || n[k].length < 25) flag('matrix', `${id}: missing/short ${k}`);
  (titles[n.title.toLowerCase()] ||= []).push(id);
  if (n.type === 'submission' && n.points !== 'WIN' && n.points !== 'LOSS') flag('matrix', `${id}: submission without WIN/LOSS`);
  if (n.points === 'WIN' && n.type !== 'submission') flag('matrix', `${id}: WIN on non-submission`);
  if (n.type === 'submission' && n.points === 'WIN' && !(n.children || []).length) flag('matrix-info', `${id}: finish with no "if defended" follow-up`);
  const all = Object.values(n).filter(v => typeof v === 'string').join(' ');
  if (/\b(4|four) points?\b/i.test(all) && /back|mount/i.test(all) && !/clean|past (the )?guard/i.test(all)) flag('matrix-scoring', `${id}: mentions 4 points for back/mount? "${all.match(/.{0,60}\b(4|four) points?.{0,40}/i)[0]}"`);
  if (/\bIBJJF\b/.test(all)) flag('matrix-info', `${id}: mentions IBJJF`);
}
for (const [t, ids] of Object.entries(titles)) if (ids.length > 1) flag('matrix', `duplicate title "${t}": ${ids.join(', ')}`);
// leaf positions (dead ends) that aren't finishes or losses
for (const [id, n] of Object.entries(NODES)) if (!(n.children || []).length && n.type !== 'submission') flag('matrix', `${id}: dead end (no options) and not a finish`);

// ── Knowledge structure
const kreq = ['name', 'tagline', 'objective', 'mechanics', 'defense', 'mistake', 'drill'];
const knames = {};
for (const e of DB) {
  for (const k of kreq) if (!e[k] || e[k].length < 15) flag('knowledge', `${e.id}: missing/short ${k}`);
  if (!e.tags || !e.tags.length) flag('knowledge', `${e.id}: no tags`);
  (knames[e.name.toLowerCase()] ||= []).push(e.id);
  const all = [e.tagline, e.objective, e.mechanics, e.defense, e.mistake, e.drill].join(' ');
  const pts = all.match(/[^.]{0,80}\b(\d) points?\b[^.]{0,60}/gi) || [];
  pts.forEach(p => flag('knowledge-scoring', `${e.id}: "${p.trim()}"`));
  if (/[<>]/.test(all)) flag('knowledge', `${e.id}: contains < or > (rendered as HTML)`);
}
for (const [t, ids] of Object.entries(knames)) if (ids.length > 1) flag('knowledge', `duplicate name "${t}": ${ids.join(', ')}`);

// ── Principles
for (const p of PRINCIPLES) for (const k of ['name', 'tagline', 'overview']) if (!p[k]) flag('principles', `${p.id}: missing ${k}`);
const hier = [...pr.matchAll(/hier-pts[^>]*>([^<]+)<\/span><span class="hier-name">([^<]+)</g)].map(m => m[2] + ' ' + m[1]);
flag('principles-info', 'hierarchy: ' + hier.join(' | '));

// ── Pages
const pages = ['index.html', 'chinthe-guardian-matrix.html', 'competition.html', 'knowledge.html', 'principles.html', 'journal.html'];
for (const p of pages) {
  const h = read(p);
  if (!/<html lang="/.test(h)) flag('page', `${p}: no lang attribute`);
  if (!/<meta name="description"/.test(h)) flag('page', `${p}: no meta description`);
  const t = (h.match(/<title>([^<]*)<\/title>/) || [])[1]; flag('page-info', `${p}: title "${t}"`);
  const h1 = (h.match(/<h1\b/g) || []).length; if (h1 !== 1) flag('page', `${p}: ${h1} <h1> elements`);
  [...h.matchAll(/href="([^"#:]+\.html)(#[^"]*)?"/g)].forEach(m => { if (!fs.existsSync(R + m[1])) flag('page', `${p}: broken link ${m[1]}`); });
  [...h.matchAll(/<img\b[^>]*>/g)].forEach(m => { if (!/\balt=/.test(m[0])) flag('page', `${p}: img without alt: ${m[0].slice(0, 60)}`); });
  if (!/theme-color/.test(h)) flag('page', `${p}: no theme-color`);
  if (/<button(?![^>]*type=)[^>]*onclick/.test(h)) flag('page-info', `${p}: inline onclick buttons without type`);
}
// Compete quick-jumps resolve
const cp = read('competition.html');
[...cp.matchAll(/\{ id: "([a-z_]+)",\s+name:/g)].forEach(m => { if (!NODES[m[1]]) flag('compete', `quick jump to missing node ${m[1]}`); });
const qr = mx.match(/const QUICK_REF_IDS = \[([^\]]*)\]/)[1].match(/"([a-z_]+)"/g).map(x => x.slice(1, -1));
qr.forEach(id => { if (!NODES[id]) flag('matrix', `quick ref missing node ${id}`); });

// ── Dumps for reading
fs.writeFileSync(__dirname + '/dump-matrix.txt', Object.entries(NODES).map(([id, n]) =>
  `## ${id} | ${n.title} | ${n.type} | ${n.points}\nO: ${n.objective || ''}\nM: ${n.mechanics || ''}\nX: ${n.commonMistake || ''}\nD: ${n.drill || ''}${n.defense ? '\nR: ' + n.defense : ''}\n→ ${(n.children || []).join(', ')}`).join('\n\n'));
fs.writeFileSync(__dirname + '/dump-kb.txt', DB.map(e =>
  `## ${e.id} | ${e.cat} | ${e.name}\nT: ${e.tagline}\nO: ${e.objective}\nM: ${e.mechanics}\nR: ${e.defense}\nX: ${e.mistake}\nD: ${e.drill}\n#: ${(e.tags || []).join(', ')}`).join('\n\n'));
fs.writeFileSync(__dirname + '/dump-principles.txt', JSON.stringify(PRINCIPLES, null, 1));

console.log(findings.join('\n'));
console.log(`\n${findings.length} findings | nodes ${Object.keys(NODES).length} | kb ${DB.length} | principles ${PRINCIPLES.length}`);
