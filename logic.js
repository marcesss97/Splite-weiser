/* Ferienkasse: Rechenlogik ohne Seiteneffekte. Alle Beträge sind ganze Zahlen in der kleinsten Einheit der Währung (Rappen, Cent). */
window.FK = (function () {
  "use strict";
  var LOCALE = "de-CH";

  var CATS = [
    { id: "food", label: "Restaurant", emoji: "🍝" },
    { id: "apero", label: "Apéro & Bar", emoji: "🍻" },
    { id: "groceries", label: "Einkauf", emoji: "🛒" },
    { id: "lodging", label: "Unterkunft", emoji: "🏡" },
    { id: "transport", label: "Transport", emoji: "🚗" },
    { id: "mountain", label: "Berg & Ski", emoji: "🏔️" },
    { id: "activity", label: "Aktivitäten", emoji: "🎟️" },
    { id: "shopping", label: "Shopping", emoji: "🛍️" },
    { id: "other", label: "Sonstiges", emoji: "✨" }
  ];
  var CURRENCIES = ["CHF", "EUR", "USD", "GBP", "SEK", "NOK", "DKK", "ISK", "CZK", "PLN", "HUF", "RON", "TRY", "MAD", "EGP", "ZAR", "TZS", "KES", "AED", "THB", "VND", "IDR", "MYR", "SGD", "JPY", "CNY", "HKD", "KRW", "INR", "NPR", "LKR", "AUD", "NZD", "CAD", "MXN", "BRL", "ARS", "CLP", "PEN", "COP", "GEL"];

  function catLabel(id) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i].id === id) return CATS[i].label;
    return "Sonstiges";
  }
  function isCat(id) { return CATS.some(function (c) { return c.id === id; }); }
  function catEmoji(id) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i].id === id) return CATS[i].emoji;
    return "✨";
  }

  /* ---------- Avatare ---------- */
  /* Jede Person hat ein Emoji als Profilbild. In der Reise steht die Kennung (links), nicht das Zeichen selbst: So bleibt alles
     lesbar, auch wenn ein Gerät ein Emoji nicht kennt oder die Auswahl später wächst. Nur Emojis, die es seit 2020 gibt. */
  var AVATARS = [
    { title: "Tiere", items: [
      ["lama", "🦙", "Lama"], ["faultier", "🦥", "Faultier"], ["pinguin", "🐧", "Pinguin"], ["flamingo", "🦩", "Flamingo"], ["oktopus", "🐙", "Oktopus"], ["frosch", "🐸", "Frosch"],
      ["affe", "🐵", "Affe"], ["fuchs", "🦊", "Fuchs"], ["panda", "🐼", "Panda"], ["koala", "🐨", "Koala"], ["igel", "🦔", "Igel"], ["otter", "🦦", "Otter"],
      ["eule", "🦉", "Eule"], ["ente", "🦆", "Ente"], ["huhn", "🐔", "Huhn"], ["kuh", "🐮", "Kuh"], ["geiss", "🐐", "Geiss"], ["hund", "🐶", "Hund"],
      ["katze", "😼", "Katze"], ["hai", "🦈", "Hai"], ["schnecke", "🐌", "Schnecke"], ["dino", "🦖", "Dino"], ["einhorn", "🦄", "Einhorn"], ["drache", "🐲", "Drache"]
    ] },
    { title: "Typen", items: [
      ["cool", "😎", "Sonnenbrille"], ["nerd", "🤓", "Nerd"], ["party", "🥳", "Partylöwe"], ["cowboy", "🤠", "Cowboy"], ["inkognito", "🥸", "Inkognito"], ["geld", "🤑", "Geldgesicht"],
      ["clown", "🤡", "Clown"], ["alien", "👽", "Alien"], ["roboter", "🤖", "Roboter"], ["geist", "👻", "Geist"], ["zombie", "🧟", "Zombie"], ["vampir", "🧛", "Vampir"],
      ["zauberer", "🧙", "Zauberer"], ["ninja", "🥷", "Ninja"], ["held", "🦸", "Superheld"], ["teufel", "😈", "Teufelchen"], ["schaedel", "💀", "Totenkopf"], ["haufen", "💩", "Häufchen"],
      ["moai", "🗿", "Moai"], ["mond", "🌚", "Mondgesicht"], ["sonne", "🌞", "Sonne"], ["schneemann", "⛄", "Schneemann"], ["krone", "👑", "Krone"], ["gehirn", "🧠", "Grosshirn"]
    ] },
    { title: "Essen und Trinken", items: [
      ["pizza", "🍕", "Pizza"], ["avocado", "🥑", "Avocado"], ["kartoffel", "🥔", "Kartoffel"], ["hotdog", "🌭", "Hotdog"], ["taco", "🌮", "Taco"], ["donut", "🍩", "Donut"],
      ["gipfeli", "🥐", "Gipfeli"], ["kaese", "🧀", "Käse"], ["fondue", "🫕", "Fondue"], ["brezel", "🥨", "Brezel"], ["gurke", "🥒", "Gurke"], ["banane", "🍌", "Banane"],
      ["ananas", "🍍", "Ananas"], ["chili", "🌶️", "Chili"], ["pilz", "🍄", "Pilz"], ["glace", "🍦", "Glace"], ["bier", "🍺", "Bier"], ["popcorn", "🍿", "Popcorn"]
    ] },
    { title: "Berge und Ferien", items: [
      ["berg", "🏔️", "Berg"], ["gleitschirm", "🪂", "Gleitschirm"], ["ski", "⛷️", "Skifahrer"], ["snowboard", "🏂", "Snowboard"], ["gondel", "🚠", "Gondel"], ["zelt", "⛺", "Zelt"],
      ["bus", "🚐", "Büssli"], ["kaktus", "🌵", "Kaktus"], ["palme", "🌴", "Palme"], ["rakete", "🚀", "Rakete"], ["ufo", "🛸", "Ufo"], ["regenbogen", "🌈", "Regenbogen"],
      ["ballon", "🎈", "Ballon"], ["diamant", "💎", "Diamant"], ["feuer", "🔥", "Feuer"], ["kompass", "🧭", "Kompass"], ["anker", "⚓", "Anker"], ["wuerfel", "🎲", "Würfel"]
    ] }
  ];
  var AV = Object.create(null), AV_IDS = [];
  AVATARS.forEach(function (g) { g.items.forEach(function (it) { AV[it[0]] = { id: it[0], ch: it[1], label: it[2] }; AV_IDS.push(it[0]); }); });
  function isAvatar(id) { return typeof id === "string" && AV[id] !== undefined; }
  function avatar(id) { return isAvatar(id) ? AV[id] : null; }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  /* Wer noch keins gewählt hat, bekommt eines aus der Kennung der Person: auf allen Geräten dasselbe, ohne dass etwas gespeichert wird. */
  function avatarFor(memberId) { return AV_IDS[hash(String(memberId)) % AV_IDS.length]; }
  /* Ein zufälliges, das in der Gruppe noch niemand hat (solange der Vorrat reicht). */
  function pickAvatar(taken, rnd) {
    var used = Object.create(null);
    (taken || []).forEach(function (id) { used[id] = 1; });
    var free = AV_IDS.filter(function (id) { return !used[id]; }), pool = free.length ? free : AV_IDS;
    return pool[Math.min(pool.length - 1, Math.floor((rnd || Math.random)() * pool.length))];
  }

  /* ---------- Währungen und Zahlen ---------- */
  /* Nachkommastellen je Währung nach ISO 4217, fest hinterlegt. Browser weichen bei einigen Währungen voneinander ab,
     und dann würde derselbe gespeicherte Betrag auf zwei Geräten Verschiedenes bedeuten. Alles Übrige hat zwei Stellen. */
  var DIGITS = {};
  "BIF CLP DJF GNF ISK JPY KMF KRW PYG RWF UGX UYI VND VUV XAF XOF XPF".split(" ").forEach(function (c) { DIGITS[c] = 0; });
  "BHD IQD JOD KWD LYD OMR TND".split(" ").forEach(function (c) { DIGITS[c] = 3; });
  "CLF UYW".split(" ").forEach(function (c) { DIGITS[c] = 4; });
  function digits(cur) { return Object.prototype.hasOwnProperty.call(DIGITS, cur) ? DIGITS[cur] : 2; }
  /* Obergrenzen: weit über jeder Ferienrechnung und weit unter dem, was sich noch auf die kleinste Einheit genau rechnen lässt. */
  var MAX_MINOR = 1e13, MAX_BASE = 1e15, RATE_MIN = 1e-9, RATE_MAX = 1e9;
  var curSet = null;
  function isCurrency(cur) {
    if (typeof cur !== "string" || !/^[A-Z]{3}$/.test(cur)) return false;
    if (curSet === null) {
      try { curSet = {}; Intl.supportedValuesOf("currency").forEach(function (c) { curSet[c] = 1; }); } catch (e) { curSet = false; }
    }
    return curSet ? !!curSet[cur] : CURRENCIES.indexOf(cur) >= 0;
  }
  var curNames = null;
  function curName(cur) {
    try {
      if (curNames === null) curNames = new Intl.DisplayNames(LOCALE, { type: "currency" });
      return curNames.of(cur) || cur;
    } catch (e) { curNames = false; return cur; }
  }
  var nfCache = {};
  function nf(d) { return nfCache[d] || (nfCache[d] = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: d, maximumFractionDigits: d })); }
  function num(minor, cur) { var d = digits(cur); return nf(d).format(Math.abs(minor) / Math.pow(10, d)); }
  function money(minor, cur) { return (minor < 0 ? "−" : "") + cur + "\u00a0" + num(minor, cur); }
  function signed(minor, cur) { return (minor > 0 ? "+" : minor < 0 ? "−" : "") + num(minor, cur); }
  function whole(minor, cur) { return nf(0).format(Math.round(Math.abs(minor) / Math.pow(10, digits(cur)))); }
  function plain(minor, cur) { var d = digits(cur); return (minor / Math.pow(10, d)).toFixed(d); }
  /* Wechselkurs zum Anzeigen und Bearbeiten: sechs gültige Stellen, ohne Zahlenballast */
  function rateText(r) { return r > 0 && isFinite(r) ? String(Number(r.toPrecision(6))) : ""; }

  /* "12.50", "12,50", "1'234.50" und Summen wie "45+12.5" -> kleinste Einheit; null wenn nicht lesbar.
     Punkt und Komma können beides sein. Als Tausendertrennung gelten sie, wenn sie mehrfach vorkommen ("1.234.567"),
     wenn beide vorkommen (dann ist das letzte Zeichen das Komma: "1.234,50"), und wenn genau drei Ziffern folgen
     ("25.000" Dong, "1,500" Yen). Nur bei Währungen mit drei Nachkommastellen bleibt "1.500" eine Kommazahl. */
  function parseOne(s, cur) {
    s = s.replace(/[\s'’`\u00a0\u202f]/g, "");
    var neg = false;
    if (s.charAt(0) === "-" || s.charAt(0) === "\u2212") { neg = true; s = s.slice(1); }
    if (!s || s.length > 30 || !/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
    var d = digits(cur), seps = s.replace(/\d/g, ""), intPart = s, frac = "";
    if (seps) {
      var last = Math.max(s.lastIndexOf(","), s.lastIndexOf(".")), head = s.slice(0, last), tail = s.slice(last + 1);
      var mixed = seps.indexOf(",") >= 0 && seps.indexOf(".") >= 0, group;
      if (mixed) group = false;                                        // das letzte Zeichen ist das Komma
      else if (seps.length > 1) group = true;                          // "1.234.567"
      else group = tail.length === 3 && /^[1-9]\d{0,2}$/.test(head) && d !== 3;
      if (group) {
        if (!/^\d{1,3}([.,]\d{3})+$/.test(s)) return null;            // keine saubere Dreiergruppierung: nicht raten
        intPart = s.replace(/[.,]/g, "");
      } else {
        if (head && !/^\d{1,3}([.,]\d{3})*$/.test(head) && !/^\d+$/.test(head)) return null;
        intPart = head.replace(/[.,]/g, ""); frac = tail;
      }
    }
    var v = Number((intPart || "0") + (frac ? "." + frac : ""));
    if (!isFinite(v)) return null;
    v = Math.round(v * Math.pow(10, d));
    return v > MAX_MINOR ? null : neg ? -v : v;
  }
  function parseAmount(input, cur) {
    if (input == null) return null;
    var parts = String(input).split("+"), sum = 0, any = false;
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i].trim()) { if (parts.length > 1 && i === parts.length - 1) continue; return null; }
      var v = parseOne(parts[i], cur);
      if (v == null) return null;
      sum += v; any = true;
    }
    return any && Math.abs(sum) <= MAX_MINOR ? sum : null;
  }
  function okRate(v) { return typeof v === "number" && isFinite(v) && v >= RATE_MIN && v <= RATE_MAX; }
  function parseRate(input) {
    var s = String(input == null ? "" : input).trim().replace(/[\s'’]/g, "").replace(",", ".");
    if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return null;
    var v = Number(s);
    return okRate(v) ? v : null;
  }
  function toBase(minor, cur, base, rate) {
    if (cur === base) return minor;
    if (!(rate > 0)) return null;
    var v = Math.round(minor / Math.pow(10, digits(cur)) * rate * Math.pow(10, digits(base)));
    return Math.abs(v) <= MAX_BASE ? v : null;
  }

  /* ---------- Datum ---------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function today() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function validDate(iso) {
    if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    var d = dateObj(iso);
    return !isNaN(d) && d.toISOString().slice(0, 10) === iso;
  }
  function dateObj(iso) { var p = iso.split("-"); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function addDays(iso, n) { var d = dateObj(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function dayDiff(a, b) { return Math.round((dateObj(b) - dateObj(a)) / 864e5); }
  function fmtDate(iso, opts) {
    if (!validDate(iso)) return "Ohne Datum";
    var o = { timeZone: "UTC" }; for (var k in opts) o[k] = opts[k];
    return new Intl.DateTimeFormat(LOCALE, o).format(dateObj(iso));
  }
  function dayLabel(iso) { return fmtDate(iso, { weekday: "short", day: "numeric", month: "short" }); }
  function rangeLabel(a, b) {
    if (!a || !b) return "";
    if (a === b) return fmtDate(a, { day: "numeric", month: "short", year: "numeric" });
    var sameMonth = a.slice(0, 7) === b.slice(0, 7);
    var end = fmtDate(b, { day: "numeric", month: "short", year: "numeric" });
    if (sameMonth) return (+a.slice(8)) + ".–" + end;
    return fmtDate(a, { day: "numeric", month: "short" }) + " – " + end;
  }

  /* ---------- Aufteilen ---------- */
  function seedOf(id) { var s = 0, t = String(id || ""); for (var i = 0; i < t.length; i++) s = (s * 31 + t.charCodeAt(i)) % 9973; return s; }

  /* Verteilt `total` proportional zu den Gewichten. Die Summe stimmt immer auf die kleinste Einheit;
     Restrappen gehen an die grössten Bruchteile, bei Gleichstand reihum (über `seed`). */
  function allocate(total, weights, seed) {
    var n = weights.length, W = 0, i;
    for (i = 0; i < n; i++) W += weights[i] > 0 ? weights[i] : 0;
    var out = new Array(n);
    for (i = 0; i < n; i++) out[i] = 0;
    if (!n || !(W > 0) || !total) return out;
    var sign = total < 0 ? -1 : 1, T = Math.abs(total), used = 0, order = [], off = (seed || 0) % n;
    for (i = 0; i < n; i++) {
      if (!(weights[i] > 0)) continue;
      var raw = T * weights[i] / W, fl = Math.floor(raw + 1e-9);
      out[i] = fl; used += fl;
      order.push({ i: i, f: raw - fl, k: (i - off + n) % n });
    }
    order.sort(function (a, b) { return Math.abs(b.f - a.f) > 1e-9 ? b.f - a.f : a.k - b.k; });
    var left = T - used;
    if (!(left >= 0 && left <= order.length)) left = 0;               // nur bei Beträgen jenseits der Rechengenauigkeit
    for (var j = 0; left > 0 && order.length; left--, j = (j + 1) % order.length) out[order[j].i]++;
    if (sign < 0) for (i = 0; i < n; i++) out[i] = -out[i];
    return out;
  }

  function memberIds(trip, all) {
    var m = trip.members || {};
    return Object.keys(m).filter(function (id) { return all || !m[id].gone; }).sort(function (a, b) { return (m[a].o || 0) - (m[b].o || 0) || (a < b ? -1 : 1); });
  }

  /* Gewichte je Person für eine Ausgabe, je nach Aufteilungsart */
  function weights(e, fallbackIds) {
    var w = {}, id, k;
    if (e.mode === "shares" || e.mode === "exact") {
      for (id in (e.weights || {})) if (e.weights[id] > 0) w[id] = e.weights[id];
    } else if (e.mode === "items") {
      (e.items || []).forEach(function (it) {
        var f = it.for || [];
        if (!f.length || !it.amount) return;
        for (k = 0; k < f.length; k++) w[f[k]] = (w[f[k]] || 0) + it.amount / f.length;
      });
      for (id in w) if (!(w[id] > 1e-9)) delete w[id];
    } else {
      (e.for || []).forEach(function (x) { w[x] = 1; });
    }
    if (!Object.keys(w).length) ((e.for && e.for.length) ? e.for : fallbackIds || []).forEach(function (x) { w[x] = 1; });
    return w;
  }

  function rateFor(e, trip) {
    if (e.cur === trip.base) return 1;
    if (e.rate > 0) return e.rate;
    var r = (trip.rates || {})[e.cur];
    return r > 0 ? r : null;
  }

  /* Betrag in Hauptwährung und Anteil je Person. null, wenn ein Wechselkurs fehlt. */
  function shares(e, trip) {
    var total = toBase(e.amount, e.cur, trip.base, rateFor(e, trip));
    if (total == null || !(e.amount > 0)) return null;
    var parts = {};
    if (e.kind === "transfer") { parts[e.to] = total; return { total: total, parts: parts }; }
    var w = weights(e, memberIds(trip)), ids = Object.keys(w).sort();
    var a = allocate(total, ids.map(function (id) { return w[id]; }), seedOf(e.id));
    ids.forEach(function (id, i) { parts[id] = a[i]; });
    return { total: total, parts: parts };
  }

  /* Vorschau der Aufteilung in der Währung der Ausgabe */
  function preview(e, fallbackIds) {
    var w = weights(e, fallbackIds), ids = Object.keys(w).sort(), parts = {};
    var a = allocate(e.amount || 0, ids.map(function (id) { return w[id]; }), seedOf(e.id));
    ids.forEach(function (id, i) { parts[id] = a[i]; });
    return parts;
  }

  function balances(trip, expenses) {
    var per = {}, total = 0, count = 0, missing = 0;
    function p(id) { return per[id] || (per[id] = { paid: 0, share: 0, sent: 0, got: 0, net: 0 }); }
    memberIds(trip).forEach(p);
    (expenses || []).forEach(function (e) {
      var s = shares(e, trip);
      if (!s) { missing++; return; }
      if (e.kind === "transfer") {
        p(e.payer).sent += s.total; p(e.payer).net += s.total;
        p(e.to).got += s.total; p(e.to).net -= s.total;
        return;
      }
      total += s.total; count++;
      p(e.payer).paid += s.total; p(e.payer).net += s.total;
      for (var id in s.parts) { p(id).share += s.parts[id]; p(id).net -= s.parts[id]; }
    });
    return { per: per, total: total, count: count, missing: missing };
  }

  /* ---------- Ausgleich mit möglichst wenigen Zahlungen ---------- */
  var EXACT_MAX = 14;
  function zeroGroups(v) {
    var n = v.length, N = 1 << n, sum = new Float64Array(N), dp = new Int8Array(N), pick = new Int8Array(N);
    for (var m = 1; m < N; m++) {
      var low = m & -m, li = 31 - Math.clz32(low);
      sum[m] = sum[m ^ low] + v[li];
      var best = -1, bi = 0;
      for (var j = 0; j < n; j++) if (m >> j & 1) { var c = dp[m ^ (1 << j)]; if (c > best) { best = c; bi = j; } }
      dp[m] = best + (sum[m] === 0 ? 1 : 0); pick[m] = bi;
    }
    var groups = [], cur = N - 1, g = [];
    while (cur) { var k = pick[cur]; g.push(k); cur ^= 1 << k; if (sum[cur] === 0) { groups.push(g); g = []; } }
    if (g.length) groups.push(g);
    return groups;
  }
  function settle(net) {
    var ids = Object.keys(net).filter(function (id) { return net[id] !== 0; }).sort();
    var out = [], exact = false;
    if (ids.length < 2) return { payments: out, exact: true };
    var groups = [ids], sum = ids.reduce(function (a, id) { return a + net[id]; }, 0);
    if (ids.length <= EXACT_MAX && sum === 0) {
      groups = zeroGroups(ids.map(function (id) { return net[id]; })).map(function (g) { return g.map(function (i) { return ids[i]; }); });
      exact = true;
    }
    function bySize(a, b) { return b.v - a.v || (a.id < b.id ? -1 : 1); }
    groups.forEach(function (g) {
      var deb = [], cre = [];
      g.forEach(function (id) { if (net[id] < 0) deb.push({ id: id, v: -net[id] }); else if (net[id] > 0) cre.push({ id: id, v: net[id] }); });
      while (deb.length && cre.length) {
        deb.sort(bySize); cre.sort(bySize);
        var d = deb[0], c = cre[0], x = Math.min(d.v, c.v);
        out.push({ from: d.id, to: c.id, amount: x });
        d.v -= x; c.v -= x;
        if (!d.v) deb.shift();
        if (!c.v) cre.shift();
      }
    });
    out.sort(function (a, b) { return b.amount - a.amount || (a.from < b.from ? -1 : 1); });
    return { payments: out, exact: exact };
  }
  function netOf(bal) { var n = {}; for (var id in bal.per) n[id] = bal.per[id].net; return n; }

  /* ---------- Statistik ---------- */
  function stats(trip, expenses, memberId) {
    var byCat = {}, byDay = {}, total = 0, count = 0, minD = null, maxD = null;
    (expenses || []).forEach(function (e) {
      if (e.kind === "transfer") return;
      var s = shares(e, trip);
      if (!s) return;
      var v = memberId ? (s.parts[memberId] || 0) : s.total;
      if (memberId && !v) return;
      total += v; count++;
      var c = isCat(e.cat) ? e.cat : "other";
      byCat[c] = (byCat[c] || 0) + v;
      if (validDate(e.date)) {
        byDay[e.date] = (byDay[e.date] || 0) + v;
        if (!minD || e.date < minD) minD = e.date;
        if (!maxD || e.date > maxD) maxD = e.date;
      }
    });
    var cats = CATS.filter(function (c) { return byCat[c.id] > 0; }).map(function (c) { return { id: c.id, label: c.label, amount: byCat[c.id] }; })
      .sort(function (a, b) { return b.amount - a.amount; });
    var days = [];
    if (minD) {
      var span = dayDiff(minD, maxD) + 1;
      if (span <= 62) for (var i = 0; i < span; i++) { var d = addDays(minD, i); days.push({ date: d, amount: byDay[d] || 0 }); }
      else Object.keys(byDay).sort().forEach(function (d) { days.push({ date: d, amount: byDay[d] }); });
    }
    return { total: total, count: count, cats: cats, days: days, first: minD, last: maxD, span: minD ? dayDiff(minD, maxD) + 1 : 0 };
  }

  /* "Schöne" Obergrenze für eine Achse, deren halber Wert ebenfalls rund ist */
  function niceMax(v) {
    if (!(v > 0)) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p;
    var steps = [1, 1.2, 1.6, 2, 3, 4, 5, 6, 8, 10], n = 10;
    for (var i = 0; i < steps.length; i++) if (f <= steps[i] + 1e-9) { n = steps[i]; break; }
    return Math.round(n * p);
  }

  /* ---------- Stempel (Awards) ---------- */
  function awards(trip, expenses, bal) {
    var m = trip.members || {}, base = trip.base, xs = [];
    function name(id) { return (m[id] && m[id].name) || "Unbekannt"; }
    (expenses || []).forEach(function (e) { if (e.kind === "transfer") return; var s = shares(e, trip); if (s) xs.push({ e: e, s: s }); });
    if (xs.length < 3) return [];
    var ids = Object.keys(bal.per).sort(), out = [];
    function top(fn, min) {
      var best = null;
      ids.forEach(function (id) { var v = fn(id); if (v != null && (best == null || (min ? v < best.v : v > best.v))) best = { id: id, v: v }; });
      return best;
    }
    var a = top(function (id) { return bal.per[id].paid || null; });
    if (a) out.push({ id: "spender", emoji: "💸", title: "Spendierhose", who: name(a.id), note: money(a.v, base) + " vorgestreckt" });

    var big = xs.reduce(function (x, y) { return y.s.total > x.s.total ? y : x; });
    out.push({ id: "big", emoji: "🍾", title: "Grösste Runde", who: big.e.title || catLabel(big.e.cat), note: money(big.s.total, base) + ", bezahlt von " + name(big.e.payer) });

    function catShare(cats) {
      var t = {};
      xs.forEach(function (x) { if (cats.indexOf(x.e.cat) < 0) return; for (var id in x.s.parts) t[id] = (t[id] || 0) + x.s.parts[id]; });
      return t;
    }
    var food = catShare(["food", "apero"]), f = top(function (id) { return food[id] || null; });
    if (f) out.push({ id: "gourmet", emoji: "🍝", title: "Feinschmecker", who: name(f.id), note: money(f.v, base) + " für Essen und Apéro" });

    var mount = catShare(["mountain"]), g = top(function (id) { return mount[id] || null; });
    if (g) out.push({ id: "summit", emoji: "🏔️", title: "Gipfelstürmer", who: name(g.id), note: money(g.v, base) + " für Berg und Ski" });

    var withShare = ids.filter(function (id) { return bal.per[id].share > 0; });
    if (withShare.length >= 3) {
      var s = top(function (id) { return bal.per[id].share > 0 ? bal.per[id].share : null; }, true);
      if (s) out.push({ id: "saver", emoji: "🦊", title: "Sparfuchs", who: name(s.id), note: "nur " + money(s.v, base) + " verbraucht" });
    }

    var byWho = {};
    xs.forEach(function (x) { if (x.e.by && m[x.e.by]) byWho[x.e.by] = (byWho[x.e.by] || 0) + 1; });
    var b = top(function (id) { return byWho[id] || null; });
    if (b && b.v >= 2) out.push({ id: "clerk", emoji: "🤓", title: "Buchhalter", who: name(b.id), note: b.v + " Ausgaben erfasst" });

    var byDay = {};
    xs.forEach(function (x) { if (validDate(x.e.date)) byDay[x.e.date] = (byDay[x.e.date] || 0) + x.s.total; });
    var dk = Object.keys(byDay).sort();
    if (dk.length >= 2) {
      var d = dk.reduce(function (x, y) { return byDay[y] > byDay[x] ? y : x; });
      out.push({ id: "day", emoji: "🔥", title: "Teuerster Tag", who: fmtDate(d, { weekday: "long", day: "numeric", month: "long" }), note: money(byDay[d], base) + " an einem Tag" });
    }

    var small = xs.reduce(function (x, y) { return y.s.total < x.s.total ? y : x; });
    if (small !== big) out.push({ id: "small", emoji: "🐜", title: "Kleinvieh", who: small.e.title || catLabel(small.e.cat), note: money(small.s.total, base) + ", macht auch Mist" });
    return out;
  }

  /* ---------- Meme-Karten ---------- */
  /* Sprüche, die fast alle kennen, passend zum Stand der Kasse. Gibt es mehrere passende, entscheiden Reise und Tag: Die Karte
     bleibt also einen Tag lang dieselbe und springt nicht bei jedem Tippen. o: { net, base, count, payments, total, seed, day }.
     net ist der eigene Saldo (oder null, solange niemand gewählt ist), count die Zahl der Ausgaben, payments die Zahl der
     Zahlungen, mit denen alle quitt wären. Ergebnis: { tone, emoji, top, bottom }. */
  function meme(o) {
    o = o || {};
    var base = o.base || "CHF", n = hash(String(o.seed || "") + "|" + String(o.day || today()));
    function one(list) { return list[n % list.length]; }
    function card(tone, emoji, top, bottom) { return { tone: tone, emoji: emoji, top: top, bottom: bottom }; }
    if (!(o.count > 0)) return one([
      card("idle", "🗿", "Noch keine Ausgaben", "Bruh."),
      card("idle", "💀", "Ich, wie ich warte", "bis jemand die erste Runde zahlt"),
      card("idle", "🧙", "One does not simply", "eine Rechnung durch sieben teilen")
    ]);
    if (typeof o.net === "number" && isFinite(o.net)) {
      var amt = money(Math.abs(o.net), base);
      if (o.net > 0) return one([
        card("up", "📈", "Stonks", "Du bekommst " + amt),
        card("up", "🚀", "To the moon", "Du bekommst " + amt),
        card("up", "🖨️", "Money printer go brrr", "Du bekommst " + amt)
      ]);
      if (o.net < 0) return one([
        card("down", "🔥", "This is fine.", "Du schuldest " + amt),
        card("down", "📉", "Not stonks", "Du schuldest " + amt),
        card("down", "💸", "Shut up and take my money!", "Du schuldest " + amt),
        card("down", "⌨️", "Press F to pay", "Du schuldest " + amt)
      ]);
      return one([
        card("even", "⚖️", "Perfectly balanced", "as all things should be"),
        card("even", "🤝", "Du bist quitt", "Much fair. Very wow."),
        card("even", "😎", "Du bist quitt", "Deal with it.")
      ]);
    }
    if (!(o.payments > 0)) return card("even", "⚖️", "Perfectly balanced", "Alle sind quitt");
    return one([
      card("brain", "🧠", "Big brain time", (o.payments === 1 ? "Eine Zahlung" : o.payments + " Zahlungen") + ", und alle sind quitt"),
      card("brain", "🧙", "One does not simply", "im Kopf abrechnen")
    ]);
  }
  /* Für die Statistik: nur wenn das Total eine bekannte Schwelle sprengt. Sonst null. */
  function memeTotal(total, base) {
    var f = Math.pow(10, digits(base || "CHF"));
    return total > 9000 * f ? { tone: "boom", emoji: "💥", top: "It's over 9000!", bottom: "Total " + money(total, base) } : null;
  }

  /* ---------- Text für den Gruppenchat ---------- */
  function summaryText(trip, bal, plan) {
    var m = trip.members || {}, base = trip.base, L = [];
    function name(id) { return (m[id] && m[id].name) || "Unbekannt"; }
    var ids = Object.keys(bal.per).sort(function (a, b) { return bal.per[b].net - bal.per[a].net || (name(a) < name(b) ? -1 : 1); });
    L.push("Ferienkasse «" + (trip.name || "Reise") + "»");
    L.push("Total " + money(bal.total, base) + ", " + memberIds(trip).length + " Personen");
    L.push("");
    if (plan.payments.length) {
      L.push("So sind wir quitt:");
      plan.payments.forEach(function (p) { L.push(name(p.from) + " → " + name(p.to) + ": " + money(p.amount, base)); });
    } else L.push("Alle sind quitt.");
    L.push("");
    L.push("Saldo in " + base + ":");
    ids.forEach(function (id) { L.push(name(id) + " " + signed(bal.per[id].net, base)); });
    return L.join("\n").replace(/\u00a0/g, " ");
  }

  /* ---------- Prüfen vor dem Speichern ---------- */
  function check(e, trip) {
    if (!(e.amount > 0)) return "Gib einen Betrag grösser als null ein.";
    if (e.amount > MAX_MINOR) return "Dieser Betrag ist zu gross für die Ferienkasse.";
    if (!e.payer) return "Wähle, wer bezahlt hat.";
    if (e.kind === "transfer") {
      if (!e.to) return "Wähle, wer das Geld bekommen hat.";
      if (e.to === e.payer) return "Zahlung an sich selbst geht nicht. Wähle zwei verschiedene Personen.";
    } else if (e.mode === "equal" || e.mode === "items") {
      if (!(e.for && e.for.length)) return "Wähle mindestens eine Person, die mitzahlt.";
    } else if (e.mode === "shares") {
      if (!Object.keys(e.weights || {}).length) return "Gib mindestens einer Person einen Anteil.";
    } else if (e.mode === "exact") {
      var sum = 0; for (var id in (e.weights || {})) sum += e.weights[id];
      if (sum !== e.amount) return "Die Beträge ergeben " + money(sum, e.cur) + ", die Ausgabe ist " + money(e.amount, e.cur) + ". Verteile die Differenz von " + money(Math.abs(e.amount - sum), e.cur) + ".";
    }
    if (e.cur !== trip.base && !(rateFor(e, trip) > 0)) return "Gib den Wechselkurs für " + e.cur + " ein.";
    if (!validDate(e.date)) return "Wähle ein Datum.";
    return null;
  }

  /* ---------- Gespeicherte Dokumente lesen ---------- */
  /* Der Speicher ist geteilt: jedes Feld prüfen, bevor damit gerechnet wird. Unbrauchbares ergibt null. */
  function text(v, max) { return typeof v === "string" ? v.slice(0, max) : ""; }
  /* Kennungen von Personen: nur schlichte Zeichen und nie der Name einer eingebauten Eigenschaft wie "__proto__" oder "constructor".
     Sie dienen überall als Schlüssel in Tabellen; eine präparierte Kennung dürfte sonst die Rechnung durcheinanderbringen. */
  function okId(v) { return typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(v) && !(v in Object.prototype); }
  function idList(v) { return Array.isArray(v) ? v.slice(0, 400).filter(okId) : []; }
  function posNum(v) { return typeof v === "number" && isFinite(v) && v > 0; }
  function num0(v) { return typeof v === "number" && isFinite(v) ? v : 0; }
  function normTrip(id, d) {
    if (!d || typeof d !== "object" || typeof d.name !== "string" || typeof d.base !== "string" || !/^[A-Z]{3}$/.test(d.base)) return null;
    var members = {}, rates = {}, k, m;
    if (d.members && typeof d.members === "object") for (k in d.members) {
      m = d.members[k];
      if (m && typeof m === "object" && okId(k)) members[k] = { name: text(m.name, 60).trim() || "?", c: Math.abs(Math.round(num0(m.c))) % 1000, o: num0(m.o), gone: !!m.gone, a: isAvatar(m.a) ? m.a : "" };
    }
    if (d.rates && typeof d.rates === "object") for (k in d.rates) if (okRate(d.rates[k]) && /^[A-Z]{3}$/.test(k)) rates[k] = d.rates[k];
    return { id: id, name: text(d.name, 80).trim() || "Reise", base: d.base, rates: rates, members: members, created: num0(d.created) };
  }
  function normExpense(id, d) {
    if (!d || typeof d !== "object" || !posNum(d.amount) || typeof d.cur !== "string" || !/^[A-Z]{3}$/.test(d.cur)) return null;
    if (!(Math.round(d.amount) >= 1 && d.amount <= MAX_MINOR)) return null;
    if (!okId(d.payer)) return null;
    var e = { id: id, kind: d.kind === "transfer" ? "transfer" : "expense", title: text(d.title, 120), amount: Math.round(d.amount), cur: d.cur,
      rate: okRate(d.rate) ? d.rate : null, rateAuto: d.rateAuto === true, rateDate: validDate(d.rateDate) ? d.rateDate : "",
      date: validDate(d.date) ? d.date : "", cat: isCat(d.cat) ? d.cat : "other", payer: d.payer,
      by: okId(d.by) ? d.by : null, ts: num0(d.ts), up: num0(d.up) };
    if (e.kind === "transfer") { if (!okId(d.to)) return null; e.to = d.to; return e; }
    e.mode = ["equal", "shares", "exact", "items"].indexOf(d.mode) >= 0 ? d.mode : "equal";
    e.for = idList(d.for);
    if (e.mode === "shares" || e.mode === "exact") {
      e.weights = {};
      if (d.weights && typeof d.weights === "object") for (var k in d.weights) if (okId(k) && posNum(d.weights[k]) && d.weights[k] <= MAX_MINOR) e.weights[k] = d.weights[k];
    }
    if (e.mode === "items") e.items = (Array.isArray(d.items) ? d.items : []).filter(function (it) { return it && typeof it === "object"; }).slice(0, 80).map(function (it) {
      return { name: text(it.name, 80), amount: typeof it.amount === "number" && isFinite(it.amount) && Math.abs(it.amount) <= MAX_MINOR ? Math.round(it.amount) : 0, for: idList(it.for) };
    });
    return e;
  }

  return {
    CATS: CATS, CURRENCIES: CURRENCIES, catLabel: catLabel, isCat: isCat,
    digits: digits, isCurrency: isCurrency, curName: curName, num: num, money: money, signed: signed, whole: whole, plain: plain, rateText: rateText,
    parseAmount: parseAmount, parseRate: parseRate, toBase: toBase,
    today: today, validDate: validDate, addDays: addDays, dayDiff: dayDiff, fmtDate: fmtDate, dayLabel: dayLabel, rangeLabel: rangeLabel,
    allocate: allocate, memberIds: memberIds, weights: weights, rateFor: rateFor, shares: shares, preview: preview,
    balances: balances, settle: settle, netOf: netOf, stats: stats, niceMax: niceMax, awards: awards,
    summaryText: summaryText, check: check, normTrip: normTrip, normExpense: normExpense,
    catEmoji: catEmoji, AVATARS: AVATARS, isAvatar: isAvatar, avatar: avatar, avatarFor: avatarFor, pickAvatar: pickAvatar, meme: meme, memeTotal: memeTotal, EXACT_MAX: EXACT_MAX, MAX_MINOR: MAX_MINOR
  };
})();
