// Jump to every matrix node at desktop + phone size; report any focus node whose badge leaves the viewport.
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  for (const [w, h, mobile] of [[1440, 900, false], [1024, 768, false], [390, 844, true]]) {
    const t = await (await fetch('http://localhost:9333/json/new?about:blank', { method: 'PUT' })).json();
    const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const pend = {};
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend[m.id]) { pend[m.id](m.result); delete pend[m.id]; } };
    const send = (method, params = {}) => new Promise(res => { const i = ++id; pend[i] = res; ws.send(JSON.stringify({ id: i, method, params })); });
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
    await send('Page.navigate', { url: 'http://localhost:8790/chinthe-guardian-matrix.html' }); await sleep(1500);
    const r = await send('Runtime.evaluate', { returnByValue: true, awaitPromise: true, expression: `(async()=>{
      const st=document.createElement('style');st.textContent='*{transition:none!important;animation:none!important}';document.head.appendChild(st);const out={};for (const mode of ["focus","map"]) { const bad=[]; let minZ=9;
      for (const nid of Object.keys(NODES)) {
        setViewMode(mode); jumpTo(nid);
        await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
        minZ=Math.min(minZ,zoom);
        const vp=treeViewport.getBoundingClientRect();
        [nid].concat(NODES[nid].children||[]).forEach(i=>{const b=nodeEls[i].querySelector('.tree-node-badge').getBoundingClientRect();
          if(b.left<vp.left-1||b.right>vp.right+1||b.top<vp.top-1||b.bottom>vp.bottom+1) bad.push(nid+'→'+i);});
      }
      out[mode]={minZoom:+minZ.toFixed(3), bad: bad.slice(0,8), badCount: bad.length}; } return {checked:Object.keys(NODES).length, ...out};
    })()` });
    console.log(w + 'x' + h, JSON.stringify(r.result.value));
    await fetch('http://localhost:9333/json/close/' + t.id); ws.close();
  }
  setTimeout(() => process.exit(0), 100);
})();
