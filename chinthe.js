/*
  CHINTHE — shared page behaviour
  1. Mobile nav: injects a hamburger toggle into .site-nav.
  2. Service worker registration.
  3. C.4 Page transitions (fade-in + View Transitions API).
  4. C.1 Breadcrumbs (all non-home pages).
  5. C.2 Learn-Next nudge (reads chinthe_mastery_v1 from localStorage).
  6. C.3 Global search modal (Ctrl+K).
*/
(function () {
  // ── 1. Mobile Nav ────────────────────────────────────────────
  var nav    = document.querySelector(".site-nav");
  var inner  = nav && nav.querySelector(".site-nav-inner");
  var links  = nav && nav.querySelector(".site-nav-links");

  if (nav && inner && links) {
    if (!links.id) links.id = "siteNavLinks";
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
    window.addEventListener("resize", function () { if (window.innerWidth >= 900) setOpen(false); });
  }

  // ── 2. Service Worker ─────────────────────────────────────────
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(function () {});
  }

  // ── C.4 Page Transitions ──────────────────────────────────────
  document.documentElement.classList.add("page-ready");

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!prefersReducedMotion && document.startViewTransition) {
    document.addEventListener("click", function (e) {
      var a = e.target.closest("a[href]");
      if (!a) return;
      var href = a.getAttribute("href");
      if (!href || href.charAt(0) === "#" || href.indexOf("http") === 0 || href.indexOf("mailto") === 0) return;
      if (a.target === "_blank" || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      document.startViewTransition(function () { window.location.href = href; });
    });
  }

  // ── C.1 Breadcrumbs ───────────────────────────────────────────
  var CRUMB_MAP = {
    "chinthe-guardian-matrix.html": "Guardian Matrix",
    "knowledge.html":               "Knowledge Base",
    "principles.html":              "Principles",
    "journal.html":                 "Training Journal",
    "competition.html":             "Compete"
  };

  (function () {
    var pageName = window.location.pathname.split("/").pop() || "index.html";
    var label = CRUMB_MAP[pageName];
    if (!label || !nav) return;
    var bc = document.createElement("nav");
    bc.className = "breadcrumb";
    bc.setAttribute("aria-label", "Breadcrumb");
    bc.innerHTML =
      '<a href="index.html">Home</a>' +
      '<span class="bc-sep" aria-hidden="true">›</span>' +
      '<span class="bc-current">' + label + '</span>';
    nav.insertAdjacentElement("afterend", bc);
  })();

  // ── C.2 Learn-Next Nudge ─────────────────────────────────────
  (function () {
    var pageName = window.location.pathname.split("/").pop() || "index.html";
    if (pageName === "index.html" || pageName === "chinthe-guardian-matrix.html") return;
    if (sessionStorage.getItem("ch_lnn_dismissed")) return;

    var mastery;
    try { mastery = JSON.parse(localStorage.getItem("chinthe_mastery_v1")) || {}; } catch (e) { mastery = {}; }
    var mapped = Object.keys(mastery).filter(function (k) { return mastery[k] > 0; }).length;
    var total  = 102;

    var nudge = document.createElement("div");
    nudge.className = "learn-next-nudge";
    nudge.setAttribute("role", "complementary");
    nudge.setAttribute("aria-label", "Matrix progress");

    var statHtml = mapped > 0
      ? '<span class="lnn-stat"><strong>' + mapped + '</strong> / ' + total + ' nodes mapped</span>'
      : '<span class="lnn-stat">Track your progress</span>';

    nudge.innerHTML =
      statHtml +
      '<a class="lnn-cta" href="chinthe-guardian-matrix.html">' + (mapped > 0 ? 'Continue →' : 'Open Matrix →') + '</a>' +
      '<button class="lnn-close" aria-label="Dismiss">✕</button>';

    nudge.querySelector(".lnn-close").addEventListener("click", function () {
      sessionStorage.setItem("ch_lnn_dismissed", "1");
      nudge.remove();
    });

    document.body.appendChild(nudge);
  })();

  // ── C.3 Global Search (Ctrl+K) ───────────────────────────────
  var IDX = (function () {
    var items = [];
    function m(id, title) { items.push({ c: "M", cl: "c-M", cat: "Matrix",    t: title, u: "chinthe-guardian-matrix.html" }); }
    function p(id, title) { items.push({ c: "P", cl: "c-P", cat: "Principle", t: title, u: "principles.html" }); }
    function k(id, title) { items.push({ c: "T", cl: "c-T", cat: "Technique", t: title, u: "knowledge.html" }); }

    // Matrix nodes
    m("hub",                    "Guardian Matrix");
    m("start",                  "Neutral / Standing");
    m("td_wrestling",           "Wrestling Shot");
    m("td_judo",                "Judo Throw Entry");
    m("guard_pull",             "Guard Pull");
    m("td_clean",               "Clean Takedown");
    m("td_standard",            "Standard Takedown");
    m("td_stuffed",             "Shot Stuffed → Front Headlock");
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
    p("pos_hier",   "Positional Hierarchy");
    p("chess",      "Chess Principles Applied to Grappling");
    p("grips",      "Grip Taxonomy");
    p("distance",   "Fighting Distances");

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

    return items;
  })();

  // Search modal
  var searchOverlay = null;
  var searchInput   = null;
  var searchBody    = null;
  var activeIdx     = -1;

  function searchQuery(q) {
    if (!q) return [];
    var ql = q.toLowerCase();
    return IDX.filter(function (item) {
      return item.t.toLowerCase().indexOf(ql) !== -1;
    }).slice(0, 10);
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
        '<span class="search-esc" aria-hidden="true">ESC</span>' +
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
        if (target) { closeSearch(); window.location.href = target.getAttribute("href"); }
      }
    });

    searchBody.addEventListener("click", function (e) {
      var a = e.target.closest(".search-result");
      if (a) { closeSearch(); window.location.href = a.getAttribute("href"); e.preventDefault(); }
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

  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      if (searchOverlay) { closeSearch(); } else { openSearch(); }
    } else if (e.key === "Escape") {
      if (searchOverlay) { closeSearch(); }
    }
  });

})();
