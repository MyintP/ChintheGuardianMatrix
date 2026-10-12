# CHINTHE PROJECT WORKLOG
## Project: Guardian System (Grappling Knowledge Base)
## Goal: MVP $\rightarrow$ MLP $\rightarrow$ Commercial Release

---

### [2026-09-25] SESSION 1: Initialization & Audit
**Status:** Stage 1 (MVP) - Stabilization

#### ?? Actions Taken:
- **Code Review:** Completed full audit of `chinthe.js`, `sw.js`, `chinthe.css`, and `index.html`.
- **Roadmap established:** Defined 3-stage rollout (MVP $\rightarrow$ MLP $\rightarrow$ Commercial).
- **Role Definition:** Established Autonomous Product Lead persona with internal sign-off roles (Analyst, PM, Designer).
- **Repo Housekeeping:**
    - Created `/archive` directory.
    - Archived 6 legacy/duplicate HTML files.
    - Initialized `worklog.md`.
- **Link Audit:** Verified that all search index (`IDX`) destinations exist in the current file system.

#### ?? Current Project Status:
- **Stage 1 (MVP):** 70% (Finalizing core JS stabilization)
- **Stage 2 (MLP):** 0%
- **Stage 3 (Commercial):** 0%

#### ?? Decisions & Notes:
- Move from ES5 to ES6+ (Modern JS) to ensure better stability and maintainability.
- Decided to move toward a data-driven approach (JSON) in future stages to decouple content from logic.
- Focus for immediate next step: PWA/Service Worker verification.

---

### [2026-10-13] SESSION 2: Review, content expansion, full audit, design system
**Status:** Stage 1 (MVP) complete — Stage 2 (MLP) underway
**Live:** https://myintp.github.io/ChintheGuardianMatrix/ (service worker cache `chinthe-v23`)
**Commits:** `75b4cef` → `b6f5792` (8 commits, all pushed to `main`)

#### Summary of progress
| Metric | Start of session | End of session |
|---|---|---|
| Matrix nodes | 102 | 135 (graph validated: every child exists, every node reachable from the hub) |
| Knowledge entries | 73 | 98 (each with level, related moves, training plan; 81 linked to the Matrix) |
| Principles reference sections | 4 | 5 (+ Glossary, 37 terms) |
| Automated checks | 0 | 177 browser checks + all-node framing + service-worker + static content audit (`tests/`) |
| Themes | Dark only | System (default) / Light / Dark |

#### Pass 1 — Code review and fixes (`75b4cef`)
- Global search: added a visible nav search button (was Ctrl+K only, so unusable on phones), `/` shortcut and an on-screen close; every result now deep-links to the exact matrix node, knowledge entry or principle; results ranked by match quality.
- Journal: dates were UTC (sessions logged before ~10–11am in UTC+10/11 got the previous day) → local date; added JSON backup + restore (merge by id, validates input); requests persistent storage; a failed save now alerts instead of silently losing the session.
- Counts derived from data (the homepage said "80+ nodes"; actual 102).
- Removed a JS page-transition click hijack that did nothing, and an `html{opacity:0}` gate that blanked pages until the script loaded; replaced with CSS `@view-transition`.
- Progress pop-up: off the Compete page, padded on mobile, dismissal lasts 7 days.
- Homepage: value proposition in the hero; crisp 512px lion (was a 96px image upscaled); "Coming Soon" card no longer a dead link.
- Repo: removed duplicate `chunk0–3.html` (exact copies of the matrix) and an empty stray folder.

#### Pass 2 — Matrix layout, backup reminder, ADCC scoring (`e5e0c92`)
- Every matrix node panel now lists its options (type, points, progress) plus "Back to …". Previously the only way forward was finding nodes on the map.
- Desktop three columns (sidebar | tree | detail); framing fits the node, its options and the previous step; fixed the breadcrumb clipping the app frame; the mobile header no longer pins over half the screen.
- Journal backup reminder (3+ sessions never backed up, 5+ since the last backup, or any new session and a 14+ day old backup); "Later" snoozes for 3 days.
- ADCC scoring corrected against FloGrappling's ADCC rules explainer (Aug 2024): back control 3 (not 4), clean takedown and clean sweep 4, guard pull −1, first-half rule. Added the missing Compete card; removed an overclaim from the Matrix card.

