// Bella Mae's demo: live open/closed, today's special, menu tabs. No tracking, nothing sent anywhere.
(function () {
  // Hours in Rensselaer time. [open, close] in minutes after midnight. Confirm with owner.
  var HOURS = {0: [900, 1080], 1: [660, 1140], 2: [660, 1140], 3: [660, 1140], 4: [660, 1140], 5: [660, 1200], 6: [660, 1200]};
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  function nyNow() {
    var parts = new Intl.DateTimeFormat("en-US", {timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hour12: false}).formatToParts(new Date());
    var o = {};
    parts.forEach(function (p) { o[p.type] = p.value; });
    var day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(o.weekday);
    return {day: day, min: (parseInt(o.hour, 10) % 24) * 60 + parseInt(o.minute, 10)};
  }
  function fmt(m) {
    var h = Math.floor(m / 60), mm = m % 60, ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return h + (mm ? ":" + (mm < 10 ? "0" : "") + mm : "") + " " + ap;
  }

  var now = nyNow();
  var el = document.getElementById("status");
  if (el) {
    var t = HOURS[now.day], txt;
    if (now.min >= t[0] && now.min < t[1]) {
      el.classList.add("open");
      txt = "Open now until " + fmt(t[1]);
    } else {
      el.classList.add("closed");
      if (now.min < t[0]) {
        txt = "Closed now. Opens today at " + fmt(t[0]);
      } else {
        var nd = (now.day + 1) % 7;
        txt = "Closed now. Opens " + DAYS[nd] + " at " + fmt(HOURS[nd][0]);
      }
    }
    el.querySelector(".status-text").textContent = txt;
  }

  document.querySelectorAll('[data-day="' + now.day + '"]').forEach(function (n) { n.classList.add("today"); });

  // Menu tabs
  var chips = document.querySelectorAll(".chip");
  chips.forEach(function (c) {
    c.addEventListener("click", function () {
      chips.forEach(function (x) { x.setAttribute("aria-selected", x === c ? "true" : "false"); });
      document.querySelectorAll(".msec").forEach(function (s) {
        if (s.id === "m-" + c.dataset.key) s.removeAttribute("data-collapsed"); else s.setAttribute("data-collapsed", "");
      });
    });
    c.addEventListener("keydown", function (e) {
      var list = Array.prototype.slice.call(chips), i = list.indexOf(c);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        var n = list[(i + (e.key === "ArrowRight" ? 1 : list.length - 1)) % list.length];
        n.focus(); n.click(); e.preventDefault();
      }
    });
  });

  var yr = document.getElementById("yr");
  if (yr) yr.textContent = new Date().getFullYear();
})();
