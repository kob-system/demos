(function () {
  "use strict";
  var CFG = window.__CFG || {};
  var ROOT = document.body.getAttribute("data-root") || "./";

  /* ---------- language ---------- */
  var html = document.documentElement;
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function applyLang(lang) {
    html.setAttribute("lang", lang);
    html.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    var nodes = document.querySelectorAll("[data-ar]");
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.getAttribute("data-en") === null) n.setAttribute("data-en", n.textContent);
      n.textContent = lang === "ar" ? n.getAttribute("data-ar") : n.getAttribute("data-en");
    }
    var ph = document.querySelectorAll("[data-ar-ph]");
    for (var j = 0; j < ph.length; j++) {
      if (ph[j].getAttribute("data-en-ph") === null) ph[j].setAttribute("data-en-ph", ph[j].getAttribute("placeholder") || "");
      ph[j].setAttribute("placeholder", lang === "ar" ? ph[j].getAttribute("data-ar-ph") : ph[j].getAttribute("data-en-ph"));
    }
    var btn = document.getElementById("lang");
    if (btn) { btn.textContent = lang === "ar" ? "English" : "عربي"; btn.setAttribute("lang", lang === "ar" ? "en" : "ar"); }
    store("aq-lang", lang);
    document.dispatchEvent(new CustomEvent("aq-lang", { detail: lang }));
  }
  var lb = document.getElementById("lang");
  if (lb) lb.addEventListener("click", function () { applyLang(html.getAttribute("lang") === "ar" ? "en" : "ar"); });
  if (/[?&]lang=ar/.test(location.search) || store("aq-lang") === "ar") applyLang("ar");

  /* ---------- open / closed ---------- */
  function nyNow() {
    var f = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hour12: false });
    var parts = {}; f.formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
    var h = parseInt(parts.hour, 10) % 24;
    return { day: parts.weekday, mins: h * 60 + parseInt(parts.minute, 10) };
  }
  function toMin(s) { var a = s.split(":"); return parseInt(a[0], 10) * 60 + parseInt(a[1], 10); }
  var st = document.getElementById("status");
  if (st && CFG.hours) {
    var now = nyNow(), open = false, today = null;
    CFG.hours.forEach(function (h) { if (h[1] === now.day) { today = h; open = now.mins >= toMin(h[2]) && now.mins < toMin(h[3]); } });
    var row = document.querySelector('tr[data-day="' + now.day + '"]');
    if (row) row.classList.add("today");
    st.className = "status " + (open ? "open" : "closed");
    var ar = html.getAttribute("lang") === "ar";
    st.setAttribute("data-en", open ? "Open now" : "Closed now");
    st.setAttribute("data-ar", open ? "مفتوح الآن" : "مغلق الآن");
    st.textContent = ar ? st.getAttribute("data-ar") : st.getAttribute("data-en");
  }

  /* ---------- mashawi pickup list ---------- */
  var listEl = document.getElementById("plist");
  if (listEl) {
    var qty = {};
    var items = {};
    document.querySelectorAll(".item[data-id]").forEach(function (el) {
      items[el.getAttribute("data-id")] = { name: el.getAttribute("data-name"), unit: el.getAttribute("data-unit") };
      var out = el.querySelector("output");
      el.querySelectorAll("button[data-d]").forEach(function (b) {
        b.addEventListener("click", function () {
          var id = el.getAttribute("data-id");
          var q = Math.max(0, Math.min(50, (qty[id] || 0) + parseInt(b.getAttribute("data-d"), 10)));
          qty[id] = q; out.textContent = q; render();
        });
      });
    });
    var ul = document.getElementById("plist-ul"), note = document.getElementById("pnote");
    var wa = document.getElementById("wa"), copyBtn = document.getElementById("copy"), msgOut = document.getElementById("copied");
    function text() {
      var lines = [], any = false;
      Object.keys(qty).forEach(function (id) { if (qty[id] > 0) { any = true; lines.push("- " + qty[id] + " " + items[id].unit + " " + items[id].name); } });
      if (!any) return "";
      return "Hi Al-Aqsa, pickup request:\n" + lines.join("\n") + (note.value ? "\nNote: " + note.value : "") + "\nThank you.";
    }
    function render() {
      ul.innerHTML = "";
      var any = false;
      Object.keys(qty).forEach(function (id) {
        if (qty[id] > 0) {
          any = true;
          var li = document.createElement("li");
          var a = document.createElement("span"); a.textContent = items[id].name;
          var b = document.createElement("span"); b.textContent = qty[id] + " " + items[id].unit;
          li.appendChild(a); li.appendChild(b); ul.appendChild(li);
        }
      });
      if (!any) { var e = document.createElement("li"); e.className = "empty"; e.textContent = html.getAttribute("lang") === "ar" ? "لم تختر شيئاً بعد." : "Nothing picked yet."; ul.appendChild(e); }
      if (wa) wa.href = "https://wa.me/" + CFG.whatsapp + "?text=" + encodeURIComponent(text());
      if (wa) wa.setAttribute("aria-disabled", any ? "false" : "true");
      copyBtn.disabled = !any;
    }
    note.addEventListener("input", render);
    copyBtn.addEventListener("click", function () {
      var t = text(); if (!t) return;
      function done() { msgOut.textContent = html.getAttribute("lang") === "ar" ? "تم النسخ. الصقها في رسالة أو اتصل بنا." : "Copied. Paste it in a message, or call us."; }
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).then(done, function () { note.value = t; note.select(); }); }
      else { note.value = t; note.select(); }
    });
    document.addEventListener("aq-lang", render);
    render();
  }

  /* ---------- grocery browse ---------- */
  var grid = document.getElementById("pgrid");
  if (grid) {
    var data = null, aisle = "all", q = "", shown = 60, PAGE = 60;
    var countEl = document.getElementById("count"), moreBtn = document.getElementById("more"), aisleBar = document.getElementById("aislebar"), input = document.getElementById("q");
    function norm(s) { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
    function filtered() {
      var nq = norm(q.trim());
      return data.items.filter(function (r) {
        if (aisle !== "all" && data.aisles[r[1]][0] !== aisle) return false;
        if (nq && r[5].indexOf(nq) === -1) return false;
        return true;
      });
    }
    function draw() {
      var list = filtered();
      var ar = html.getAttribute("lang") === "ar";
      countEl.textContent = ar ? list.length.toLocaleString("en-US") + " منتج" : list.length.toLocaleString("en-US") + " items";
      grid.innerHTML = "";
      var frag = document.createDocumentFragment();
      list.slice(0, shown).forEach(function (r) {
        var d = document.createElement("div"); d.className = "p";
        var im = document.createElement("img"); im.loading = "lazy"; im.width = 168; im.height = 168; im.alt = r[0]; im.src = ROOT + "images/" + r[3] + ".jpg";
        var b = document.createElement("b"); b.textContent = r[0];
        var s = document.createElement("small"); s.textContent = r[2] || "";
        if (r[4]) { var e = document.createElement("span"); e.className = "ebt"; e.textContent = "EBT"; s.appendChild(e); }
        d.appendChild(im); d.appendChild(b); d.appendChild(s); frag.appendChild(d);
      });
      grid.appendChild(frag);
      moreBtn.hidden = list.length <= shown;
    }
    function buildBar() {
      aisleBar.innerHTML = "";
      var ar = html.getAttribute("lang") === "ar";
      var all = document.createElement("button"); all.type = "button"; all.setAttribute("aria-pressed", aisle === "all"); all.textContent = ar ? "الكل" : "All aisles";
      all.addEventListener("click", function () { aisle = "all"; shown = PAGE; buildBar(); draw(); });
      aisleBar.appendChild(all);
      data.aisles.forEach(function (a) {
        if (!a[3]) return;
        var b = document.createElement("button"); b.type = "button"; b.setAttribute("aria-pressed", aisle === a[0]);
        b.textContent = (ar ? a[2] : a[1]) + " (" + a[3] + ")";
        b.addEventListener("click", function () { aisle = a[0]; shown = PAGE; buildBar(); draw(); });
        aisleBar.appendChild(b);
      });
    }
    input.addEventListener("input", function () { q = input.value; shown = PAGE; draw(); });
    moreBtn.addEventListener("click", function () { shown += PAGE; draw(); });
    document.addEventListener("aq-lang", function () { if (data) { buildBar(); draw(); } });
    fetch(ROOT + "data/grocery.json").then(function (r) { return r.json(); }).then(function (j) {
      j.items.forEach(function (r) { r.push(norm(r[0] + " " + (r[2] || ""))); });
      data = j;
      var qs = new URLSearchParams(location.search).get("q");
      if (qs) { q = qs; input.value = qs; }
      buildBar(); draw();
    }).catch(function () { countEl.textContent = "The item list could not load. Please call the store."; });
  }
})();
