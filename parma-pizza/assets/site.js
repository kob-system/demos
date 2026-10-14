/* Menu tabs, open/closed badge, today's hours, footage play/pause, story reveal. */
(function () {
  "use strict";
  var tabs = [].slice.call(document.querySelectorAll('[role="tab"]'));
  var panels = [].slice.call(document.querySelectorAll("[data-panel]"));
  function pick(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
    });
    if (focus) tab.focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { pick(t); });
    t.addEventListener("keydown", function (e) {
      var n = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (n) { e.preventDefault(); pick(tabs[(i + n + tabs.length) % tabs.length], true); }
    });
  });
  if (tabs.length) pick(tabs[0]);
  function fromHash() {
    var h = location.hash.replace("#", "");
    var t = document.getElementById("t-" + h);
    if (t) { pick(t); document.getElementById("menu").scrollIntoView(); }
  }
  window.addEventListener("hashchange", fromHash); fromHash();

  // Open / closed, in shop time (America/New_York). Mon=0 ... Sun=6, minutes from midnight.
  var H = [[600, 1230], [600, 1230], [600, 1230], [600, 1230], [600, 1260], [600, 1260], [720, 1200]];
  var DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  function nyNow() {
    var p = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date());
    var o = {}; p.forEach(function (x) { o[x.type] = x.value; });
    return { d: DAYS.indexOf(o.weekday), m: (parseInt(o.hour, 10) % 24) * 60 + parseInt(o.minute, 10) };
  }
  function fmt(m) { var h = Math.floor(m / 60), mm = m % 60, ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return h + (mm ? ":" + (mm < 10 ? "0" : "") + mm : "") + " " + ap; }
  try {
    var n = nyNow(), today = H[n.d], badge = document.getElementById("openStatus");
    var row = document.querySelector('.hours tr[data-day="' + n.d + '"]'); if (row) row.className = "today";
    if (badge && n.d >= 0) {
      var open = n.m >= today[0] && n.m < today[1], txt;
      if (open) txt = "Open now · until " + fmt(today[1]);
      else if (n.m < today[0]) txt = "Closed · opens " + fmt(today[0]) + " today";
      else txt = "Closed · opens " + fmt(H[(n.d + 1) % 7][0]) + " tomorrow";
      badge.className = "status " + (open ? "open" : "closed");
      badge.querySelector("span").textContent = txt;
    }
  } catch (e) { /* badge keeps the address text */ }

  // Footage: plays only on screen, never when the visitor asked for reduced motion, always has Pause (WCAG 2.2.2).
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  [].slice.call(document.querySelectorAll("video[data-auto]")).forEach(function (v) {
    var b = v.parentNode.querySelector(".vbtn"), paused = still;
    function set() { if (b) { b.textContent = paused ? "Play" : "Pause"; b.setAttribute("aria-pressed", paused ? "true" : "false"); b.setAttribute("aria-label", (paused ? "Play" : "Pause") + " video"); } }
    if (b) b.addEventListener("click", function () { paused = !paused; paused ? v.pause() : v.play(); set(); });
    set();
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && !paused) v.play().catch(function () {}); else v.pause(); }); }, { threshold: .25 }).observe(v);
    } else if (!paused) v.play().catch(function () {});
  });
  // Story chapters slide in once.
  var ch = [].slice.call(document.querySelectorAll(".chapter"));
  if (ch.length && "IntersectionObserver" in window && !still) {
    document.documentElement.className += " js";
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }); }, { threshold: .15 });
    ch.forEach(function (c) { io.observe(c); });
  }

  // Walk-in: scroll scrubs the door-open video frames. Reduced motion keeps the still photo.
  var wk = document.querySelector(".walkin");
  if (wk && !still) {
    var n = +wk.getAttribute("data-frames"), base = wk.getAttribute("data-path"), cv = wk.querySelector("canvas"), cx = cv.getContext("2d");
    var imgs = [], cur = -1, started = false, txt = wk.querySelector(".walkin-text");
    function src(i) { return base + ("00" + (i + 1)).slice(-3) + ".webp"; }
    function draw() {
      var r = wk.getBoundingClientRect(), span = wk.offsetHeight - window.innerHeight;
      var p = Math.min(1, Math.max(0, -r.top / span)), i = Math.min(n - 1, Math.floor(p * n));
      txt.style.opacity = p > .82 || p < .04 ? 1 : 0;
      while (i > 0 && !(imgs[i] && imgs[i].naturalWidth)) i--;
      var im = imgs[i]; if (!im || !im.naturalWidth || i === cur) return; cur = i;
      var s = Math.max(cv.width / im.naturalWidth, cv.height / im.naturalHeight), w = im.naturalWidth * s, h = im.naturalHeight * s;
      cx.drawImage(im, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
      if (!/ready/.test(wk.className)) wk.className += " ready";
    }
    function size() { var r = Math.min(window.devicePixelRatio || 1, 2); cv.width = cv.clientWidth * r; cv.height = cv.clientHeight * r; cur = -1; draw(); }
    function load() {
      if (started) return; started = true;
      for (var i = 0; i < n; i++) { var im = new Image(); im.decoding = "async"; im.onload = draw; im.src = src(i); imgs[i] = im; }
    }
    new IntersectionObserver(function (es) { if (es[0].isIntersecting) load(); }, { rootMargin: "100% 0px" }).observe(wk);
    window.addEventListener("scroll", function () { requestAnimationFrame(draw); }, { passive: true });
    window.addEventListener("resize", size); size();
  }
})();
