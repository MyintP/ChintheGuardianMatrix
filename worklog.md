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

#### Pass 9 — One three-panel frame on every page (see git log: "Uniform three-panel frame")
Every page now uses the same layout: a page-specific panel on the left, information in the middle, supporting information on the right.
| Page | Left | Middle | Right |
|---|---|---|---|
| Home | "Start here" path (5 steps + reference) | Hero, modules, philosophy | Your progress (from device data), quick actions, data note |
| Matrix | Areas, tools, search, path (same list style) | Tree | Selected position |
| Compete | Rulesets + core positions | Ruleset header, score tracker, clock guidance | Scoring table |
| Knowledge | Database (positions, types) | Move tiles | Move detail |
| Principles | Principles + reference list | Reading column | Examples, related techniques, sources |
| Journal | Session history + New session | Log form or selected session | Stats, backup |
- Shared frame in `chinthe.css` §17: ≥1200px three fixed panels each scrolling on its own; 900–1199px sticky left panel with content and side panel stacked; phones single column (picker in the header, side panel after content).
- Fonts unified: identical font set loaded on every page; all font names replaced by tokens (Inter body, Oswald titles/lists, IBM Plex Mono labels, Cinzel quotes). The Matrix previously used IBM Plex Sans.
- Fixed while verifying: tree area overflowing under the Matrix detail panel; Principles row gap at tablet width; a stray global `nav{}` rule in Journal; homepage hero centring.
- 192/192 browser checks (new: frame order, identical left width, fonts and font links on all six pages; Journal history → middle; Compete ruleset → middle + right).
- **Owner feedback:** the panel with the most information was the smallest, and the right panel meant different things on different pages — not uniform. Superseded by Pass 10.

#### Pass 10 — WHERE | WHAT | READ: the reading panel is always the widest
One rule for every page: information gets deeper, and the panel wider, from left to right.
- **WHERE** (left, 260px): navigate. **WHAT** (middle, 400px): pick an item. **READ** (right, the rest, ~780px at 1440): the full detail.
| Page | WHERE | WHAT | READ (widest) |
|---|---|---|---|
| Home | Start-here path | Your progress, modules, quick actions | Overview: hero, philosophy, pillars |
| Matrix | Areas, tools, search | Decision tree | Position detail + options |
| Compete | Rulesets, core positions | Score tracker | Rules: key rule, scoring table, clock guidance |
| Knowledge | Positions & types | Moves (compact cards) | Move breakdown |
| Principles | Groups: Strategy & Mindset, Mechanics, Balance, Reference | Principle cards | Full principle: explanation, application, examples, related moves, sources |
| Journal | New session, type filters (with counts), stats, backup | Session cards by month | Log form or the selected session |
- Shared in `chinthe.css` §17: `.app-nav` / `.app-list` / `.app-detail` and one `.list-card` component for every pickable item. ≥1100px three panels; 900–1099px WHERE beside WHAT-then-READ; phones single column (Journal shows the form before history, Home shows the overview first).
- Homepage lion always on its brand tile (fixes a visible square on the new panel colour).
- 199/199 browser checks (new: reading panel widest on all six pages, identical middle width, Principles groups, Journal card → reading panel); all 135 Matrix nodes still framed in Focus and Full map; SW cache v25.

#### Pass 11 — Soft-launch audit (product, design, test)
Audience: wrestling, judo, BJJ and MMA practitioners, daily use.
**Fixed:**
- Journal: all 8 form fields now have programmatic labels, so screen readers and tap-to-focus on the label both work.
- Contrast (WCAG AA): light-theme gold `#8A6A12 → #7D600F` and victory `#8F6B0F → #7D5E0C` (active items, Intermediate chip, verify flag). Opponent score label, the −1 penalty and "Trailing" guidance now use the text-safe red.
- Phone tap targets: Knowledge level filters and Matrix Focus / Full map raised to 40px.
- Sharing: Open Graph and Twitter tags on all six pages, so links shared in WhatsApp, Instagram or Messenger show the title, description and lion.
- Install: apple-touch-icon and app title, so iPhone "Add to Home Screen" uses the lion. The manifest uses the brand night colour, and the icons are no longer declared maskable (which cropped them).
- Safety: a "learn under a coach, apply slowly, tap early" notice in the homepage footer and the Knowledge database panel.
- New `tests/a11y-audit.js`.

