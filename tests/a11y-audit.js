// Launch audit: accessibility, contrast, tap targets, headings, page weight, manifest.
const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE = 'http://localhost:8790/';
const PAGES = ['index.html', 'chinthe-guardian-matrix.html', 'competition.html', 'knowledge.html', 'principles.html', 'journal.html', 'gameplan.html'];

const SCAN = `(() => {
  const out = { unnamed: [], unlabeled: [], lowContrast: [], smallTargets: [], h1: 0, headings: [], overflow: 0 };
  const parse = c => {
    if (!c) return null;
    let m = c.match(/rgba?\\(([^)]+)\\)/);
    if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
    m = c.match(/color\\(srgb ([^)]+)\\)/);
    if (m) { const p = m[1].split(/[ /]+/).filter(Boolean).map(Number); return [p[0]*255, p[1]*255, p[2]*255, p.length > 3 ? p[3] : 1]; }
    return null;
  };
  const lum = ([r,g,b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
  const blend = (top, bot) => { const a = top[3]; return [top[0]*a+bot[0]*(1-a), top[1]*a+bot[1]*(1-a), top[2]*a+bot[2]*(1-a), 1]; };
  const bgOf = el => {
    const stack = [];
    for (let n = el; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c[3] > 0) { stack.push(c); if (c[3] >= 1) break; } }
    let col = parse(getComputedStyle(document.body).backgroundColor) || [0,0,0,1];
    for (let i = stack.length - 1; i >= 0; i--) col = blend(stack[i], col);
    return col;
  };
  const visible = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
  const label = el => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.value || el.getAttribute('placeholder') || '').trim();
  document.querySelectorAll('button, a[href], [role=button], [role=tab]').forEach(el => {
    if (!visible(el)) return;
    if (!label(el) && !el.querySelector('img[alt]:not([alt=""])')) out.unnamed.push(el.outerHTML.slice(0, 90));
    const r = el.getBoundingClientRect();
    if (innerWidth < 600 && (r.width < 32 || r.height < 32) && !el.closest('.breadcrumb') && !el.closest('p') && !el.closest('.legend')) out.smallTargets.push((label(el) || el.className).slice(0, 40) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  });
  document.querySelectorAll('input:not([type=hidden]):not([type=file]), select, textarea').forEach(el => {
    if (!visible(el)) return;
    const id = el.id;
    const has = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || (id && document.querySelector('label[for="'+id+'"]')) || el.closest('label');
    if (!has) out.unlabeled.push((el.id || el.className) + ' (' + el.tagName.toLowerCase() + ')');
  });
  // contrast for text-bearing leaf elements
  const seen = new Set();
  document.querySelectorAll('body *').forEach(el => {
    if (!visible(el) || el.closest('svg') || el.closest('.hero-visual')) return;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!own) return;
    const cs = getComputedStyle(el);
    const fg = parse(cs.color); if (!fg) return;
    const bg = bgOf(el);
    const fgB = fg[3] < 1 ? blend(fg, bg) : fg;
    const L1 = lum(fgB), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 600;
    const need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5;
    if (ratio < need) {
      const key = el.className + '|' + cs.color;
      if (seen.has(key)) return; seen.add(key);
      out.lowContrast.push(Math.round(ratio*100)/100 + ' < ' + need + ' : ' + (el.className || el.tagName).toString().slice(0, 40) + ' "' + el.textContent.trim().slice(0, 30) + '"');
    }
  });
  out.h1 = document.querySelectorAll('h1').length;
  out.overflow = document.documentElement.scrollWidth - innerWidth;
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
  const report = {};
  for (const [w, h, mob] of [[390, 844, true], [1440, 900, false]]) {
    for (const theme of ['dark', 'light']) {
      const t = await tab();
      await t.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: mob });
      for (const p of PAGES) {
        await t.send('Page.navigate', { url: BASE + p }); await sleep(1200);
        await t.ev(`document.documentElement.setAttribute('data-theme','${theme}')`); await sleep(150);
        // open a detail so the reading panel content is scanned too
        if (p === 'knowledge.html') { await t.ev(`location.hash='kimura'`); await sleep(400); }
        const r = await t.ev(SCAN);
        const key = `${p} @${w} ${theme}`;
        report[key] = r;
      }
      t.close();
    }
  }
  // Summarise
  const agg = { unnamed: new Set(), unlabeled: new Set(), lowContrast: new Set(), smallTargets: new Set(), h1: [], overflow: [] };
  for (const [k, r] of Object.entries(report)) {
    r.unnamed.forEach(x => agg.unnamed.add(k.split(' ')[0] + ': ' + x));
    r.unlabeled.forEach(x => agg.unlabeled.add(k.split(' ')[0] + ': ' + x));
    r.lowContrast.forEach(x => agg.lowContrast.add(k + ': ' + x));
    r.smallTargets.forEach(x => agg.smallTargets.add(k.split(' ')[0] + ': ' + x));
    if (r.h1 !== 1) agg.h1.push(k + ' h1=' + r.h1);
    if (r.overflow > 0) agg.overflow.push(k + ' +' + r.overflow + 'px');
  }
  for (const [k, v] of Object.entries(agg)) { const arr = [...v]; console.log(`\n## ${k} (${arr.length})`); arr.slice(0, 40).forEach(x => console.log('  ' + x)); }
  process.exit(0);
})();
