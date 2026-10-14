// QA walkthrough: every page on 10 devices, both themes, plus the core user flows on each device.
//   node tests/qa-live.js [base-url]      (default: the live GitHub Pages site)
// Needs headless Chrome on :9333 (see README). Per page and theme it checks: no console errors or
// failed requests, no sideways scroll, header fits and marks the current page, menu works on
// touch sizes (6 links, 44px rows), footer present and reachable, images and web fonts loaded,
// body text contrast. Per device it runs: search, Matrix move, Compete scoring, Encyclopedia
// entry, Principles, Journal save + restore, Game Plan create + pick, theme toggle.
const BASE = process.argv[2] || 'https://myintp.github.io/ChintheGuardianMatrix/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PAGES = ['index.html', 'chinthe-guardian-matrix.html', 'competition.html', 'knowledge.html', 'principles.html', 'gameplan.html', 'journal.html'];
const DEVICES = [
  ['iPhone SE', 320, 568, true], ['Android small', 360, 780, true], ['iPhone 15', 393, 852, true], ['iPhone Pro Max', 430, 932, true],
  ['iPad mini portrait', 768, 1024, true], ['iPad Air portrait', 820, 1180, true], ['iPad landscape', 1180, 820, true], ['iPad Pro landscape', 1366, 1024, true],
  ['Laptop', 1440, 900, false], ['Desktop HD', 1920, 1080, false],
];
const results = []; let fails = 0;
const ok = (name, pass, info = '') => { results.push({ name, pass: !!pass, info }); if (!pass) { fails++; console.log('FAIL ' + name + (info ? '  — ' + info : '')); } };