**Verified clean:**
- No unnamed controls.
- No horizontal overflow at 390 or 1440 in either theme.
- One h1 per page.
- Every page under 55 KB gzipped.
- No external links or trackers.
- No ebooks or work files in the repo or its history.
- 199/199 checks; all 135 Matrix nodes framed; SW v26 offline and freshness checks pass.

**Open, owner decisions (not built):**
1. No in-app feedback channel. Testers need one obvious way to report issues (form or email). Needs the owner's choice of channel.
2. Scope vs audience: rulesets are ADCC, IBJJF and NAGA only. There's no judo (IJF), wrestling (UWW or folkstyle) or MMA scoring, and no striking, cage or ground-and-pound content. Wrestling and judo technique coverage is real: Standing & Clinch 13, Judo Throws 18.
3. Data lives only on each device, with a backup reminder. Testers who clear their browser lose their journal.
4. No usage measurement. The soft launch can only be judged by what testers report.

#### Pass 12 — Home is the brand front door again
**Owner feedback:** Pass 10 turned Home into a working tool screen. It didn't tell a new visitor what CHINTHE is.
**Rule now:** Home is a full-width brand landing page, using the pattern of the reference sites (BJJ University, The BJJ Atlas). The three-panel frame is for the five tool pages only.
Sections, top to bottom:
1. Hero: "Know your next move.", a one-sentence explanation of what CHINTHE is, two calls to action, and the trust line (free, no sign-up, offline, private). The lion sits on a single black tile.
2. Welcome-back strip with the athlete's progress (shown only when there is data on the device).
3. Proof numbers.
4. What's inside (6 module cards).
5. How it works (4 steps).
6. Who it's for: BJJ, wrestling, judo and MMA, each with honest scope and deep links.
7. Philosophy band.
8. Four values.
9. Origin story (Chinthe, Myanmar).
10. Closing call to action.
11. Footer with links and the safety notice.
Also: new page title and share description; brand colours tokenised (`--brand-gold`, `--brand-black`, `--brand-band-deep`).
Verified: 198/198 checks (Home leaves the frame checks and gains landing-page checks); accessibility audit clean on Home; SW v27.

