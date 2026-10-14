// Verifies the service worker: network-first freshness for code/data, and offline fallback.
const fs = require('fs');
const TMP = '' + require('path').join(__dirname, '..', 'zz-sw-fresh.json') + '';   // throwaway, deleted at the end
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let failed = 0; const ok = (n, p, i = '') => { if (!p) failed++; console.log((p ? 'PASS ' : 'FAIL ') + n + (p ? '' : ' — ' + i)); };
  fs.writeFileSync(TMP, '{"v":1}');
  const t = await (await fetch('http://localhost:9333/json/new?about:blank', { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = {};
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend[m.id]) { pend[m.id](m.result || m); delete pend[m.id]; } };
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pend[i] = res; ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async e => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.value;
  try {
    await send('Page.enable'); await send('Network.enable');
    await send('Page.navigate', { url: 'http://localhost:8790/chinthe-guardian-matrix.html' }); await sleep(1500);
    await ev(`navigator.serviceWorker.ready.then(()=>1)`);
    await send('Page.reload', {}); await sleep(1500);
    ok('Page is controlled by the service worker', await ev(`!!navigator.serviceWorker.controller`));
    ok('Controller is the new SW (v31)', await ev(`caches.keys().then(k=>k.includes('chinthe-v31'))`), await ev(`caches.keys().then(k=>k.join())`));
    const v1 = await ev(`fetch('zz-sw-fresh.json').then(r=>r.json()).then(j=>j.v)`);
    fs.writeFileSync(TMP, '{"v":2}');
    const v2 = await ev(`fetch('zz-sw-fresh.json').then(r=>r.json()).then(j=>j.v)`);
    ok('Changed file is served fresh on the next request (network-first)', v1 === 1 && v2 === 2, `got ${v1} then ${v2}`);
    await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    const off = await ev(`fetch('zz-sw-fresh.json').then(r=>r.json()).then(j=>j.v).catch(e=>'ERR '+e)`);
    ok('Offline: last fetched version served from cache', off === 2, String(off));
    await send('Page.reload', {}); await sleep(1500);
    ok('Offline: matrix page still loads', await ev(`typeof NODES==='object' && Object.keys(NODES).length>100`));
  } finally {
    fs.unlinkSync(TMP);
    await fetch('http://localhost:9333/json/close/' + t.id); ws.close();
    setTimeout(() => process.exit(failed ? 1 : 0), 100);
  }
})();