#### Pass 3 — Content expansion and caching fix (`960a9c6`)
- Matrix +32 nodes: standing hand-fighting (2-on-1, collar tie / snap down, underhook, ankle pick, single leg, body lock, rear body lock, mat return); front headlock hub (D'Arce, anaconda, go-behind); turtle top and crucifix; side control and north-south (americana, kimura, arm triangle, north-south choke); seated guard, wrestle up, shin-to-shin, K-guard; beating the knee shield; defensive escapes.
- Logic bug fixed: your own stuffed shot routed to *your* front-headlock attacks; it now routes to the "they have your head" defence.
- Knowledge +25 entries to match.
- Service worker switched to network-first for pages and scripts (returning visitors were being served the previous version); offline still works.

#### Pass 4 — UI/UX declutter (`a812d14`)
- Matrix **Focus view** (default): draws only the decision — previous step, current node, and its options in a grouped grid. Full map is one tap away.
- One semantic colour system (gold = finish, jade = position, red = defence, neutral otherwise), replacing 8 knowledge colours, 5 homepage hues and 12 principle gradients.
- Knowledge grouped by category with compact cards; Principles hero halved; Compete column gaps removed; floating progress pop-up removed.

#### Pass 5 — Full content audit of every page and entry (`190dbfe`)
Read all 135 nodes, 98 entries and 12 principles end to end. Fixed:
- Scoring: back control 4 → 3 (3 places); the unverified "75% back pinned" clean-finish rule (5 places); guard-pull timing; negative points in the first half.
- Technique accuracy: X guard (one leg, not both), hip bump sweep (hand post, posture-back timing), o-soto-gari (rear-corner kuzushi), ko-soto-gari (left sole), hane-goshi (inside front of the thigh), north-south position and choke, gable and ball-and-socket grips, angles physics (30° off-axis loses about 13%, not half), gi-only techniques removed from a no-gi app, contradictory single-leg head rules removed.
- Structure: two wrong links (arm-drag back take, kimura follow-up); five nodes all titled "If Defended" renamed and filled; "you were tapped" nodes now teach something; stale "future build" note removed; unsourced claims softened; meta descriptions on every page.

#### Pass 6 — Knowledge detail panel; personalised content removed (`bd0879a`)
- Cards open one detail panel (slide-over on desktop, full-screen sheet on phones) instead of expanding inside a narrow grid column; prev/next within the current filter; shareable link per entry.
- Removed "Phil's signature throw" and all "your wrestling base / you live here already" framing (22 edits); Compete "Your go-to game" → "Core positions".

#### Pass 7 — Reference-site improvements (`1ff4a49`)
Patterns adopted (structure only, no content copied) from bjjequipment.com, thefortjiujitsu.com, bjjuniversity.com, thebjjatlas.com and open-bjj.com:
- Level on every entry (Fundamental 51 / Intermediate 39 / Advanced 8), a level filter, and "start with the fundamentals".
- Searchable aliases, ADCC points on cards, a format chip.
- Detail panel: 4-step "How to train it" (learn → drill → positional sparring → live), an "In the Matrix" link with progress buttons synced to the Matrix, related moves (Matrix graph plus attack/counter pairs), and an external video search link.
- Principles REF-05 Glossary (37 terms).

#### Pass 8 — Design system, themes, three-panel Knowledge (`b6f5792`)
- Light / Dark / System themes with a nav toggle, applied before first paint. Logo tile and brand band kept as fixed brand colours. Every hard-coded page colour converted to tokens; body text contrast ≥ 7:1 in both themes.
- One layout system in `chinthe.css` §17: a shared app shell (Knowledge, Principles; Matrix header aligned) and a shared page header (Compete, Journal).
- Knowledge as three panels: database (search, 13 position groups, types) | move tiles | docked detail.
- Principles rebuilt on the shared shell (list left, reading column right, picker on phones).

#### How every pass was verified
- Headless Chrome driven over the DevTools protocol from Node (`tests/`, see `tests/README.md`): 177 checks across every page at 360 / 390 / 1024 / 1280 / 1440 px, in both themes.
- All 135 matrix nodes framed in view, in Focus and Full map, at three screen sizes.
- Service worker freshness and offline test.
- Static content audit plus a full manual read of every entry.
- Screenshots reviewed by eye after each pass; live deploy confirmed after each push.

#### Open items and decisions for the owner
- Coach review recommended for judo throw mechanics, leg-lock details, wrestle-up scoring and the difficulty levels (borderline calls: straight ankle lock and arm triangle as Fundamental; omoplata and crucifix as Intermediate).
- Single-leg head position: the absolute rules were removed — set a house standard with your coach.
- Not yet tested on a real iPhone (iOS storage eviction, touch gestures).
- `archive/` and `.claude/` remain untracked by design.

#### Current Project Status
- **Stage 1 (MVP):** 100% — stable, tested, deployed.
- **Stage 2 (MLP):** ~60% — design system, themes, content depth and learning paths done; remaining: coach-verified content, a game-plan builder, a journal technique picker.
- **Stage 3 (Commercial):** 0%.
