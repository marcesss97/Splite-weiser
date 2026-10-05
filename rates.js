/* Ferienkasse: Tageskurse.
   Quelle 1: Frankfurter (api.frankfurter.dev) mit den Referenzkursen der Europäischen Zentralbank, neu an jedem Bankwerktag gegen 16 Uhr.
   Quelle 2: dieselbe Schnittstelle mit dem Mittel vieler Zentralbanken, für Währungen ohne EZB-Kurs.
   Quelle 3: currency-api über jsDelivr, falls Frankfurter nicht erreichbar ist.
   Jeder geholte Kurs wird auf dem Gerät gemerkt. Ohne Netz gilt der letzte bekannte Kurs, und von Hand geht es immer. */
window.FKRates = (function () {
  "use strict";
  var FK = window.FK, KEY = "fk.rates", cache = load(), inflight = {};
  var PATIENCE = 6000, WINDOW = 10;

  function load() { try { var v = JSON.parse(localStorage.getItem(KEY) || "{}"); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch (e) { return {}; } }
  function persist() {
    var keys = Object.keys(cache);
    if (keys.length > 300) keys.sort(function (a, b) { return (cache[a].t || 0) - (cache[b].t || 0); }).slice(0, keys.length - 300).forEach(function (k) { delete cache[k]; });
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { /* dann eben nur für diese Sitzung */ }
  }
  function round(r) { return Number(r.toPrecision(6)); }
  function good(r) { return typeof r === "number" && isFinite(r) && r >= 1e-9 && r <= 1e9; }
  /* Holt JSON und gibt nach PATIENCE Millisekunden auf, auch wenn die Antwort mittendrin stecken bleibt.
     Antwortet der Server mit einem Fehler, trägt die Ausnahme dessen Nummer (http). */
  function getJson(url) {
    var c = new AbortController(), t = setTimeout(function () { c.abort(); }, PATIENCE);
    function done(v) { clearTimeout(t); return v; }
    function fail(e) { clearTimeout(t); throw e; }
    return fetch(url, { signal: c.signal }).then(function (res) {
      if (!res.ok) { var e = new Error("HTTP " + res.status); e.http = res.status; throw e; }
      return res.json();
    }).then(done, fail);
  }

  /* Zeitfenster von zehn Tagen bis zum gewünschten Datum: Wochenenden und Feiertage liefern so den letzten Kurs davor.
     Gezählt wird nur eine Zeile, die genau dieses Währungspaar nennt und im Fenster liegt. */
  function frankfurter(from, to, date, ecbOnly) {
    var first = FK.addDays(date, -WINDOW);
    var url = "https://api.frankfurter.dev/v2/rates?base=" + from.toLowerCase() + "&quotes=" + to.toLowerCase() +
      "&from=" + first + "&to=" + date + (ecbOnly ? "&providers=ECB" : "");
    return getJson(url).then(function (rows) {
      if (!Array.isArray(rows)) throw new Error("unexpected answer");
      var best = null;
      rows.forEach(function (r) {
        if (!r || !good(r.rate) || !FK.validDate(r.date) || r.date > date || r.date < first) return;
        if (String(r.base).toUpperCase() !== from || String(r.quote).toUpperCase() !== to) return;
        if (!best || r.date > best.date) best = r;
      });
      return best ? { rate: best.rate, date: best.date, source: ecbOnly ? "EZB" : "Zentralbanken" } : null;
    });
  }
  function currencyApi(from, to, date) {
    var f = from.toLowerCase(), q = to.toLowerCase(), tag = date >= FK.today() ? "latest" : date;
    return getJson("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@" + tag + "/v1/currencies/" + f + ".min.json").then(function (j) {
      var r = j && j[f] && j[f][q];
      return good(r) ? { rate: r, date: FK.validDate(j.date) && j.date <= date ? j.date : date, source: "currency-api" } : null;
    });
  }
  /* Reihenfolge: EZB-Reihe; kennt sie die Währung nicht (leere Antwort oder Fehler 4xx), das Mittel der Zentralbanken;
     ist Frankfurter gar nicht erreichbar, die zweite Quelle. */
  function fetchRate(from, to, date) {
    return frankfurter(from, to, date, true)
      .catch(function (e) { if (e && e.http >= 400 && e.http < 500) return null; throw e; })
      .then(function (r) { return r || frankfurter(from, to, date, false); })
      .catch(function () { return null; })
      .then(function (r) { return r || currencyApi(from, to, date).catch(function () { return null; }); });
  }

  function newest(from, to) {
    var prefix = from + ">" + to + "@", best = null;
    Object.keys(cache).forEach(function (k) { if (k.indexOf(prefix) === 0 && good(cache[k].r) && (!best || cache[k].d > best.d)) best = cache[k]; });
    return best;
  }
  function out(entry, stale) { return { rate: entry.r, date: entry.d, source: entry.s || "", stale: !!stale }; }
  /* Darf ein gemerkter Kurs ohne Nachfrage gelten?
     Ja, wenn er genau von diesem Tag stammt; oder wenn er geholt wurde, als der Tag vorbei war (dann kommt für diesen Tag
     kein neuerer mehr, etwa am Wochenende); oder wenn die letzte Nachfrage keine zwei Stunden her ist.
     Sonst würde der Kurs vom Vortag, am Morgen geholt, für immer als Kurs dieses Tages gelten.
     Ein Kurs aus der Ersatzquelle gilt nur für diese zwei Stunden: danach wird wieder die erste Quelle gefragt. */
  function settled(hit, date) {
    if (!hit || !good(hit.r)) return false;
    var t = hit.t || 0;
    if (Date.now() - t < 2 * 3600e3) return true;
    return hit.s !== "currency-api" && (hit.d === date || t >= Date.parse(date + "T00:00:00Z") + 864e5);
  }

  /* Kurs "1 from = x to" für ein Datum. Ergebnis: { rate, date, source, stale } oder null, wenn gar nichts bekannt ist. */
  function get(from, to, date) {
    var today = FK.today();
    if (!FK.validDate(date) || date > today) date = today;
    if (from === to) return Promise.resolve({ rate: 1, date: date, source: "", stale: false });
    var k = from + ">" + to + "@" + date, hit = cache[k];
    if (settled(hit, date)) return Promise.resolve(out(hit, false));
    if (inflight[k]) return inflight[k];
    inflight[k] = fetchRate(from, to, date).then(function (r) {
      delete inflight[k];
      if (r) { cache[k] = { r: round(r.rate), d: r.date, s: r.source, t: Date.now() }; persist(); return out(cache[k], false); }
      var old = hit && good(hit.r) ? hit : newest(from, to);
      return old ? out(old, true) : null;
    }, function () { delete inflight[k]; return null; });
    return inflight[k];
  }

  return { get: get };
})();
