/*
  CHINTHE — shared page behaviour
  1. Mobile nav: injects a hamburger toggle into .site-nav.
  2. Service worker registration.
  4. C.3 Global search modal (nav button, Ctrl+K, or "/").
  5. Node counts: fills [data-node-count] from the search index.
*/
// Feedback destination — change this one line to use a form or email instead.
var FEEDBACK_URL = "https://github.com/MyintP/ChintheGuardianMatrix/issues/new";
window.chintheFeedback = function (title, body) {
  var page = (location.pathname.split("/").pop() || "index.html") + location.hash;
  var text = (body ? body + "\n\n" : "") + "Page: " + page;
  if (FEEDBACK_URL.indexOf("mailto:") === 0)
    return FEEDBACK_URL + "?subject=" + encodeURIComponent(title) + "&body=" + encodeURIComponent(text);
  if (FEEDBACK_URL.indexOf("github.com") > -1)
    return FEEDBACK_URL + "?title=" + encodeURIComponent(title) + "&body=" + encodeURIComponent(text);
  return FEEDBACK_URL;
};

// ── Shared header and footer ─────────────────────────────────────
// One source for every page: each page has an empty <nav class="site-nav">,
// and the footer is added at the end of <body>. No build step needed.
var CHINTHE_TOOLS = [
  ["chinthe-guardian-matrix.html", "Matrix"],
  ["competition.html", "Compete"],
  ["knowledge.html", "Encyclopedia"],
  ["principles.html", "Principles"],
  ["gameplan.html", "Game Plan"],
  ["journal.html", "Journal"]
];
(function () {
  var here = location.pathname.split("/").pop() || "index.html";
  var nav = document.querySelector(".site-nav");
  if (nav && !nav.querySelector(".site-nav-inner")) {
    if (!nav.getAttribute("aria-label")) nav.setAttribute("aria-label", "Main");
    nav.innerHTML =
      '<div class="site-nav-inner">' +
        '<a class="site-nav-brand" href="index.html" aria-label="CHINTHE home"' + (here === "index.html" ? ' aria-current="page"' : '') + '>' +
          '<img class="site-nav-lion" src="chinthe-lion.png" alt="" width="32" height="32">' +
          '<span class="site-nav-wordmark">CHINTHE</span>' +
        '</a>' +
        '<div class="site-nav-links" id="siteNavLinks">' +
          CHINTHE_TOOLS.map(function (t) {
            var on = t[0] === here;
            return '<a class="site-nav-link' + (on ? ' active' : '') + '" href="' + t[0] + '"' + (on ? ' aria-current="page"' : '') + '>' + t[1] + '</a>';
          }).join("") +
        '</div>' +
        '<a class="site-nav-cta btn btn-primary" href="chinthe-guardian-matrix.html">Open Matrix <span aria-hidden="true">→</span></a>' +
      '</div>';
  }
  if (!document.querySelector(".site-footer")) {
    var f = document.createElement("footer");
    f.className = "site-footer";
    f.innerHTML =
      '<div class="site-footer-inner">' +
        '<div class="site-footer-brand"><img src="chinthe-lion.png" alt="" width="40" height="40">' +
          '<div><div class="site-footer-name">CHINTHE</div><div class="site-footer-myanmar" lang="my">ခြင်္သေ့</div></div></div>' +
        '<nav class="site-footer-links" aria-label="Tools">' +
          CHINTHE_TOOLS.map(function (t) { return '<a href="' + t[0] + '">' + t[1] + '</a>'; }).join("") +
        '</nav>' +
        '<p class="site-footer-tagline">Rooted in Myanmar · Built for the World · Alpha</p>' +
        '<p class="site-footer-safety">Educational reference, not a substitute for a qualified coach. Learn submissions and leg locks under supervision, apply them slowly, and tap early.</p>' +
      '</div>';
    document.body.appendChild(f);
  }
})();

