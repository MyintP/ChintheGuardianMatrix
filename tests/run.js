const BASE = 'http://localhost:8790/';
const OUT = process.argv[2];
const fs = require('fs');
const results = [];
const ok = (name, pass, info = '') => { results.push({ name, pass: !!pass, info }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (info && !pass ? '  — ' + info : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function newTab() {
  const t = await (await fetch('http://localhost:9333/json/new?about:blank', { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = {}; const errors = []; const handlers = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value || a.description).join(' '));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/favicon/.test(m.params.entry.url || '')) errors.push(m.params.entry.text + ' ' + (m.params.entry.url || ''));
    handlers.slice().forEach(h => h(m));
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend[i] = m => m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
  const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(expr.slice(0, 80) + ' => ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; };
  const waitLoad = () => new Promise(r => {
    const h = m => { if (m.method === 'Page.loadEventFired') { done(); } };
    const timer = setTimeout(() => { console.log('  (load event timeout)'); done(); }, 10000);
    function done() { clearTimeout(timer); const i = handlers.indexOf(h); if (i >= 0) handlers.splice(i, 1); r(); }
    handlers.push(h);
  });
  const go = async url => { const done = waitLoad(); await send('Page.navigate', { url }); await done; await sleep(500); };
  const vp = (w, h, mobile) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile });
  const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(OUT + '/' + name + '.png', Buffer.from(r.data, 'base64')); };
  return { send, ev, go, vp, shot, errors, waitLoad, close: () => fetch('http://localhost:9333/json/close/' + t.id) };
}

const typeSearch = q => `(()=>{const i=document.querySelector('.search-input');i.value=${JSON.stringify(q)};i.dispatchEvent(new Event('input'))})()`;

(async () => {
  const PAGES = ['index.html', 'chinthe-guardian-matrix.html', 'competition.html', 'knowledge.html', 'principles.html', 'journal.html'];

  // 1. Every page at 360 / 390 / 1280: no JS errors, no overflow, search button visible, page not hidden
  for (const [w, h, mob, tag] of [[360, 740, true, 'm360'], [390, 844, true, 'm390'], [1280, 800, false, 'd1280']]) {
    const t = await newTab(); await t.vp(w, h, mob);
    for (const p of PAGES) {
      t.errors.length = 0; await t.go(BASE + p);
      ok(`[${tag}] ${p}: no JS errors`, t.errors.length === 0, t.errors.join(' | '));
      const ov = await t.ev('document.documentElement.scrollWidth - window.innerWidth');
      ok(`[${tag}] ${p}: no horizontal overflow`, ov <= 0, 'overflow ' + ov + 'px');
      const sb = await t.ev(`(()=>{const b=document.querySelector('.site-nav-search');if(!b)return null;const r=b.getBoundingClientRect();return {l:r.left,r:r.right,w:r.width,vis:getComputedStyle(b).display!=='none'}})()`);
      ok(`[${tag}] ${p}: search button visible in nav`, sb && sb.vis && sb.w > 0 && sb.r <= w && sb.l >= 0, JSON.stringify(sb));
      ok(`[${tag}] ${p}: page not hidden (html opacity)`, (await t.ev('getComputedStyle(document.documentElement).opacity')) === '1');
      if (tag !== 'm390') await t.shot(tag + '-' + p.replace('.html', ''));
    }
    await t.close();
  }

  const t = await newTab(); await t.vp(390, 844, true);
  await t.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await t.send('Emulation.setEmulatedMedia', { features: [{ name: 'hover', value: 'none' }, { name: 'pointer', value: 'coarse' }] });

  // 2. Global search
  await t.go(BASE + 'knowledge.html');
  await t.ev(`document.querySelector('.site-nav-search').click()`);
  ok('Search opens from nav button and focuses input', await t.ev(`!!document.querySelector('.search-overlay') && document.activeElement.classList.contains('search-input')`));
  await t.ev(typeSearch('kneebar'));
  const hrefs = await t.ev(`[...document.querySelectorAll('.search-result')].map(a=>a.getAttribute('href'))`);
  ok('Search results deep-link (matrix + knowledge)', hrefs.includes('chinthe-guardian-matrix.html#leg_kneebar') && hrefs.includes('knowledge.html#kneebar'), JSON.stringify(hrefs));
  await t.ev(typeSearch('guard'));
  const g = await t.ev(`[...document.querySelectorAll('.search-result')].map(a=>a.querySelector('.sr-cat').textContent+':'+a.querySelector('.sr-title').textContent)`);
  ok('Ranking: prefix match first, techniques not crowded out', g.slice(0, 5).every(x => x.split(':')[1].toLowerCase().startsWith('guard')) && g.some(x => x.startsWith('Technique:')), JSON.stringify(g));
  ok('Keyboard hint footer hidden on touch', await t.ev(`getComputedStyle(document.querySelector('.search-foot')).display==='none'`));
  await t.ev(typeSearch('kneebar'));
  await sleep(300);
  await t.shot('search-mobile');
  await t.ev(`document.querySelector('.search-esc').click()`);
  ok('Search closes from on-screen ESC button (touch)', await t.ev(`!document.querySelector('.search-overlay')`));

  await t.ev(`document.querySelector('.site-nav-search').click()`);
  await t.ev(typeSearch('kneebar'));
  let loaded = t.waitLoad();
  await t.ev(`document.querySelector('.search-result[href="chinthe-guardian-matrix.html#leg_kneebar"]').click()`);
  await loaded; await sleep(900);
  ok('Matrix result lands on that node', await t.ev(`location.pathname.endsWith('chinthe-guardian-matrix.html') && path[path.length-1]==='leg_kneebar'`), await t.ev('JSON.stringify(path)'));
  await t.shot('matrix-deeplink');

  await t.ev(`jumpTo('start')`);
  await t.ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}))`);
  await t.ev(typeSearch('kneebar'));
  await t.ev(`document.querySelector('.search-result[href="chinthe-guardian-matrix.html#leg_kneebar"]').click()`); await sleep(300);
  ok('Same-page, same-hash search result still jumps', await t.ev(`path[path.length-1]==='leg_kneebar'`), await t.ev('JSON.stringify(path)'));
  ok('Matrix search placeholder derived from data', await t.ev(`document.getElementById('searchInput').placeholder.includes(Object.keys(NODES).length+' ')`), await t.ev(`document.getElementById('searchInput').placeholder`));

  await t.ev(`document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'/',bubbles:true}))`);
  ok('"/" opens search', await t.ev(`!!document.querySelector('.search-overlay')`));
  await t.ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  await t.ev(`(()=>{const i=document.getElementById('searchInput');i.focus();i.dispatchEvent(new KeyboardEvent('keydown',{key:'/',bubbles:true}))})()`);
  ok('"/" ignored while typing in a field', await t.ev(`!document.querySelector('.search-overlay')`));

  // 3. Knowledge deep links
  await t.go(BASE + 'knowledge.html#kneebar'); await sleep(500);
  ok('knowledge.html#kneebar opens the detail panel', await t.ev(`!document.getElementById('kbPanel').hidden && document.getElementById('kbPanelTitle').textContent==='Kneebar'`));
  await t.shot('knowledge-deeplink');
  await t.ev(`(()=>{const s=document.getElementById('navSelect');s.value='t:submission';s.dispatchEvent(new Event('change'))})()`);
  await t.ev(`location.hash='armbar'`); await sleep(300);
  ok('Knowledge hash clears filter and opens panel', await t.ev(`document.getElementById('kbPanelTitle').textContent.startsWith('Armbar') && view.startsWith('g:')`));

  // 4. Principles deep links
  for (const id of ['kuzushi', 'hierarchy', 'distances']) {
    await t.go(BASE + 'principles.html#' + id);
    ok('principles.html#' + id + ' opens panel', await t.ev(`document.getElementById('si-${id}').classList.contains('active') && document.getElementById('mdContent').textContent.length>50`));
  }

  // 5. Every search-index entry resolves to a real item
  await t.go(BASE + 'knowledge.html'); const kIds = await t.ev(`DB.map(x=>x.id)`);
  await t.go(BASE + 'principles.html'); const pIds = await t.ev(`PRINCIPLES.map(x=>x.id).concat(REF_SECTIONS.map(x=>x.id))`);
  await t.go(BASE + 'chinthe-guardian-matrix.html'); const mIds = await t.ev(`Object.keys(NODES)`);
  const src = fs.readFileSync(require('path').join(__dirname, '..', 'chinthe.js'), 'utf8');
  const idx = [...src.matchAll(/\n\s+([mpk])\("([a-z_]+)"/g)].map(m => [m[1], m[2]]);
  const bad = idx.filter(([c, id]) => !({ m: mIds, p: pIds, k: kIds }[c]).includes(id));
  ok(`All ${idx.length} search entries resolve to a real item`, bad.length === 0, JSON.stringify(bad));
  const idxM = new Set(idx.filter(x => x[0] === 'm').map(x => x[1])), idxK = new Set(idx.filter(x => x[0] === 'k').map(x => x[1]));
  const unsearchable = mIds.filter(i => !idxM.has(i)).concat(kIds.filter(i => !idxK.has(i)));
  ok(`Every matrix node (${mIds.length}) and knowledge entry (${kIds.length}) is searchable`, unsearchable.length === 0, JSON.stringify(unsearchable));

  // 6. Homepage
  await t.go(BASE + 'index.html');
  const nc = await t.ev(`document.querySelector('[data-node-count]').textContent`);
  ok('Homepage node count matches matrix', nc === String(mIds.length), nc);
  ok('Coming Soon card is not a link', await t.ev(`!!document.querySelector('div.mod-soon') && !document.querySelector('a.mod-soon')`));

  // 7. Journal date under UTC+11
  await t.send('Emulation.setTimezoneOverride', { timezoneId: 'Australia/Sydney' });
  await t.go(BASE + 'journal.html');
  ok('Journal default date = local date (Sydney)', await t.ev(`(()=>{const d=new Date();return document.getElementById('fDate').value===d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})()`));
  ok('localISODate correct at 08:00 Sydney (old code gave previous day)', await t.ev(`localISODate(new Date(2026,9,14,8,0))==='2026-10-14' && new Date(2026,9,14,8,0).toISOString().slice(0,10)==='2026-10-13'`));

  // 8. Backup / restore
  await t.ev(`window.alert=m=>{window.__alerts=(window.__alerts||[]).concat(m)};localStorage.removeItem('chinthe_journal_v1');renderAll()`);
  await t.ev(`(()=>{document.getElementById('fTitle').value='Test roll';addTag('Kneebar');saveSession();})()`);
  ok('Session saves', await t.ev(`loadSessions().length===1`));
  const backup = await t.ev(`JSON.stringify({app:'chinthe-journal',version:1,sessions:loadSessions().concat([{id:'x1',date:'2026-10-01',type:'sparring',title:'Old roll',techniques:['Armbar']},{id:'bad',date:'nope',title:''},{id:'x2',date:'2026-09-01',type:'weird',title:'<img src=x onerror=alert(1)>',techniques:'notarray'}])})`);
  const restore = content => `(()=>{const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(content)}],'b.json',{type:'application/json'}));const i=document.getElementById('restoreInput');i.files=dt.files;i.dispatchEvent(new Event('change'))})()`;
  await t.ev(restore(backup)); await sleep(400);
  const after = await t.ev(`loadSessions().map(s=>s.id+':'+s.type)`);
  ok('Restore merges new, skips duplicates + invalid, normalises fields', after.length === 3 && after.includes('x1:sparring') && after.includes('x2:drilling'), JSON.stringify(after) + ' alerts=' + JSON.stringify(await t.ev('window.__alerts')));
  ok('Restored HTML in titles renders as text', await t.ev(`!document.querySelector('#sessionList img') && document.getElementById('sessionList').textContent.includes('<img src=x')`));
  ok('Restore sorted newest first', await t.ev(`(()=>{const d=loadSessions().map(s=>s.date);return d.join()===[...d].sort().reverse().join()})()`));
  await t.ev(restore(backup)); await sleep(300);
  ok('Re-restoring same backup adds nothing', await t.ev(`loadSessions().length===3 && window.__alerts.at(-1).includes('already here')`), await t.ev('window.__alerts.at(-1)'));
  await t.ev(restore('not json')); await sleep(300);
  ok('Bad file rejected with message, data untouched', await t.ev(`window.__alerts.at(-1).includes("isn't a valid backup") && loadSessions().length===3`));
  await t.ev(`HTMLAnchorElement.prototype.click=function(){window.__dl=(window.__dl||[]).concat(this.download)}`);
  await t.ev(`exportAll(); backupJSON();`);
  ok('Markdown export + JSON backup run with restored data', await t.ev(`window.__dl.length===2 && /chinthe-journal-backup-\\d{4}-\\d{2}-\\d{2}\\.json/.test(window.__dl[1])`), await t.ev('JSON.stringify(window.__dl)'));
  await t.ev(`location.reload()`); await sleep(1200);
  await t.shot('journal-mobile');

  // 8b. Backup reminder
  await t.ev(`localStorage.removeItem('chinthe_journal_backup_v1')`);
  await t.go(BASE + 'journal.html');
  ok('Reminder shows: 3 sessions, never backed up', await t.ev(`!document.getElementById('backupReminder').hidden && document.getElementById('lastBackupText').textContent==='Never backed up'`), await t.ev(`document.getElementById('brTitle').textContent`));
  await t.ev(`HTMLAnchorElement.prototype.click=function(){}`);
  await t.ev(`document.getElementById('brBackup').click()`);
  ok('Backing up hides reminder and records date', await t.ev(`document.getElementById('backupReminder').hidden && document.getElementById('lastBackupText').textContent==='Last backup today'`), await t.ev(`document.getElementById('lastBackupText').textContent`));
  await t.ev(`(()=>{const st=JSON.parse(localStorage.getItem('chinthe_journal_backup_v1'));st.at=new Date(Date.now()-20*864e5).toISOString();localStorage.setItem('chinthe_journal_backup_v1',JSON.stringify(st));document.getElementById('fTitle').value='New roll';saveSession();})()`);
  ok('Reminder returns: new session + backup 20 days old', await t.ev(`!document.getElementById('backupReminder').hidden && document.getElementById('lastBackupText').textContent.includes('20 days ago · 1 session not in it')`), await t.ev(`document.getElementById('lastBackupText').textContent`));
  await t.ev(`document.getElementById('brLater').click()`);
  await t.go(BASE + 'journal.html');
  ok('"Later" snoozes across reloads', await t.ev(`document.getElementById('backupReminder').hidden`));
  await t.shot('journal-reminder');

  // 8c. Matrix decision panel + layout
  await t.go(BASE + 'chinthe-guardian-matrix.html#guard_closed'); await sleep(600);
  ok('Panel lists every option from the node', await t.ev(`[...document.querySelectorAll('#detailCard [data-go]')].map(b=>b.dataset.go).join()===NODES.guard_closed.children.join()`));
  await t.ev(`document.querySelector('#detailCard [data-go="cg_armbar"]').click()`); await sleep(400);
  ok('Tapping an option moves to it', await t.ev(`path.join('>')==='guard_closed>cg_armbar'`), await t.ev(`path.join('>')`));
  ok('"Back to" shows the previous step', await t.ev(`document.querySelector('[data-back]').textContent.includes('Closed Guard')`));
  await t.ev(`document.querySelector('[data-back]').click()`); await sleep(300);
  ok('"Back to" returns', await t.ev(`path.join('>')==='guard_closed'`));
  ok('Mobile matrix header no longer sticky', await t.ev(`getComputedStyle(document.querySelector('.wrap > header')).position!=='sticky'`));
  await t.close();

  const d = await newTab(); await d.vp(1440, 900, false);
  for (const id of ['hub', 'pass', 'guard_closed', 'leg_entanglement', 'def_start']) {
    await d.go(BASE + 'chinthe-guardian-matrix.html#' + id); await sleep(700);
    const r = await d.ev(`(()=>{const vp=document.getElementById('treeViewport').getBoundingClientRect();
      const ids=[path.at(-1)].concat(NODES[path.at(-1)].children||[]);
      const out=ids.filter(i=>{const b=nodeEls[i].querySelector('.tree-node-badge').getBoundingClientRect();return b.left<vp.left||b.right>vp.right||b.top<vp.top||b.bottom>vp.bottom});
      return out;})()`);
    ok(`[d1440] #${id}: node + all options framed in view`, r.length === 0, JSON.stringify(r));
  }
  ok('[d1440] Detail pane beside the tree, above the fold', await d.ev(`(()=>{const p=document.getElementById('detailPane').getBoundingClientRect(),t=document.getElementById('treeWrap').getBoundingClientRect();return p.left>=t.right && p.top<200})()`));
  ok('[d1440] App frame not clipped by breadcrumb', await d.ev(`document.querySelector('.wrap').getBoundingClientRect().bottom<=innerHeight+1`), await d.ev(`document.querySelector('.wrap').getBoundingClientRect().bottom+' vs '+innerHeight`));
  await d.shot('matrix-d1440-pass');
  await d.vp(1024, 768, false); await d.go(BASE + 'chinthe-guardian-matrix.html#guard_closed'); await sleep(600);
  ok('[d1024] Detail pane beside the tree', await d.ev(`(()=>{const p=document.getElementById('detailPane').getBoundingClientRect(),t=document.getElementById('treeWrap').getBoundingClientRect();return p.left>=t.right && t.width>=320})()`), await d.ev(`document.getElementById('treeWrap').getBoundingClientRect().width`));
  await d.vp(1440, 900, false);
  // ── Uniform layout + themes (desktop)
  await d.vp(1440, 900, false);
  await d.go(BASE + 'knowledge.html'); await sleep(300);
  const cols = await d.ev(`(()=>{const n=document.querySelector('.app-nav').getBoundingClientRect(),m=document.getElementById('kbMid').getBoundingClientRect(),p=document.getElementById('kbPanel').getBoundingClientRect();return {ok:n.right<=m.left+1&&m.right<=p.left+1&&p.width>350&&!document.getElementById('kbPanel').hidden, n:Math.round(n.width), m:Math.round(m.width), p:Math.round(p.width)}})()`);
  ok('[d1440] Knowledge: three panels side by side (database | moves | detail)', cols.ok, JSON.stringify(cols));
  ok('[d1440] Detail panel shows a placeholder until a move is chosen', await d.ev(`document.getElementById('kbPanel').classList.contains('is-empty') && document.getElementById('kbPanelBody').textContent.includes('Select a move')`));
  await d.ev(`document.querySelector('.app-nav-item[data-view="g:closed"]').click()`); await sleep(200);
  ok('[d1440] Choosing a position lists its moves and opens the position itself', await d.ev(`document.getElementById('midTitle').textContent==='Closed Guard' && document.querySelectorAll('.tech-card').length===9 && document.getElementById('kbPanelTitle').textContent==='Closed Guard'`));
  await d.ev(`document.getElementById('tech-kimura').click()`); await sleep(150);
  ok('[d1440] Clicking a move updates the docked detail (no overlay)', await d.ev(`document.getElementById('kbPanelTitle').textContent==='Kimura' && document.getElementById('kbBackdrop').hidden && !document.body.classList.contains('kb-open')`));
  ok('[d1440] Detail "Found in" links back to position groups', await d.ev(`[...document.querySelectorAll('[data-goto]')].map(b=>b.textContent).includes('Side Control & North-South')`));
  await d.go(BASE + 'principles.html'); await sleep(300);
  ok('[d1440] Principles uses the same shell: list left, reading column right', await d.ev(`(()=>{const n=document.querySelector('.app-nav').getBoundingClientRect(),m=document.getElementById('mdPanel').getBoundingClientRect();return n.right<=m.left+1 && getComputedStyle(document.getElementById('prSelect')).display==='none' && document.querySelector('.app-nav-item.active').dataset.group==='all' && document.querySelector('#prList .list-card.active').id==='si-efficiency'})()`));
  await d.ev(`document.querySelector('[data-group="mechanics"]').click()`);
  ok('[d1440] Principles: a group filters the cards and opens its first principle', await d.ev(`document.querySelectorAll('#prList .list-card').length===5 && document.querySelector('.panel-title').textContent.startsWith('Drive')`));
  // Same header component across document pages
  // Every page: unique left panel | information in the middle | right panel, same fonts and widths
  const FRAME = {
    'chinthe-guardian-matrix.html': ['.wrap > header', '.tree-wrap', '#detailPane'],
    'competition.html':             ['.app-nav', '.app-list', '.app-detail'],
    'knowledge.html':               ['.app-nav', '#kbMid', '#kbPanel'],
    'principles.html':              ['.app-nav', '.app-list', '.app-detail'],
    'journal.html':                 ['.app-nav', '.app-list', '.app-detail']
  };
  const widths = {}, mids = {};
  for (const [p, [l, m, r]] of Object.entries(FRAME)) {
    await d.go(BASE + p); await sleep(300);
    const g = await d.ev(`(()=>{const L=document.querySelector('${l}').getBoundingClientRect(),M=document.querySelector('${m}').getBoundingClientRect(),R=document.querySelector('${r}').getBoundingClientRect();
      const title=document.querySelector('.app-title');
      return {order: L.right<=M.left+1 && M.right<=R.left+1 && L.width>=260, widest: R.width > M.width && R.width > L.width, left:Math.round(L.width), middle:Math.round(M.width), right:Math.round(R.right-R.left),
        body:getComputedStyle(document.body).fontFamily, title: title?getComputedStyle(title).fontFamily:'none'}})()`);
    widths[p] = g.left;
    ok(`[d1440] ${p}: WHERE | WHAT | READ order`, g.order, JSON.stringify(g));
    ok(`[d1440] ${p}: the reading panel is the widest`, g.widest, JSON.stringify(g));
    mids[p] = g.middle;
    ok(`[d1440] ${p}: shared fonts (Inter body, Oswald titles)`, g.body.startsWith('Inter') && g.title.includes('Oswald'), g.body + ' / ' + g.title);
  }
  ok('[d1440] Left panel is the same width on every page', new Set(Object.values(widths)).size === 1, JSON.stringify(widths));
  ok('[d1440] Middle panel is the same width on every page', new Set(Object.values(mids)).size === 1, JSON.stringify(mids));
  const fontLinks = await d.ev(`Promise.all(${JSON.stringify(['index.html',...Object.keys(FRAME)])}.map(f=>fetch(f).then(r=>r.text()).then(t=>(t.match(/fonts\\.googleapis\\.com\\/css2\\?[^"]*/)||[''])[0])))`);
  ok('Every page loads the identical font set', new Set(fontLinks).size === 1, JSON.stringify([...new Set(fontLinks)]));
  await d.go(BASE + 'journal.html');
  await d.ev(`localStorage.setItem('chinthe_journal_v1', JSON.stringify([{id:'j1',date:'2026-10-10',type:'sparring',title:'Open mat',techniques:['Kimura'],worked:'Kimura trap',needs:'',drill:'',notes:'',timestamp:'2026-10-10T10:00:00Z'}]))`);
  await d.go(BASE + 'journal.html');
  await d.ev(`document.querySelector('#sessionList [data-sid="j1"]').click()`);
  ok('[d1440] Journal: a session card opens it in the reading panel', await d.ev(`!document.getElementById('sessionView').hidden && document.getElementById('jTitle').textContent==='Open mat' && document.getElementById('formWrap').hidden`));
  await d.ev(`document.getElementById('newSessionBtn').click()`);
  ok('[d1440] Journal: "New session" returns to the form', await d.ev(`!document.getElementById('formWrap').hidden && document.getElementById('sessionView').hidden`));
  await d.ev(`localStorage.removeItem('chinthe_journal_v1')`);
  await d.go(BASE + 'competition.html');
  await d.ev(`document.querySelector('.ruleset-btn[data-rs="ibjjf"]').click()`);
  ok('[d1440] Compete: ruleset list on the left drives the middle and right panels', await d.ev(`document.getElementById('rulesetTitle').textContent==='IBJJF' && document.getElementById('scoringTitle').textContent.includes('IBJJF')`));
  await d.ev(`document.querySelector('.ruleset-btn[data-rs="adcc"]').click()`);
  // Themes
  await d.go(BASE + 'index.html');
  await d.ev(`localStorage.removeItem('chinthe_theme')`);
  await d.go(BASE + 'index.html');
  const contrast = `(()=>{const toRGB=c=>c.match(/[\\d.]+/g).slice(0,3).map(Number);const L=([r,g,b])=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)};const cs=getComputedStyle(document.body);const a=L(toRGB(cs.color)),b=L(toRGB(cs.backgroundColor));return +(((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)).toFixed(2))})()`;
  ok('Theme defaults to System (no override stored)', await d.ev(`!document.documentElement.hasAttribute('data-theme') && document.querySelector('.site-nav-theme').getAttribute('aria-label').startsWith('Theme: System')`));
  await d.ev(`document.querySelector('.site-nav-theme').click()`);
  const lightBg = await d.ev(`getComputedStyle(document.body).backgroundColor`);
  ok('Toggle → Light applies the light palette', await d.ev(`document.documentElement.getAttribute('data-theme')==='light'`) && lightBg === 'rgb(245, 243, 238)', lightBg);
  const cLight = await d.ev(contrast);
  ok('Light theme body text contrast ≥ 7:1', cLight >= 7, String(cLight));
  await d.ev(`document.querySelector('.site-nav-theme').click()`);
  const darkBg = await d.ev(`getComputedStyle(document.body).backgroundColor`);
  ok('Toggle → Dark applies the dark palette', await d.ev(`document.documentElement.getAttribute('data-theme')==='dark'`) && darkBg === 'rgb(10, 14, 19)', darkBg);
  const cDark = await d.ev(contrast);
  ok('Dark theme body text contrast ≥ 7:1', cDark >= 7, String(cDark));
  await d.go(BASE + 'knowledge.html');
  ok('Theme choice persists across pages (applied before first paint)', await d.ev(`document.documentElement.getAttribute('data-theme')==='dark' && document.head.innerHTML.indexOf('chinthe_theme') < document.head.innerHTML.indexOf('chinthe.css')`));
  await d.ev(`document.querySelector('.site-nav-theme').click()`);
  ok('Toggle → back to System clears the override', await d.ev(`!document.documentElement.hasAttribute('data-theme') && localStorage.getItem('chinthe_theme')===null`));
  await d.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  ok('System mode follows the device: dark', await d.ev(`getComputedStyle(document.body).backgroundColor==='rgb(10, 14, 19)'`));
  await d.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  ok('System mode follows the device: light', await d.ev(`getComputedStyle(document.body).backgroundColor==='rgb(245, 243, 238)'`));
  await d.send('Emulation.setEmulatedMedia', { features: [] });
  const raw = await d.ev(`Promise.all(['index.html','chinthe-guardian-matrix.html','competition.html','knowledge.html','principles.html','journal.html'].map(f=>fetch(f).then(r=>r.text()).then(t=>[f,((t.match(/<style>[\\s\\S]*?<\\/style>/g)||[]).join('').replace(/\\.philosophy\\{[\\s\\S]*?\\}/,'').replace(/\\.philosophy::before\\{[\\s\\S]*?\\}/,'').replace(/\\.philosophy-mark\\{[\\s\\S]*?\\}/,'').match(/#[0-9a-fA-F]{6}\\b|rgba?\\(/g)||[]).length])))`);
  ok('No hard-coded colours left in page styles (brand band excepted)', raw.every(([, n]) => n === 0), JSON.stringify(raw));
  await d.go(BASE + 'index.html');
  ok('Homepage: 6 module cards incl. Compete', await d.ev(`document.querySelectorAll('#inside .mod').length===6 && !!document.querySelector('.mod[href="competition.html"]')`));
  ok('Homepage is a full-width brand page: says what CHINTHE is, who it is for, and its values', await d.ev(`!document.querySelector('.app-shell') && /training system for grapplers/.test(document.querySelector('.hero-sub').textContent) && document.querySelectorAll('#who .who-card').length===4 && document.querySelectorAll('#values .value').length===4`));
  ok('Homepage: progress strip hidden for first-time visitors', await d.ev(`document.getElementById('welcome').hidden === !(localStorage.getItem('chinthe_journal_v1')||localStorage.getItem('chinthe_mastery_v1'))`));
  await d.go(BASE + 'competition.html');
  ok('Compete ADCC: clean takedown 4, clean sweep 4, guard pull −1', await d.ev(`(()=>{const a=RULESETS.adcc;const f=n=>a.positive.find(x=>x.action.startsWith(n))?.pts;return f('Clean takedown')===4&&f('Clean sweep')===4&&f('Back control')===3&&a.other[0].pts==='−1'})()`));
  await d.go(BASE + 'principles.html#hierarchy');
  ok('Principles hierarchy: back control +3 (ADCC)', await d.ev(`/\\+3<\\/span><span class="hier-name">Rear Mount/.test(document.getElementById('mdPanel').innerHTML)`));
  await d.close();

  const t2 = await newTab(); await t2.vp(390, 844, true);
  // 9. No floating overlays; knowledge grouping; focus view
  for (const p of ['knowledge.html', 'principles.html', 'journal.html', 'competition.html']) {
    await t2.go(BASE + p);
    ok(`${p}: no floating progress overlay`, await t2.ev(`!document.querySelector('.learn-next-nudge') && [...document.querySelectorAll('body *')].filter(e=>getComputedStyle(e).position==='fixed' && e.offsetParent!==null && !e.closest('.site-nav')).length===0`));
  }
  await t2.go(BASE + 'knowledge.html');
  ok('Knowledge All view grouped into 8 category sections', await t2.ev(`document.querySelectorAll('.kb-section').length===8`));
  ok('Knowledge cards: no tag chips on cards (tags live in the panel)', await t2.ev(`[...document.querySelectorAll('.tech-card-tags')].every(t=>t.closest('#kbPanel'))`));
  // Detail panel behaviour
  await t2.ev(`document.getElementById('searchInput').value='';document.getElementById('searchInput').dispatchEvent(new Event('input'))`);
  const cardH = await t2.ev(`document.getElementById('tech-back_control').getBoundingClientRect().height`);
  await t2.ev(`document.getElementById('tech-back_control').click()`); await sleep(300);
  ok('Clicking a card opens the detail panel, not an in-grid expansion', await t2.ev(`!document.getElementById('kbPanel').hidden && document.getElementById('kbPanelTitle').textContent==='Back Control' && document.getElementById('tech-back_control').getBoundingClientRect().height===${cardH}`));
  ok('Panel shows all sections at once', await t2.ev(`document.querySelectorAll('#kbPanel .kb-sec').length===4 && !!document.querySelector('#kbPanel .kb-lead')`));
  ok('Panel link is shareable (hash set)', await t2.ev(`location.hash==='#back_control'`));
  ok('Focus moves into the panel', await t2.ev(`document.getElementById('kbPanel').contains(document.activeElement)`));
  await t2.ev(`document.getElementById('kbNext').click()`);
  ok('Next arrow moves to the next visible entry', await t2.ev(`document.getElementById('kbPanelTitle').textContent==='Mount' && document.getElementById('kbPos').textContent.startsWith('2 /')`));
  await t2.ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  ok('Escape closes the panel and clears the hash', await t2.ev(`document.getElementById('kbPanel').hidden && !location.hash && !document.body.classList.contains('kb-open')`));
  await t2.ev(`(()=>{const s=document.getElementById('navSelect');s.value='t:submission';s.dispatchEvent(new Event('change'))})()`);
  await t2.ev(`document.querySelector('.tech-card').click()`);
  ok('Panel navigation respects the active filter', await t2.ev(`document.getElementById('kbPos').textContent.endsWith('/ '+document.querySelectorAll('.tech-card').length) && document.getElementById('kbPrev').disabled`));
  await t2.ev(`document.getElementById('kbBackdrop').click()`);
  ok('Backdrop click closes the panel', await t2.ev(`document.getElementById('kbPanel').hidden`));
  // No personal references anywhere in the content
  const personal = await t2.ev(`fetch('knowledge.html').then(r=>r.text()).then(k=>fetch('chinthe-guardian-matrix.html').then(r=>r.text()).then(m=>fetch('competition.html').then(r=>r.text()).then(c=>(k+m+c).match(/\b(phil'?s?|wrestling[- ]base|wrestler'?s base|built for wrestlers|you live (here|in this)|signature throw|go-to game)\b/gi)||[])))`);
  ok('No personalised content (name, "your wrestling base", "go-to game")', personal.length === 0, JSON.stringify(personal));
  ok('Knowledge filter row fits phone width (scrolls, no page overflow)', await t2.ev(`document.documentElement.scrollWidth<=innerWidth`));
  await t2.ev(`document.getElementById('searchInput').value='choke';document.getElementById('searchInput').dispatchEvent(new Event('input'))`);
  ok('Search spans the whole database', await t2.ev(`document.getElementById('midEyebrow').textContent==='Search' && document.querySelectorAll('.tech-card').length>3`));
  await t2.go(BASE + 'chinthe-guardian-matrix.html#pass');
  await t2.ev(`localStorage.removeItem('chinthe_matrix_view')`);
  await t2.go(BASE + 'index.html');
  await t2.go(BASE + 'chinthe-guardian-matrix.html#pass'); await sleep(600);
  ok('Matrix defaults to Focus view', await t2.ev(`viewMode==='focus' && treeCanvas.classList.contains('focus-view')`));
  ok('Focus view draws only the decision (node + options)', await t2.ev(`[...document.querySelectorAll('.tree-node')].filter(n=>getComputedStyle(n).display!=='none').length===1+NODES.pass.children.length`));
  ok('Focus view: no option labels overlap', await t2.ev(`(()=>{const r=[...document.querySelectorAll('.tree-node')].filter(n=>getComputedStyle(n).display!=='none').map(n=>n.querySelector('.tree-node-label').getBoundingClientRect());for(let i=0;i<r.length;i++)for(let j=i+1;j<r.length;j++){const a=r[i],b=r[j];if(a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1)return false}return true})()`));
  ok('Focus view labels readable (zoom ≥ 0.6 on phone)', await t2.ev(`zoom>=0.6`), await t2.ev('zoom'));
  await t2.ev(`document.querySelector('.view-switch [data-view="map"]').click()`); await sleep(500);
  ok('Full map toggle shows every node', await t2.ev(`viewMode==='map' && [...document.querySelectorAll('.tree-node')].filter(n=>getComputedStyle(n).display!=='none').length===Object.keys(NODES).length`));
  await t2.go(BASE + 'chinthe-guardian-matrix.html#pass'); await sleep(500);
  ok('View choice persists across reloads', await t2.ev(`viewMode==='map'`));
  await t2.ev(`document.querySelector('.view-switch [data-view="focus"]').click()`);
  ok('Zero-point nodes show no "+0" badge', await t2.ev(`(()=>{jumpTo('guard_closed');return !document.getElementById('detailCard').textContent.includes('+0 pt') && !nodeEls.guard_closed.textContent.includes('+0 pt')})()`));
  // 10. Reference-site features: levels, aliases, progress sync, related, video, glossary
  await t2.go(BASE + 'knowledge.html');
  await t2.ev(`localStorage.removeItem('chinthe_mastery_v1')`);
  await t2.go(BASE + 'knowledge.html');
  const lv = await t2.ev(`(()=>{const c={};['F','I','A'].forEach(l=>{document.querySelector('.level-btn[data-lvl="'+l+'"]').click();c[l]=document.querySelectorAll('.tech-card').length});document.querySelector('.level-btn[data-lvl="all"]').click();return c})()`);
  ok('Level filter: every entry has a level, counts add to the total', lv.F + lv.I + lv.A === (await t2.ev('DB.length')) && lv.F > 0 && lv.A > 0, JSON.stringify(lv));
  ok('Every card shows a level chip', await t2.ev(`[...document.querySelectorAll('.tech-card')].every(c=>c.querySelector('.chip[class*="lvl-"]'))`));
  await t2.ev(`document.getElementById('startBtn').click()`);
  ok('"Show fundamentals" applies the Fundamental filter and hides the banner', await t2.ev(`document.querySelector('.level-btn.active').dataset.lvl==='F' && document.getElementById('startHere').hidden`));
  await t2.ev(`document.querySelector('.level-btn[data-lvl="all"]').click()`);
  await t2.ev(`(()=>{const i=document.getElementById('searchInput');i.value='mata leão';i.dispatchEvent(new Event('input'))})()`);
  ok('Alias search: "Mata Leão" finds the Rear Naked Choke', await t2.ev(`[...document.querySelectorAll('.tech-card')].some(c=>c.id==='tech-rnc')`));
  await t2.ev(`(()=>{const i=document.getElementById('searchInput');i.value='';i.dispatchEvent(new Event('input'))})()`);
  await t2.ev(`document.getElementById('tech-darce').click()`);
  ok('Panel shows aliases, level, points/format chips', await t2.ev(`document.querySelector('.kb-aka').textContent.includes('Brabo') && document.querySelectorAll('.kb-meta-row .chip').length>=2`));
  ok('Panel has the 4-step training plan', await t2.ev(`document.querySelectorAll('.kb-steps li').length===4`));
  ok('Matrix link points at a real node', await t2.ev(`document.querySelector('.kb-link[href^="chinthe-guardian-matrix.html#"]').getAttribute('href')==='chinthe-guardian-matrix.html#fh_darce'`));
  await t2.ev(`document.querySelector('[data-mastery="2"]').click()`);
  ok('Progress set in Knowledge writes the shared Matrix store', await t2.ev(`JSON.parse(localStorage.getItem('chinthe_mastery_v1')).fh_darce===2 && document.querySelector('[data-mastery="2"]').classList.contains('active')`));
  ok('Card shows the progress dot', await t2.ev(`!!document.querySelector('#tech-darce .mdot.m2')`));
  await t2.go(BASE + 'chinthe-guardian-matrix.html#fh_darce'); await sleep(500);
  ok('Matrix reflects progress set in Knowledge', await t2.ev(`nodeEls.fh_darce.classList.contains('m-drilling')`));
  await t2.go(BASE + 'knowledge.html#darce'); await sleep(300);
  await t2.ev(`document.querySelector('.kb-rel [data-open="anaconda"]').click()`);
  ok('Related link opens that entry', await t2.ev(`document.getElementById('kbPanelTitle').textContent==='Anaconda Choke'`));
  ok('Video link is an external search in a new tab', await t2.ev(`(()=>{const a=document.querySelector('.kb-link.ext');return a.target==='_blank' && a.rel.includes('noopener') && a.href.startsWith('https://www.youtube.com/results?search_query=Anaconda')})()`));
  const relBad = await t2.ev(`Object.entries(META).flatMap(([id,m])=>(m.rel||[]).filter(r=>!DB.some(d=>d.id===r)).map(r=>id+'→'+r))`);
  ok('Every related link resolves', relBad.length === 0, JSON.stringify(relBad));
  await t2.go(BASE + 'principles.html#glossary'); await sleep(300);
  ok('Glossary reference section opens with 30+ terms', await t2.ev(`document.querySelectorAll('.gl-row').length>=30`));
  await t2.close();

  fs.writeFileSync(OUT + '/results.json', JSON.stringify(results, null, 1));
  const f = results.filter(r => !r.pass).length; console.log(`\n${results.length - f}/${results.length} passed`); process.exit(f ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
