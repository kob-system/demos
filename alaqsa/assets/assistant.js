/* Al-Aqsa store assistant. Answers from the site's own data, moves the visitor
   around the site, and builds an order list they send to the store.
   If __CFG.assistantUrl is set, questions go to the Claude worker; otherwise the
   built-in matcher below answers from data/assistant.json and data/grocery.json. */
(function () {
  var CFG = window.__CFG || {};
  var ROOT = document.body.getAttribute("data-root") || "./";
  var html = document.documentElement;
  var KB = null, GROCERY = null, history = [], order = [];

  function ar() { return html.getAttribute("lang") === "ar"; }
  function T(en, a) { return ar() ? a : en; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  try { order = JSON.parse(store("aq-order") || "[]") || []; } catch (e) { order = []; }
  function saveOrder() { store("aq-order", JSON.stringify(order)); }
  function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function load(name) { return fetch(ROOT + "data/" + name + ".json").then(function (r) { return r.json(); }); }
  function ready() {
    return Promise.all([KB || load("assistant").then(function (j) { KB = j; return j; }), GROCERY || load("grocery").then(function (j) { GROCERY = j; return j; })]);
  }

  /* ---------- UI ---------- */
  var css = document.createElement("style");
  css.textContent =
    ".aq-fab{position:fixed;inset-inline-end:16px;bottom:16px;z-index:60;background:#F2A93B;color:#071230;border:0;border-radius:999px;padding:14px 20px;font:700 16px/1 inherit;box-shadow:0 6px 20px rgba(0,0,0,.25);cursor:pointer}" +
    ".aq-panel{position:fixed;inset-inline-end:16px;bottom:16px;z-index:61;width:min(380px,calc(100vw - 32px));height:min(560px,calc(100vh - 32px));background:#fff;color:#11161A;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.3);display:flex;flex-direction:column;overflow:hidden}" +
    ".aq-panel[hidden]{display:none}" +
    ".aq-top{background:#071230;color:#fff;padding:12px 14px;display:flex;align-items:center;gap:10px}.aq-top b{flex:1;font-size:16px}" +
    ".aq-top button{background:none;border:0;color:#fff;font-size:24px;line-height:1;cursor:pointer;padding:4px 8px}" +
    ".aq-log{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#F4F2EC}" +
    ".aq-m{max-width:85%;padding:10px 12px;border-radius:12px;font-size:15px;line-height:1.4;white-space:pre-wrap}" +
    ".aq-m.bot{background:#fff;align-self:flex-start;border:1px solid #e3e0d8}.aq-m.me{background:#071230;color:#fff;align-self:flex-end}" +
    ".aq-acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.aq-acts a,.aq-acts button{font:600 13px/1 inherit;padding:8px 10px;border-radius:999px;border:1.5px solid #071230;background:#fff;color:#071230;text-decoration:none;cursor:pointer}" +
    ".aq-chips{display:flex;gap:6px;overflow-x:auto;padding:8px 12px;background:#fff;border-top:1px solid #eee}.aq-chips button{flex:0 0 auto;font:600 13px/1 inherit;padding:8px 10px;border-radius:999px;border:1px solid #ccc;background:#fafafa;cursor:pointer}" +
    ".aq-order{background:#FFF6E6;border-top:1px solid #f1dcb0;padding:8px 12px;font-size:14px}.aq-order[hidden]{display:none}.aq-order ul{margin:4px 0 6px;padding-inline-start:18px}" +
    ".aq-order .row{display:flex;gap:6px;flex-wrap:wrap}.aq-order .row a,.aq-order .row button{font:700 13px/1 inherit;padding:8px 10px;border-radius:8px;border:0;background:#071230;color:#fff;text-decoration:none;cursor:pointer}.aq-order .row .ghost{background:none;color:#071230;border:1px solid #071230}" +
    ".aq-form{display:flex;gap:6px;padding:10px;border-top:1px solid #eee;background:#fff}.aq-form input{flex:1;font:16px inherit;padding:10px 12px;border:1.5px solid #ccc;border-radius:10px;min-width:0}.aq-form button{font:700 15px inherit;padding:0 14px;border:0;border-radius:10px;background:#071230;color:#fff;cursor:pointer}";
  document.head.appendChild(css);

  var fab = document.createElement("button");
  fab.type = "button"; fab.className = "aq-fab";
  var panel = document.createElement("div");
  panel.className = "aq-panel"; panel.hidden = true; panel.setAttribute("role", "dialog");
  panel.innerHTML =
    '<div class="aq-top"><b></b><button type="button" class="aq-x" aria-label="Close">&times;</button></div>' +
    '<div class="aq-log" aria-live="polite"></div>' +
    '<div class="aq-order" hidden></div>' +
    '<div class="aq-chips"></div>' +
    '<form class="aq-form"><input type="text" autocomplete="off" aria-label="Your question"><button type="submit"></button></form>';
  document.body.appendChild(fab); document.body.appendChild(panel);
  var log = panel.querySelector(".aq-log"), input = panel.querySelector("input"), form = panel.querySelector("form"), chips = panel.querySelector(".aq-chips"), tray = panel.querySelector(".aq-order");

  function labels() {
    fab.textContent = T("Ask us / Order", "اسألنا / اطلب");
    panel.querySelector(".aq-top b").textContent = T("Al-Aqsa helper", "مساعد الأقصى");
    panel.setAttribute("aria-label", T("Al-Aqsa helper", "مساعد الأقصى"));
    input.placeholder = T("Ask about hours, prices, items...", "اسأل عن الساعات، الأسعار، المنتجات...");
    form.querySelector("button").textContent = T("Send", "إرسال");
    chips.innerHTML = "";
    [[T("Are you open?", "هل أنتم مفتوحون؟")], [T("Meat prices", "أسعار اللحوم")], [T("What is mashawi?", "ما هي المشاوي؟")], [T("Do you have halloumi?", "هل عندكم حلوم؟")], [T("Directions", "الاتجاهات")]].forEach(function (c) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = c[0];
      b.addEventListener("click", function () { ask(c[0]); });
      chips.appendChild(b);
    });
    drawOrder();
  }

  function add(role, text, acts) {
    var m = document.createElement("div"); m.className = "aq-m " + (role === "user" ? "me" : "bot"); m.textContent = text;
    if (acts && acts.length) {
      var box = document.createElement("div"); box.className = "aq-acts";
      acts.forEach(function (a) { var el = actionEl(a); if (el) box.appendChild(el); });
      if (box.childNodes.length) m.appendChild(box);
    }
    log.appendChild(m); log.scrollTop = log.scrollHeight;
  }

  function pageHref(target) {
    var map = { home: "", mashawi: "mashawi/", grocery: "grocery/", visit: "visit/", meat: "#meat", dairy: "#dairy" };
    var t = map[target];
    if (t === undefined) return null;
    if (t.charAt(0) === "#") return (document.getElementById(t.slice(1)) ? "" : ROOT) + t;
    return ROOT + t;
  }
  function actionEl(a) {
    var el;
    if (a.type === "go") {
      var href = pageHref(a.value); if (href === null) return null;
      el = document.createElement("a"); el.href = href;
      el.textContent = { home: T("Home", "الرئيسية"), mashawi: T("See the mashawi", "شاهد المشاوي"), grocery: T("Browse the grocery", "تصفّح البقالة"), visit: T("Hours and directions", "الساعات والاتجاهات"), meat: T("See meat prices", "أسعار اللحوم"), dairy: T("See the dairy case", "قسم الألبان") }[a.value];
      el.addEventListener("click", function () { if (href.charAt(0) === "#") panel.hidden = true; });
    } else if (a.type === "search") {
      el = document.createElement("a"); el.href = ROOT + "grocery/?q=" + encodeURIComponent(a.value);
      el.textContent = T("Show me ", "اعرض ") + a.value;
    } else if (a.type === "directions" && KB) {
      el = document.createElement("a"); el.href = KB.store.maps; el.target = "_blank"; el.rel = "noopener"; el.textContent = T("Open in Maps", "افتح الخريطة");
    } else if (a.type === "call") {
      el = document.createElement("a"); el.href = "tel:" + (CFG.tel || ""); el.textContent = T("Call ", "اتصل ") + (CFG.phone || "");
    } else return null;
    return el;
  }

  /* ---------- order list ---------- */
  function addToOrder(item, qty, unit) {
    var hit = order.filter(function (o) { return norm(o.item) === norm(item) && o.unit === unit; })[0];
    if (hit) hit.qty += qty; else order.push({ item: item, qty: qty, unit: unit || "" });
    saveOrder(); drawOrder();
  }
  function orderText() {
    return T("Order for Al-Aqsa:", "طلب لسوق الأقصى:") + "\n" + order.map(function (o) { return "- " + o.qty + (o.unit ? " " + o.unit : "") + " " + o.item; }).join("\n");
  }
  function drawOrder() {
    tray.hidden = !order.length; if (!order.length) return;
    var wa = (CFG.whatsapp || "").replace(/\D/g, "");
    tray.innerHTML = "<b>" + T("Your order list", "قائمة طلبك") + "</b><ul></ul><div class=\"row\"></div>";
    var ul = tray.querySelector("ul"), row = tray.querySelector(".row");
    order.forEach(function (o) { var li = document.createElement("li"); li.textContent = o.qty + (o.unit ? " " + o.unit : "") + " " + o.item; ul.appendChild(li); });
    if (wa) { var w = document.createElement("a"); w.href = "https://wa.me/" + wa + "?text=" + encodeURIComponent(orderText()); w.target = "_blank"; w.rel = "noopener"; w.textContent = T("Send on WhatsApp", "أرسل عبر واتساب"); row.appendChild(w); }
    var c = document.createElement("a"); c.href = "tel:" + (CFG.tel || ""); c.textContent = T("Call it in", "اتصل للطلب"); row.appendChild(c);
    var cp = document.createElement("button"); cp.type = "button"; cp.className = "ghost"; cp.textContent = T("Copy", "نسخ");
    cp.addEventListener("click", function () { if (navigator.clipboard) navigator.clipboard.writeText(orderText()).then(function () { cp.textContent = T("Copied", "تم النسخ"); }); });
    row.appendChild(cp);
    var clr = document.createElement("button"); clr.type = "button"; clr.className = "ghost"; clr.textContent = T("Clear", "مسح");
    clr.addEventListener("click", function () { order = []; saveOrder(); drawOrder(); });
    row.appendChild(clr);
  }

  /* ---------- built-in matcher (no AI) ---------- */
  function fmt(t) { var p = t.split(":").map(Number); return ((p[0] + 11) % 12 + 1) + (p[1] ? ":" + String(p[1]).padStart(2, "0") : "") + (p[0] >= 12 ? " PM" : " AM"); }
  function today() {
    var d = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(new Date());
    return KB.hours.filter(function (h) { return h.short === d; })[0];
  }
  var NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, ten: 10, half: 0.5 };
  function local(q) {
    var n = norm(q), r = { reply: "", actions: [] };
    var meat = KB.meatPrices.items, mash = KB.mashawi.items;
    var isAr = /[؀-ۿ]/.test(q) || ar();
    function say(en, a) { r.reply = isAr ? a : en; }

    var want = n.match(/\b(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|ten|half)\s*(lb|lbs|pound|pounds|kg)?\s*(?:of\s+)?(.+)/);
    if (/\b(order|want|get me|i need|add)\b/.test(n) || /أريد|اطلب|بدي/.test(q)) {
      var pool = mash.map(function (m) { return { name: m.name, unit: m.unit }; }).concat(meat.map(function (m) { return { name: m.name, unit: "lb" }; }));
      var found = pool.filter(function (p) { return n.indexOf(norm(p.name)) !== -1 || norm(p.name).split(" ").every(function (w) { return n.indexOf(w) !== -1; }); })[0];
      if (found) {
        var qty = 1; if (want) { var v = want[1]; qty = NUM[v] !== undefined ? NUM[v] : parseFloat(v) || 1; }
        addToOrder(found.name, qty, found.unit);
        say("Added " + qty + " " + found.unit + " " + found.name + " to your order list. Send it on WhatsApp or call it in when you're ready.", "أضفت " + qty + " " + found.unit + " " + found.name + " إلى قائمة طلبك. أرسلها أو اتصل بنا عندما تكون جاهزاً.");
        return r;
      }
    }
    if (/\b(open|close|closing|hours|time)\b/.test(n) || /ساعات|مفتوح|تفتح|تسكر/.test(q)) {
      var t = today();
      say("Today we're open " + fmt(t.opens) + " to " + fmt(t.closes) + ". Full week on the hours page.", "اليوم نفتح من " + fmt(t.opens) + " حتى " + fmt(t.closes) + ".");
      r.actions = [{ type: "go", value: "visit" }]; return r;
    }
    if (/\b(where|address|direction|directions|located|location|parking)\b/.test(n) || /وين|عنوان|موقع/.test(q)) {
      say("We're at " + KB.store.address + ".", "عنواننا: " + KB.store.address);
      r.actions = [{ type: "directions" }, { type: "go", value: "visit" }]; return r;
    }
    if (/\b(cooked|ready to eat|hot food|catering)\b/.test(n) || /مطبوخ/.test(q)) {
      say("The mashawi is raw. We clean, season and skewer it, and you cook it at home. We don't sell cooked meals.", "المشاوي نيّئة. ننظفها ونتبّلها ونركّبها على السيخ، وأنت تطهوها في البيت. لا نبيع وجبات مطبوخة.");
      r.actions = [{ type: "go", value: "mashawi" }]; return r;
    }
    if (/\b(ebt|snap|card|credit|cash|pay)\b/.test(n)) {
      say("We take " + KB.store.payment + ".", "نقبل النقد والبطاقات و EBT/SNAP."); return r;
    }
    var m1 = meat.filter(function (m) { return norm(m.name).split(" ").some(function (w) { return w.length > 3 && n.indexOf(w) !== -1; }); });
    if (/\b(meat|price|prices|lamb|goat|veal|beef|steak|ribs|shank)\b/.test(n) && !/\b(skewer|kabab|kebab|kofta|tawook|mashawi)\b/.test(n) || /لحم|أسعار|سعر/.test(q) && !/مشاوي/.test(q)) {
      var exact = meat.filter(function (m) { return n.indexOf(norm(m.name)) !== -1; });
      var list = exact.length ? exact : m1.length ? m1 : meat;
      say(list.map(function (m) { return m.name + ": $" + m.price.toFixed(2) + "/lb"; }).join("\n") + "\n\nFrom the counter sign. Prices change, so call to check.",
        list.map(function (m) { return m.name_ar + ": $" + m.price.toFixed(2) + " للرطل"; }).join("\n") + "\n\nالأسعار تتغير، اتصل للتأكد.");
      r.actions = [{ type: "go", value: "meat" }, { type: "call" }]; return r;
    }
    if (/\b(mashawi|skewer|skewers|kabab|kebab|kofta|tawook|shish|grill|bbq)\b/.test(n) || /مشاوي|كباب|كفتة|طاووق|سيخ/.test(q)) {
      say("Our mashawi counter has " + mash.map(function (m) { return m.name; }).join(", ") + ". All raw and marinated, ready for your grill. Prices are coming soon, call to ask today.",
        "ركن المشاوي فيه: " + mash.map(function (m) { return m.name_ar; }).join("، ") + ". كلها نيّئة ومتبّلة وجاهزة للشوي.");
      r.actions = [{ type: "go", value: "mashawi" }, { type: "call" }]; return r;
    }
    var AR_ITEMS = { "لبنة": "labneh", "لبنه": "labneh", "حلوم": "halloumi", "جبنة": "cheese", "جبنه": "cheese", "زيت زيتون": "olive oil", "رز": "rice", "أرز": "rice", "خبز": "bread", "شاي": "tea", "قهوة": "coffee", "تمر": "dates", "حمص": "chickpeas", "طحينة": "tahini", "دبس رمان": "pomegranate molasses", "دبس الرمان": "pomegranate molasses", "زعتر": "zaatar", "عدس": "lentils", "برغل": "bulgur", "لبن": "yogurt", "عيران": "ayran", "زيتون": "olives", "حلاوة": "halva", "سماق": "sumac", "فريكة": "freekeh" };
    Object.keys(AR_ITEMS).sort(function (a, b) { return b.length - a.length; }).forEach(function (k) { if (q.indexOf(k) !== -1) { n += " " + AR_ITEMS[k]; q = q.split(k).join(" "); } });
    var words = n.replace(/[؀-ۿ]+/g, " ").replace(/\b(do|you|have|has|sell|carry|any|the|a|an|is|there|got|i|want|need|looking|for|some|of|please|where|can|find|buy|your|in|stock)\b/g, " ").replace(/[^a-z0-9؀-ۿ ]/g, " ").trim().split(/\s+/).filter(function (w) { return w.length > 2; });
    if (words.length) {
      var hits = GROCERY.items.filter(function (it) { var s = norm(it[0] + " " + (it[2] || "")); return words.every(function (w) { return s.indexOf(w.replace(/s$/, "")) !== -1; }); });
      var dairyHit = KB.dairy.filter(function (d) { return words.some(function (w) { return norm(d).indexOf(w.replace(/s$/, "")) !== -1; }); });
      if (hits.length || dairyHit.length) {
        var names = hits.slice(0, 5).map(function (h) { return h[0]; });
        if (!names.length) names = dairyHit;
        say("Yes. We carry " + (hits.length || dairyHit.length) + " item" + ((hits.length || dairyHit.length) > 1 ? "s" : "") + " matching that, like:\n" + names.join("\n") + "\n\nStock changes daily, so call if you need it today.",
          "نعم، عندنا " + (hits.length || dairyHit.length) + " منتج مطابق، مثل:\n" + names.join("\n"));
        r.actions = hits.length ? [{ type: "search", value: words.join(" ") }, { type: "call" }] : [{ type: "go", value: "dairy" }];
        return r;
      }
    }
    say("I'm not sure about that one. The store can tell you, call " + KB.store.phone + ".", "لست متأكداً. اتصل بالمتجر على " + KB.store.phone + ".");
    r.actions = [{ type: "call" }]; return r;
  }

  /* ---------- ask ---------- */
  function ask(q) {
    q = String(q || "").trim(); if (!q) return;
    add("user", q); input.value = "";
    history.push({ role: "user", content: q });
    var thinking = document.createElement("div"); thinking.className = "aq-m bot"; thinking.textContent = "..."; log.appendChild(thinking);
    var p = CFG.assistantUrl
      ? fetch(CFG.assistantUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: history.slice(-12), lang: html.getAttribute("lang") }) })
          .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
          .catch(function () { return ready().then(function () { return local(q); }); })
      : ready().then(function () { return local(q); });
    p.then(function (res) {
      thinking.remove();
      (res.actions || []).forEach(function (a) { if (a.type === "add" && a.value) addToOrder(a.value, a.qty || 1, a.unit || ""); });
      add("assistant", res.reply, (res.actions || []).filter(function (a) { return a.type !== "add"; }));
      history.push({ role: "assistant", content: res.reply });
    }).catch(function () { thinking.textContent = T("Something went wrong. Please call ", "حدث خطأ. اتصل على ") + (CFG.phone || ""); });
  }

  form.addEventListener("submit", function (e) { e.preventDefault(); ask(input.value); });
  fab.addEventListener("click", function () {
    panel.hidden = false; fab.hidden = true;
    if (!log.childNodes.length) add("assistant", T("Hi! Ask me about hours, meat prices, the mashawi, or any item. I can also start an order list for you.", "أهلاً! اسألني عن الساعات أو أسعار اللحوم أو المشاوي أو أي منتج. ويمكنني أيضاً تجهيز قائمة طلب لك."));
    input.focus(); ready();
  });
  panel.querySelector(".aq-x").addEventListener("click", function () { panel.hidden = true; fab.hidden = false; });
  document.addEventListener("aq-lang", labels);
  labels();
})();