(function () {
  // ── 1. Mobile Nav ────────────────────────────────────────────
  var nav    = document.querySelector(".site-nav");
  var inner  = nav && nav.querySelector(".site-nav-inner");
  var links  = nav && nav.querySelector(".site-nav-links");

  if (nav && inner && links) {
    if (!links.id) links.id = "siteNavLinks";

    // Visible search trigger — the only way to open search on touch devices
    var searchBtn = document.createElement("button");
    searchBtn.type = "button";
    searchBtn.className = "site-nav-search";
    searchBtn.setAttribute("aria-label", "Search");
    searchBtn.setAttribute("title", "Search (Ctrl K)");
    searchBtn.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
        '<circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/>' +
        '<line x1="11" y1="11" x2="14.5" y2="14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '</svg>';
    searchBtn.addEventListener("click", function (e) { e.stopPropagation(); openSearch(); });
    var cta = inner.querySelector(".site-nav-cta");
    inner.insertBefore(searchBtn, cta || null);

    // Theme: System (follow the device) → Light → Dark. Stored per device;
    // the inline script in each <head> applies it before first paint.
    var THEME_KEY = "chinthe_theme";
    var THEME_ICONS = {
      system: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none"/></svg>',
      light:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
      dark:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>'
    };
    var THEME_NEXT = { system: "light", light: "dark", dark: "system" };
    var THEME_NAME = { system: "System", light: "Light", dark: "Dark" };
    function currentTheme() { try { var t = localStorage.getItem(THEME_KEY); return t === "light" || t === "dark" ? t : "system"; } catch (e) { return "system"; } }
    function applyTheme(t) {
      if (t === "system") document.documentElement.removeAttribute("data-theme");
      else document.documentElement.setAttribute("data-theme", t);
      document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
        if (!m.dataset.orig) m.dataset.orig = m.getAttribute("content");
        m.setAttribute("content", t === "system" ? m.dataset.orig : (t === "light" ? "#F3EFE6" : "#13110F"));
      });
      themeBtn.innerHTML = THEME_ICONS[t];
      themeBtn.setAttribute("aria-label", "Theme: " + THEME_NAME[t] + " (switch to " + THEME_NAME[THEME_NEXT[t]] + ")");
      themeBtn.setAttribute("title", "Theme: " + THEME_NAME[t]);
    }
    var themeBtn = document.createElement("button");
    themeBtn.type = "button";
    themeBtn.className = "site-nav-theme";
    themeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      var next = THEME_NEXT[currentTheme()];
      try { if (next === "system") localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, next); } catch (err) {}
      applyTheme(next);
    });
    inner.insertBefore(themeBtn, searchBtn.nextSibling);
    applyTheme(currentTheme());

    // Feedback: one tap from every page
    var fb = document.createElement("a");
    fb.className = "site-nav-theme site-nav-feedback";
    fb.target = "_blank"; fb.rel = "noopener noreferrer";
    fb.setAttribute("aria-label", "Send feedback");
    fb.setAttribute("title", "Send feedback");
    fb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14h4"/></svg>';
    fb.addEventListener("click", function () { fb.href = window.chintheFeedback("Feedback: " + document.title, "What happened, or what would make this better?"); });
    fb.href = window.chintheFeedback("Feedback: " + document.title, "What happened, or what would make this better?");
    inner.insertBefore(fb, themeBtn.nextSibling);

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "site-nav-toggle";
    toggle.setAttribute("aria-label", "Menu");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", links.id);
    for (var i = 0; i < 3; i++) toggle.appendChild(document.createElement("span"));
    inner.appendChild(toggle);

    function setOpen(open) {
      nav.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }
    toggle.addEventListener("click", function (e) {
      e.stopPropagation(); setOpen(!nav.classList.contains("menu-open"));
    });
    links.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !document.querySelector(".search-overlay")) setOpen(false); });
    document.addEventListener("click", function (e) { if (nav.classList.contains("menu-open") && !nav.contains(e.target)) setOpen(false); });
    window.addEventListener("resize", function () { if (window.innerWidth >= 1024) setOpen(false); });
    // A soft shadow once the page scrolls, so the sticky header stays distinct
    var onScroll = function () { nav.classList.toggle("is-scrolled", window.scrollY > 4); };
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  }

  // ── 2. Service Worker ─────────────────────────────────────────
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(function () {});
  }

  // Breadcrumbs were removed: the nav already marks the current page, and
  // every page is one level below Home.

  // ── C.3 Global Search ─────────────────────────────────────────
  // Every result deep-links: the Matrix, Knowledge Base and Principles pages
  // all open the matching item from the URL hash.
  var IDX = (function () {
    var items = [];
    function m(id, title) { items.push({ c: "M", cl: "c-M", cat: "Matrix",    t: title, u: "chinthe-guardian-matrix.html#" + id }); }
    function p(id, title) { items.push({ c: "P", cl: "c-P", cat: "Principle", t: title, u: "principles.html#" + id }); }
    function k(id, title) { items.push({ c: "T", cl: "c-T", cat: "Technique", t: title, u: "knowledge.html#" + id }); }

    // Matrix nodes
    m("hub",                    "Guardian Matrix");
    m("start",                  "Neutral / Standing");
    m("td_wrestling",           "Wrestling Shot");
    m("td_judo",                "Judo Throw Entry");
    m("guard_pull",             "Guard Pull");
    m("td_clean",               "Clean Takedown");
    m("td_standard",            "Standard Takedown");
    m("td_stuffed",             "Front Headlock");
    m("turtle_from_throw",      "Opponent Turtles (after Throw)");
    m("guard_bottom",           "Bottom Guard — Select Guard Type");
    m("guard_closed",           "Closed Guard");
    m("cg_armbar",              "Armbar (Closed Guard)");
    m("cg_triangle",            "Triangle (Closed Guard)");
    m("cg_guillotine_entry",    "Guillotine Setup (Closed Guard)");
    m("cg_kimura",              "Kimura (Closed Guard)");
    m("cg_hip_bump",            "Hip Bump Sweep");
    m("cg_scissor",             "Scissor Sweep");
    m("guard_half",             "Half Guard (Bottom)");
    m("hg_underhook",           "Underhook Battle (Half Guard)");
    m("hg_dogfight",            "Dog Fight (Half Guard)");
    m("hg_old_school",          "Old School Sweep (Half Guard)");
    m("hg_back_take",           "Back Take (from Half Guard)");
    m("guard_butterfly",        "Butterfly Guard");
    m("bg_elevate",             "Butterfly Elevator Sweep");
    m("bg_arm_drag",            "Arm Drag (Butterfly)");
    m("bg_x_entry",             "Entry to Single Leg X");
    m("guard_slx",              "Single Leg X (SLX)");
    m("slx_sweep",              "SLX Sweep");
    m("slx_back_take",          "Back Take (from SLX)");
    m("guard_x",                "X Guard");
    m("xg_back_sweep",          "Back Dump Sweep (X Guard)");
    m("xg_front_sweep",         "Front Trip Sweep (X Guard)");
    m("xg_stand_up",            "Stand Up (from X Guard)");
    m("sweep",                  "Sweep");
    m("pass",                   "Passing Game");
    m("pass_over_under",        "Over-Under Pass");
    m("pass_knee_slice",        "Knee Slice / Knee Cut");
    m("pass_torreando",         "Torreando / Bullfighter Pass");
    m("pass_body_lock",         "Body Lock Pass");
    m("pass_leg_drag",          "Leg Drag");
    m("pass_double_under",      "Double Under / Stack Pass");
    m("pass_headquarters",      "Headquarters (HQ) Position");
    m("pass_smash",             "Smash Pass (Half Guard)");
    m("pass_complete",          "Guard Pass — Scored");
    m("knee_belly",             "Knee on Belly");
    m("mount",                  "Mount");
    m("backtake_pass",          "Back Take (off the Pass)");
    m("backtake_turtle",        "Back Take (off Turtle)");
    m("backtake_headlock",      "Back Take (off Front Headlock)");
    m("backtake_mount_scramble","Back Take (Mount Scramble)");
    m("rnc",                    "Rear Naked Choke");
    m("rnc_defended",           "RNC — If Defended");
    m("bow_arrow",              "Bow-and-Arrow Choke");
    m("armbar_back",            "Armbar (from the Back)");
    m("mount_from_spin",        "Mount (off Their Spin-In)");
    m("armbar_mount",           "Armbar (from Mount)");
    m("armbar_defended",        "Armbar — If Defended");
    m("triangle_from_armbar",   "Triangle (chained off Armbar)");
    m("backtake_from_stack",    "Back Take (off Their Stack)");
    m("triangle_mount",         "Triangle (from Mount)");
    m("triangle_defended",      "Triangle — If Defended");
    m("armbar_from_triangle",   "Armbar (chained off Triangle)");
    m("guillotine",             "Guillotine");
    m("guillotine_defended",    "Guillotine — If Defended");
    m("armbar_from_guillotine", "Armbar (off Failed Guillotine)");
    m("triangle_from_guillotine","Triangle (off Failed Guillotine)");
    m("backtake_from_guillotine","Back Take (off Failed Guillotine)");
    m("leg_entanglement",       "Leg Entanglement");
    m("leg_ashi_inside",        "Inside Ashi-Garami");
    m("leg_ashi_outside",       "Outside Ashi / Backstep");
    m("leg_saddle",             "Saddle / 411 / Honey Hole");
    m("leg_fifty_fifty",        "50/50");
    m("leg_inside_heel_hook",   "Inside Heel Hook");
    m("leg_outside_heel_hook",  "Outside Heel Hook");
    m("leg_straight_ankle",     "Straight Ankle Lock");
    m("leg_kneebar",            "Kneebar");
    m("leg_upgrade_saddle",     "Upgrade to Saddle");
    m("leg_defended",           "Leg Lock — If Defended");
    m("def_start",              "Opponent Has Initiative");
    m("def_takedown_threat",    "Opponent Shoots On You");
    m("def_sprawl_success",     "Sprawl Successful");
    m("def_takedown_conceded",  "Takedown Conceded");
    m("def_guard_threat",       "Opponent Passing Your Guard");
    m("def_guard_recovered",    "Guard Recovered");
    m("def_stood_up",           "Base Built — Back to Feet");
    m("def_pass_conceded",      "Pass Conceded");
    m("def_half_recovered",     "Half Guard Recovered");
    m("def_mount_conceded",     "Mount Conceded");
    m("def_mount_escaped",      "Mount Escaped");
    m("def_armbar_threat_mount","They Attack Armbar From Mount");
    m("def_armbar_survived",    "Armbar Survived");
    m("def_submitted_armbar",   "Armbar Finished (Loss)");
    m("def_back_threat",        "Opponent Has Seatbelt / Hooks In");
    m("def_backtake_conceded",  "Back Taken — Points Conceded");
    m("def_back_neutralized",   "Position Neutralized");
    m("def_choke_threat",       "They Attack the Choke");
    m("def_choke_survived",     "Choke Survived");
    m("def_submitted_choke",    "Choke Finished (Loss)");
    m("def_leg_threat",         "Opponent Attacking the Leg");
    m("def_leg_survived",       "Escaped / Neutralized (Leg Lock)");
    m("def_submitted_leg",      "Leg Lock Finished (Loss)");
    m("def_leg_safe",           "Passed Through Safely");
    m("hand_fight",                "Hand Fight & Tie-Ups");
    m("st_two_on_one",             "2-on-1 / Arm Drag");
    m("st_collar_snap",            "Collar Tie & Snap Down");
    m("st_underhook_tie",          "Underhook Tie-Up");
    m("st_body_lock_td",           "Body Lock Takedown");
    m("st_ankle_pick",             "Ankle Pick");
    m("st_single_leg",             "Single Leg");
    m("st_rear_body_lock",         "Rear Body Lock (Standing)");
    m("st_mat_return",             "Mat Return");
    m("fh_darce",                  "D'Arce Choke");
    m("fh_anaconda",               "Anaconda Choke");
    m("fh_go_behind",              "Go-Behind (Spin to the Back)");
    m("fh_choke_defended",         "Front Headlock Choke — If Defended");
    m("turtle_top",                "Turtle — Top");
    m("turtle_crucifix",           "Crucifix");
    m("crucifix_armlock",          "Crucifix Armlock");
    m("side_control",              "Side Control");
    m("sc_americana",              "Americana (Keylock)");
    m("sc_kimura",                 "Kimura (Top)");
    m("sc_arm_triangle",           "Arm Triangle (Kata Gatame)");
    m("north_south",               "North-South");
    m("ns_choke",                  "North-South Choke");
    m("guard_seated",              "Seated Guard");
    m("gs_wrestle_up",             "Wrestle Up");
    m("gs_shin_to_shin",           "Shin-to-Shin");
    m("gs_k_guard",                "K-Guard Entry");
    m("pass_knee_shield",          "Beating the Knee Shield");
    m("def_headlock_threat",       "They Have Your Head (Front Headlock)");
    m("def_headlock_escaped",      "Head Free — Back to Neutral");
    m("def_side_control",          "Pinned in Side Control");
    m("def_side_to_knees",         "Underhook to Knees");
    m("def_guard_retention",       "Guard Retention");
    m("bg_back_take",            "Back Take (from Arm Drag)");

    // Principles
    p("efficiency", "Maximum Efficiency — Seiryoku Zenyo");
    p("ju",         "JU — Yielding");
    p("timing",     "Timing");
    p("reaction",   "Action-Reaction");
    p("drive",      "Drive, Don't Strike");
    p("leverage",   "Leverage");
    p("weight",     "Weight Over Muscle");
    p("angles",     "Angles and Force Vectors");
    p("balance",    "Balance and Base");
    p("kuzushi",    "Kuzushi");
    p("position",   "Position Before Submission");
    p("frames",     "Frames");
    // Static principle sections
    p("hierarchy",  "Positional Hierarchy");
    p("chess",      "Chess Principles Applied to Grappling");
    p("grips",      "Grip Taxonomy");
    p("distances",  "Fighting Distances");
    p("glossary",   "Glossary — BJJ Terms");

    // Knowledge techniques
    k("rnc",                     "Rear Naked Choke (Hadaka-Jime)");
    k("armbar",                  "Armbar (Juji-Gatame)");
    k("triangle",                "Triangle Choke");
    k("guillotine",              "Guillotine");
    k("heel_hook_inside",        "Inside Heel Hook");
    k("heel_hook_outside",       "Outside Heel Hook");
    k("ankle_lock",              "Straight Ankle Lock");
    k("kneebar",                 "Kneebar");
    k("bow_arrow",               "Bow-and-Arrow Choke");
    k("kimura",                  "Kimura");
    k("omoplata",                "Omoplata");
    k("back_control",            "Back Control");
    k("mount",                   "Mount");
    k("guard_closed",            "Closed Guard");
    k("half_guard_bottom",       "Half Guard (Bottom)");
    k("butterfly",               "Butterfly Guard");
    k("slx",                     "Single Leg X (SLX)");
    k("x_guard",                 "X Guard");
    k("ashi_inside",             "Inside Ashi-Garami");
    k("saddle",                  "Saddle / 411 / Honey Hole");
    k("over_under",              "Over-Under Pass");
    k("knee_slice",              "Knee Slice / Knee Cut");
    k("torreando",               "Torreando / Bullfighter Pass");
    k("body_lock",               "Body Lock Pass");
    k("leg_drag",                "Leg Drag");
    k("smash_pass",              "Smash Pass (Half Guard)");
    k("double_under",            "Double Under / Stack Pass");
    k("hip_bump",                "Hip Bump Sweep");
    k("scissor",                 "Scissor Sweep");
    k("butterfly_sweep",         "Butterfly Elevator Sweep");
    k("old_school",              "Old School Sweep (Half Guard)");
    k("slx_sweep",               "SLX Sweep");
    k("xg_sweep",                "X Guard Back Dump");
    k("wrestling_shot",          "Wrestling Shot");
    k("judo_throw",              "Judo Throw Entry");
    k("clean_takedown",          "Clean Takedown");
    k("front_headlock_td",       "Front Headlock Control");
    k("sprawl",                  "Sprawl Defence");
    k("guard_recovery",          "Guard Recovery");
    k("back_survival",           "Back Control Survival");
    k("choke_survival",          "Choke Defence");
    k("leg_escape",              "Leg Lock Escape");
    k("mount_escape",            "Mount Escape");
    k("side_control",            "Side Control (Side Mount)");
    k("north_south",             "North-South Position");
    k("turtle_top",              "Turtle (Top)");
    k("turtle_bottom",           "Turtle (Bottom)");
    k("knee_on_belly",           "Knee on Belly");
    k("guard_bottom_closed_detail","Closed Guard — Top Player's Game");
    k("o_soto_gari",             "O-Soto-Gari (Major Outer Reap)");
    k("seoi_nage",               "Seoi-Nage (Shoulder Throw)");
    k("single_leg_wrestling",    "Single Leg Takedown");
    k("kuzushi_application",     "Kuzushi in Passing");
    k("chain_attacks",           "The Attack Chain");
    k("action_reaction_entries", "Set-Up and Reaction Entries");
    k("hip_movement",            "Hip Movement (Shrimping and Bridging)");
    k("fluid_efficiency",        "Fluid Technique — Efficiency Over Power");
    k("tai_otoshi",              "Tai-Otoshi (Body Drop)");
    k("o_goshi",                 "O-Goshi (Large Hip Throw)");
    k("harai_goshi",             "Harai-Goshi (Sweeping Hip Throw)");
    k("uchi_mata",               "Uchi-Mata (Inner Thigh Throw)");
    k("ukemi",                   "Ukemi (Break Falls)");
    k("kesa_gatame",             "Kesa-Gatame (Scarf Hold)");
    k("randori",                 "Randori (Freestyle Practice)");
    k("kumi_kata",               "Kumi-Kata (Grip Fighting)");
    k("ouchi_gari",              "Ouchi-Gari (Large Inner Reap)");
    k("ko_uchi_gari",            "Ko-Uchi-Gari (Small Inner Reap)");
    k("ko_soto_gari",            "Ko-Soto-Gari (Small Outer Reap)");
    k("hane_goshi",              "Hane-Goshi (Spring Hip Throw)");
    k("tomoe_nage",              "Tomoe-Nage (Circle Throw / Sacrifice)");
    k("sumi_gaeshi",             "Sumi-Gaeshi (Corner Reversal)");
    k("judo_bjj_bridge",         "The Judo-to-BJJ Bridge");
    k("clinch_entry",            "Standup Entry to Clinch");
    k("darce",                     "D'Arce Choke");
    k("anaconda",                  "Anaconda Choke");
    k("arm_triangle",              "Arm Triangle (Kata Gatame)");
    k("americana",                 "Americana (Keylock / Ude Garami)");
    k("north_south_choke",         "North-South Choke");
    k("toe_hold",                  "Toe Hold");
    k("seated_guard",              "Seated Guard");
    k("k_guard",                   "K-Guard");
    k("shin_to_shin",              "Shin-to-Shin");
    k("crucifix",                  "Crucifix");
    k("body_triangle",             "Body Triangle");
    k("double_leg",                "Double Leg");
    k("ankle_pick",                "Ankle Pick");
    k("snap_down",                 "Snap Down");
    k("arm_drag_standing",         "Arm Drag (Standing / 2-on-1)");
    k("body_lock_takedown",        "Body Lock Takedown");
    k("mat_return",                "Mat Return");
    k("wrestle_up",                "Wrestle Up");
    k("knee_shield_pass",          "Beating the Knee Shield");
    k("guard_retention",           "Guard Retention");
    k("side_control_escape",       "Side Control Escape");
    k("front_headlock_defence",    "Front Headlock Defence");
    k("hand_fighting",             "Hand Fighting & Ties");
    k("kimura_trap",               "Kimura Trap System");
    k("adcc_match_strategy",       "ADCC Match Strategy");
    // KB:START (generated by tools/build-kb.js)
    k("stance_motion", "Stance & Motion");
    k("collar_tie", "Collar Tie");
    k("russian_tie", "Russian Tie");
    k("underhooks_pummel", "Underhooks & Pummelling");
    k("whizzer", "Whizzer");
    k("high_crotch", "High Crotch");
    k("low_single", "Low Single");
    k("outside_single", "Outside Single");
    k("snatch_single", "Snatch Single");
    k("single_leg_finishes", "Single Leg Finishes");
    k("duck_under", "Duck Under");
    k("fireman_carry", "Fireman's Carry");
    k("lateral_drop", "Lateral Drop");
    k("knee_tap", "Knee Tap");
    k("slide_by", "Slide-By");
    k("shuck", "Shuck");
    k("single_leg_defence", "Single Leg Defence");
    k("spin_behind", "Spin Behind");
    k("guard_pull", "Guard Pull");
    k("referee_position", "Referee's Position");
    k("stand_up", "Stand-Up");
    k("sit_out", "Sit-Out & Turn-In");
    k("switch", "Switch");
    k("granby_roll", "Granby Roll");
    k("tight_waist", "Tight Waist & Chop");
    k("half_nelson", "Half Nelson");
    k("cradle", "Cradle");
    k("cross_face", "Cross-Face");
    k("spiral_ride", "Spiral Ride");
    k("leg_ride", "Leg Ride");
    k("tilt", "Tilt");
    k("gut_wrench", "Gut Wrench");
    k("leg_lace", "Leg Lace");
    k("peterson_roll", "Peterson Roll");
    k("chicken_wing", "Chicken Wing");
    k("de_ashi_harai", "De-Ashi-Harai");
    k("okuri_ashi_harai", "Okuri-Ashi-Harai");
    k("sasae_tsurikomi_ashi", "Sasae-Tsurikomi-Ashi");
    k("hiza_guruma", "Hiza-Guruma");
    k("o_guruma", "O-Guruma");
    k("ashi_guruma", "Ashi-Guruma");
    k("ko_soto_gake", "Ko-Soto-Gake");
    k("kibisu_gaeshi", "Kibisu-Gaeshi");
    k("ippon_seoi_nage", "Ippon-Seoi-Nage");
    k("seoi_otoshi", "Seoi-Otoshi");
    k("uki_otoshi", "Uki-Otoshi");
    k("sumi_otoshi", "Sumi-Otoshi");
    k("tani_otoshi", "Tani-Otoshi");
    k("kata_guruma", "Kata-Guruma");
    k("koshi_guruma", "Koshi-Guruma");
    k("uki_goshi", "Uki-Goshi");
    k("tsurikomi_goshi", "Tsurikomi-Goshi");
    k("sode_tsurikomi_goshi", "Sode-Tsurikomi-Goshi");
    k("utsuri_goshi", "Utsuri-Goshi");
    k("ushiro_goshi", "Ushiro-Goshi");
    k("ura_nage", "Ura-Nage");
    k("soto_makikomi", "Soto-Makikomi");
    k("hikikomi_gaeshi", "Hikikomi-Gaeshi");
    k("renraku_waza", "Renraku-Waza");
    k("kaeshi_waza", "Kaeshi-Waza");
    k("osaekomi_rules", "Osaekomi: How Judo Pins Score");
    k("kuzure_kesa_gatame", "Kuzure-Kesa-Gatame");
    k("yoko_shiho_gatame", "Yoko-Shiho-Gatame");
    k("kami_shiho_gatame", "Kami-Shiho-Gatame");
    k("kuzure_kami_shiho_gatame", "Kuzure-Kami-Shiho-Gatame");
    k("tate_shiho_gatame", "Tate-Shiho-Gatame");
    k("ushiro_kesa_gatame", "Ushiro-Kesa-Gatame");
    k("kesa_escape", "Scarf Hold Escape");
    k("judo_sankaku", "Sankaku Turnover");
    k("okuri_eri_jime", "Okuri-Eri-Jime");
    k("kata_ha_jime", "Kata-Ha-Jime");
    k("spider_guard", "Spider Guard");
    k("lasso_guard", "Lasso Guard");
    k("dlr_guard", "De La Riva Guard");
    k("rdlr_guard", "Reverse De La Riva");
    k("collar_sleeve", "Collar-Sleeve Guard");
    k("worm_guard", "Worm Guard");
    k("spider_sweep", "Spider Guard Sweep");
    k("lasso_sweep", "Lasso Sweep");
    k("dlr_sweep", "De La Riva Sweep");
    k("tripod_sweep", "Tripod Sweep");
    k("sickle_sweep", "Sickle Sweep");
    k("balloon_sweep", "Balloon Sweep");
    k("inverted_guard", "Inverted Guard");
    k("flower_sweep", "Flower Sweep");
    k("overhook_guard", "Overhook Guard");
    k("rubber_guard", "Rubber Guard");
    k("gogoplata", "Gogoplata");
    k("cross_collar_choke", "Cross Collar Choke");
    k("loop_choke", "Loop Choke");
    k("knee_shield", "Knee Shield Half Guard");
    k("deep_half", "Deep Half Guard");
    k("waiter_sweep", "Waiter Sweep");
    k("lockdown", "Lockdown");
    k("electric_chair", "Electric Chair");
    k("dogfight", "Dogfight");
    k("half_guard_top", "Half Guard Top");
    k("standing_guard_break", "Breaking the Closed Guard");
    k("headquarters", "Headquarters Position");
    k("long_step_pass", "Long Step Pass");
    k("x_pass", "X-Pass");
    k("leg_weave_pass", "Leg Weave Pass");
    k("backstep_pass", "Backstep");
    k("pressure_passing", "Pressure vs Speed Passing");
    k("side_to_mount", "Side Control to Mount");
    k("far_side_armbar", "Far-Side Armbar");
    k("von_flue_choke", "Von Flue Choke");
    k("paper_cutter_choke", "Paper Cutter Choke");
    k("baseball_bat_choke", "Baseball Bat Choke");
    k("twister_side", "Twister Side Control");
    k("knee_on_belly_escape", "Knee on Belly Escape");
    k("north_south_escape", "North-South Escape");
    k("s_mount", "S-Mount");
    k("technical_mount", "Technical Mount");
    k("mount_to_back", "Mount to Back Take");
    k("gift_wrap", "Gift Wrap");
    k("mounted_triangle", "Mounted Triangle");
    k("ezekiel_choke", "Ezekiel Choke");
    k("seatbelt", "Seatbelt Grip");
    k("short_choke", "Short Choke");
    k("rear_triangle", "Rear Triangle");
    k("high_elbow_guillotine", "High-Elbow Guillotine");
    k("arm_in_guillotine", "Arm-In Guillotine");
    k("peruvian_necktie", "Peruvian Necktie");
    k("japanese_necktie", "Japanese Necktie");
    k("back_take_turtle", "Back Take from Turtle");
    k("outside_ashi", "Outside Ashi-Garami");
    k("fifty_fifty", "50/50 Guard");
    k("butterfly_ashi", "Butterfly Ashi-Garami");
    k("false_reap", "False Reap");
    k("truck", "Truck");
    k("estima_lock", "Estima Lock");
    k("calf_slicer", "Calf Slicer");
    k("aoki_lock", "Aoki Lock");
    k("wrist_lock", "Wrist Lock");
    k("bicep_slicer", "Bicep Slicer");
    k("baratoplata", "Baratoplata");
    k("tarikoplata", "Tarikoplata");
    k("banana_split", "Banana Split");
    k("twister", "Twister");
    k("buggy_choke", "Buggy Choke");
    k("ude_gatame", "Ude-Gatame");
    k("armbar_escape", "Armbar Escape");
    k("triangle_escape", "Triangle Escape");
    k("guillotine_escape", "Guillotine Escape");
    k("kimura_defence", "Kimura Defence");
    k("ghost_escape", "Ghost Escape");
    k("framing", "Framing");
    k("fighting_stance", "MMA Fighting Stance");
    k("footwork_striking", "Footwork & Distance");
    k("head_movement", "Slips, Rolls & Head Movement");
    k("blocking_covering", "Blocking & Parrying");
    k("checking_kicks", "Checking Leg Kicks");
    k("counterstriking", "Counterstriking");
    k("jab", "Jab");
    k("cross", "Cross");
    k("hook_punch", "Hook");
    k("uppercut", "Uppercut");
    k("overhand", "Overhand");
    k("superman_punch", "Superman Punch");
    k("teep", "Teep");
    k("leg_kick", "Low Kick");
    k("calf_kick", "Calf Kick");
    k("body_kick", "Body Kick");
    k("head_kick", "Head Kick");
    k("spinning_back_kick", "Spinning Back Kick");
    k("upkick", "Upkick");
    k("straight_knee", "Knee Strike");
    k("flying_knee", "Flying Knee");
    k("horizontal_elbow", "Horizontal Elbow");
    k("downward_elbow", "Downward Elbow");
    k("spinning_back_elbow", "Spinning Back Elbow");
    k("thai_clinch", "Thai Clinch");
    k("dirty_boxing", "Dirty Boxing");
    k("cage_clinch", "Cage Clinch");
    k("cage_double_leg", "Double Leg Against the Cage");
    k("fence_defence", "Takedown Defence on the Fence");
    k("wall_walk", "Wall Walk");
    k("butterfly_wall", "Butterfly to Wall Stand-Up");
    k("mma_guard", "Guard in MMA");
    k("mma_top_control", "Top Control in MMA");
    k("ground_and_pound", "Ground and Pound");
    k("hammerfist", "Hammerfist");
    k("mma_back", "Back Control in MMA");
    k("mma_scramble", "Scrambles & Getting Up");
    k("mma_gameplan", "MMA Grappling Priorities");
    k("arm_drag_back", "Arm Drag to Back");
    k("technical_standup", "Technical Stand-Up");
    k("chair_sit_back_take", "Chair Sit Back Take");
    k("crab_ride", "Crab Ride");
    k("berimbolo", "Berimbolo");
    k("kiss_of_the_dragon", "Kiss of the Dragon");
    k("collar_drag", "Collar Drag");
    k("imanari_roll", "Imanari Roll");
    k("distance_management", "Distance Management");
    k("base_posture", "Base & Posture");
    k("inside_position", "Inside Position");
    k("breathing_relaxation", "Breathing & Relaxation");
    k("training_methods", "Training Methods");
    k("leglock_rules", "Leg Lock Rules by Ruleset");
    k("grip_breaks", "Grip Breaks");
    k("clock_choke", "Clock Choke");
    k("morote_gari", "Morote-Gari");
    k("kuchiki_taoshi", "Kuchiki-Taoshi");
    k("obi_otoshi", "Obi-Otoshi");
    k("sukui_nage", "Sukui-Nage");
    k("yama_arashi", "Yama-Arashi");
    k("tsuri_goshi", "Tsuri-Goshi");
    k("daki_age", "Daki-Age");
    k("harai_tsurikomi_ashi", "Harai-Tsurikomi-Ashi");
    k("o_soto_guruma", "O-Soto-Guruma");
    k("o_soto_otoshi", "O-Soto-Otoshi");
    k("o_soto_gaeshi", "O-Soto-Gaeshi");
    k("o_uchi_gaeshi", "O-Uchi-Gaeshi");
    k("ko_uchi_gaeshi", "Ko-Uchi-Gaeshi");
    k("tsubame_gaeshi", "Tsubame-Gaeshi");
    k("uchi_mata_gaeshi", "Uchi-Mata-Gaeshi");
    k("uchi_mata_sukashi", "Uchi-Mata-Sukashi");
    k("harai_goshi_gaeshi", "Harai-Goshi-Gaeshi");
    k("hane_goshi_gaeshi", "Hane-Goshi-Gaeshi");
    k("tawara_gaeshi", "Tawara-Gaeshi");
    k("daki_wakare", "Daki-Wakare");
    k("uki_waza", "Uki-Waza");
    k("yoko_otoshi", "Yoko-Otoshi");
    k("yoko_gake", "Yoko-Gake");
    k("yoko_guruma", "Yoko-Guruma");
    k("yoko_wakare", "Yoko-Wakare");
    k("o_soto_makikomi", "O-Soto-Makikomi");
    k("uchi_makikomi", "Uchi-Makikomi");
    k("harai_makikomi", "Harai-Makikomi");
    k("hane_makikomi", "Hane-Makikomi");
    k("uchi_mata_makikomi", "Uchi-Mata-Makikomi");
    k("ko_uchi_makikomi", "Ko-Uchi-Makikomi");
    k("kani_basami", "Kani-Basami");
    k("kawazu_gake", "Kawazu-Gake");
    k("kata_gatame_pin", "Kata-Gatame (Shoulder Hold)");
    k("uki_gatame", "Uki-Gatame");
    k("gyaku_juji_jime", "Gyaku-Juji-Jime");
    k("kata_juji_jime", "Kata-Juji-Jime");
    k("kata_te_jime", "Kata-Te-Jime");
    k("ryo_te_jime", "Ryo-Te-Jime");
    k("tsukkomi_jime", "Tsukkomi-Jime");
    k("do_jime", "Do-Jime");
    k("waki_gatame", "Waki-Gatame");
    k("hara_gatame", "Hara-Gatame");
    k("hiza_gatame", "Hiza-Gatame");
    k("ashi_gatame", "Ashi-Gatame");
    k("te_gatame", "Te-Gatame");
    k("sankaku_gatame", "Sankaku-Gatame");
    k("inside_trip", "Inside Trip");
    k("outside_trip", "Outside Trip");
    k("back_body_lock_trip", "Back Body Lock Takedowns");
    k("suplex", "Suplex");
    k("folding_pass", "Folding Pass");
    k("single_under_pass", "Single Under Pass");
    k("float_pass", "Float Pass");
    k("lumberjack_sweep", "Lumberjack Sweep");
    k("double_ankle_sweep", "Double Ankle Sweep");
    k("john_wayne_sweep", "John Wayne Sweep");
    k("omoplata_sweep", "Omoplata Sweep");
    k("knee_tap_sweep", "Knee Tap Sweep");
    k("squid_guard", "Squid Guard");
    k("backside_fifty", "Backside 50/50");
    k("schultz_front_headlock", "Schultz Front Headlock");
    k("mir_lock", "Mir Lock");
    k("bulldog_choke", "Bulldog Choke");
    k("can_opener", "Can Opener");
    k("suloev_stretch", "Suloev Stretch");
    k("flying_armbar", "Flying Armbar");
    k("flying_triangle", "Flying Triangle");
    k("muay_thai_stance", "Muay Thai Stance");
    k("wai_kru", "Wai Kru Ram Muay");
    k("muay_thai_scoring", "How Muay Thai Is Scored");
    k("long_guard", "Long Guard");
    k("switch_kick", "Switch Kick");
    k("diagonal_knee", "Diagonal Knee");
    k("uppercut_elbow", "Uppercut Elbow");
    k("chopping_elbow", "Chopping Elbow");
    k("clinch_fighting", "Clinch Fighting: Position, Knees and Turns");
    k("clinch_dump", "Clinch Dump");
    k("catch_and_sweep", "Catch and Sweep");
    k("counter_kick", "Check and Counter Kick");
    k("thai_pads", "Training on Thai Pads");
    k("muay_thai_conditioning", "Conditioning for Striking");
    k("lethwei_rules", "Lethwei: Rules and Nine Limbs");
    k("lethwei_ritual", "Lekkha Moun and Lethwei Yay");
    k("lethwei_stance", "Lethwei Stance & Guard");
    k("bare_knuckle_punching", "Bare-Knuckle Punching");
    k("headbutt", "Headbutt");
    k("clinch_headbutt", "Clinch Headbutt");
    k("headbutt_defence", "Headbutt Defence");
    k("lethwei_clinch", "Lethwei Clinch");
    k("lethwei_throws", "Throws and Sweeps in Lethwei");
    k("bare_knuckle_defence", "Defence Without Gloves");
    k("bando", "Bando and Banshay: Burmese Martial Roots");
    // KB:END

    return items;
  })();
  // Every technique name and its encyclopedia link, for the journal and home page
  window.chintheTechniques = IDX.filter(function (i) { return i.c === "T"; }).map(function (i) { return { name: i.t, url: i.u }; });
  document.dispatchEvent(new Event("chinthe:techniques"));

  // Search modal
  var searchOverlay = null;
  var searchInput   = null;
  var searchBody    = null;
  var activeIdx     = -1;

  function searchQuery(q) {
    if (!q) return [];
    var ql = q.toLowerCase();
    // Rank: title starts with query > a word starts with it > contains it.
    // Stable within a rank, so index order (Matrix, Principle, Technique) breaks ties.
    var wordStart = new RegExp("(^|[^a-z0-9])" + ql.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return IDX.map(function (item, i) {
      var t = item.t.toLowerCase();
      var pos = t.indexOf(ql);
      if (pos === -1) return null;
      return { item: item, i: i, rank: pos === 0 ? 0 : wordStart.test(t) ? 1 : 2 };
    }).filter(Boolean).sort(function (a, b) {
      return a.rank - b.rank || a.i - b.i;
    }).slice(0, 20).map(function (r) { return r.item; });
  }

  function renderResults(results) {
    if (!searchBody) return;
    if (results.length === 0) {
      searchBody.innerHTML = '<p class="search-empty">No results — try a technique name, position, or principle.</p>';
      activeIdx = -1;
      return;
    }
    searchBody.innerHTML = results.map(function (r, i) {
      return '<a class="search-result" href="' + r.u + '" data-idx="' + i + '">' +
        '<span class="sr-cat ' + r.cl + '">' + r.cat + '</span>' +
        '<span class="sr-title">' + r.t + '</span>' +
        '<span class="sr-arrow" aria-hidden="true">›</span>' +
        '</a>';
    }).join("");
    activeIdx = -1;
  }

  function setActive(idx, results) {
    var items = searchBody ? searchBody.querySelectorAll(".search-result") : [];
    items.forEach(function (el) { el.removeAttribute("data-active"); });
    if (idx >= 0 && idx < items.length) {
      items[idx].setAttribute("data-active", "true");
      items[idx].scrollIntoView({ block: "nearest" });
    }
    activeIdx = idx;
  }

  function openSearch() {
    if (searchOverlay) return;

    searchOverlay = document.createElement("div");
    searchOverlay.className = "search-overlay";
    searchOverlay.setAttribute("role", "dialog");
    searchOverlay.setAttribute("aria-label", "Search");
    searchOverlay.setAttribute("aria-modal", "true");

    var modal = document.createElement("div");
    modal.className = "search-modal";
    modal.innerHTML =
      '<div class="search-head">' +
        '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
          '<circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/>' +
          '<line x1="11" y1="11" x2="14.5" y2="14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '</svg>' +
        '<input class="search-input" type="search" placeholder="Search techniques, positions, principles…" autocomplete="off" spellcheck="false" aria-label="Search"/>' +
        '<button type="button" class="search-esc" aria-label="Close search">ESC</button>' +
      '</div>' +
      '<div class="search-body"></div>' +
      '<div class="search-foot">' +
        '<span><kbd>↑↓</kbd> navigate</span>' +
        '<span><kbd>↵</kbd> open</span>' +
        '<span><kbd>Ctrl K</kbd> toggle</span>' +
      '</div>';

    searchOverlay.appendChild(modal);
    document.body.appendChild(searchOverlay);
    searchInput = modal.querySelector(".search-input");
    searchBody  = modal.querySelector(".search-body");

    searchInput.focus();
    modal.querySelector(".search-esc").addEventListener("click", closeSearch);

    var currentResults = [];

    searchInput.addEventListener("input", function () {
      currentResults = searchQuery(searchInput.value.trim());
      renderResults(currentResults);
    });

    searchInput.addEventListener("keydown", function (e) {
      var count = currentResults.length;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive(Math.min(activeIdx + 1, count - 1), currentResults);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive(Math.max(activeIdx - 1, 0), currentResults);
      } else if (e.key === "Enter") {
        e.preventDefault();
        var items = searchBody.querySelectorAll(".search-result");
        var target = activeIdx >= 0 ? items[activeIdx] : items[0];
        if (target) { closeSearch(); goTo(target.getAttribute("href")); }
      }
    });

    searchBody.addEventListener("click", function (e) {
      var a = e.target.closest(".search-result");
      if (a) { closeSearch(); goTo(a.getAttribute("href")); e.preventDefault(); }
    });

    searchOverlay.addEventListener("click", function (e) {
      if (e.target === searchOverlay) closeSearch();
    });
  }

  function closeSearch() {
    if (!searchOverlay) return;
    searchOverlay.remove();
    searchOverlay = null;
    searchInput   = null;
    searchBody    = null;
    activeIdx     = -1;
  }

  // Same page + same hash fires no hashchange, so re-dispatch it by hand.
  function goTo(href) {
    var url = new URL(href, window.location.href);
    if (url.pathname === window.location.pathname && url.hash === window.location.hash) {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } else {
      window.location.href = url.href;
    }
  }

  document.addEventListener("keydown", function (e) {
    var typing = e.target.closest && e.target.closest("input, textarea, select, [contenteditable='true']");
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      if (searchOverlay) { closeSearch(); } else { openSearch(); }
    } else if (e.key === "/" && !typing && !searchOverlay) {
      e.preventDefault();
      openSearch();
    } else if (e.key === "Escape") {
      if (searchOverlay) { closeSearch(); }
    }
  });

  // ── Node counts (need IDX) ───────────────────────────
  var NODE_TOTAL = IDX.filter(function (item) { return item.c === "M"; }).length;
  document.querySelectorAll("[data-node-count]").forEach(function (el) {
    el.textContent = el.getAttribute("data-node-count").replace("{n}", NODE_TOTAL);
  });

})();
