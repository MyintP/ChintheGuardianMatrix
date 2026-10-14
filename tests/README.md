# CHINTHE test suite

Browser tests that drive headless Chrome over the DevTools protocol from plain Node (Node 22+, no npm install).
These are the checks that verified every pass recorded in `worklog.md`.

## Run

From the repo root, in three terminals (or as background jobs):

```bash
# 1. Static server on :8790
node tests/serve.js .

# 2. Headless Chrome with remote debugging on :9333 (fresh profile = no stale service worker)
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --remote-debugging-port=9333 \
  --user-data-dir="$TEMP/chinthe-test-profile" --no-first-run --disable-gpu about:blank

# 3. The suites
node tests/run.js tests/shots   # main suite (274 checks) — screenshots land in tests/shots/
node tests/frame-all.js         # every Matrix node framed in view, Focus + Full map, at 1440 / 1024 / 390 px
node tests/sw-test.js           # service worker: network-first freshness + offline fallback
node tests/audit.js             # static content audit (fields, scoring claims, page meta); writes tests/dump-*.txt
node tests/device-check.js      # every page on 8 devices (iPhone SE to iPad Pro): sideways scroll, iOS input zoom, small text, cut-off panels
node tests/a11y-audit.js        # accessibility: labels, names, WCAG contrast (both themes), phone tap targets, overflow
node tests/qa-live.js [url]     # QA walkthrough on 10 devices x 2 themes, against the live site by default (pass http://localhost:8790/ for local)
```

After editing any `kb/*.js` file, rebuild first: `node tools/build-kb.js` (it validates every entry and fails on errors).

Delete the Chrome profile folder between runs if you change `sw.js`, or the old service worker may serve cached pages.

## What each covers

| Script | Checks |
|---|---|
| `run.js` | Every page at 360/390/1280 px: no JS errors, no horizontal overflow, nav search visible. Global search (button, `/`, deep links, ranking, every entry resolvable and searchable). Knowledge: deep links, three-panel layout, detail panel, levels, aliases, progress sync with the Matrix, related links, video link. Principles: shell, deep links, glossary. Journal: local dates, backup/restore, backup reminder. Matrix: options panel, Focus/Full map, framing, layout. Compete ADCC values. Themes: System/Light/Dark toggle, persistence, pre-paint, contrast ≥ 7:1, no hard-coded colours. No personalised content. |
| `frame-all.js` | Jumps to all Matrix nodes in both views and asserts the node and all its options are inside the tree viewport. |
| `sw-test.js` | Page controlled by the current SW; a changed file is served fresh on the next request; offline falls back to cache. |
| `audit.js` | Missing/thin fields, point-value mentions, duplicate titles, dead ends, page meta, broken links. |
| `a11y-audit.js` | Every page at 390 and 1440 px in dark and light: unnamed controls, unlabeled fields, WCAG AA text contrast, tap targets under 32px on phones, one h1, no horizontal overflow. Gradient backgrounds aren't read, so the homepage philosophy band is a known false positive. |
| `qa-live.js` | Every page on 10 devices (iPhone SE to 1920 desktop) in light and dark: console errors and failed requests, sideways scroll, header fits and marks the current page, menu (6 links, 44px rows, Escape, navigation), footer present and reachable, images and web fonts loaded, contrast. Per device: search, Encyclopedia entry, Matrix move, Compete scoring and reset, Principles, Journal save/backup/restore, Game Plan create and reload, theme toggle. |
| `shoot.js` | Helper: `node tests/shoot.js <url> <w> <h> <out.png> [1=fullpage] [js-before-shot]`. |
