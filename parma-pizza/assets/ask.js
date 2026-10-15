/* Ask Parma: a food helper. Customers type what they want ("pizza with mushrooms",
   "feeding 8 people") and get real menu items with prices, plus Order and Call buttons.
   Pattern copied from the Al-Aqsa helper: if __ASK.assistantUrl is set, questions go to the
   Claude worker (assistant-worker/); if that fails or is not set, the built-in matcher below
   answers from assets/menu-data.json. Both return the same shape:
   { reply, groups: [{ title, items: [{ name, detail, price }], total }], note } */
(function () {
  "use strict";
  var CFG = window.__ASK || {};
  var MENU = null, ITEMS = [], history = [];

  /* ---------- helpers ---------- */
  function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function money(n) { return "$" + (Math.round(n * 100) / 100).toFixed(2); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function priceText(p) {
    if (p == null) return "";
    if (typeof p === "number") return p ? money(p) : "Free";
    var keys = Object.keys(p), lab = { small: "S", medium: "M", large: "L", xl: "XL" };
    return keys.map(function (k) { return lab[k] + " " + money(p[k]).replace(".00", ""); }).join(" / ");
  }
  function row(it, detail) { return { name: it.name, detail: detail != null ? detail : it.desc || "", price: priceText(it.price) }; }
  function load() {
    if (MENU) return Promise.resolve(MENU);
    return fetch(CFG.data || "assets/menu-data.json").then(function (r) { return r.json(); }).then(function (j) {
      MENU = j; ITEMS = [];
      j.sections.forEach(function (s) { s.items.forEach(function (it) { it.section = s.id; it.hay = norm(it.name + " " + it.desc); ITEMS.push(it); }); });
      return j;
    });
  }
  function find(name) { return ITEMS.filter(function (i) { return i.name === name; })[0]; }
  function sect(id) { return ITEMS.filter(function (i) { return i.section === id; }); }

  /* ---------- word lists (all checked against menu-data.json text) ---------- */
  // key: [regex on the customer's words, regex on menu text, standard topping name or ""]
  var ING = {
    mushroom: [/\b(mushrooms?|shrooms?|funghi)\b/, /mushroom/, "Mushrooms"],
    pepperoni: [/\b(pepperoni|roni)\b/, /pepperoni/, "Pepperoni"],
    sausage: [/\bsausages?\b/, /sausage/, "Sausage"],
    chicken: [/\bchicken\b/, /chicken/, "Chicken"],
    bacon: [/\bbacon\b/, /bacon/, ""],
    ham: [/\bham\b/, /\bham\b/, "Ham"],
    steak: [/\b(steak|philly|cheesesteak)\b/, /steak/, ""],
    meatball: [/\bmeatballs?\b/, /meatball/, "Meatballs"],
    salami: [/\b(salami|soppressata)\b/, /salami|soppressata/, "Salami"],
    prosciutto: [/\bprosciutto\b/, /prosciutto/, ""],
    peppers: [/\b(peppers|green peppers?|bell peppers?|roasted peppers?)\b/, /\bpeppers?\b/, "Peppers"],
    onion: [/\bonions?\b/, /onion/, "Onions"],
    olive: [/\bolives?\b/, /olive/, "Olives"],
    broccoli: [/\bbroccoli\b/, /broccoli/, "Broccoli"],
    spinach: [/\bspinach\b/, /spinach/, "Spinach"],
    pineapple: [/\bpineapples?\b/, /pineapple/, "Pineapple"],
    tomato: [/\btomato(es)?\b/, /tomato/, "Tomatoes"],
    eggplant: [/\beggplant\b/, /eggplant/, "Eggplant"],
    feta: [/\bfeta\b/, /feta/, ""],
    ricotta: [/\bricotta\b/, /ricotta/, "Ricotta"],
    garlic: [/\bgarlic\b/, /garlic/, ""],
    basil: [/\bbasil\b/, /basil/, ""],
    pesto: [/\bpesto\b/, /pesto/, ""],
    alfredo: [/\balfredo\b/, /alfredo/, ""],
    ranch: [/\branch\b/, /ranch/, ""],
    bbq: [/\b(bbq|barbecue|barbeque)\b/, /bbq/, ""],
    buffalo: [/\bbuffalo\b/, /buffalo/, ""],
    honey: [/\bhot honey\b/, /hot honey/, "Hot Honey"],
    tuna: [/\btuna\b/, /tuna/, ""],
    turkey: [/\bturkey\b/, /turkey/, ""]
  };
  var MEAT = /chicken|bacon|\bham\b|steak|sausage|pepperoni|meatball|salami|soppressata|prosciutto|turkey|tuna/;
  var SPICY = /hot sauce|hot honey|hot peppers|diabolo|buffalo|jalapeno|habanero/;
  var NUMW = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, dozen: 12,
    thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50 };
  var PIES = { "the parma": "Parma Pizza", "parma pie": "Parma Pizza", "bang bang": "Chicken Bang Bang", "italian pizza": "Italian", "chicken parm": "Chicken Parmesan",
    "buffalo chicken": "Buffalo Chicken", "bbq chicken": "BBQ Chicken", "chicken alfredo": "Chicken Alfredo", "diabolo": "Chicken Diabolo",
    "lasagna pizza": "Lasagna", "the works": "The Works", "works": "The Works", "meat lover": "Meat Lovers", "roma": "Roma Spinach",
    "white rio": "White Rio", "philly": "Philly Cheese Steak", "ny white": "NY White", "new york white": "NY White",
    "ziti pizza": "Baked Ziti", "ziti alfredo": "Ziti Alfredo", "primavera": "Primavera", "hawaiian": "Hawaiian",
    "mediterranean": "Mediterranean", "cordon bleu": "Chicken Cordon Bleu", "margherita": "Margherita", "margarita": "Margherita",
    "vegetarian pizza": "Vegetarian", "veggie pizza": "Vegetarian", "chicken bacon ranch": "Chicken Bacon Ranch",
    "pesto": "Pesto", "chicken broccoli ranch": "Chicken Broccoli Ranch" };

  function result(reply, groups, note) { return { reply: reply, groups: groups || [], note: note || "" }; }
  function capList(list, n) { return list.length > n ? list.slice(0, n) : list; }

  /* ---------- party sizing ---------- */
  function headcount(n) {
    var q = n.replace(/\b[a-z]+\b/g, function (w) { return NUMW[w] != null ? String(NUMW[w]) : w; });
    var a = q.match(/(\d+)\s*(?:adults?|grown ?ups?)/), k = q.match(/(\d+)\s*(?:kids?|children|child)\b/);
    var adults = a ? +a[1] : 0, kids = k ? +k[1] : 0;
    if (!adults && !kids) {
      var g = q.match(/(\d+)\s*(?:people|persons?|ppl|guests?|of us|friends|guys|folks|players|teammates|coworkers|co-workers|heads|mouths|over|coming|hungry)/) ||
              q.match(/(?:feed(?:ing)?|for|party of|group of|serves?|serving|crowd of|team of)\s*(\d+)\b/);
      if (g) adults = +g[1];
    }
    var total = adults + kids;
    return total >= 2 && total <= 400 ? { adults: adults, kids: kids, total: total } : null;
  }
  // Cheapest mix of bundles that gives at least `xl` XL pies and `wings` wings. Prices from menu-data specials + wings.
  function bestBundle(xl, wings) {
    var B = [["X-Large Cheese Pizza", 1, 0, 17.99], ["Route 9 Special (2 XL)", 2, 0, 29.99], ["Party Pack (3 XL)", 3, 0, 45.99],
      ["Wings, 10 pc", 0, 10, 15], ["Wings, 20 pc", 0, 20, 28], ["Wings, 30 pc", 0, 30, 40],
      ["The Double Play (2 XL, 20 wings, 2 liter)", 2, 20, 59.99], ["Family Special #1 (1 XL, 20 wings, 2 liter)", 1, 20, 42.99],
      ["Triple Play (3 XL, 30 wings)", 3, 30, 84.99]];
    var W = Math.ceil(wings / 10), best = {}, key = function (x, w) { return x + "," + w; };
    best[key(0, 0)] = { cost: 0, picks: [] };
    for (var x = 0; x <= xl; x++) for (var w = 0; w <= W; w++) {
      var cur = best[key(x, w)]; if (!cur) continue;
      B.forEach(function (b) {
        var nx = Math.min(xl, x + b[1]), nw = Math.min(W, w + b[2] / 10);
        if (nx === x && nw === w) return;
        var c = cur.cost + b[3], k2 = key(nx, nw);
        if (!best[k2] || c < best[k2].cost - 0.001) best[k2] = { cost: c, picks: cur.picks.concat([b]) };
      });
    }
    var fin = best[key(xl, W)], count = {};
    fin.picks.forEach(function (b) { count[b[0]] = count[b[0]] || { b: b, n: 0 }; count[b[0]].n++; });
    return { cost: fin.cost, lines: Object.keys(count).map(function (k) { var c = count[k]; return { name: (c.n > 1 ? c.n + " x " : "") + c.b[0], detail: "", price: money(c.b[3] * c.n) }; }) };
  }
  function wingPacks(w) { return bestBundle(0, w); }
  function party(n, hc, picks, toppings) {
    var wantsWings = /\bwings?\b|boneless/.test(n), wantsTray = /\b(tray|trays|pasta|ziti|penne|lasagna tray|catering)\b/.test(n) && !/ziti pizza|ziti alfredo pizza/.test(n);
    var perAdult = wantsWings ? 2 : 3, perKid = wantsWings ? 1.5 : 2;
    var slices = Math.ceil(hc.adults * perAdult + hc.kids * perKid);
    if (wantsTray) slices = Math.ceil(slices / 2);
    var pies = Math.max(1, Math.ceil(slices / 8));
    var wings = wantsWings ? Math.max(10, Math.ceil(hc.total * 3 / 10) * 10) : 0;
    var who = hc.adults && hc.kids ? hc.adults + " adults and " + hc.kids + " kids" : hc.total + " people";
    var groups = [];
    var addOns = [], addCost = 0;
    if (wantsTray) {
      var trays = Math.max(1, Math.ceil(hc.total / 2 / 7)), tray = find("Baked Ziti Half Tray");
      var TRAY = [[/vodka|penne/, "Penne Vodka with Chicken"], [/alfredo/, "Chicken Alfredo"], [/chicken parm/, "Chicken Parmigiana"],
        [/meatball/, "Meatball Parmigiana"], [/lasagna/, "Lasagna"], [/shells/, "Stuffed Shells"], [/ravioli/, "Ravioli"], [/manicotti/, "Manicotti"]];
      for (var ti = 0; ti < TRAY.length; ti++) if (TRAY[ti][0].test(n)) { tray = find(TRAY[ti][1] + " Half Tray") || tray; break; }
      addOns.push({ name: (trays > 1 ? trays + " x " : "") + tray.name, detail: "Each half tray serves 6-8", price: money(tray.price * trays) });
      addCost += tray.price * trays;
    }
    // 1. Their picks
    if (picks.length || toppings.length) {
      var choices = picks.map(function (p) { return { name: "XL " + p.name, detail: p.desc, price: p.price.xl }; });
      if (toppings.length) choices.push({ name: "XL Pizza with " + toppings.join(" + "), detail: "Cheese pizza $17.99 + $3.00 per topping", price: 17.99 + 3 * toppings.length });
      var cnt = choices.map(function () { return 0; });
      for (var i = 0; i < pies; i++) cnt[i % choices.length]++;
      var lines = [], cost = 0;
      choices.forEach(function (c, i) { if (!cnt[i]) return; lines.push({ name: (cnt[i] > 1 ? cnt[i] + " x " : "") + c.name, detail: c.detail, price: money(c.price * cnt[i]) }); cost += c.price * cnt[i]; });
      if (wings) { var wp = wingPacks(wings); lines = lines.concat(wp.lines); cost += wp.cost; }
      groups.push({ title: "Your picks", items: lines.concat(addOns), total: money(cost + addCost) });
    }
    // 2. Best value round pies (specials)
    var bb = bestBundle(pies, wings);
    groups.push({ title: "Best value: XL round pies" + (wings ? " + wings" : ""), items: bb.lines.concat(addOns), total: money(bb.cost + addCost) });
    // 3. Party pies, 24 pieces each
    if (groups.length < 3) {
      var big = Math.max(1, Math.ceil(slices / 24)), thin = find("Round Thin 24-Cut"), sic = find("Sicilian 24-Cut");
      var pl = [{ name: (big > 1 ? big + " x " : "") + thin.name, detail: "24 pieces each. Or Sicilian 24-Cut at " + money(sic.price) + " each.", price: money(thin.price * big) }], pc = thin.price * big;
      if (wings) { var wp2 = wingPacks(wings); pl = pl.concat(wp2.lines); pc += wp2.cost; }
      groups.push({ title: "Party pies (24-cut)", items: pl.concat(addOns), total: money(pc + addCost) });
    }
    if (groups.length < 3) {
      var gm = ["Parma Pizza", "Chicken Diabolo", "The Works", "Margherita"].map(find), gl = [], gc = 0, gcount = {};
      for (var gi = 0; gi < pies; gi++) { var g = gm[gi % gm.length]; gcount[g.name] = (gcount[g.name] || 0) + 1; }
      gm.forEach(function (g) { var c = gcount[g.name]; if (!c) return; gl.push({ name: (c > 1 ? c + " x " : "") + "XL " + g.name, detail: g.desc, price: money(25 * c) }); gc += 25 * c; });
      if (wings) { var wp3 = wingPacks(wings); gl = gl.concat(wp3.lines); gc += wp3.cost; }
      groups.push({ title: "Gourmet mix (swap in any of the 26)", items: gl.concat(addOns), total: money(gc + addCost) });
    }
    var basis = "About " + slices + " slices" + (wantsTray ? " plus pasta" : "") + " (" + perAdult + " per adult" + (hc.kids ? ", " + perKid + " per kid" : "") + (wantsTray ? ", halved for the pasta" : "") + ")" +
      (wings ? " and about " + wings + " wings" : "") + ". X-Large rounds are 8 slices.";
    var today = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(new Date());
    var note = "Estimate before tax and toppings. Big order? Call a day ahead." + (/Tue|Wed/.test(today) ? " Today: free 2 liter with any XL pizza, pickup only." : "");
    return result("For " + who + ": " + basis + " Here are " + groups.length + " ways to do it:", groups, note);
  }

  /* ---------- the matcher ---------- */
  function local(q) {
    var n = norm(q);
    var pizzaWords = /\b(pizza|pizzas|pie|pies|slice|slices|sicilian|gourmet)\b/.test(n);
    var picks = [];
    Object.keys(PIES).sort(function (a, b) { return b.length - a.length; }).forEach(function (k) {
      var re = new RegExp("\\b" + k + "\\b");
      if (re.test(n) && !(/^(chicken parm|lasagna pizza|ziti pizza)$/.test(k) && /\b(subs?|hero|dinners?|trays?)\b/.test(n))) {
        var p = find(PIES[k]); if (p && picks.indexOf(p) === -1 && !picks.some(function (x) { return norm(x.name).indexOf(k) !== -1; })) picks.push(p);
      }
    });
    var keys = Object.keys(ING).filter(function (k) { return ING[k][0].test(n); });

    if (/allerg|celiac|coeliac|peanut|tree nut|\bnuts?\b|dairy.?free|lactose|\begg\b|shellfish|sesame|kosher|halal/.test(n))
      return result("I can't answer allergy or diet-safety questions. Please call the shop and ask the kitchen directly before you order.", [], "For allergies, always call the shop.");

    var hc = headcount(n);
    if (hc) {
      var tops = keys.map(function (k) { return ING[k][2]; }).filter(function (t, i, a) { return t && a.indexOf(t) === i; });
      // a named pie already covers its own toppings
      if (picks.length) tops = tops.filter(function (t) { return !picks.some(function (p) { return norm(p.desc).indexOf(norm(t).replace(/s$/, "")) !== -1; }); });
      return party(n, hc, picks, tops);
    }
    if (/\b(party|feed|crowd|how many|how much food|people)\b/.test(n))
      return result("Happy to size it. How many people are you feeding? Try something like \"12 people, pizza and wings\" or \"6 adults and 4 kids\".", [], "");

    if (/gluten|cauliflower|\bgf\b/.test(n)) {
      var gf = find("Gluten Free 12\"");
      return result("There's a 12\" gluten-free pizza with a cauliflower crust. Add any standard topping for $2.00 each. The menu doesn't say how it's prepared, so if you have celiac or an allergy, call the shop before you order.", [{ items: [row(gf)] }], "");
    }
    if (/\b(vegetarian|veggie|veg|no meat|meatless|without meat|plant)\b/.test(n) && !picks.filter(function (p) { return p.name !== "Vegetarian"; }).length) {
      var pool = ITEMS.filter(function (i) { return /gourmet|pizza|rolls|hotsubs|coldsubs/.test(i.section) && i.desc && !MEAT.test(i.hay) && !/tray/.test(i.hay); });
      if (pizzaWords) pool = pool.filter(function (i) { return i.section === "gourmet"; });
      return result("These have no meat in their listed ingredients. The menu doesn't label anything vegetarian, so ask the shop about sauces and prep if it matters.", [{ items: pool.map(function (i) { return row(i); }) }], "");
    }
    if (/\b(white|bianca|no red|without red|no sauce|no tomato sauce|garlic butter)\b/.test(n) && !keys.filter(function (k) { return k !== "garlic"; }).length) {
      var wh = ITEMS.filter(function (i) { return (i.section === "gourmet" || i.section === "pizza") && ((i.tags || []).indexOf("white") !== -1 || /alfredo|ranch|garlic butter|pesto/.test(i.hay)) && !/marinara/.test(i.hay); });
      return result("No red sauce? These use garlic butter, Alfredo, ranch or pesto instead, going by the menu description. Ask the shop if you need it with no red sauce at all.", [{ items: wh.map(function (i) { return row(i); }) }], "");
    }
    if (/\b(spicy|spice|hot|heat|kick|jalapeno|habanero|diablo|diabolo|fire)\b/.test(n) && !/hot (subs?|dog)/.test(n)) {
      var sp = ITEMS.filter(function (i) { return SPICY.test(i.hay); });
      if (pizzaWords) sp = sp.filter(function (i) { return i.section === "gourmet"; });
      var sg = [{ items: sp.map(function (i) { return row(i); }) }];
      if (!pizzaWords) sg.push({ title: "Wings, any sauce", items: [row(find("Wings, 10 pc"), "Hot or Mango Habanero sauce for heat")] });
      sg.push({ title: "Or add heat to any pizza", items: [{ name: "Hot Peppers topping", detail: "Standard topping on any round pizza", price: "+$2 / $2.50 / $3" }] });
      return result("Something with a kick. These list hot sauce, hot honey, buffalo or jalapeno. Buffalo Chicken pizza uses mild buffalo sauce.", sg, "");
    }
    // ingredient / topping search
    if (keys.length || picks.length) {
      if (picks.length && !keys.length) return result(picks.length > 1 ? "Here they are:" : "Here it is:", [{ items: picks.map(function (p) { return row(p); }) }], "");
      var all = ITEMS.filter(function (i) { return keys.every(function (k) { return ING[k][1].test(i.hay); }); });
      var partial = false;
      if (!all.length) { all = ITEMS.filter(function (i) { return keys.some(function (k) { return ING[k][1].test(i.hay); }); }); partial = true; }
      if (pizzaWords) all = all.filter(function (i) { return /gourmet|pizza|party|specials/.test(i.section); });
      all = all.filter(function (i) { return !/tray/i.test(i.name); });
      var order = ["gourmet", "pizza", "rolls", "hotsubs", "coldsubs", "salads", "apps", "dinners", "wings", "specials"];
      all.sort(function (a, b) { return order.indexOf(a.section) - order.indexOf(b.section); });
      var PL = { mushroom: "mushrooms", meatball: "meatballs", onion: "onions", olive: "olives", tomato: "tomatoes", honey: "hot honey", bbq: "BBQ" };
      var label = keys.map(function (k) { return PL[k] || k; }).join(" and ");
      var groups = [];
      var gp = all.filter(function (i) { return i.section === "gourmet"; }), other = all.filter(function (i) { return i.section !== "gourmet"; });
      if (gp.length) groups.push({ title: "Gourmet pizzas (" + gp.length + ")", items: gp.map(function (i) { return row(i); }) });
      var std = keys.map(function (k) { return ING[k][2]; }).filter(Boolean);
      if (std.length && (pizzaWords || gp.length || !other.length)) {
        var t = std.length;
        groups.push({ title: "Or build your own", items: [{ name: "Cheese pizza + " + std.join(" + "), detail: std.length === keys.length ? "Standard toppings" : "Standard toppings; the rest only come on the pies above",
          price: "S " + money(13.99 + 2 * t) + " / M " + money(15.99 + 2.5 * t) + " / XL " + money(17.99 + 3 * t) }] });
      }
      if (other.length && !pizzaWords) groups.push({ title: "Also on the menu", items: capList(other, 8).map(function (i) { return row(i); }) });
      if (!groups.length) return result("I couldn't find " + label + " on the menu. Call the shop, they may be able to add it.", [], "");
      return result((partial ? "Nothing has all of that together. Closest matches with " : "Here's everything with ") + label + ":", groups, "");
    }
    // categories
    var CAT = [
      [/\b(wings?|boneless)\b/, "Wings: jumbo or boneless, served with bleu cheese. Sauces: Buffalo, Garlic Parmesan, Honey BBQ, Mild, Medium, Hot, BBQ, Teriyaki, Mango Habanero.", ["wings"], ["The Double Play", "Family Special #1"]],
      [/\b(subs?|sandwich|sandwiches|hero|hoagie|grinder)\b/, "Hot subs are baked with mozzarella. Extra cheese +$2, extra meat +$5.", ["hotsubs", "coldsubs"]],
      [/\b(salads?|greens|caesar)\b/, "Salads come small or large. Dressings: balsamic vinaigrette, bleu cheese, ranch, honey mustard, thousand island, golden Italian, Caesar.", ["salads"]],
      [/\b(cater|catering|trays?|office|event)\b/, "Half trays serve 6 to 8. Tell me how many people and I'll size it, or call the shop to set up catering.", ["trays", "salad_trays"], ["Round Thin 24-Cut", "Sicilian 24-Cut"]],
      [/\b(desserts?|cannoli|cheesecake|tiramisu|cake|sweet)\b/, "Desserts:", ["desserts"]],
      [/\b(drinks?|soda|coke|water|beverages?)\b/, "Drinks:", ["drinks"]],
      [/\b(apps?|appetizers?|sides?|knots|fries|mozzarella sticks|mozz|rice balls?|poppers|tenders|nuggets|snack)\b/, "Appetizers:", ["apps"]],
      [/\b(calzones?|stromboli|rolls?)\b/, "Stuffed rolls and calzones. Toppings +$1.50 each.", ["rolls"]],
      [/\b(pasta|dinners?|ziti|penne|vodka|lasagna|ravioli|shells|manicotti|parm|parmigiana)\b/, "Italian dinners come with spaghetti or ziti and bread.", ["dinners"]],
      [/\b(deals?|specials?|cheap|cheapest|coupon|value|family|combo)\b/, "Specials:", ["specials"]],
      [/\b(gourmet|specialty|signature|best|popular|recommend)\b/, "26 gourmet pies, Small $20 / Medium $23 / XL $25. The Parma Pizza is the house pie.", ["gourmet"]],
      [/\b(pizza|pizzas|pie|cheese|plain|sizes?|slice|sicilian|large|medium|small)\b/, "Round pizza: Small 6 slices, Medium and XL 8 slices. Add standard toppings for $2 / $2.50 / $3.", ["pizza", "party"]]
    ];
    for (var c = 0; c < CAT.length; c++) {
      if (CAT[c][0].test(n)) {
        var its = [];
        CAT[c][2].forEach(function (s) { its = its.concat(sect(s)); });
        (CAT[c][3] || []).forEach(function (nm) { var f = find(nm); if (f) its.push(f); });
        return result(CAT[c][1], [{ items: its.map(function (i) { return row(i); }) }], "");
      }
    }
    if (/\b(hours?|open|close|closing|where|address|directions?|deliver|delivery|pickup)\b/.test(n))
      return result("This helper only knows the menu. Hours and directions are on the home page, or call the shop at " + (CFG.phone || "") + ".", [], "");
    return result("I didn't catch that one. Try a topping (\"pizza with mushrooms\"), a category (\"wings\", \"subs\") or a head count (\"feeding 10 people\"). Or call the shop.", [], "");
  }

  /* ---------- UI ---------- */
  var fab = el("button", "ask-fab");
  fab.type = "button";
  fab.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg><span>Ask Parma</span>';
  fab.setAttribute("aria-label", "Ask Parma: find food on the menu");
  var panel = el("div", "ask-panel");
  panel.hidden = true;
  panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Ask Parma");
  panel.innerHTML =
    '<div class="ask-top"><div><b>Ask Parma</b><span>Tell us what you\'re hungry for</span></div><button type="button" class="ask-x" aria-label="Close">&times;</button></div>' +
    '<div class="ask-log" aria-live="polite"></div>' +
    '<div class="ask-chips"></div>' +
    '<form class="ask-form"><input type="text" autocomplete="off" enterkeyhint="send" aria-label="What are you hungry for?" placeholder="e.g. pizza with mushrooms"><button type="submit">Ask</button></form>' +
    '<p class="ask-foot">Automated helper. Prices and ingredients can change; for allergies, call the shop.</p>';
  document.body.appendChild(fab); document.body.appendChild(panel);
  var dock = document.querySelector(".dock"), dockBtn = null;
  if (dock) {
    dockBtn = el("button", "dock-ask"); dockBtn.type = "button"; dockBtn.innerHTML = fab.innerHTML; dockBtn.setAttribute("aria-label", "Ask Parma: find food on the menu");
    dockBtn.querySelector("span").textContent = "Ask"; dock.appendChild(dockBtn);
    dockBtn.addEventListener("click", function () { open(dockBtn); });
  }
  var log = panel.querySelector(".ask-log"), input = panel.querySelector("input"), form = panel.querySelector("form"), chips = panel.querySelector(".ask-chips");
  ["Pizza with mushrooms", "Feeding 8 people", "Something spicy", "Gluten-free"].forEach(function (c) {
    var b = el("button", null, c); b.type = "button";
    b.addEventListener("click", function () { ask(c); });
    chips.appendChild(b);
  });

  function actions() {
    var box = el("div", "ask-acts");
    var o = el("a", "ask-order", "Order online"); o.href = CFG.order || "#"; o.target = "_blank"; o.rel = "noopener";
    var c = el("a", "ask-call", "Call " + (CFG.phone || "")); c.href = "tel:" + (CFG.tel || "");
    box.appendChild(o); box.appendChild(c);
    return box;
  }
  function say(role, text) { var m = el("div", "ask-m " + role, text); log.appendChild(m); return m; }
  function render(res) {
    var m = say("bot", res.reply || "");
    (res.groups || []).forEach(function (g) {
      if (!g.items || !g.items.length) return;
      var box = el("div", "ask-group");
      if (g.title) box.appendChild(el("h4", null, g.title));
      var ul = el("ul");
      g.items.forEach(function (it) {
        var li = el("li"), top = el("div", "ask-row");
        top.appendChild(el("span", "ask-name", it.name)); top.appendChild(el("span", "ask-price", it.price || ""));
        li.appendChild(top);
        if (it.detail) li.appendChild(el("small", null, it.detail));
        ul.appendChild(li);
      });
      box.appendChild(ul);
      if (g.total) { var t = el("div", "ask-total"); t.appendChild(el("span", null, "Estimated total")); t.appendChild(el("b", null, g.total)); box.appendChild(t); }
      m.appendChild(box);
    });
    if (res.note) m.appendChild(el("p", "ask-note", res.note));
    m.appendChild(actions());
    return m;
  }
  function ask(q) {
    q = String(q || "").trim().slice(0, 300); if (!q) return;
    say("me", q); input.value = "";
    history.push({ role: "user", content: q });
    var wait = say("bot ask-wait", "Looking at the menu...");
    var p = CFG.assistantUrl
      ? fetch(CFG.assistantUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: history.slice(-10) }) })
          .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
          .then(function (j) { if (!j || typeof j.reply !== "string") throw new Error("shape"); return j; })
          .catch(function () { return load().then(function () { return local(q); }); })
      : load().then(function () { return local(q); });
    p.then(function (res) {
      wait.remove();
      var m = render(res);
      history.push({ role: "assistant", content: res.reply });
      m.scrollIntoView({ block: "start", behavior: "smooth" });
    }).catch(function () { wait.textContent = "Something went wrong. Please call the shop at " + (CFG.phone || "") + "."; });
  }
  function open(fromEl) {
    panel.hidden = false; fab.hidden = true; document.documentElement.classList.add("ask-open");
    if (!log.childNodes.length) say("bot", "Hi! Tell me what you're in the mood for, a topping, or how many people you're feeding. I'll pull it from the menu with prices.");
    load();
    setTimeout(function () { input.focus(); }, 30);
    panel._from = fromEl || fab;
  }
  function close() { panel.hidden = true; fab.hidden = false; document.documentElement.classList.remove("ask-open"); if (panel._from) panel._from.focus(); }
  form.addEventListener("submit", function (e) { e.preventDefault(); ask(input.value); });
  fab.addEventListener("click", function () { open(fab); });
  panel.querySelector(".ask-x").addEventListener("click", close);
  panel.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  [].forEach.call(document.querySelectorAll("[data-ask]"), function (b) { b.addEventListener("click", function () { open(b); }); });
  window.AskParma = { open: open, ask: function (q) { open(); ask(q); }, local: function (q) { return load().then(function () { return local(q); }); } };
})();
