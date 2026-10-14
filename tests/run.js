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
  const PAGES = ['index.html', 'chinthe-guardian-matrix.html', 'competition.html', 'knowledge.html', 'principles.html', 'journal.html', 'gameplan.html'];

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
      const hf = await t.ev(`(()=>{const links=[...document.querySelectorAll('.site-nav-links a')].map(a=>a.textContent).join('|');const cur=document.querySelectorAll('.site-nav [aria-current="page"]');const f=document.querySelector('.site-footer');
        return {links, cur:cur.length, curHref:cur[0]&&cur[0].getAttribute('href'), cta:!!document.querySelector('.site-nav-cta[href="chinthe-guardian-matrix.html"]'), footer:!!f && f.textContent.includes('Rooted in Myanmar · Built for the World · Alpha') && f.textContent.includes('tap early') && f.querySelectorAll('a').length===6}})()`);
      ok(`[${tag}] ${p}: shared header (six tools, Open Matrix, current page marked) and footer`, hf.links === 'Matrix|Compete|Encyclopedia|Principles|Game Plan|Journal' && hf.cur === 1 && hf.curHref === p && hf.cta && hf.footer, JSON.stringify(hf));
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

  // 8b2. Keeping journal data safe on iOS: persist on first save, stale-backup prompt, Home Screen tip
  await t.ev(`localStorage.removeItem('chinthe_journal_backup_v1');localStorage.removeItem('chinthe_journal_v1')`);
  await t.go(BASE + 'journal.html');
  ok('Journal: does not ask for persistent storage on page load', await t.ev(`!JSON.parse(localStorage.getItem('chinthe_journal_backup_v1')||'{}').persist`));
  await t.ev(`window.__persistCalls=0;navigator.storage.persist=()=>{window.__persistCalls++;return Promise.resolve(true)}`);
  await t.ev(`(()=>{document.getElementById('fTitle').value='First roll';saveSession();})()`); await sleep(150);
  ok('Journal: first save asks for persistent storage and records the answer', await t.ev(`(()=>{const p=JSON.parse(localStorage.getItem('chinthe_journal_backup_v1')).persist;return window.__persistCalls===1 && p.result==='granted' && !!p.at})()`), await t.ev(`localStorage.getItem('chinthe_journal_backup_v1')`));
  await t.ev(`(()=>{document.getElementById('fTitle').value='Second roll';saveSession();})()`); await sleep(150);
  ok('Journal: later saves do not ask again', await t.ev(`window.__persistCalls===1`));
  await t.ev(`localStorage.removeItem('chinthe_journal_backup_v1');window.__persistCalls=0;navigator.storage.persist=()=>{window.__persistCalls++;return Promise.resolve(false)};document.getElementById('fTitle').value='Third roll';saveSession();`); await sleep(150);
  ok('Journal: a refusal is recorded too', await t.ev(`JSON.parse(localStorage.getItem('chinthe_journal_backup_v1')).persist.result==='denied'`));
  // Stale-backup prompt: 5+ entries and no backup in 14+ days, even when every entry is in that backup
  const seed = (n, daysAgo) => `(()=>{const s=[];for(let i=0;i<${n};i++)s.push({id:'s'+i,date:'2026-09-0'+(i%9+1),type:'drilling',title:'Roll '+i,techniques:[],worked:'',needs:'',drill:'',notes:'',timestamp:'2026-09-01T10:00:00Z'});
    localStorage.setItem('chinthe_journal_v1',JSON.stringify(s));
    localStorage.setItem('chinthe_journal_backup_v1',JSON.stringify(${daysAgo === null ? '{}' : `{at:new Date(Date.now()-${daysAgo}*864e5).toISOString(),ids:s.map(x=>x.id)}`}));})()`;
  const reminderShown = `!document.getElementById('backupReminder').hidden`;
  await t.ev(seed(5, 15)); await t.go(BASE + 'journal.html');
  ok('Journal: 5 entries, last backup 15 days ago (all in it): "Back up your journal" shows', await t.ev(`${reminderShown} && document.getElementById('brTitle').textContent==='Back up your journal' && document.getElementById('brSub').textContent.includes('15 days ago')`), await t.ev(`document.getElementById('brTitle').textContent+' / '+document.getElementById('brSub').textContent`));
  ok('Journal: the prompt sits at the top of the page, with the backup button', await t.ev(`!!document.querySelector('.app-nav-head #backupReminder #brBackup') && document.getElementById('backupReminder').getBoundingClientRect().top < document.getElementById('formWrap').getBoundingClientRect().top`));
  await t.ev(`HTMLAnchorElement.prototype.click=function(){window.__dl=(window.__dl||[]).concat(this.download)}`);
  await t.ev(`document.getElementById('brBackup').click()`);
  ok('Journal: the prompt links to the existing backup, which clears it', await t.ev(`/chinthe-journal-backup-/.test((window.__dl||[]).at(-1)) && document.getElementById('backupReminder').hidden`));
  await t.ev(seed(5, 13)); await t.go(BASE + 'journal.html');
  ok('Journal: 5 entries backed up 13 days ago: no prompt', await t.ev(`!(${reminderShown})`));
  await t.ev(seed(4, 20)); await t.go(BASE + 'journal.html');
  ok('Journal: 4 entries backed up 20 days ago: no prompt', await t.ev(`!(${reminderShown})`));
  await t.ev(seed(5, null)); await t.go(BASE + 'journal.html');
  ok('Journal: 5 entries never backed up: prompt shows', await t.ev(reminderShown));
  await t.ev(`document.getElementById('brLater').click()`);
  await t.go(BASE + 'journal.html');
  ok('Journal: the prompt is dismissible and stays dismissed', await t.ev(`!(${reminderShown}) && JSON.parse(localStorage.getItem('chinthe_journal_backup_v1')).snoozeUntil > Date.now()`));
  // Home Screen tip: the rule itself, for each kind of device
  const SAFARI_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
  const tipRule = await t.ev(`(()=>{const n=(ua,extra)=>Object.assign({userAgent:ua,maxTouchPoints:5},extra||{});return {
    iphone: needsInstallTip(n(${JSON.stringify(SAFARI_IPHONE)})),
    ipad: needsInstallTip(n('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15')),
    installed: needsInstallTip(n(${JSON.stringify(SAFARI_IPHONE)},{standalone:true})),
    chromeIOS: needsInstallTip(n('Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0 Mobile/15E148 Safari/604.1')),
    mac: needsInstallTip(n('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',{maxTouchPoints:0})),
    android: needsInstallTip(n('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Mobile Safari/537.36')),
    here: needsInstallTip()}})()`);
  ok('Journal: Home Screen tip only for iPhone/iPad Safari that is not installed', tipRule.iphone && tipRule.ipad && !tipRule.installed && !tipRule.chromeIOS && !tipRule.mac && !tipRule.android && !tipRule.here, JSON.stringify(tipRule));
  ok('Journal: no Home Screen tip in this (non-iOS) browser', await t.ev(`document.getElementById('installTip').hidden`));
  {
    const ios = await newTab(); await ios.vp(390, 844, true);
    await ios.send('Emulation.setUserAgentOverride', { userAgent: SAFARI_IPHONE, platform: 'iPhone' });
    await ios.go(BASE + 'journal.html');
    await ios.ev(`(()=>{const st=JSON.parse(localStorage.getItem('chinthe_journal_backup_v1')||'{}');delete st.installTip;localStorage.setItem('chinthe_journal_backup_v1',JSON.stringify(st))})()`);
    await ios.go(BASE + 'journal.html');
    ok('Journal (iPhone Safari): the Home Screen tip shows, with the exact wording', await ios.ev(`!document.getElementById('installTip').hidden && document.querySelector('#installTip b').textContent==='Add to Home Screen to keep your journal safe.'`));
    await ios.shot('journal-ios-tip');
    await ios.ev(`document.getElementById('installTipClose').click()`);
    ok('Journal (iPhone Safari): "Got it" dismisses it', await ios.ev(`document.getElementById('installTip').hidden`));
    await ios.go(BASE + 'journal.html');
    ok('Journal (iPhone Safari): the tip is shown only once', await ios.ev(`document.getElementById('installTip').hidden && !!JSON.parse(localStorage.getItem('chinthe_journal_backup_v1')).installTip`));
    await ios.close();
  }
  ok('Journal: existing storage keys unchanged', await t.ev(`['chinthe_journal_v1','chinthe_journal_backup_v1'].every(k=>localStorage.getItem(k)!==null) && Object.keys(localStorage).filter(k=>k.startsWith('chinthe_journal')).sort().join()==='chinthe_journal_backup_v1,chinthe_journal_v1'`), await t.ev(`Object.keys(localStorage).join()`));
  await t.ev(`localStorage.removeItem('chinthe_journal_v1');localStorage.removeItem('chinthe_journal_backup_v1')`);

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
  ok('[d1440] Before a move is chosen, the detail panel offers the fundamentals to open', await d.ev(`document.getElementById('kbPanel').classList.contains('is-empty') && document.getElementById('kbPanelBody').textContent.includes('Start with the fundamentals') && document.querySelectorAll('#kbPanelBody .kb-start-list [data-open]').length===8`));
  await d.ev(`document.querySelector('#kbPanelBody .kb-start-list [data-open="armbar"]').click()`); await sleep(150);
  ok('[d1440] A fundamental in the start panel opens its entry', await d.ev(`document.getElementById('kbPanelTitle').textContent.startsWith('Armbar')`));
  await d.go(BASE + 'knowledge.html'); await sleep(300);
  await d.ev(`document.querySelector('.app-nav-item[data-view="g:closed"]').click()`); await sleep(200);
  ok('[d1440] Choosing a position lists its moves and opens the position itself', await d.ev(`document.getElementById('midTitle').textContent==='Closed Guard' && document.querySelectorAll('.tech-card').length===GROUPS.find(g=>g.id==='closed').ids.length && GROUPS.find(g=>g.id==='closed').ids.length>15 && document.getElementById('kbPanelTitle').textContent==='Closed Guard'`));
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
    'journal.html':                 ['.app-nav', '.app-list', '.app-detail'],
    'gameplan.html':                ['.app-nav', '.app-list', '.app-detail']
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
    ok(`[d1440] ${p}: shared fonts (IBM Plex Sans body, Newsreader titles)`, g.body.includes('IBM Plex Sans') && g.title.includes('Newsreader'), g.body + ' / ' + g.title);
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
  ok('Toggle → Light applies the light palette', await d.ev(`document.documentElement.getAttribute('data-theme')==='light'`) && lightBg === 'rgb(243, 239, 230)', lightBg);
  const cLight = await d.ev(contrast);
  ok('Light theme body text contrast ≥ 7:1', cLight >= 7, String(cLight));
  await d.ev(`document.querySelector('.site-nav-theme').click()`);
  const darkBg = await d.ev(`getComputedStyle(document.body).backgroundColor`);
  ok('Toggle → Dark applies the dark palette', await d.ev(`document.documentElement.getAttribute('data-theme')==='dark'`) && darkBg === 'rgb(19, 17, 15)', darkBg);
  const cDark = await d.ev(contrast);
  ok('Dark theme body text contrast ≥ 7:1', cDark >= 7, String(cDark));
  await d.go(BASE + 'knowledge.html');
  ok('Theme choice persists across pages (applied before first paint)', await d.ev(`document.documentElement.getAttribute('data-theme')==='dark' && document.head.innerHTML.indexOf('chinthe_theme') < document.head.innerHTML.indexOf('chinthe.css')`));
  await d.ev(`document.querySelector('.site-nav-theme').click()`);
  ok('Toggle → back to System clears the override', await d.ev(`!document.documentElement.hasAttribute('data-theme') && localStorage.getItem('chinthe_theme')===null`));
  await d.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  ok('System mode follows the device: dark', await d.ev(`getComputedStyle(document.body).backgroundColor==='rgb(19, 17, 15)'`));
  await d.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  ok('System mode follows the device: light', await d.ev(`getComputedStyle(document.body).backgroundColor==='rgb(243, 239, 230)'`));
  await d.send('Emulation.setEmulatedMedia', { features: [] });
  const raw = await d.ev(`Promise.all(['index.html','chinthe-guardian-matrix.html','competition.html','knowledge.html','principles.html','journal.html','gameplan.html'].map(f=>fetch(f).then(r=>r.text()).then(t=>[f,((t.match(/<style>[\\s\\S]*?<\\/style>/g)||[]).join('').replace(/\\.philosophy\\{[\\s\\S]*?\\}/,'').replace(/\\.philosophy::before\\{[\\s\\S]*?\\}/,'').replace(/\\.philosophy-mark\\{[\\s\\S]*?\\}/,'').match(/#[0-9a-fA-F]{6}\\b|rgba?\\(/g)||[]).length])))`);
  ok('No hard-coded colours left in page styles (brand band excepted)', raw.every(([, n]) => n === 0), JSON.stringify(raw));
  await d.go(BASE + 'index.html');
  ok('Homepage: 7 module cards incl. Compete and Game Plan', await d.ev(`document.querySelectorAll('#inside .mod').length===7 && !!document.querySelector('.mod[href="competition.html"]') && !!document.querySelector('.mod[href="gameplan.html"]')`));
  ok('Homepage is a full-width brand page: says what CHINTHE is, who it is for, and its values', await d.ev(`!document.querySelector('.app-shell') && /training system for grapplers/.test(document.querySelector('.hero-sub').textContent) && document.querySelectorAll('#who .who-card').length===6 && document.querySelectorAll('#values .value').length===4`));
  ok('Homepage: emblem shown unfiltered, no gradient backgrounds', await d.ev(`(()=>{const img=document.querySelector('.hero-tile img');const all=[...document.querySelectorAll('body *')];return getComputedStyle(img).filter==='none' && all.every(e=>!/gradient/.test(getComputedStyle(e).backgroundImage))})()`));
  ok('Homepage: sections in order (hero, stats, tools, how, fighters, quote, values, story, call to action)', await d.ev(`(()=>{const ids=[...document.querySelectorAll('main > section')].map(x=>x.id||x.className.split(' ')[0]);const want=['hero','stats-band','inside','how','who','philosophy','values','origin','band'];let i=0;ids.forEach(x=>{if(x===want[i])i++});return i===want.length})()`), await d.ev(`[...document.querySelectorAll('main > section')].map(x=>x.id||x.className).join(',')`));
  ok('Homepage: progress strip hidden for first-time visitors', await d.ev(`document.getElementById('welcome').hidden === !(localStorage.getItem('chinthe_journal_v1')||localStorage.getItem('chinthe_mastery_v1'))`));
  await d.go(BASE + 'competition.html');
  ok('Compete ADCC: clean takedown 4, clean sweep 4, guard pull −1', await d.ev(`(()=>{const a=RULESETS.adcc;const f=n=>a.positive.find(x=>x.action.startsWith(n))?.pts;return f('Clean takedown')===4&&f('Clean sweep')===4&&f('Back control')===3&&a.other[0].pts==='−1'})()`));
  await d.go(BASE + 'principles.html#hierarchy');
  ok('Principles hierarchy: back control +3 (ADCC)', await d.ev(`/\\+3<\\/span><span class="hier-name">Rear Mount/.test(document.getElementById('mdPanel').innerHTML)`));
  await d.close();

  const t2 = await newTab(); await t2.vp(390, 844, true);
  // 9. No floating overlays; knowledge grouping; focus view
  for (const p of ['knowledge.html', 'principles.html', 'journal.html', 'competition.html', 'gameplan.html']) {
    await t2.go(BASE + p);
    ok(`${p}: no floating progress overlay`, await t2.ev(`!document.querySelector('.learn-next-nudge') && [...document.querySelectorAll('body *')].filter(e=>getComputedStyle(e).position==='fixed' && e.offsetParent!==null && !e.closest('.site-nav')).length===0`));
  }
  await t2.go(BASE + 'knowledge.html');
  ok('Encyclopedia: 350+ entries, every one with tagline, objective, mechanics, reactions, mistake and drill', await t2.ev(`DB.length>=350 && DB.every(d=>['tagline','objective','mechanics','defense','mistake','drill'].every(k=>(d[k]||'').length>=25))`), await t2.ev('DB.length'));
  ok('Encyclopedia: every entry has a level and sits in at least one group', await t2.ev(`DB.every(d=>META[d.id]&&META[d.id].lvl&&GROUPS.some(g=>g.ids.includes(d.id)))`), await t2.ev(`JSON.stringify(DB.filter(d=>!GROUPS.some(g=>g.ids.includes(d.id))).map(d=>d.id))`));
  ok('Encyclopedia: wrestling, judo, gi, MMA, Muay Thai, Lethwei and transition sections exist', await t2.ev(`['wrestling_mat','judo_ground','gi_guard','striking','mma','muay_thai','lethwei','transitions'].every(id=>GROUPS.find(g=>g.id===id&&g.ids.length>=8))`));
  ok('Encyclopedia: every related link and group anchor resolves', await t2.ev(`Object.values(META).every(m=>(m.rel||[]).every(r=>byId(r))) && GROUPS.every(g=>byId(g.anchor)&&g.ids.every(byId))`));
  await t2.ev(`document.querySelector('[data-view="az"]').click()`); await sleep(250);
  ok('Encyclopedia: A-Z index lists every entry under letter headings', await t2.ev(`document.querySelectorAll('.tech-card').length===DB.length && [...document.querySelectorAll('.kb-section h2')].every(h=>/^[A-Z0-9]$/.test(h.textContent)) && document.querySelectorAll('.kb-section').length>=20`));
  await t2.ev(`openPanel('jab')`); await sleep(150);
  ok('Encyclopedia: entries show their discipline (MMA) and search videos for it', await t2.ev(`document.getElementById('kbPanelBody').textContent.includes('MMA') && document.querySelector('.kb-link.ext').href.includes('mma')`));
  await t2.ev(`document.querySelector('[data-view="all"]').click()`); await sleep(200);
  await t2.go(BASE + 'competition.html'); await sleep(300);
  ok('Compete: nine rulesets across six sports', await t2.ev(`Object.keys(RULESETS).length===9 && new Set(Object.values(RULESETS).map(r=>r.sport)).size===6 && document.querySelectorAll('.ruleset-btn').length===9`));
  await t2.ev(`setRuleset('ijf')`); await sleep(100);
  await t2.ev(`[...document.querySelectorAll('#youAdds .add-btn')].find(b=>b.textContent==='Waza-ari').click(); [...document.querySelectorAll('#youAdds .add-btn')].find(b=>b.textContent==='Waza-ari').click()`);
  ok('Compete judo: two waza-ari is ippon', await t2.ev(`document.getElementById('trackerDiff').textContent.includes('You win')`));
  ok('Compete judo: key techniques link into the encyclopedia', await t2.ev(`document.querySelector('#qjump a').getAttribute('href').startsWith('knowledge.html#')`));
  await t2.ev(`setRuleset('unified')`); await sleep(100);
  await t2.ev(`document.querySelector('#youAdds [aria-label^="Round to you 10-9"]').click(); document.querySelector('#oppAdds [aria-label^="Round to opponent 10-8"]').click()`);
  ok('Compete MMA: round card adds up (10-9 then 8-10 = 18-19)', await t2.ev(`document.getElementById('youScore').textContent==='18' && document.getElementById('oppScore').textContent==='19'`));
  await t2.ev(`setRuleset('lethwei')`); await sleep(100);
  ok('Compete Lethwei: no points, draw unless stopped', await t2.ev(`document.getElementById('trackerDiff').textContent.includes('Draw unless stopped') && document.getElementById('scoringTitle').textContent.includes('Lethwei')`));
  await t2.ev(`setRuleset('adcc')`);
  await t2.go(BASE + 'principles.html');
  const sansCheck = `(()=>{const cs=q=>getComputedStyle(document.querySelector(q));return {nav:cs('.site-nav-link').fontFamily.includes('IBM Plex Sans')&&cs('.site-nav-link').textTransform==='none', card:cs('.list-card-title').fontFamily.includes('IBM Plex Sans')&&cs('.list-card-title').textTransform==='none', title:cs('.app-title').fontFamily.includes('Newsreader'), crumb:!document.querySelector('.breadcrumb')}})()`;
  const sc = await t2.ev(sansCheck);
  await t2.go(BASE + 'journal.html');
  const btnSans = await t2.ev(`getComputedStyle(document.querySelector('.btn')).fontFamily.includes('IBM Plex Sans') && getComputedStyle(document.querySelector('.btn')).textTransform==='none'`);
  ok('Design: nav, buttons and list titles in the sans, sentence case; page titles keep the display face; no breadcrumb bar', sc.nav && sc.card && sc.title && sc.crumb && btnSans, JSON.stringify(sc) + ' btn=' + btnSans);
  ok('Feedback: one tap from the nav on every page, pointing at the feedback channel', await t2.ev(`(()=>{const a=document.querySelector('.site-nav-feedback');return !!a && a.href.startsWith('https://github.com/MyintP/ChintheGuardianMatrix/issues/new') && a.target==='_blank'})()`));
  await t2.ev(`localStorage.removeItem('chinthe_discipline')`);
  await t2.go(BASE + 'index.html'); await sleep(400);
  ok('Home: technique of the day links to a real encyclopedia entry and to the journal', await t2.ev(`(()=>{const a=document.querySelector('#todayCard a.btn-primary'),l=document.querySelector('#todayCard a.btn-secondary');const id=a&&a.getAttribute('href').split('#')[1];return !!id && CHINTHE_KB.entries.some(e=>e.id===id) && l.getAttribute('href').startsWith('journal.html?tech=')})()`));
  ok('Home: weekly focus lists three moves and links to its section', await t2.ev(`document.querySelectorAll('#weekCard .week-list a').length===3 && document.querySelector('#weekCard .today-actions a').getAttribute('href').startsWith('knowledge.html#g:')`));
  await t2.ev(`[...document.querySelectorAll('#discPick button')].find(b=>b.textContent==='Lethwei').click()`); await sleep(100);
  ok('Home: choosing a discipline filters today and is remembered', await t2.ev(`(()=>{const id=document.querySelector('#todayCard a.btn-primary').getAttribute('href').split('#')[1];return CHINTHE_KB.entries.find(e=>e.id===id).meta.fmt==='Lethwei' && localStorage.getItem('chinthe_discipline')==='lethwei'})()`));
  await t2.ev(`localStorage.removeItem('chinthe_discipline')`);
  await t2.go(BASE + 'journal.html?tech=Kimura'); await sleep(400);
  ok('Journal: "Log it" opens a new session with the technique tagged', await t2.ev(`techTags.includes('Kimura') && !document.getElementById('formWrap').hidden`));
  ok('Journal: technique names autocomplete from the encyclopedia', await t2.ev(`document.querySelectorAll('#techList option').length>=350`));
  ok('Journal: logged techniques link to their encyclopedia entry', await t2.ev(`findTechnique('Kimura').url==='knowledge.html#kimura' && findTechnique('rear naked choke').url==='knowledge.html#rnc'`));
  await t2.go(BASE + 'knowledge.html#g:lethwei'); await sleep(400);
  ok('Encyclopedia: #g:<section> links open that section', await t2.ev(`view==='g:lethwei' && document.getElementById('midTitle').textContent.startsWith('Lethwei')`));
  await t2.ev(`openPanel('headbutt')`); await sleep(150);
  ok('Encyclopedia: every entry has a "report a correction" link naming the entry', await t2.ev(`(()=>{const c=document.querySelector('.kb-correction');c.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));return c.href.includes('issues/new') && decodeURIComponent(c.href).includes('Correction: Headbutt')})()`));
  await t2.go(BASE + 'knowledge.html'); await sleep(300);
  ok('Knowledge All view grouped into 10 category sections', await t2.ev(`document.querySelectorAll('.kb-section').length===10`));
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

  // 11. Game plan builder
  await t2.go(BASE + 'gameplan.html');
  await t2.ev(`localStorage.removeItem('chinthe_gameplan_v1');localStorage.removeItem('chinthe_gameplan_last');window.alert=m=>{window.__alerts=(window.__alerts||[]).concat(m)};window.confirm=()=>true`);
  await t2.go(BASE + 'gameplan.html');
  ok('Game plan: first visit opens the new-plan form', await t2.ev(`!!document.getElementById('npName') && document.querySelectorAll('.disc-pick button').length===7`));
  ok('Game plan: every stage of every discipline offers 4+ encyclopedia techniques', await t2.ev(`DISC.every(d=>d.stages.every(s=>poolFor(d,s).length>=4))`), await t2.ev(`JSON.stringify(DISC.flatMap(d=>d.stages.map(s=>d.id+':'+s.key+'='+poolFor(d,s).length)))`));
  ok('Game plan: the picker covers the core entries too (kimura, knee slice)', await t2.ev(`ALL.length>=380 && !!findTech('Kimura') && !!findTech('Knee Slice')`), await t2.ev('ALL.length'));
  await t2.ev(`(()=>{document.getElementById('npName').value='Spring open';[...document.querySelectorAll('.disc-pick button')].find(b=>b.dataset.disc==='nogi').click();document.getElementById('npCreate').click()})()`);
  ok('Game plan: creating a plan opens stage 1', await t2.ev(`loadPlans().length===1 && loadPlans()[0].name==='Spring open' && document.getElementById('dTitle').textContent==='Standing' && document.querySelectorAll('#stageList .list-card').length===8`));
  await t2.ev(`(()=>{const i=document.getElementById('f-a');i.value='Double Leg';i.dispatchEvent(new Event('input'))})()`);
  ok('Game plan: Plan A saves as you type and previews the encyclopedia entry', await t2.ev(`loadPlans()[0].stages.stand.a==='Double Leg' && document.querySelector('.pick-preview a').getAttribute('href')==='knowledge.html#double_leg'`));
  await t2.ev(`document.querySelector('.suggest button').click()`);
  ok('Game plan: a quick pick fills the empty Plan B', await t2.ev(`!!loadPlans()[0].stages.stand.b && document.getElementById('f-b').value===loadPlans()[0].stages.stand.b`));
  await t2.ev(`(()=>{const n=document.getElementById('f-note');n.value='If they sprawl, I snap down.';n.dispatchEvent(new Event('input'))})()`);
  await t2.ev(`document.getElementById('nextStage').click()`);
  ok('Game plan: Next moves to the following stage', await t2.ev(`document.getElementById('dTitle').textContent==='Your guard'`));
  await t2.ev(`(()=>{const i=document.getElementById('f-a');i.value='<img src=x onerror=alert(1)>';i.dispatchEvent(new Event('input'))})()`);
  ok('Game plan: a move not in the encyclopedia is kept, shown as text', await t2.ev(`loadPlans()[0].stages.guard.a.startsWith('<img') && !document.querySelector('#stageList img') && document.querySelector('.pick-preview').textContent.includes('Your own move')`));
  await t2.ev(`document.querySelector('#stageList .list-card').click()`);
  ok('Game plan: overview lists every stage and names the gaps', await t2.ev(`document.querySelectorAll('.plan-flow li').length===7 && document.querySelector('.gap-callout').textContent.includes('Passing') && !document.querySelector('.gap-callout').textContent.includes('Standing')`));
  ok('Game plan: overview links picks to the encyclopedia and builds the drill list', await t2.ev(`document.querySelector('.plan-flow a').getAttribute('href')==='knowledge.html#double_leg' && document.querySelectorAll('.drill-list li').length===1 && document.querySelector('.pf-note').textContent.includes('snap down')`));
  await t2.go(BASE + 'gameplan.html');
  ok('Game plan: reopens the last plan after a reload', await t2.ev(`document.getElementById('listTitle').textContent==='Spring open'`));
  await t2.ev(`window.alert=m=>{window.__alerts=(window.__alerts||[]).concat(m)};window.confirm=()=>true;HTMLAnchorElement.prototype.click=function(){window.__dl=(window.__dl||[]).concat(this.download)}`);
  await t2.ev(`exportPlan(loadPlans()[0].id)`);
  ok('Game plan: exports as a text file', await t2.ev(`window.__dl.at(-1)==='chinthe-gameplan-spring-open.md' && planMarkdown(loadPlans()[0]).includes('**Plan A:** Double Leg')`));
  const gpBackup = await t2.ev(`JSON.stringify({app:'chinthe-gameplan',version:1,plans:loadPlans().concat([{id:'g2',name:'Judo nationals',disc:'judo',stages:{throw:{a:'Uchi-Mata',b:7,note:'x'},bogus:{a:'y'}}},{id:'g3',name:'',disc:'nogi'},{id:'g4',name:'Bad',disc:'karate'}])})`);
  await t2.ev(restore(gpBackup)); await sleep(400);
  ok('Game plan: restore adds new plans, skips duplicates and invalid ones, cleans fields', await t2.ev(`(()=>{const p=loadPlans();const j=p.find(x=>x.id==='g2');return p.length===2 && j && j.stages.throw.a==='Uchi-Mata' && j.stages.throw.b==='' && !j.stages.bogus})()`), await t2.ev(`JSON.stringify(loadPlans().map(p=>p.id))+' '+JSON.stringify(window.__alerts)`));
  ok('Game plan: restored plan opens with judo stages', await t2.ev(`document.getElementById('listEyebrow').textContent==='Judo' && document.querySelectorAll('#stageList .list-card').length===7`));
  await t2.ev(`document.querySelector('.btn-danger').click()`);
  ok('Game plan: delete removes the plan and opens the next one', await t2.ev(`loadPlans().length===1 && document.getElementById('listTitle').textContent==='Spring open'`));
  await t2.shot('gameplan-mobile');
  await t2.ev(`localStorage.removeItem('chinthe_gameplan_v1');localStorage.removeItem('chinthe_gameplan_last')`);
  await t2.close();

  fs.writeFileSync(OUT + '/results.json', JSON.stringify(results, null, 1));
  const f = results.filter(r => !r.pass).length; console.log(`\n${results.length - f}/${results.length} passed`); process.exit(f ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
