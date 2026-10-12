// node shoot.js <url> <width> <height> <out.png> [fullPage] [js-to-run-before]
const fs = require('fs');
const [url, w, h, out, full, pre] = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const t = await (await fetch('http://localhost:9333/json/new?about:blank', { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = {};
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend[m.id]) { pend[m.id](m.result); delete pend[m.id]; } };
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pend[i] = res; ws.send(JSON.stringify({ id: i, method, params })); });
  const mobile = +w < 800;
  await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile });
  await send('Page.navigate', { url }); await sleep(1800);
  if (pre) { await send('Runtime.evaluate', { expression: pre, awaitPromise: true }); await sleep(900); }
  const params = { format: 'png' };
  if (full === '1') {
    const r = await send('Runtime.evaluate', { expression: 'document.documentElement.scrollHeight', returnByValue: true });
    params.clip = { x: 0, y: 0, width: +w, height: Math.min(r.result.value, 6000), scale: 1 };
    params.captureBeyondViewport = true;
  }
  const r = await send('Page.captureScreenshot', params);
  fs.writeFileSync(out, Buffer.from(r.data, 'base64'));
  await fetch('http://localhost:9333/json/close/' + t.id);
  ws.close(); setTimeout(() => process.exit(0), 100);
})();
