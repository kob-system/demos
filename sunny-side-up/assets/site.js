// Hours live here once. Status chip, hours table and today highlight all read from it.
// ASK OWNER: real hours. Times are 24h "HH:MM" in America/New_York. null = closed.
var HOURS = {
  0: ["07:00", "13:00"], // Sunday
  1: ["06:30", "14:00"],
  2: ["06:30", "14:00"],
  3: ["06:30", "14:00"],
  4: ["06:30", "14:00"],
  5: ["06:30", "14:00"],
  6: ["07:00", "13:00"]  // Saturday
};
var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function fmt(t) {
  var p = t.split(":"), h = +p[0], m = p[1];
  var ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return h + (m === "00" ? "" : ":" + m) + " " + ap;
}
function mins(t) { var p = t.split(":"); return +p[0] * 60 + +p[1]; }

function nowNY() {
  var s = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  return new Date(s);
}

function renderStatus() {
  var el = document.getElementById("status"), txt = document.getElementById("status-text");
  if (!el) return;
  var n = nowNY(), d = n.getDay(), cur = n.getHours() * 60 + n.getMinutes(), h = HOURS[d];
  if (h && cur >= mins(h[0]) && cur < mins(h[1])) {
    el.className = "status open";
    txt.textContent = "Open now · until " + fmt(h[1]);
    return;
  }
  el.className = "status closed";
  if (h && cur < mins(h[0])) { txt.textContent = "Closed · opens today at " + fmt(h[0]); return; }
  for (var i = 1; i <= 7; i++) {
    var nd = (d + i) % 7;
    if (HOURS[nd]) {
      txt.textContent = "Closed · opens " + (i === 1 ? "tomorrow" : DAYS[nd]) + " at " + fmt(HOURS[nd][0]);
      return;
    }
  }
  txt.textContent = "Closed";
}

function renderHours() {
  var body = document.querySelector("#hours tbody");
  if (!body) return;
  var today = nowNY().getDay(), order = [1, 2, 3, 4, 5, 6, 0], html = "";
  order.forEach(function (d) {
    var h = HOURS[d];
    html += '<tr' + (d === today ? ' class="today"' : "") + '><th scope="row">' + DAYS[d] + (d === today ? " (today)" : "") +
      "</th><td>" + (h ? fmt(h[0]) + " to " + fmt(h[1]) : "Closed") + "</td></tr>";
  });
  body.innerHTML = html;
}

function tabs() {
  var list = document.querySelector("[role=tablist]");
  if (!list) return;
  var btns = [].slice.call(list.querySelectorAll("[role=tab]"));
  function select(b) {
    btns.forEach(function (x) {
      var on = x === b;
      x.setAttribute("aria-selected", on);
      x.tabIndex = on ? 0 : -1;
      document.getElementById(x.getAttribute("aria-controls")).hidden = !on;
    });
  }
  btns.forEach(function (b, i) {
    b.addEventListener("click", function () { select(b); });
    b.addEventListener("keydown", function (e) {
      var j = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
      if (j === null) return;
      var nb = btns[(j + btns.length) % btns.length];
      select(nb); nb.focus(); e.preventDefault();
    });
  });
}

renderStatus(); renderHours(); tabs();
setInterval(renderStatus, 60000);