async function tab() {
  const t = await (await fetch('http://localhost:9333/json/new?about:blank', { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = {}; const errors = []; let loaded = null;
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; }
    if (m.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split('\n')[0]);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console: ' + m.params.args.map(a => a.value || a.description).join(' '));
    if (m.method === 'Network.responseReceived' && m.params.response.status >= 400 && !/favicon/.test(m.params.response.url)) errors.push(m.params.response.status + ' ' + m.params.response.url);
    if (m.method === 'Network.loadingFailed' && !m.params.canceled && m.params.type !== 'Ping') errors.push('failed: ' + m.params.errorText + ' ' + (m.params.type || ''));
    if (m.method === 'Page.loadEventFired' && loaded) { loaded(); loaded = null; }
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend[i] = m => m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  // Native dialogs block a headless tab: answer them the way a user who confirms would
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.alert=()=>{};window.confirm=()=>true;window.prompt=()=>null;' });
  const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(expr.slice(0, 70) + ' => ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; };
  // Wait until the new document is the one showing: a late load event from an earlier
  // navigation must not let the next step run against the old page.
  const go = async url => {
    const done = new Promise(r => { loaded = r; setTimeout(r, 15000); });
    await send('Page.navigate', { url }); await done;
    const want = url.split('#')[0];
    for (let i = 0; i < 50; i++) { if (await ev(`location.href.split('#')[0]===${JSON.stringify(want)} && document.readyState==='complete'`).catch(() => false)) break; await sleep(200); }
    await sleep(700);
  };
  return { send, ev, go, errors, close: () => { fetch('http://localhost:9333/json/close/' + t.id); ws.close(); } };
}

const PAGE_SCAN = `(async () => {
  await document.fonts.ready;
  const W = innerWidth, out = {};
  out.overflow = document.documentElement.scrollWidth - W;
  const vis = el => { if (!el) return false; const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
  const nav = document.querySelector('.site-nav');
  out.headerOff = [...nav.querySelectorAll('a, button')].filter(vis).filter(el => { const r = el.getBoundingClientRect(); return r.left < -1 || r.right > W + 1; }).map(el => (el.className || el.textContent).toString().slice(0, 30));
  const cur = nav.querySelectorAll('[aria-current="page"]');
  out.current = cur.length === 1 ? cur[0].getAttribute('href') : 'count ' + cur.length;
  out.linksVisible = [...nav.querySelectorAll('.site-nav-links a')].filter(vis).length;
  out.toggle = vis(nav.querySelector('.site-nav-toggle'));
  out.smallNavTargets = [...nav.querySelectorAll('a, button')].filter(vis).filter(el => { const r = el.getBoundingClientRect(); return r.height < 40 || r.width < 40; }).map(el => (el.getAttribute('aria-label') || el.textContent).trim().slice(0, 20));
  out.brokenImages = [...document.images].filter(i => i.complete && i.naturalWidth === 0 && vis(i)).map(i => i.src.split('/').pop());
  out.fonts = ['16px "IBM Plex Sans"', '24px "Newsreader"'].filter(f => !document.fonts.check(f));
  const f = document.querySelector('.site-footer');
  out.footer = !!f && f.querySelectorAll('a').length === 6 && /Rooted in Myanmar/.test(f.textContent) && /tap early/.test(f.textContent);
  const rgb = c => c.match(/[\\d.]+/g).slice(0, 3).map(Number), L = ([r, g, b]) => { const t = v => (v /= 255) <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; return .2126 * t(r) + .7152 * t(g) + .0722 * t(b); };
  const bs = getComputedStyle(document.body), a = L(rgb(bs.color)), b = L(rgb(bs.backgroundColor));
  out.contrast = +((Math.max(a, b) + .05) / (Math.min(a, b) + .05)).toFixed(1);
  out.theme = document.documentElement.getAttribute('data-theme') || 'system';
  return out;
})()`;

(async () => {
  const PAGE_LABEL = p => p.replace('.html', '');
  for (const [name, w, h, touch] of DEVICES) {
    const t = await tab();
    await t.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: touch && w < 1100 });
    await t.send('Emulation.setTouchEmulationEnabled', { enabled: touch, maxTouchPoints: 5 });
    if (touch) await t.send('Emulation.setEmulatedMedia', { features: [{ name: 'hover', value: 'none' }, { name: 'pointer', value: 'coarse' }] });
    await t.go(BASE + 'index.html');
    await t.ev(`localStorage.clear()`);
    const tag = `[${name} ${w}x${h}]`;

    // ── Every page, light then dark ──
    for (const theme of ['light', 'dark']) {
      await t.ev(`localStorage.setItem('chinthe_theme','${theme}')`);
      for (const p of PAGES) {
        t.errors.length = 0;
        await t.go(BASE + p);
        const r = await t.ev(PAGE_SCAN);
        const where = `${tag} ${theme} ${PAGE_LABEL(p)}`;
        const issues = [];
        if (t.errors.length) issues.push('errors: ' + [...new Set(t.errors)].join(' | '));
        if (r.overflow > 0) issues.push('sideways scroll +' + r.overflow + 'px');
        if (r.headerOff.length) issues.push('header off-screen: ' + r.headerOff.join(', '));
        if (r.current !== p) issues.push('current page marker: ' + r.current);
        if (w >= 1024 ? r.linksVisible !== 6 : !r.toggle) issues.push(w >= 1024 ? 'nav links visible ' + r.linksVisible : 'no menu button');
        if (touch && r.smallNavTargets.length) issues.push('nav targets < 40px: ' + r.smallNavTargets.join(', '));
        if (r.brokenImages.length) issues.push('broken images: ' + r.brokenImages.join(', '));
        if (r.fonts.length) issues.push('fonts not loaded: ' + r.fonts.join(', '));
        if (!r.footer) issues.push('footer missing or incomplete');
        if (r.contrast < 7) issues.push('body contrast ' + r.contrast);
        if (r.theme !== theme) issues.push('theme not applied: ' + r.theme);
        ok(where, !issues.length, issues.join(' || '));
        // Footer reachable: scroll to the end of the page
        const fr = await t.ev(`(()=>{const f=document.querySelector('.site-footer');f.scrollIntoView({block:'end',behavior:'instant'});const r=f.getBoundingClientRect();return r.bottom<=innerHeight+2&&r.top<innerHeight})()`);
        ok(where + ' footer reachable by scrolling', fr);
      }
    }
    await t.ev(`localStorage.setItem('chinthe_theme','light')`);

    // ── Menu (phone and tablet sizes) ──
    if (w < 1024) {
      await t.go(BASE + 'knowledge.html');
      await t.ev(`document.querySelector('.site-nav-toggle').click()`); await sleep(200);
      const m = await t.ev(`(()=>{const ls=[...document.querySelectorAll('.site-nav-links a')];return {open:document.querySelector('.site-nav').classList.contains('menu-open'), n:ls.length, tall:ls.every(a=>a.getBoundingClientRect().height>=44), inView:ls.every(a=>{const r=a.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}), cur:document.querySelector('.site-nav-links [aria-current="page"]')?.textContent}})()`);
      ok(`${tag} menu opens: 6 links, 44px+ rows, all on screen, current page marked`, m.open && m.n === 6 && m.tall && m.inView && m.cur === 'Encyclopedia', JSON.stringify(m));
      await t.ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
      ok(`${tag} menu closes with Escape`, await t.ev(`!document.querySelector('.site-nav').classList.contains('menu-open')`));
      await t.ev(`document.querySelector('.site-nav-toggle').click()`); await sleep(150);
      await t.ev(`document.querySelector('.site-nav-links a[href="journal.html"]').click()`); await sleep(1500);
      ok(`${tag} menu link navigates`, await t.ev(`location.pathname.endsWith('journal.html')`));
    }

    // ── Search ──
    t.errors.length = 0;
    await t.go(BASE + 'index.html');
    await t.ev(`document.querySelector('.site-nav-search').click()`); await sleep(150);
    await t.ev(`(()=>{const i=document.querySelector('.search-input');i.value='armbar';i.dispatchEvent(new Event('input'))})()`);
    const sr = await t.ev(`document.querySelectorAll('.search-result').length`);
    await t.ev(`document.querySelector('.search-result[href^="knowledge.html#armbar"]').click()`); await sleep(1800);
    ok(`${tag} search: finds "armbar" and opens the entry`, sr > 0 && await t.ev(`location.hash==='#armbar' && document.getElementById('kbPanelTitle').textContent.startsWith('Armbar') && !document.getElementById('kbPanel').hidden`), 'results ' + sr);

    // ── Encyclopedia: open an entry from the list ──
    await t.go(BASE + 'knowledge.html');
    await t.ev(`document.getElementById('tech-kimura').click()`); await sleep(300);
    ok(`${tag} encyclopedia: a card opens its breakdown`, await t.ev(`(()=>{const p=document.getElementById('kbPanel');const r=p.getBoundingClientRect();return !p.hidden && document.getElementById('kbPanelTitle').textContent==='Kimura' && r.width>0 && r.left<innerWidth})()`));

    // ── Matrix: move from the hub ──
    await t.go(BASE + 'chinthe-guardian-matrix.html#guard_closed'); await sleep(500);
    await t.ev(`document.querySelector('#detailCard [data-go]').click()`); await sleep(400);
    ok(`${tag} matrix: tapping an option moves to it`, await t.ev(`path.length>=2 && path[0]==='guard_closed'`), await t.ev(`JSON.stringify(path)`));

    // ── Compete: score and reset ──
    await t.go(BASE + 'competition.html');
    await t.ev(`setRuleset('ibjjf')`); await sleep(100);
    await t.ev(`[...document.querySelectorAll('#youAdds .add-btn')].find(b=>b.textContent.trim()==='+2').click()`); await sleep(100);
    const sc = await t.ev(`document.getElementById('youScore').textContent`);
    await t.ev(`document.querySelector('.tracker-reset').click()`); await sleep(100);
    ok(`${tag} compete: +2 scores and reset clears`, sc === '2' && await t.ev(`document.getElementById('youScore').textContent==='0'`), 'score ' + sc);

    // ── Principles ──
    await t.go(BASE + 'principles.html');
    await t.ev(`document.querySelectorAll('#prList .list-card')[2].click()`); await sleep(300);
    ok(`${tag} principles: a card opens in the reading panel`, await t.ev(`document.querySelector('.panel-title').textContent.length>2 && document.querySelectorAll('#prList .list-card')[2].classList.contains('active')`));

    // ── Journal: save, then restore a backup ──
    await t.go(BASE + 'journal.html');
    await t.ev(`window.alert=()=>{};window.confirm=()=>true;HTMLAnchorElement.prototype.click=function(){window.__dl=(window.__dl||[]).concat(this.download)}`);
    await t.ev(`(()=>{document.getElementById('fTitle').value='QA roll';addTag('Kimura');saveSession();})()`); await sleep(200);
    const js = await t.ev(`loadSessions().length===1 && document.querySelector('#sessionList .list-card-title').textContent==='QA roll'`);
    await t.ev(`backupJSON()`);
    const backup = JSON.stringify({ app: 'chinthe-journal', version: 1, sessions: [{ id: 'qa2', date: '2026-10-01', type: 'sparring', title: 'Restored roll', techniques: ['Armbar'] }] });
    await t.ev(`(()=>{const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(backup)}],'b.json',{type:'application/json'}));const i=document.getElementById('restoreInput');i.files=dt.files;i.dispatchEvent(new Event('change'))})()`); await sleep(400);
    ok(`${tag} journal: saves a session, backs up, restores`, js && await t.ev(`loadSessions().length===2 && (window.__dl||[]).some(n=>/chinthe-journal-backup/.test(n))`), await t.ev(`JSON.stringify(loadSessions().map(s=>s.title))`));

    // ── Game Plan: create and pick ──
    await t.go(BASE + 'gameplan.html');
    await t.ev(`(()=>{document.getElementById('npName').value='QA plan';document.getElementById('npCreate').click()})()`); await sleep(200);
    await t.ev(`(()=>{const i=document.getElementById('f-a');i.value='Double Leg';i.dispatchEvent(new Event('input'))})()`);
    await t.go(BASE + 'gameplan.html');
    ok(`${tag} game plan: create, pick Plan A, survives reload`, await t.ev(`loadPlans().length===1 && loadPlans()[0].stages.stand.a==='Double Leg' && document.querySelector('.plan-flow a').getAttribute('href')==='knowledge.html#double_leg'`));

    // ── Theme toggle: System → Light → Dark ──
    await t.ev(`localStorage.removeItem('chinthe_theme')`); await t.go(BASE + 'index.html');
    await t.ev(`document.querySelector('.site-nav-theme').click()`);
    const l = await t.ev(`getComputedStyle(document.body).backgroundColor`);
    await t.ev(`document.querySelector('.site-nav-theme').click()`);
    const d = await t.ev(`getComputedStyle(document.body).backgroundColor`);
    ok(`${tag} theme toggle: light then dark`, l === 'rgb(243, 239, 230)' && d === 'rgb(19, 17, 15)', l + ' / ' + d);
    ok(`${tag} flows ran without console errors`, t.errors.length === 0, [...new Set(t.errors)].join(' | '));

    await t.ev(`localStorage.clear()`);
    t.close();
    console.log(`${name} done (${results.length} checks so far, ${fails} failing)`);
  }
  require('fs').writeFileSync(require('path').join(__dirname, 'shots', 'qa-results.json'), JSON.stringify(results, null, 1));
  console.log(`\n${results.length - fails}/${results.length} passed`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
