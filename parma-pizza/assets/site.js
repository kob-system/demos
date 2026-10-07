/* Menu tabs, open/closed badge, today's hours. */
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
})();
