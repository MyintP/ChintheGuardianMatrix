/*
  CHINTHE — shared page behaviour
  1. Mobile nav: injects a hamburger toggle into .site-nav and wires the dropdown.
  2. Service worker registration (single place, every page).
*/
(function () {
  var nav = document.querySelector(".site-nav");
  var inner = nav && nav.querySelector(".site-nav-inner");
  var links = nav && nav.querySelector(".site-nav-links");

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
      e.stopPropagation();
      setOpen(!nav.classList.contains("menu-open"));
    });
    links.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });
    document.addEventListener("click", function (e) {
      if (nav.classList.contains("menu-open") && !nav.contains(e.target)) setOpen(false);
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 900) setOpen(false);
    });
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(function () {});
  }
})();
