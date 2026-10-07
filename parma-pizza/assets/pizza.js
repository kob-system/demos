/* Parma Pizza - the live pie.
   Builds the pizza in front of you (dough, sauce, cheese, toppings, bake),
   then it turns slowly, steams, and a slice pulls out with the cheese stretching.
   Chips under it add or take off toppings live.
   One Pause button stops every bit of motion (WCAG 2.2.2). Reduced-motion users
   get the finished pie, still. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var svg = document.getElementById("pie");
  if (!svg) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var art = document.getElementById("pieArt");
  var sliceG = document.getElementById("pieSlice");
  var spinG = document.getElementById("pieSpin");
  var strings = document.getElementById("pieStrings");
  var btn = document.getElementById("motionBtn");
  var canvas = document.getElementById("embers");

  /* ---------- helpers ---------- */
  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  var seed = 1525; // the address, why not
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  function anim(node, frames, opts) {
    if (reduce || !node.animate) {
      var last = frames[frames.length - 1];
      for (var k in last) if (k !== "offset" && k !== "easing") node.style[k] = last[k];
      return null;
    }
    opts.fill = "both";
    return node.animate(frames, opts);
  }
  var BOUNCE = "cubic-bezier(.34,1.56,.64,1)";
  var OUT = "cubic-bezier(.16,1,.3,1)";

  /* ---------- the layers ---------- */
  var gCrust = el("g", { class: "pop" }, art);
  el("circle", { r: 186, fill: "url(#gDough)" }, gCrust);
  var baked = el("circle", { r: 186, fill: "url(#gCrust)", opacity: 0 }, gCrust);
  var chars = el("g", { opacity: 0 }, gCrust);
  for (var i = 0; i < 26; i++) {
    var a = rnd() * Math.PI * 2, r = 170 + rnd() * 10;
    el("ellipse", { cx: (Math.cos(a) * r).toFixed(1), cy: (Math.sin(a) * r).toFixed(1),
      rx: (3 + rnd() * 6).toFixed(1), ry: (2 + rnd() * 3).toFixed(1),
      transform: "rotate(" + (a * 57.3).toFixed(0) + " " + (Math.cos(a) * r).toFixed(1) + " " + (Math.sin(a) * r).toFixed(1) + ")",
      fill: "#5a2c12", opacity: (0.35 + rnd() * 0.4).toFixed(2) }, chars);
  }
  el("circle", { r: 161, fill: "#e9c98f" }, art); // the bed under the sauce

  // sauce: a ladle spiral, then a full coat so there are no gaps
  var gSauce = el("g", {}, art);
  var d = "", turns = 4.6, steps = 260;
  for (var s = 0; s <= steps; s++) {
    var t = s / steps, ang = t * turns * Math.PI * 2, rr = 6 + t * 132;
    d += (s ? "L" : "M") + (Math.cos(ang) * rr).toFixed(1) + " " + (Math.sin(ang) * rr).toFixed(1);
  }
  var spiral = el("path", { d: d, fill: "none", stroke: "#b8321f", "stroke-width": 36,
    "stroke-linecap": "round", "stroke-linejoin": "round" }, gSauce);
  var coat = el("circle", { r: 156, fill: "url(#gSauce)", opacity: 0 }, gSauce);

  // cheese: one melty sheet + blobs, gooey edge from the filter
  var gCheese = el("g", { filter: "url(#goo)", opacity: 0 }, art);
  el("circle", { r: 146, fill: "#f4cf68" }, gCheese);
  var blobs = [];
  for (var b = 0; b < 30; b++) {
    var ba = rnd() * Math.PI * 2, br = rnd() * 132;
    blobs.push(el("circle", { cx: (Math.cos(ba) * br).toFixed(1), cy: (Math.sin(ba) * br).toFixed(1),
      r: (12 + rnd() * 16).toFixed(1), fill: rnd() > 0.5 ? "#fbe39a" : "#f7d97e", class: "pop" }, gCheese));
  }
  var browned = el("g", { opacity: 0 }, art);
  for (var c = 0; c < 22; c++) {
    var ca = rnd() * Math.PI * 2, cr = rnd() * 138;
    el("circle", { cx: (Math.cos(ca) * cr).toFixed(1), cy: (Math.sin(ca) * cr).toFixed(1),
      r: (2 + rnd() * 5).toFixed(1), fill: "#c98a2e", opacity: (0.4 + rnd() * 0.4).toFixed(2) }, browned);
  }
  var gTop = el("g", {}, art);

  /* ---------- toppings ---------- */
  var placed = [];
  function spot(minGap, maxR) {
    for (var tries = 0; tries < 400; tries++) {
      var a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * maxR;
      var x = Math.cos(a) * r, y = Math.sin(a) * r, ok = true;
      for (var p = 0; p < placed.length; p++) {
        var dx = placed[p][0] - x, dy = placed[p][1] - y;
        if (dx * dx + dy * dy < Math.pow(minGap + placed[p][2], 2)) { ok = false; break; }
      }
      if (ok) return [x, y];
    }
    return [Math.cos(rnd() * 6.28) * rnd() * maxR, Math.sin(rnd() * 6.28) * rnd() * maxR];
  }
  var SHAPES = {
    pepperoni: { n: 13, gap: 19, maxR: 128, draw: function (g) {
      el("circle", { r: 18, fill: "url(#gPep)" }, g);
      el("circle", { r: 18, fill: "none", stroke: "#7a1610", "stroke-width": 2, opacity: 0.6 }, g);
      for (var k = 0; k < 4; k++) el("circle", { cx: (rnd() * 20 - 10).toFixed(1), cy: (rnd() * 20 - 10).toFixed(1), r: (1.2 + rnd() * 1.8).toFixed(1), fill: "#6e130c", opacity: 0.55 }, g);
      el("ellipse", { cx: -6, cy: -7, rx: 6, ry: 3, fill: "#fff", opacity: 0.18, transform: "rotate(-30 -6 -7)" }, g);
    } },
    mushroom: { n: 9, gap: 14, maxR: 132, draw: function (g) {
      el("path", { d: "M-13 2 C-13 -12 13 -12 13 2 L5 2 L5 12 L-5 12 L-5 2 Z", fill: "#eadfcd", stroke: "#9b7b5c", "stroke-width": 2, "stroke-linejoin": "round" }, g);
      el("path", { d: "M-9 2 Q0 -3 9 2", fill: "none", stroke: "#b89a7a", "stroke-width": 1.5 }, g);
    } },
    peppers: { n: 9, gap: 13, maxR: 132, draw: function (g) {
      el("path", { d: "M-14 4 Q0 -14 14 4", fill: "none", stroke: "#2f8a35", "stroke-width": 6, "stroke-linecap": "round" }, g);
      el("path", { d: "M-11 3 Q0 -9 11 3", fill: "none", stroke: "#57b25b", "stroke-width": 1.6, "stroke-linecap": "round", opacity: 0.8 }, g);
    } },
    onions: { n: 10, gap: 11, maxR: 134, draw: function (g) {
      el("path", { d: "M-13 5 Q0 -12 13 5", fill: "none", stroke: "#a565a8", "stroke-width": 3.5, "stroke-linecap": "round" }, g);
      el("path", { d: "M-9 6 Q0 -6 9 6", fill: "none", stroke: "#f3e8f1", "stroke-width": 2.5, "stroke-linecap": "round" }, g);
    } },
    olives: { n: 11, gap: 9, maxR: 134, draw: function (g) {
      el("circle", { r: 7, fill: "none", stroke: "#1c1a18", "stroke-width": 5 }, g);
      el("path", { d: "M-5 -4 Q-1 -7 3 -6", fill: "none", stroke: "#fff", "stroke-width": 1.2, opacity: 0.35 }, g);
    } },
    sausage: { n: 11, gap: 11, maxR: 132, draw: function (g) {
      el("path", { d: "M-9 -4 Q-6 -11 2 -9 Q11 -8 10 1 Q9 10 0 9 Q-10 9 -9 -4 Z", fill: "#8c5a39" }, g);
      el("circle", { cx: -2, cy: -2, r: 2, fill: "#b07a52" }, g);
      el("circle", { cx: 4, cy: 3, r: 1.4, fill: "#5e3a22" }, g);
    } },
    basil: { n: 6, gap: 14, maxR: 120, draw: function (g) {
      el("path", { d: "M0 -16 C12 -8 12 8 0 16 C-12 8 -12 -8 0 -16 Z", fill: "#2e7d32" }, g);
      el("path", { d: "M0 -14 L0 14", stroke: "#1b5e20", "stroke-width": 1.4 }, g);
    } }
  };
  var groups = {};
  function addTopping(kind, delay) {
    var def = SHAPES[kind], g = el("g", {}, gTop), items = [];
    groups[kind] = g;
    for (var n = 0; n < def.n; n++) {
      var p = spot(def.gap, def.maxR);
      placed.push([p[0], p[1], def.gap, kind]);
      var outer = el("g", { transform: "translate(" + p[0].toFixed(1) + " " + p[1].toFixed(1) + ") rotate(" + (rnd() * 360).toFixed(0) + ")" }, g);
      var inner = el("g", { class: "pop" }, outer);
      def.draw(inner);
      items.push(inner);
      anim(inner, [{ transform: "translateY(-240px) scale(1.7)", opacity: 0 },
                   { transform: "translateY(0) scale(1)", opacity: 1 }],
           { duration: 560, delay: (delay || 0) + n * 70, easing: BOUNCE });
    }
    return items;
  }
  function removeTopping(kind) {
    var g = groups[kind]; if (!g) return;
    delete groups[kind];
    placed = placed.filter(function (p) { return p[3] !== kind; });
    if (reduce || !g.animate) { g.remove(); return; }
    var a = g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: "both" });
    a.onfinish = function () { g.remove(); };
  }

  /* ---------- the build ---------- */
  var BUILD_MS = 6200;
  function build() {
    anim(gCrust, [{ transform: "scale(.15) rotate(-200deg)", opacity: 0 }, { transform: "scale(1) rotate(0)", opacity: 1 }],
         { duration: 1000, easing: OUT });
    var len = spiral.getTotalLength();
    spiral.style.strokeDasharray = len;
    anim(spiral, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 1500, delay: 700, easing: "ease-in-out" });
    anim(coat, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 2050 });
    anim(gCheese, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 2250 });
    blobs.forEach(function (bl, k) {
      anim(bl, [{ transform: "scale(0)" }, { transform: "scale(1)" }], { duration: 480, delay: 2250 + (k % 10) * 60, easing: BOUNCE });
    });
    addTopping("pepperoni", 3100);
    addTopping("basil", 4300);
    anim(baked, [{ opacity: 0 }, { opacity: 1 }], { duration: 1300, delay: 4700 });
    anim(chars, [{ opacity: 0 }, { opacity: 1 }], { duration: 1300, delay: 4900 });
    anim(browned, [{ opacity: 0 }, { opacity: 1 }], { duration: 1300, delay: 4900 });
    var glow = document.getElementById("ovenGlow");
    if (glow) anim(glow, [{ opacity: 0 }, { opacity: 0.9, offset: 0.4 }, { opacity: 0.45 }], { duration: 1800, delay: 4600 });
  }

  /* ---------- the idle loop: spin, slice pull, cheese strings, embers ---------- */
  var playing = !reduce, clock = 0, last = 0, started = false, visible = true;
  var A1 = -112.5 * Math.PI / 180, A2 = -67.5 * Math.PI / 180, CYCLE = 9000;
  var strandEls = [];
  [[A1, 46], [A1, 92], [A1, 134], [A2, 52], [A2, 98], [A2, 138]].forEach(function (s) {
    strandEls.push({ a: s[0], r: s[1], n: el("path", { fill: "none", stroke: "#fbe08a", "stroke-linecap": "round" }, strings) });
  });
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function pullAt(ms) {
    var t = ms % CYCLE;
    if (t < 1200) return 0;
    if (t < 2400) return ease((t - 1200) / 1200);
    if (t < 4600) return 1;
    if (t < 5800) return 1 - ease((t - 4600) / 1200);
    return 0;
  }
  var slicing = false, sliceCopy = null;
  function settle() {
    // bake every finished or running animation into inline style so a clone looks identical
    if (!document.getAnimations) return;
    document.getAnimations().forEach(function (a) {
      var t = a.effect && a.effect.target;
      if (t && art.contains(t) && a.commitStyles) { try { a.commitStyles(); a.cancel(); } catch (e) {} }
    });
  }
  function setSlice(on) {
    if (on === slicing) return;
    slicing = on;
    if (on) {
      settle();
      sliceCopy = art.cloneNode(true);
      sliceCopy.removeAttribute("id");
      sliceCopy.setAttribute("clip-path", "url(#cpSlice)");
      sliceG.appendChild(sliceCopy);
      art.setAttribute("clip-path", "url(#cpRest)");
    } else {
      if (sliceCopy) sliceCopy.remove();
      sliceCopy = null;
      art.removeAttribute("clip-path");
      sliceG.removeAttribute("transform");
    }
    strings.style.display = on ? "" : "none";
  }
  function frame(now) {
    if (!last) last = now;
    var dt = Math.min(now - last, 64); last = now;
    if (playing && visible) {
      clock += dt;
      if (started) {
        spinG.setAttribute("transform", "rotate(" + ((clock * 0.006) % 360).toFixed(2) + ")");
        var p = pullAt(clock), dist = p * 58;
        setSlice(dist > 0.3);
        if (slicing) {
          sliceG.setAttribute("transform", "translate(0 " + (-dist).toFixed(2) + ")");
          var w = Math.max(1.2, 10 * (1 - dist / 80));
          strandEls.forEach(function (s, k) {
            var x = Math.cos(s.a) * s.r, y = Math.sin(s.a) * s.r, sag = (k % 2 ? 1 : -1) * (2 + dist * 0.08);
            s.n.setAttribute("d", "M" + x.toFixed(1) + " " + y.toFixed(1) + " Q" + (x + sag).toFixed(1) + " " + (y - dist / 2).toFixed(1) + " " + x.toFixed(1) + " " + (y - dist).toFixed(1));
            s.n.setAttribute("stroke-width", w.toFixed(2));
            s.n.setAttribute("opacity", dist > 6 ? 0.95 : dist / 6);
          });
        }
      }
      embers(dt);
    }
    requestAnimationFrame(frame);
  }

  /* embers rising out of the oven, behind the pie */
  var ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null, sparks = [], W = 0, H = 0;
  function size() {
    if (!ctx) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function spark(init) {
    return { x: Math.random() * W, y: init ? Math.random() * H : H + 10, v: 18 + Math.random() * 46,
      r: 0.6 + Math.random() * 1.9, drift: Math.random() * 6.28, life: 0 };
  }
  function embers(dt) {
    if (!ctx || !W) return;
    if (!sparks.length) for (var k = 0; k < 70; k++) sparks.push(spark(true));
    ctx.clearRect(0, 0, W, H);
    for (var k = 0; k < sparks.length; k++) {
      var s = sparks[k];
      s.life += dt; s.y -= s.v * dt / 1000; s.x += Math.sin(s.drift + s.life / 700) * 0.25;
      if (s.y < -10) { sparks[k] = spark(false); continue; }
      var h = s.y / H, a = Math.max(0, Math.min(1, h * 1.2)) * (0.55 + 0.45 * Math.sin(s.life / 120 + k));
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283);
      ctx.fillStyle = "rgba(255," + (120 + (k % 5) * 22) + ",40," + a.toFixed(2) + ")";
      ctx.fill();
    }
  }

  /* ---------- pause / play: one button stops everything ---------- */
  function setPlaying(on) {
    playing = on;
    document.getAnimations && document.getAnimations().forEach(function (a) {
      if (a.playState === "finished") return;
      on ? a.play() : a.pause();
    });
    svg.classList.toggle("paused", !on);
    if (btn) {
      btn.setAttribute("aria-pressed", on ? "false" : "true");
      btn.querySelector("span").textContent = on ? "Pause" : "Play";
      btn.setAttribute("aria-label", on ? "Pause the pizza animation" : "Play the pizza animation");
    }
  }
  if (btn) btn.addEventListener("click", function () { setPlaying(!playing); });

  /* ---------- topping chips ---------- */
  document.querySelectorAll("[data-top]").forEach(function (chip) {
    chip.addEventListener("click", function () {
      var kind = chip.getAttribute("data-top"), on = chip.getAttribute("aria-pressed") === "true";
      chip.setAttribute("aria-pressed", on ? "false" : "true");
      on ? removeTopping(kind) : addTopping(kind, 0);
      if (!playing && !reduce) setPlaying(true);
      var count = document.querySelectorAll('[data-top][aria-pressed="true"]').length;
      var out = document.getElementById("pieSays");
      if (out) out.textContent = count === 0 ? "Plain cheese. A classic." : count + (count === 1 ? " topping" : " toppings") + " on your pie.";
    });
  });

  /* ---------- go ---------- */
  setSlice(false);
  if (reduce) {
    build();
    if (btn) btn.hidden = true;
    return;
  }
  size();
  window.addEventListener("resize", size);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(svg);
  }
  build();
  setTimeout(function () { started = true; svg.classList.add("live"); }, BUILD_MS);
  requestAnimationFrame(frame);
})();
