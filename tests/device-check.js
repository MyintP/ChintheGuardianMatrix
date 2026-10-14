// Device pass: every page at real phone / tablet / desktop sizes with touch emulation.
// Checks: no sideways scroll, text inputs >= 16px on touch devices (iOS zooms otherwise),
// readable body text, tap targets, and nothing cut off by the app frame.
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE = 'http://localhost:8790/';
const PAGES = ['index.html', 'chinthe-guardian-matrix.html', 'competition.html', 'knowledge.html', 'principles.html', 'journal.html', 'gameplan.html'];
const DEVICES = [
  ['iPhone SE', 320, 568, true], ['Android small', 360, 780, true], ['iPhone 15', 393, 852, true], ['iPhone Pro Max', 430, 932, true],
  ['iPad mini portrait', 768, 1024, true], ['iPad Air portrait', 820, 1180, true], ['iPad landscape', 1180, 820, true], ['iPad Pro landscape', 1366, 1024, true],
];
const SCAN = `(() => {
  const out = { overflow: document.documentElement.scrollWidth - innerWidth, smallInputs: [], tinyText: 0, cut: [] };
  document.querySelectorAll('input:not([type=hidden]):not([type=file]), select, textarea').forEach(el => {
    const r = el.getBoundingClientRect(); if (!r.width || getComputedStyle(el).display === 'none') return;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 16) out.smallInputs.push((el.id || el.className) + ' ' + fs + 'px');
  });
  document.querySelectorAll('p, li, .list-card-sub, .tech-card-tagline, .kb-sec p').forEach(el => {
    const r = el.getBoundingClientRect(); if (!r.width || getComputedStyle(el).textTransform === 'uppercase') return;
    if (parseFloat(getComputedStyle(el).fontSize) < 12.5) out.tinyText++;
  });
  // In the fixed app frame, each scrolling panel must end inside the viewport
  if (document.body.classList.contains('app-page')) {
    document.querySelectorAll('.app-nav, .app-list, .app-detail, #kbPanel, .tree-wrap, #detailPane').forEach(el => {
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (r.width && cs.display !== 'none' && r.bottom > innerHeight + 1 && document.documentElement.scrollHeight <= innerHeight + 1) out.cut.push((el.id || el.className.split(' ')[0]) + ' bottom ' + Math.round(r.bottom) + '>' + innerHeight);
    });
  }
  return out;
})()`;
async function tab() {
  const t = await (await fetch('http://localhost:9333/json/new?about:blank', { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = {};
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend[m.id]) { pend[m.id](m.result); delete pend[m.id]; } };
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pend[i] = res; ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async e => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.value;
  return { send, ev, close: () => { fetch('http://localhost:9333/json/close/' + t.id); ws.close(); } };
}
(async () => {
  let problems = 0;
  for (const [name, w, h, touch] of DEVICES) {
    const t = await tab();
    await t.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: w < 1100 });
    await t.send('Emulation.setTouchEmulationEnabled', { enabled: touch, maxTouchPoints: 5 });
    for (const p of PAGES) {
      await t.send('Page.navigate', { url: BASE + p + (p === 'knowledge.html' ? '#kimura' : '') }); await sleep(1100);
      const r = await t.ev(SCAN);
      const issues = [];
      if (r.overflow > 0) issues.push('sideways scroll +' + r.overflow + 'px');
      if (r.smallInputs.length) issues.push('iOS zoom inputs: ' + r.smallInputs.join(', '));
      if (r.tinyText) issues.push(r.tinyText + ' body text < 12.5px');
      if (r.cut.length) issues.push('cut off: ' + r.cut.join(', '));
      if (issues.length) { problems++; console.log(`${name} ${w}x${h} ${p}: ${issues.join(' | ')}`); }
    }
    t.close();
  }
  console.log(problems ? problems + ' page/device combinations with issues' : 'all pages clean on all devices');
  process.exit(0);
})();