#### Pass 13 — The encyclopedia: 98 → 368 entries
**Owner feedback:** every earlier pass added a handful of moves; the owner asked for a full encyclopedia across wrestling, judo, BJJ and MMA, using the reference sites.
**Sources for the taxonomy:** open-bjj.com, thefortjiujitsu.com, bjjequipment.com (techniques and jiu-jitsu-moves), Wikipedia's lists of judo techniques and BJJ techniques, judoinfo.com, mmawiki.org and fightencyclopedia.com. Names and structure only; every entry is original writing. The z-library books in the working folder were not used: the tool's safety check blocked reading them, and they are a copyright risk for a public site.
**What was added (270 entries, each with tagline, objective, mechanics, opponent reactions, common mistake, drill, level, format, aliases and related moves):**
- Wrestling: stance, ties (collar, Russian, underhooks, whizzer), 15 takedowns and finishes, trips, and a new **Mat Work & Rides** section (referee's position, stand-up, sit-out, switch, Granby, Peterson, breakdowns, half nelson, cradles, spiral ride, leg ride, tilt, gut wrench, leg lace).
- Judo: the Kodokan throwing syllabus (te-, koshi-, ashi-, ma-sutemi- and yoko-sutemi-waza, including counters and wraps, with banned throws marked as reference only), combinations and counters, and a new **Pins & Ne-Waza** section (all osaekomi, the formal chokes, the ude-hishigi armlocks).
- BJJ: a new **Gi Guards & Grips** section (spider, lasso, De La Riva, RDLR, collar-sleeve, worm, squid, sweeps), plus additions to closed, half and open guard, passing (HQ, long step, X-pass, leg weave, backstep, folding, float), top positions, leg entanglements (outside ashi, 50/50, butterfly ashi, false reap, truck), submissions and escapes.
- A new **Back Takes & Transitions** section, and new concepts (distance, base and posture, inside position, breathing, training methods, leg-lock rules by ruleset).
- MMA: new **Striking** (stance, footwork, punches, kicks, knees, elbows, clinch, defence) and **Cage & Ground** sections (cage clinch, wall walk, fence takedowns and defence, ground-and-pound posture, MMA guard and back control, priorities).
**How it's built:** sources in `kb/*.js`; `node tools/build-kb.js` validates them (unique ids and names, valid groups and related links, required fields, no markup) and writes `encyclopedia.js` plus the global-search block in `chinthe.js`. The Knowledge page merges the data at load.
**UI:** renamed to Encyclopedia across nav, breadcrumb, title and home; an **A–Z index**; Transitions and Strikes types; the panel shows the format (Gi, No-Gi, Wrestling, Judo, MMA) and video search uses the right discipline. The home page describes all four disciplines with deep links.
Verified: 204/204 checks (new: 350+ complete entries, every entry levelled and grouped, every link resolves, the six new sections, A–Z index, format chip and video search); accessibility audit clean; SW v28 precaches `encyclopedia.js` (63 KB gzipped).

#### Pass 14 — Muay Thai and Lethwei (368 → 393 entries)
- New **Muay Thai: Art of Eight Limbs** section: Thai stance, Wai Kru Ram Muay, how fights are scored, long guard, switch kick, diagonal knee, uppercut and chopping elbows, clinch fighting, clinch dumps, catch-and-sweep, check-and-counter, Thai pad training, conditioning. Linked to the existing teep, kicks, knees, elbows and Thai clinch, with no duplicates.
- New **Lethwei: Burmese Boxing** section: rules and the nine limbs (bare knuckle, headbutts, KO-only tradition, injury time-out), Lekkha Moun and Lethwei Yay, stance, bare-knuckle punching and hand safety, headbutt and clinch headbutt (pads only), headbutt defence, the Lethwei clinch, throws and sweeps, defence without gloves, and Bando and Banshay as Myanmar's martial roots.
- New formats Muay Thai and Lethwei (chip and video search). Home: two new audience cards, "Built for fighters", three-column grid; the encyclopedia is renamed **Fighting Encyclopedia**.
- Rules details vary by promotion (Muay Thai scoring, modern Lethwei judging); entries say so rather than state one rulebook.
- 204/204 checks (section checks now include Muay Thai and Lethwei); SW v29.

#### Pass 15 — Closing the launch gaps
**Feedback (launch blocker):** a feedback button in the nav on every page, plus "Report a correction to this entry" on all 393 encyclopedia entries (pre-filled with the entry name and page). It goes to GitHub Issues on the public repo by default, so no personal contact details are published. To use a Google Form or email instead, change `FEEDBACK_URL` at the top of `chinthe.js`.
**Expert review:** per-entry correction links let practitioners review as they use the site. MMA rules claims were hedged: 12-6 elbows (the ABC voted in 2024 to allow them; adoption varies) and the varying definition of a grounded fighter.
**Compete, six sports, nine rulesets:** ADCC, IBJJF, NAGA, Judo (IJF), Freestyle (UWW), Folkstyle (NCAA), MMA (Unified Rules), Muay Thai and Lethwei (traditional), grouped by sport. Each has a tracker that matches how it is scored:
- points (BJJ, wrestling);
- waza-ari and shido (judo: two waza-ari is ippon, a third shido loses);
- a 10-point-must round card (MMA, Muay Thai);
- knockdowns and injury time-out (Lethwei: draw unless stopped).
Guidance and key-technique links are per sport. Every non-ADCC ruleset carries the verify-against-the-rulebook flag.
**Daily loop:** Home has a **Today** band with a discipline picker (remembered on the device), a technique of the day (with "drill it today", "Open the breakdown" and "Log it"), and a weekly focus (three moves from one section, rotating each Monday). The journal autocompletes technique names from the encyclopedia, links logged techniques back to their entries, and accepts `journal.html?tech=` from "Log it". The encyclopedia supports `#g:<section>` links.
**Video:** entries accept an optional `video` (YouTube or Vimeo, validated by the build), shown as "Watch: coach's pick" above the video search. No videos have been chosen yet; that is for a coach.
**Not built, on purpose:**
- Cross-device sync needs accounts, a backend and a privacy policy. Backup and restore covers it until usage justifies the cost.
- Analytics needs a third-party account and would change the "no tracking" promise. That is the owner's decision.
- Position diagrams need an illustrator to be good. Weak diagrams would hurt the brand more than text does.
Verified: 218/218 checks (new: nine rulesets and six sports, judo ippon, MMA round card, Lethwei draw, feedback links, Today, discipline memory, journal pre-fill, autocomplete and links, section links, correction links). All 135 Matrix nodes framed. Accessibility clean. SW v30.

#### Pass 16 — Every device, iOS and Android
The owner will share one link with friends on phones, tablets and desktops. A new `tests/device-check.js` runs every page on 8 devices (iPhone SE 320, Android 360, iPhone 15 393, Pro Max 430, iPad mini and Air portrait, iPad and iPad Pro landscape) with touch emulation.
- **Fixed: iOS zoom.** Every text field and dropdown was 13–15px, so iPhones and iPads zoomed the page on every tap into search or the journal. All fields are now 16px on touch devices.
- **Fixed: iPad Safari height.** The three-panel frame uses `100dvh` (with a `100vh` fallback), so the toolbar can't hide the bottom of the panels.
- **Fixed:** the Compete "Undo last round" button was squashed on tablets and small phones.
- Result: all 6 pages are clean on all 8 devices (no sideways scroll, no zooming fields, no cut-off panels). The feedback channel stays GitHub Issues, by the owner's choice.

#### Pass 17 — Game plan builder
A new page, `gameplan.html`, in the same three-panel frame: your plans on the left, the plan's stages in the middle, the open stage on the right.
- **Stages per discipline:** BJJ no-gi and gi (standing, your guard, from your guard, passing, pin and advance, finish, when it goes wrong), wrestling, judo (grips, tokui-waza, renraku-waza, kaeshi-waza, into ne-waza, pin or submission), MMA, Muay Thai and Lethwei.
- **Each stage:** Plan A, Plan B and an if–then note. Picks autocomplete from the encyclopedia, filtered to that stage and discipline. Fundamentals are offered as quick picks, and each pick previews its entry with "Open the breakdown" and "Log it". Moves that aren't in the encyclopedia are kept as plain text.
- **Overview:** every stage on one page, the gaps named, and a drill list built from the encyclopedia drill for each Plan A. Export as text, print, rename, delete.
- **Storage:** on the device, with backup and restore that validates and cleans the file. The last plan reopens on return.
- **Data:** `tools/build-kb.js` now adds a short index of the 98 core entries to `encyclopedia.js`, so the picker covers all 393 techniques.
- Linked from the nav on every page, the home page (a new card, "six tools") and the footer. SW v32.
- Fixed while testing: the home page entry count read the new index twice (showed 491); it counts only the encyclopedia entries again (393).
Verified: 15 new checks (stage pools for every discipline, saving, quick picks, gaps, drill list, reload, export, restore validation, delete).

#### Pass 18 — Professional design finish
A design review found the site looked amateur for site-wide reasons, not page-by-page ones: almost every piece of text was condensed or monospaced capitals, each page named itself three times, and four accent colours competed. Fixed at the design-system level so every page changed together.
- **Type:** one UI sans (Inter) for nav, buttons, labels, list items and card titles, in sentence case. The condensed display face (Oswald, uppercase) is kept only for page and section titles, the logo and the brand words. Monospace is gone from the interface. Small uppercase labels stay, with tighter tracking.
- **Navigation:**
  - 14px nav links with an underline on the current page.
  - The breadcrumb bar is removed; every page is one level below Home.
  - The repeated "CHINTHE …" eyebrow above each left-panel title is hidden.
  - Home no longer has its own nav button, so the nav is identical everywhere.
  - The theme toggle shows a half-filled circle instead of a monitor.
- **Colour:**
  - Primary buttons are gold on dark and ink-black on light (black and gold).
  - Section labels are neutral grey instead of jade.
  - Jade stays only where it means something: points scored, "got it", success.
  - Callouts and focus rings are gold.
- **Surfaces:** cards are white (light) or lifted (dark) with a clear border on the page tone. The reading panel is white like a document. Level chips are quiet pills instead of three colours.
- **Fixes:**
  - The Encyclopedia opens on a "Start with the fundamentals" panel (8 entries to open) instead of an empty pane.
  - The Matrix uses line icons instead of emoji, and its path trail is a quiet gold pill instead of a black one.
  - On phones, Game Plan shows your plan first and hides the empty list when there are no plans.
  - The Encyclopedia level filter wraps instead of running off screen.
  - The Principles quote is in italic body text instead of Cinzel capitals.
  - Light label colour darkened to pass AA.
  - The logo and path pills reach the 32px tap height.
- SW v33.

#### Pass 19 — Lacquer and Gold: palette, type, shared header and footer, home layout
The owner's redesign brief, applied to pass 18.

**Direction:** Burmese lacquerware (yun-de): black lacquer, cinnabar red and gold leaf. The light theme reads like palm-leaf manuscript paper.
- **Palette:**
  - Light: paper `#F3EFE6`, ink `#1C1915`, cinnabar `#8F2D22` for primary actions and the current page.
  - Dark: lacquer `#13110F` with cinnabar `#B8432F` buttons.
  - Gold is kept for numerals, rules and the emblem, so the emblem stays the brightest gold on the page.
  - Jade only means "scored" or "got it".
- **Type:** Newsreader (serif) for headings, in sentence case. IBM Plex Sans for body and interface text. Noto Sans Myanmar unchanged. Inter, Oswald and Cinzel are no longer loaded.
- **Shape:** 4px corners and hairline rules. No coloured side bars, no gradients, no emoji.
- Every token is in `chinthe.css`. New tokens: `--accent`, `--accent-dim`, `--content-max`, `--gutter`, `--space-12/16/24`. `--brand-black` is now the emblem's own ground (`#0D000D`), so the emblem is shown without a filter.

**Shared header and footer:** `chinthe.js` builds both on every page. Pages keep an empty `<nav class="site-nav">`.
- **Header:**
  - Logo and wordmark, then Matrix · Compete · Encyclopedia · Principles · Game Plan · Journal, then search, theme, feedback and **Open Matrix →**.
  - The current page has `aria-current="page"` and a cinnabar underline.
  - Below 1024px the links collapse into a 44px menu button with 52px rows. Below 720px the Open Matrix button moves into the menu.
  - All targets are 44px. The sticky header gains a soft shadow on scroll.
- **Footer:** tool links, "Rooted in Myanmar · Built for the World · Alpha", and the safety disclaimer.
- **App pages:** the three-panel frame fills the screen under the header, and the footer sits below it.

**Home, in the brief's order:**
1. Hero, left-aligned, with the emblem on the right (below the copy on phones).
2. Stat row.
3. Six tools as numbered full-width rows, with Guardian Coach as a muted "Coming soon" row.
4. How it works.
5. Built for fighters (3 × 2, 2 × 3, 1 column).
6. Pull quote on solid lacquer.
7. Four values.
8. Our story: heading left, paragraphs right.
9. Closing call to action.

All copy, anchors and IDs are unchanged.

**Deliberate deviations from the brief:**
- **Game Plan:** it is in the nav and is the sixth tool, because it was built after the brief was written.
- **Today band:** the brief doesn't list it. It sits between the tools and How it works.
- **Returning-athlete strip:** shown under the hero, only when there is data on the device.

**Verified:**
- Main suite: 274 checks. New ones cover the shared header and footer on every page at 360, 390 and 1280px, the current-page marker, the unfiltered emblem, no gradients, and the home section order.
- All 7 pages clean on 8 devices.
- Accessibility clean in both themes.
- All 135 Matrix nodes framed.
- Service worker and offline both pass.

**Also:**
- Running text in the reading panels is 16px.
- `prefers-reduced-motion` turns off all transitions.
- SW v34.

#### Pass 20 — Full QA run on every device
New `tests/qa-live.js` runs every page on 10 devices (iPhone SE 320 to 1920 desktop) in light and dark, against the live site by default, and drives the core flows on each device: search, Encyclopedia, Matrix, Compete, Principles, Journal save/backup/restore, Game Plan, and the theme toggle.

**Defects found and fixed:**
- **Page transitions (medium, phones and tablets):** the browser aborted the cross-page fade when the viewport changed mid-navigation (rotation, the mobile address bar) and logged an uncaught error. Cross-page transitions are removed: the brief asks for minimal motion and the fade was decorative. The search overlay keeps its in-page fade.
- **Logo tap target (low, iPad landscape 1024–1199px):** with the wordmark hidden, the logo was a 32px target. It is now at least 44px.

**Test tooling fixed (not site bugs):**
- `audit.js` flagged every encyclopedia name under 15 characters as "short". Its Compete check matched the sport groups instead of the quick-jump links, and it never checked `gameplan.html`. It now reports 0 defects plus 21 informational notes.
- The walkthrough hung on a native confirm dialog ("Reset score"), and a late load event from an earlier page could race the next step. Dialogs are now stubbed on every page, and each step waits until the new URL is showing.

**Results after the fixes:**
- Walkthrough: 388/388.
- Main suite: 274/274.
- 8-device check: clean.
- Accessibility: clean in both themes. The one remaining small target is an inline text link, which WCAG exempts.
- All 135 Matrix nodes framed.
- Service worker and offline: 5/5.
- SW v35.

**Not covered:** real Safari/WebKit and real hardware. Every run is Chrome with device emulation. iOS storage eviction and real touch gestures still need a person on an iPhone.

#### Pass 21 — Keeping the journal safe on iOS
iOS Safari can clear a website's storage, and the journal lives only in that storage. Three safeguards were added, with no new dependencies and no new storage keys. The extra fields live in the existing `chinthe_journal_backup_v1` object.
- **Persistent storage on first save:** `navigator.storage.persist()` used to run on every page load, and its answer was ignored. It now runs on the first save, because Safari needs a user action before it will grant it. The answer is recorded as `persist: {result: granted | denied | unsupported | error, at}` and the question is asked once.
- **"Back up your journal" prompt:** it now also appears when there are 5+ entries and no backup in 14+ days (or never), even if every entry is in the last backup. The existing rules are kept: 3+ never backed up, 5+ not in the last backup, or any new entry and 14+ days.
  - The prompt moved from the bottom of the phone layout to the top of the Journal, under "New session".
  - "Back up now" runs the existing backup.
  - "Later" dismisses it for 3 days.
- **One-time Home Screen tip:** "Add to Home Screen to keep your journal safe. Tap Share, then 'Add to Home Screen'."
  - It shows only in iPhone and iPad Safari when the site isn't running from the Home Screen (`navigator.standalone` or `display-mode: standalone`).
  - iPadOS is detected by its Mac user agent plus touch points.
  - Chrome, Firefox, Edge, Opera and Google on iOS are excluded.
  - It is shown once (recorded as `installTip`), and "Got it" hides it.
- 17 new checks:
  - No storage request on page load. The first save asks and records. Later saves don't ask. A refusal is recorded.
  - The prompt at 15 days with 5 entries, its position at the top, and its backup button. No prompt at 13 days or with 4 entries. A prompt when never backed up. Dismissal persists.
  - The tip rule for iPhone, iPad, installed, Chrome on iOS, Mac and Android, then the real tip in an iPhone Safari tab: wording, "Got it", shown once.
  - Storage keys unchanged.
- **Verified:**
  - Main suite: 291/291.
  - 10-device walkthrough: 388/388.
  - 8-device check: clean.
  - Accessibility: clean in both themes.
  - All 135 Matrix nodes framed.
  - Content audit: 0 defects.
  - Service worker and offline: 5/5.
- SW v36.

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
- **Stage 2 (MLP):** ~70% — design system, themes, content depth, learning paths and the game plan builder done; remaining: coach-verified content and a professional design finish.
- **Stage 3 (Commercial):** 0%.
