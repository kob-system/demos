// Bella Mae's demo v2: live open/closed, tonight's special, menu jump chips. No tracking, nothing sent anywhere.
(function () {
  // Hours in Rensselaer time (Google listing). [open, close] in minutes after midnight. Confirm with owner.
  var HOURS = {0: [900, 1080], 1: [660, 1140], 2: [660, 1140], 3: [660, 1140], 4: [660, 1140], 5: [660, 1200], 6: [660, 1200]};
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var SPECIALS = {
    1: ["Chicken Marsala", "With pasta and bread.", "$13"],
    2: ["Chicken Parmesan", "With pasta and bread.", "$13"],
    3: ["Lasagna", "With bread.", "$13"],
    4: ["Stuffed Peppers", "With beans, rice and cabbage.", "$12"],
    5: ["Linguine and Clams", "Red or white, with bread.", "$14"]
  };

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
  function setText(id, t) { var n = document.getElementById(id); if (n) n.textContent = t; }

  var now = nyNow();

  // Open / closed
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
        txt = "Closed now. Opens " + "tomorrow" + " at " + fmt(HOURS[nd][0]);
      }
    }
    el.querySelector(".status-text").textContent = txt;
  }

  // Tonight's special: today if a weekday, else Monday's
  var sp = SPECIALS[now.day];
  if (sp) {
    setText("tn-h", "Tonight's dinner special");
    setText("tn-dish", sp[0]);
    setText("tn-with", DAYS[now.day] + ". " + sp[1]);
    setText("tn-price", sp[2]);
  } else {
    setText("tn-h", "Weeknight dinner specials");
    setText("tn-dish", SPECIALS[1][0]);
    setText("tn-with", "Specials run Monday to Friday. Monday starts with this one.");
    setText("tn-price", SPECIALS[1][2]);
  }

  document.querySelectorAll('[data-day="' + now.day + '"]').forEach(function (n) { n.classList.add("today"); });

  // Menu chips: highlight the section in view, keep the active chip visible
  var chips = Array.prototype.slice.call(document.querySelectorAll(".chip"));
  function activate(key) {
    chips.forEach(function (c) {
      if (c.dataset.key === key) {
        c.setAttribute("aria-current", "true");
        var row = c.parentNode, l = c.offsetLeft - row.offsetLeft;
        if (l < row.scrollLeft || l + c.offsetWidth > row.scrollLeft + row.clientWidth) row.scrollTo({left: l - 16, behavior: "smooth"});
      } else c.removeAttribute("aria-current");
    });
  }
  if ("IntersectionObserver" in window && chips.length) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) activate(e.target.id.slice(2)); });
    }, {rootMargin: "-140px 0px -60% 0px"});
    document.querySelectorAll(".msec").forEach(function (s) { io.observe(s); });
  }
  chips.forEach(function (c) { c.addEventListener("click", function () { activate(c.dataset.key); }); });

  var yr = document.getElementById("yr");
  if (yr) yr.textContent = new Date().getFullYear();
})();
