/* Ferienkasse: Oberfläche. Speichert über FKStore (dieses Gerät oder Gruppen-Sync), holt Tageskurse über FKRates. */
(function () {
  "use strict";
  var root = document.getElementById("app"), P = window.htmPreact, FK = window.FK, Store = window.FKStore, Rates = window.FKRates;
  if (!P || !FK || !Store || !Rates) {
    var bs = document.getElementById("boot-status");
    if (bs) bs.textContent = "Die Ferienkasse konnte nicht geladen werden. Prüf die Verbindung und lade die Seite neu.";
    return;
  }
  const { html, render, useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, useErrorBoundary } = P;
  /* Earlier versions could read receipts with a key of the user's own. That is gone; a key still stored on this device is removed. */
  try { localStorage.removeItem("fk.ai"); } catch (e) { /* nothing stored */ }

  /* ---------- small helpers ---------- */
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage is optional */ } }
  };
  const newId = () => Store.randomId(10, "k");
  const expenseId = () => "x" + Date.now().toString(36) + Store.randomId(5);
  const clean = o => JSON.parse(JSON.stringify(o));
  const initials = name => {
    const w = String(name || "?").trim().split(/\s+/).filter(Boolean);
    if (!w.length) return "?";
    const s = w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2);
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const GHOST = id => ({ id, name: "Unbekannt", c: 7, o: 999, gone: true, a: "geist" });
  /* a: the avatar. Whoever has not chosen one gets one derived from the member's id, the same on every device;
     chosen tells the two apart. */
  function membersOf(trip, all) {
    const m = trip.members || {};
    return FK.memberIds(trip, all).map(id => ({ id, name: m[id].name || "?", c: m[id].c || 0, o: m[id].o || 0, gone: !!m[id].gone, a: m[id].a || FK.avatarFor(id), chosen: !!m[id].a }));
  }
  const COLOR_NAMES = ["Blau", "Orange", "Türkis", "Gelb", "Rosa", "Grün", "Violett", "Rot"];
  /* A picture for a trip in the list, the same on every start: picked by the trip's id. */
  const TRIP_EMOJI = ["🏝️", "🏔️", "🚐", "⛵", "🏕️", "🎿", "🌋", "🗺️", "🚲", "🏖️", "✈️", "🚂"], TRIP_TINT = ["k-lodging", "k-mountain", "k-transport", "k-groceries", "k-activity", "k-shopping", "k-food", "k-apero"];
  function hashOf(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function refsOf(e) {
    const s = new Set();
    if (e.payer) s.add(e.payer);
    if (e.to) s.add(e.to);
    (e.for || []).forEach(id => s.add(id));
    Object.keys(e.weights || {}).forEach(id => s.add(id));
    (e.items || []).forEach(it => (it.for || []).forEach(id => s.add(id)));
    return s;
  }
  function fileName(name) {
    const slug = String(name || "").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return "ferienkasse-" + (slug || "reise") + "-" + FK.today() + ".json";
  }
  const FAIL = {
    storage: "Speichern auf diesem Gerät ist nicht möglich. Der Browser-Speicher ist voll oder gesperrt (privater Modus?).",
    "permission-denied": "Der Gruppen-Sync hat das Speichern abgelehnt. Prüf in Firebase die Sicherheitsregeln (siehe README).",
    "resource-exhausted": "Das Tageskontingent des Gruppen-Syncs ist aufgebraucht. Morgen geht es weiter.",
    "not-found": "Diese Reise gibt es nicht mehr.",
    gone: "Diese Reise gibt es auf diesem Gerät nicht mehr.",
    unconfigured: "Auf dieser Installation ist kein Gruppen-Sync eingerichtet.",
    "setup-db": "Im Firebase-Projekt gibt es noch keine Firestore-Datenbank. Die Schritte stehen im README, Abschnitt «Gruppen-Sync einrichten».",
    "invalid-argument": "Firebase lehnt die Angaben aus config.js ab. Prüf den Gruppen-Sync in den Einstellungen mit «Verbindung prüfen».",
    unauthenticated: "Firebase lehnt die Angaben aus config.js ab. Prüf den Gruppen-Sync in den Einstellungen mit «Verbindung prüfen».",
    "failed-precondition": "Firebase lehnt die Angaben aus config.js ab. Prüf den Gruppen-Sync in den Einstellungen mit «Verbindung prüfen».",
    aborted: "Das Freigeben wurde abgebrochen, weil sich die Reise dabei laufend geändert hat. Versuch es nochmal.",
    internal: "Beim Gruppen-Sync ist etwas durcheinandergeraten. Lade die Seite neu und versuch es nochmal.",
    unavailable: "Keine Verbindung zum Gruppen-Sync. Prüf dein Netz und versuch es nochmal.",
    timeout: "Das hat zu lange gedauert. Prüf dein Netz und versuch es nochmal."
  };

  /* ---------- icons ---------- */
  const IC = {
    plus: ["M12 5v14M5 12h14"],
    back: ["M15 5l-7 7 7 7"],
    next: ["M9 5l7 7-7 7"],
    close: ["M6 6l12 12M18 6L6 18"],
    check: ["M5 12.5l4.5 4.5L19 7"],
    arrow: ["M5 12h14M13 6l6 6-6 6"],
    sliders: ["M4 7h9M17 7h3M4 17h3M11 17h9", "M13 7a2 2 0 1 0 4 0a2 2 0 1 0-4 0", "M7 17a2 2 0 1 0 4 0a2 2 0 1 0-4 0"],
    copy: ["M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1z", "M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"],
    trash: ["M4 7h16M9 7V4.5h6V7M6.5 7l.8 12a1 1 0 0 0 1 .9h7.4a1 1 0 0 0 1-.9l.8-12M10 11v5M14 11v5"],
    swap: ["M4 8h14l-3-3M20 16H6l3 3"],
    user: ["M8.5 8a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0", "M5 20c.5-3.5 3.2-5.5 7-5.5s6.5 2 7 5.5"],
    other: ["M4.8 12a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0", "M10.8 12a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0", "M16.8 12a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0"],
    share: ["M12 15V4M8 7.5l4-4 4 4", "M7 11H5.5a1 1 0 0 0-1 1v7.5a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V12a1 1 0 0 0-1-1H17"],
    link: ["M10 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1", "M14 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"],
    people: ["M5.5 8a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0-6.4 0", "M2.5 19.5c.4-3.2 2.7-5 6.2-5s5.8 1.8 6.2 5", "M15.5 5.1a3.2 3.2 0 0 1 0 5.8M17.5 14.8c2.2.6 3.6 2.1 4 4.7"],
    device: ["M8 3.5h8a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z", "M11 17.5h2"],
    offline: ["M7 18.5a4.5 4.5 0 0 1-.6-8.96 6 6 0 0 1 11.5 1.5A3.8 3.8 0 0 1 17.5 18.5H7z", "M4 4l16 16"],
    download: ["M12 4v11M8 11.5l4 4 4-4M5 19.5h14"],
    upload: ["M12 15.5V4.5M8 8l4-4 4 4M5 19.5h14"],
    refresh: ["M19.5 9A8 8 0 1 0 20 13.5", "M20 4.5V9h-4.5"],
    pen: ["M4 20l1-4.5L16.2 4.3a1.6 1.6 0 0 1 2.3 0l1.2 1.2a1.6 1.6 0 0 1 0 2.3L8.5 19 4 20z", "M14.5 6l3.5 3.5"]
  };
  function Icon({ n, s }) {
    const size = s || 20;
    return html`<svg class="ic" width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(IC[n] || IC.other).map(d => html`<path d=${d} />`)}</svg>`;
  }
  /* s: 1 small, 2 large, 3 extra large. */
  function Av({ m, s }) {
    const av = FK.avatar(m.a), size = s === 1 ? " av-s" : s === 2 ? " av-l" : s === 3 ? " av-xl" : "";
    return html`<span class=${"av c" + ((m.c || 0) % 8 + 1) + size + (av ? " em" : "")} aria-hidden="true">${av ? av.ch : initials(m.name)}</span>`;
  }
  /* A meme card: a saying nearly everybody knows, in big white capitals above and below a picture. */
  function Meme({ m }) {
    return html`
      <figure class=${"meme t-" + m.tone}>
        <p class="meme-t">${m.top}</p>
        <span class="meme-e" aria-hidden="true">${m.emoji}</span>
        <p class="meme-t">${m.bottom}</p>
      </figure>`;
  }
  /* Confetti for a few seconds. Not for people who have asked their device for less motion. */
  function Confetti() {
    const [on, setOn] = useState(() => { try { return !window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } });
    const bits = useMemo(() => Array.from({ length: 30 }, (_, i) => ({ l: Math.random() * 100, d: Math.random() * 0.9, r: Math.round(Math.random() * 360), c: i % 6 })), []);
    useEffect(() => { const t = setTimeout(() => setOn(false), 3800); return () => clearTimeout(t); }, []);
    if (!on) return null;
    return html`<div class="confetti" aria-hidden="true">${bits.map((b, i) => html`<i key=${i} class=${"cf" + b.c} style=${"left:" + b.l.toFixed(1) + "%;animation-delay:" + b.d.toFixed(2) + "s;--r:" + b.r + "deg"}></i>`)}</div>`;
  }

  const SLOW = "Das Speichern dauert länger als sonst. Prüf deine Verbindung.";
  function useSlow(busy) {
    const [slow, setSlow] = useState(false);
    useEffect(() => { if (!busy) { setSlow(false); return; } const t = setTimeout(() => setSlow(true), 7000); return () => clearTimeout(t); }, [busy]);
    return slow;
  }

  /* ---------- sheet shell ---------- */
  function Sheet({ title, onClose, action, closeLabel, error, children }) {
    const ref = useRef(null);
    useLayoutEffect(() => {
      const prev = document.activeElement;
      const el = ref.current && ref.current.querySelector("[data-autofocus]");
      if (el) el.focus();
      return () => { try { if (prev && prev.focus) prev.focus(); } catch (e) { /* element is gone */ } };
    }, []);
    useLayoutEffect(() => {                                           // at once, not a frame later: the key works as soon as the sheet is there
      const onKey = e => { if (e.key === "Escape") onClose(); };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);
    return html`
      <div class="scrim" onMouseDown=${e => { if (e.target === e.currentTarget) onClose(); }}>
        <div class="sheet" role="dialog" aria-modal="true" aria-label=${title} ref=${ref}>
          <div class="sheet-head">
            <button type="button" class="btn ghost small" onClick=${onClose}>${closeLabel || "Abbrechen"}</button>
            <h2>${title}</h2>
            <div>${action}</div>
          </div>
          ${error && html`<p class="sheet-err" role="alert">${error}</p>`}
          <div class="sheet-body">${children}</div>
        </div>
      </div>`;
  }
  function DeleteButton({ label, onConfirm, disabled }) {
    const [armed, setArmed] = useState(false);
    useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);
    return html`<button type="button" class="btn danger block" disabled=${disabled} onClick=${() => { if (armed) onConfirm(); else setArmed(true); }}>
      <${Icon} n="trash" s=${18} />${armed ? "Wirklich löschen? Nochmal tippen" : label}
    </button>`;
  }
  function CurSelect({ id, value, trip, onChange, cls, label, disabled }) {
    const known = [];
    if (trip) { known.push(trip.base); Object.keys(trip.rates || {}).sort().forEach(c => { if (known.indexOf(c) < 0) known.push(c); }); }
    if (value && known.indexOf(value) < 0) known.push(value);
    const rest = FK.CURRENCIES.filter(c => known.indexOf(c) < 0);
    return html`<select id=${id} class=${"select " + (cls || "")} aria-label=${label || "Währung"} value=${value} disabled=${!!disabled} onChange=${e => onChange(e.target.value)}>
      ${known.map(c => html`<option value=${c}>${c}</option>`)}
      ${known.length > 0 && html`<option disabled value="">──────</option>`}
      ${rest.map(c => html`<option value=${c}>${c}</option>`)}
    </select>`;
  }
  /* ---------- daily rate ---------- */
  const SRC = { EZB: "Referenzkurs der EZB", Zentralbanken: "Mittel aus Zentralbank-Kursen", "currency-api": "Quelle currency-api" };
  function rateFields(d) {
    const auto = d.rateMode === "auto" && !!(d.rateInfo && d.rateInfo.date);
    return { rate: FK.parseRate(d.rateStr), rateAuto: auto, rateDate: auto ? d.rateInfo.date : "" };
  }
  /* The rate follows currency and date until someone types into the field. An existing booking keeps its stored rate
     unless its currency or date changes. */
  function useRate(trip, d, set, original) {
    const [busy, setBusy] = useState(false);
    const seq = useRef(0), last = useRef(original ? original.cur + "@" + original.date : null);
    const base = trip.base, known = trip.rates || {};
    const load = (cur, date) => {
      const n = ++seq.current;
      setBusy(true);
      Rates.get(cur, base, date).then(r => r, () => null).then(r => {
        if (seq.current !== n) return;
        setBusy(false);
        set(prev => {
          if (prev.cur !== cur || prev.rateMode !== "auto") return {};
          if (r) return { rateStr: FK.rateText(r.rate), rateInfo: { date: r.date, source: r.source, stale: !!r.stale } };
          if (prev.rateStr) return { rateInfo: { failed: true, kept: true } };
          return known[cur] > 0 ? { rateStr: FK.rateText(known[cur]), rateInfo: { failed: true, kept: true } } : { rateInfo: { failed: true } };
        });
      });
    };
    useEffect(() => {
      if (d.cur === base) { last.current = null; return; }
      const key = d.cur + "@" + d.date;
      if (key === last.current) return;
      last.current = key;
      if (d.rateMode === "auto" && FK.validDate(d.date)) load(d.cur, d.date);
    }, [d.cur, d.date, d.rateMode, base]);
    const refresh = () => { last.current = d.cur + "@" + d.date; set({ rateMode: "auto", rateInfo: null }); load(d.cur, d.date); };
    /* Wer den Kurs von Hand eintippt, muss nicht auf die Antwort warten. */
    return { busy: busy && d.rateMode === "auto", refresh };
  }
  function RateField({ cur, base, d, busy, onValue, onRefresh }) {
    const info = d.rateInfo;
    let text;
    if (busy) text = "Tageskurs wird geladen …";
    else if (d.rateMode === "auto" && info && info.date) text = (info.stale ? "Ohne Netz: letzter bekannter Tageskurs vom " : "Tageskurs vom ") + FK.fmtDate(info.date, { day: "numeric", month: "short", year: "numeric" }) + (SRC[info.source] ? ", " + SRC[info.source] : "") + ".";
    else if (info && info.failed) text = info.kept ? "Kein Tageskurs erreichbar. Eingesetzt ist der letzte bekannte Kurs, prüf ihn kurz." : "Kein Tageskurs erreichbar. Trag den Kurs von Hand ein.";
    else text = "Von Hand eingetragen.";
    const offer = !busy && (d.rateMode !== "auto" || !info || info.failed || info.stale);
    return html`
      <div class="field">
        <label for="fk-rate">Wechselkurs</label>
        <div class="rate-row">
          <span class="m">1 ${cur} =</span>
          <input id="fk-rate" class="input" inputmode="decimal" autocomplete="off" placeholder=${busy ? "…" : "Kurs eingeben"} value=${d.rateStr} onInput=${e => onValue(e.target.value)} />
          <span class="m">${base}</span>
        </div>
        <p class="hint" role="status">${text}</p>
        ${offer && html`<div><button type="button" class="btn small" onClick=${onRefresh}><${Icon} n="refresh" s=${16} />Tageskurs einsetzen</button></div>`}
      </div>`;
  }
  function Qr({ text }) {
    const rows = useMemo(() => { try { return window.FKQR.matrix(text); } catch (e) { return null; } }, [text]);
    if (!rows) return null;
    const n = rows.length, q = 4;
    let d = "";
    rows.forEach((row, y) => row.forEach((on, x) => { if (on) d += "M" + (x + q) + " " + (y + q) + "h1v1h-1z"; }));
    return html`<svg class="qr" viewBox=${"0 0 " + (n + 2 * q) + " " + (n + 2 * q)} role="img" aria-label="QR-Code mit dem Einladungslink" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff" /><path d=${d} fill="#000" /></svg>`;
  }

  /* ---------- as an app on the home screen ---------- */
  /* Browsers on Android and on the desktop hand over an install offer that may be shown on a tap. The iPhone has no such
     thing: there the way leads through the share menu, and the installed app starts with a storage of its own. */
  let installOffer = null;
  const installSubs = new Set();
  const installChanged = () => { installSubs.forEach(f => { try { f(); } catch (e) { /* a listener that is gone */ } }); };
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installOffer = e; installChanged(); });
  window.addEventListener("appinstalled", () => { installOffer = null; installChanged(); });
  function isStandalone() {
    try { return navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches; } catch (e) { return false; }
  }
  function isIos() {
    const ua = navigator.userAgent || "";
    return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  }
  function useInstallOffer() {
    const [, bump] = useState(0);
    useEffect(() => { const f = () => bump(n => n + 1); installSubs.add(f); return () => { installSubs.delete(f); }; }, []);
    return installOffer;
  }
  /* Shows the browser's own install dialog. An offer can be used once. */
  function runInstall() {
    const offer = installOffer;
    if (!offer) return;
    installOffer = null; installChanged();
    try { offer.prompt(); } catch (e) { /* the browser has withdrawn the offer */ }
  }
  /* The hint on the start page, and as one line (slim) in a trip. It goes away for good once it is closed; the guide stays in the settings. */
  function InstallHint({ onHow, slim }) {
    const offer = useInstallOffer();
    const [off, setOff] = useState(() => !!ls.get("fk.install.off", false));
    const kind = off || isStandalone() ? null : offer ? "offer" : isIos() ? "ios" : null;
    if (!kind) return null;
    const hide = () => { ls.set("fk.install.off", true); setOff(true); };
    if (slim) return html`
      <section class="tip slim" aria-label="Als App installieren">
        <button type="button" class="tip-go" onClick=${kind === "offer" ? runInstall : onHow}><span class="emo" aria-hidden="true">📲</span><span>Als App installieren</span><${Icon} n="next" s=${16} /></button>
        <button type="button" class="icon-btn" aria-label="Hinweis ausblenden" onClick=${hide}><${Icon} n="close" s=${18} /></button>
      </section>`;
    return html`
      <section class="tip" aria-label="Als App installieren">
        <span class="x-ic k-apero" aria-hidden="true">📲</span>
        <div class="tip-body">
          <strong>Als App installieren</strong>
          <p>Dann startet die Ferienkasse vom ${kind === "ios" ? "Home-Bildschirm" : "Startbildschirm"}: im Vollbild, ohne Browser-Leisten und auch ohne Netz.</p>
          ${kind === "offer"
            ? html`<button type="button" class="btn primary small" onClick=${runInstall}><${Icon} n="download" s=${16} />Installieren</button>`
            : html`<button type="button" class="btn primary small" onClick=${onHow}>So geht es</button>`}
        </div>
        <button type="button" class="icon-btn" aria-label="Hinweis ausblenden" onClick=${hide}><${Icon} n="close" /></button>
      </section>`;
  }
  /* link: the invitation of the open trip, if it is a shared one. hasCloud, hasLocal: what this device has to take along. */
  function InstallSheet({ link, hasCloud, hasLocal, onClose, say }) {
    const offer = useInstallOffer();
    const [shown, setShown] = useState(false);
    const ios = isIos(), ua = navigator.userAgent || "";
    /* Other browsers on the iPhone and the windows inside chat apps have the share button elsewhere, or no such entry at all. */
    const safari = /Version\/[\d.]+.*Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    const copy = () => {
      const no = () => setShown(true);
      try { navigator.clipboard.writeText(link).then(() => say("Link kopiert. In der App fügst du ihn bei «Mit Link beitreten» ein."), no); } catch (e) { no(); }
    };
    if (isStandalone()) return html`
      <${Sheet} title="Als App installieren" onClose=${onClose} closeLabel="Fertig">
        <p class="ok">Die Ferienkasse läuft bereits als App.</p>
      <//>`;
    return html`
      <${Sheet} title="Als App installieren" onClose=${onClose} closeLabel="Fertig">
        <p class="lead">Als App startet die Ferienkasse vom ${ios ? "Home-Bildschirm" : "Startbildschirm"}: im Vollbild, ohne Browser-Leisten und auch ohne Netz.</p>
        ${ios ? html`
          ${(hasCloud || hasLocal) && html`
            <div class="note"><${Icon} n="device" /><div class="stack">
              <p><strong>Vorher: Reisen mitnehmen.</strong> Auf iPhone und iPad hat die App einen eigenen Speicher und beginnt leer.</p>
              ${hasCloud && html`<p>Eine geteilte Reise holst du in der App mit dem Einladungslink wieder hinein, über «Mit Link beitreten».</p>`}
              ${link && html`<div><button type="button" class="btn small" onClick=${copy}><${Icon} n="copy" s=${16} />Link dieser Reise kopieren</button></div>`}
              ${link && shown && html`<input class="input linkbox" readonly aria-label="Einladungslink" value=${link} onFocus=${e => e.target.select()} />`}
              ${hasLocal && html`<p>Eine Reise, die nur auf diesem Gerät liegt, sicherst du vorher: in der Reise unter «Reise bearbeiten» die Sicherung herunterladen. In der App liest du sie in den Einstellungen wieder ein.</p>`}
            </div></div>`}
          <ol class="steps">
            <li><div class="step"><strong>${safari ? "In Safari auf «Teilen» tippen" : "Auf «Teilen» tippen"}</strong><p>${safari
              ? "Das ist das Quadrat mit dem Pfeil nach oben. Auf neueren iPhones steckt es hinter den drei Punkten «…»."
              : "Das ist das Quadrat mit dem Pfeil nach oben, meist neben der Adresse. Fehlt danach der Eintrag «Zum Home-Bildschirm», öffne die Ferienkasse in Safari."}</p></div></li>
            <li><div class="step"><strong>«Zum Home-Bildschirm» wählen</strong><p>Der Eintrag steht weiter unten in der Liste. Mit «Hinzufügen» bestätigen.</p></div></li>
            <li><div class="step"><strong>Vom Home-Bildschirm starten</strong><p>Ab jetzt öffnest du die Ferienkasse über ihr Symbol, nicht mehr über den Browser.</p></div></li>
            ${link && html`<li><div class="step"><strong>Reise wieder öffnen</strong><p>In der App auf «Mit Link beitreten» tippen und den kopierten Link einfügen.</p></div></li>`}
          </ol>
          ${!hasCloud && !hasLocal && html`<p class="hint">Auf iPhone und iPad hat die App einen eigenen Speicher und beginnt leer. Leg Reisen deshalb am besten gleich in der App an.</p>`}` : html`
          ${offer && html`<div><button type="button" class="btn primary" onClick=${runInstall}><${Icon} n="download" s=${18} />Installieren</button></div>`}
          <div class="field">
            <span class="label">Android</span>
            <p class="hint">Im Browser-Menü (drei Punkte) «App installieren» oder «Zum Startbildschirm hinzufügen» wählen.</p>
          </div>
          <div class="field">
            <span class="label">iPhone</span>
            <p class="hint">Die Ferienkasse in Safari öffnen, auf «Teilen» tippen, dann «Zum Home-Bildschirm». Dort beginnt die App mit leerem Speicher: Geteilte Reisen kommen mit dem Einladungslink dazu, andere über eine Sicherung.</p>
          </div>
          <div class="field">
            <span class="label">Computer</span>
            <p class="hint">In Chrome oder Edge auf das Installieren-Symbol rechts in der Adresszeile klicken. In Safari auf dem Mac: «Ablage», dann «Zum Dock hinzufügen».</p>
          </div>`}
      <//>`;
  }

  /* ---------- home ---------- */
  function Home({ reg, onOpen, onNew, onJoin, onSettings, onSetup, onInstall }) {
    return html`
      <header class="brand">
        <div class="brand-row">
          <h1><span class="logo" aria-hidden="true">🏝️</span><span class="word">Ferienkasse</span></h1>
          <button type="button" class="icon-btn" aria-label="Einstellungen" onClick=${onSettings}><${Icon} n="sliders" s=${22} /></button>
        </div>
        <p>Wer hat was bezahlt, und wer schuldet wem?</p>
      </header>
      ${!Store.storageOk && html`<div class="note warn" role="alert"><${Icon} n="device" /><div>Dieser Browser lässt nichts speichern (privater Modus oder gesperrte Website-Daten). Reisen gehen verloren, sobald du die Seite schliesst. Öffne die Ferienkasse in einem gewöhnlichen Fenster.</div></div>`}
      <${InstallHint} onHow=${onInstall} />
      ${reg.length > 0
        ? html`
          <section class="stack">
            <h2 class="sec-h">Eure Reisen</h2>
            <div class="trips">${reg.map(t => html`
              <button type="button" key=${t.id} class="trip" onClick=${() => onOpen(t.id)}>
                <span class=${"trip-e " + TRIP_TINT[hashOf(t.id) % TRIP_TINT.length]} aria-hidden="true">${TRIP_EMOJI[hashOf("e" + t.id) % TRIP_EMOJI.length]}</span>
                <span class="trip-body">
                  <span class="trip-name">${t.name || "Geteilte Reise"}</span>
                  <span class="trip-meta">${t.mode === "cloud" ? "Für die Gruppe, synchronisiert" : "Nur auf diesem Gerät"}</span>
                </span>
                <span class="go"><${Icon} n="next" /></span>
              </button>`)}
            </div>
            <div class="btn-row">
              <button type="button" class="btn" onClick=${onNew}><${Icon} n="plus" s=${18} />Neue Reise</button>
              ${Store.cloudOn && html`<button type="button" class="btn" onClick=${onJoin}><${Icon} n="link" s=${18} />Mit Link beitreten</button>`}
            </div>
          </section>`
        : html`
          <section class="empty">
            <span class="empty-e" aria-hidden="true">🏝️🍕💸</span>
            <h2>Noch keine Reise</h2>
            <p>Leg eine Reise an und trag ein, wer mitkommt. Danach werden die Ausgaben erfasst, und die Ferienkasse rechnet aus, wer wem wie viel schuldet.</p>
            <ul class="feat">
              <li><span class="x-ic k-groceries" aria-hidden="true">${Store.cloudOn ? "👯" : "📱"}</span>${Store.cloudOn ? "Die ganze Gruppe trägt ein, auch ohne Netz" : "Läuft ohne Konto, alles bleibt auf deinem Gerät"}</li>
              <li><span class="x-ic k-apero" aria-hidden="true">💱</span>In Euro zahlen, zum Tageskurs in Franken abrechnen</li>
              <li><span class="x-ic k-mountain" aria-hidden="true">🤝</span>Am Schluss quitt mit so wenigen Zahlungen wie möglich</li>
            </ul>
            <div class="btn-row">
              <button type="button" class="btn primary" onClick=${onNew}>Reise anlegen</button>
              ${Store.cloudOn && html`<button type="button" class="btn" onClick=${onJoin}><${Icon} n="link" s=${18} />Mit Link beitreten</button>`}
            </div>
          </section>
          <${Meme} m=${{ tone: "idle", emoji: "🧙", top: "One does not simply", bottom: "eine Rechnung durch sieben teilen" }} />`}
      ${!Store.cloudOn && html`
        <section class="tip plain" aria-label="Gemeinsam speichern">
          <span class="x-ic k-lodging" aria-hidden="true">👯</span>
          <div class="tip-body">
            <strong>Gemeinsam speichern</strong>
            <p>${Store.configState === "off"
              ? "Im Moment bleiben Reisen auf diesem Gerät. Mit dem Gruppen-Sync tragen alle auf dem eigenen Handy ein, und alles wird laufend gemeinsam gespeichert. Erst dann kannst du andere einladen."
              : "Der Gruppen-Sync ist aus, weil in der Datei config.js etwas nicht stimmt. Bis dahin bleiben Reisen auf diesem Gerät."}</p>
            <button type="button" class="btn small" onClick=${onSetup}>Gruppen-Sync einrichten</button>
          </div>
        </section>`}
    `;
  }

  /* A trip that cannot be shown (yet): loading, gone, unreachable. */
  function TripGate({ state, onBack, onForget }) {
    const gone = state === null, text = state === undefined
      ? ["Reise wird geladen", "Einen Moment."]
      : gone ? ["Diese Reise gibt es nicht", "Sie wurde gelöscht, oder der Link stimmt nicht ganz."]
      : state === "denied" ? ["Zugriff verweigert", "Der Gruppen-Sync lässt das Lesen nicht zu. In Firebase fehlen vermutlich noch die Sicherheitsregeln: siehe README, Abschnitt «Gruppen-Sync einrichten»."]
      : state === "unconfigured" ? ["Kein Gruppen-Sync", "Diese Reise ist eine geteilte Reise, aber auf dieser Installation ist kein Gruppen-Sync eingerichtet."]
      : state === "setup-db" ? ["Datenbank fehlt", "Im Firebase-Projekt gibt es noch keine Firestore-Datenbank. Die Schritte stehen im README, Abschnitt «Gruppen-Sync einrichten»."]
      : state === "setup" ? ["Gruppen-Sync nicht bereit", "Firebase lehnt die Angaben aus config.js ab. Tippe auf der Startseite in den Einstellungen auf «Verbindung prüfen»."]
      : state === "quota" ? ["Kontingent aufgebraucht", "Das kostenlose Tageskontingent von Firebase ist aufgebraucht. Am Morgen wird es wieder frei, dann lädt die Reise von selbst."]
      : ["Reise nicht erreichbar", "Ohne Netz erscheinen nur Reisen, die dieses Gerät schon einmal geladen hat. Sobald du wieder online bist, lädt sie von selbst."];
    const waits = state !== null && state !== "unconfigured";
    const face = state === undefined ? "⏳" : gone ? "🕳️" : state === "denied" ? "🔒" : state === "quota" ? "😴" : state === "offline" ? "📡" : "🧰";
    return html`
      <div class="top"><button type="button" class="back" onClick=${onBack}><${Icon} n="back" />Reisen</button></div>
      <section class="empty" aria-live="polite">
        <span class="empty-e" aria-hidden="true">${face}</span>
        <h2>${text[0]}</h2>
        <p>${text[1]}</p>
        ${state !== undefined && waits && html`<p class="meta">Die Ferienkasse versucht es von selbst wieder.</p>`}
        ${gone && html`<button type="button" class="btn" onClick=${onForget}>Aus meiner Liste entfernen</button>`}
      </section>`;
  }

  function JoinSheet({ onJoin, onClose }) {
    const [v, setV] = useState("");
    const [err, setErr] = useState(null);
    const go = () => {
      const id = Store.idFromLink(v);
      if (!id) { setErr("Darin steckt kein Einladungslink. Füg den ganzen Link ein, den du bekommen hast."); return; }
      onJoin(id);
    };
    const canPaste = !!(navigator.clipboard && navigator.clipboard.readText);
    const paste = () => {
      const no = () => setErr("Der Browser gibt die Zwischenablage nicht frei. Füg den Link von Hand ins Feld ein.");
      try { navigator.clipboard.readText().then(t => { if (t) { setV(t.trim()); setErr(null); } else no(); }, no); } catch (e) { no(); }
    };
    return html`
      <${Sheet} title="Beitreten" onClose=${onClose} error=${err} action=${html`<button type="button" class="btn primary small" onClick=${go}>Öffnen</button>`}>
        <div class="field">
          <label for="fk-join">Einladungslink</label>
          <input id="fk-join" class="input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Link einfügen" value=${v} data-autofocus=""
            onInput=${e => { setV(e.target.value); setErr(null); }} onKeyDown=${e => { if (e.key === "Enter") { e.preventDefault(); go(); } }} />
          <p class="hint">Den Link bekommst du von jemandem aus der Gruppe: in der Reise auf «Einladen» tippen und den Link schicken.</p>
        </div>
        ${canPaste && html`<div><button type="button" class="btn" onClick=${paste}><${Icon} n="copy" s=${18} />Aus der Zwischenablage einfügen</button></div>`}
        <div class="foot"><button type="button" class="btn primary block" onClick=${go}>Reise öffnen</button></div>
      <//>`;
  }

  function InviteSheet({ trip, onClose, say }) {
    const link = Store.linkFor(trip.id);
    const [shown, setShown] = useState(false);
    const canShare = typeof navigator.share === "function";
    const copy = () => {
      const no = () => setShown(true);
      try { navigator.clipboard.writeText(link).then(() => say("Link kopiert. Schick ihn in euren Gruppenchat."), no); } catch (e) { no(); }
    };
    const share = () => { navigator.share({ title: "Ferienkasse «" + trip.name + "»", text: "Trag deine Ausgaben für «" + trip.name + "» hier ein:", url: link }).catch(() => {}); };
    return html`
      <${Sheet} title="Einladen" onClose=${onClose} closeLabel="Fertig">
        <p class="hint">Wer diesen Link öffnet, sieht die Reise und kann Ausgaben eintragen, ohne Konto und ohne Passwort. Schick ihn nur an eure Gruppe.</p>
        <div class="qr-box"><${Qr} text=${link} /></div>
        <div class="btn-row center">
          ${canShare && html`<button type="button" class="btn primary" onClick=${share}><${Icon} n="share" s=${18} />Link teilen</button>`}
          <button type="button" class=${"btn" + (canShare ? "" : " primary")} onClick=${copy}><${Icon} n="copy" s=${18} />Link kopieren</button>
        </div>
        <div class="field">
          <label for="fk-link">Einladungslink</label>
          <input id="fk-link" class="input linkbox" readonly value=${link} onFocus=${e => e.target.select()} />
          ${shown && html`<p class="hint">Kopieren hat nicht geklappt. Markiere den Link im Feld und kopiere ihn von Hand.</p>`}
        </div>
        <p class="hint">Vor Ort geht es am schnellsten mit dem QR-Code: Die anderen richten die Handy-Kamera darauf.</p>
      <//>`;
  }

  const SYNC_TEXT = {
    off: "Nicht eingeschaltet. Reisen liegen nur auf diesem Gerät. Mit dem Gruppen-Sync tragen alle ein, und alles wird laufend gemeinsam gespeichert. Die Anleitung führt Schritt für Schritt durch das Einrichten.",
    broken: "Nicht eingeschaltet: Die Datei config.js lässt sich nicht lesen, vermutlich wegen eines Tippfehlers. Ersetze darin nur die eine Zeile durch den Block aus der Firebase-Konsole, von «const firebaseConfig = {» bis «};». Das README zeigt ein Beispiel.",
    incomplete: "Nicht eingeschaltet: In der Datei config.js fehlen Angaben, oder es stehen noch Platzhalter darin. Kopier den ganzen Block aus der Firebase-Konsole, mindestens mit apiKey und projectId."
  };
  const CONFIG_BAD = "Firebase lehnt die Angaben aus config.js ab (apiKey oder projectId stimmen nicht). Kopier den Block nochmals aus der Firebase-Konsole.";
  const CLOUD_ERR = {
    "permission-denied": "Firebase antwortet, lehnt den Zugriff aber ab. Es fehlen die Sicherheitsregeln: In der Firebase-Konsole bei der Firestore-Datenbank den Reiter «Regeln» öffnen, den Inhalt der Datei firestore.rules einfügen und veröffentlichen.",
    "setup-db": "Firebase antwortet: In diesem Projekt gibt es noch keine Firestore-Datenbank. Leg sie in der Firebase-Konsole an und lass ihre Kennung auf «(default)». Die Schritte stehen im README, Abschnitt «Gruppen-Sync einrichten».",
    "resource-exhausted": "Firebase antwortet, aber das kostenlose Tageskontingent ist aufgebraucht. Am Morgen geht es weiter.",
    "invalid-argument": CONFIG_BAD, unauthenticated: CONFIG_BAD, "failed-precondition": CONFIG_BAD,
    internal: "Die Prüfung liess sich nicht starten. Lade die Seite neu und versuch es nochmal."
  };
  const CLOUD_NO = "Keine Antwort von Firebase. Prüf zuerst dein Netz. Ist es in Ordnung, stimmen vermutlich die Werte in config.js nicht.";
  /* Asks the sync server directly and says in plain words what is missing. */
  function CloudCheck() {
    const [cloud, setCloud] = useState(null);
    const checkCloud = () => {
      setCloud({ busy: true });
      Store.checkCloud().then(
        () => setCloud({ ok: true, msg: "Die Verbindung steht: Firebase antwortet, und die Regeln lassen die Ferienkasse zu." }),
        e => {
          const code = e && e.code, quiet = !code || code === "unavailable" || code === "timeout" || code === "internal" || code === "unconfigured";
          setCloud({ ok: false, msg: (CLOUD_ERR[code] || CLOUD_NO) + (!quiet && e.message ? " Meldung von Firebase: " + String(e.message).slice(0, 220) : "") });
        });
    };
    return html`
      <div><button type="button" class="btn small" disabled=${!!(cloud && cloud.busy)} onClick=${checkCloud}><${Icon} n="refresh" s=${16} />Verbindung prüfen</button></div>
      ${cloud && cloud.busy && html`<p class="hint" role="status">Verbindung wird geprüft, das dauert höchstens eine Viertelminute …</p>`}
      ${cloud && cloud.msg && html`<p class=${cloud.ok ? "ok" : "err"} role="status">${cloud.msg}</p>`}`;
  }

  /* ---------- group sync: the guide, and sharing a trip that lives on one device ---------- */
  /* Where a file of this installation is edited: on GitHub Pages the address names the account and the project. */
  function editLink(file) {
    try {
      const m = /^([a-z0-9][a-z0-9-]*)\.github\.io$/i.exec(location.hostname);
      if (!m) return null;
      const repo = location.pathname.replace(/[^/]*$/, "").split("/").filter(Boolean)[0] || location.hostname;
      return /^[A-Za-z0-9._-]+$/.test(repo) ? "https://github.com/" + m[1] + "/" + repo + "/edit/main/" + file : null;
    } catch (e) { return null; }
  }
  /* A page of the Firebase console. Without a known project the console first asks which one is meant ("_"). */
  const consoleLink = page => "https://console.firebase.google.com/project/" + (Store.projectId ? encodeURIComponent(Store.projectId) : "_") + "/" + page;
  function SetupSheet({ onClose, say }) {
    const [rules, setRules] = useState(null);                         // null = still loading, "" = the file is not there
    const [shown, setShown] = useState(false);
    const edit = useMemo(() => editLink("config.js"), []);
    useEffect(() => {
      let alive = true;
      const take = t => { if (alive) setRules(/service\s+cloud\.firestore/.test(t || "") ? String(t).trim() : ""); };
      try { fetch("firestore.rules", { cache: "no-cache" }).then(r => (r.ok ? r.text() : "")).then(take, () => take("")); } catch (e) { take(""); }
      return () => { alive = false; };
    }, []);
    const copyRules = () => {
      const no = () => setShown(true);
      if (!rules) { no(); return; }
      try { navigator.clipboard.writeText(rules).then(() => say("Regeln kopiert. Füg sie in Firebase im Reiter «Regeln» ein."), no); } catch (e) { no(); }
    };
    const bad = Store.configState === "broken" || Store.configState === "incomplete";
    return html`
      <${Sheet} title="Gruppen-Sync einrichten" onClose=${onClose} closeLabel="Fertig">
        ${Store.cloudOn
          ? html`<div class="field">
              <p class="ok" role="status">Der Gruppen-Sync ist eingeschaltet, Firebase-Projekt <span class="m">${Store.projectId}</span>. Neue Reisen werden automatisch für die Gruppe gespeichert.</p>
              <${CloudCheck} />
            </div>`
          : html`<p class="lead">Mit dem Gruppen-Sync sehen alle dieselbe Reise, tragen auf dem eigenen Handy ein, und alles wird laufend gemeinsam gespeichert. Erst dann kannst du andere einladen.</p>
            <p class="hint">Dafür braucht die Ferienkasse einen gemeinsamen Speicher: ein eigenes Projekt bei Firebase von Google, kostenlos und ohne Kreditkarte. Das Einrichten dauert rund zehn Minuten und ist nur einmal nötig. Am bequemsten geht es am Computer.</p>`}
        ${bad && html`<p class="err" role="status">${SYNC_TEXT[Store.configState]}</p>`}
        <ol class="steps">
          <li><div class="step">
            <strong>Projekt anlegen</strong>
            <p>Die Firebase-Konsole öffnen, mit einem Google-Konto anmelden und ein Projekt erstellen, zum Beispiel «ferienkasse». Google Analytics braucht es nicht.</p>
            <a class="btn small" href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer"><${Icon} n="arrow" s=${16} />Firebase-Konsole öffnen</a>
          </div></li>
          <li><div class="step">
            <strong>Datenbank anlegen</strong>
            <p>Im Menü links «Datenbanken und Speicher» öffnen (englisch «Databases & Storage»), dann «Firestore», und «Datenbank erstellen» wählen («Create database»). Standort zum Beispiel Zürich (europe-west6), Start im Produktionsmodus («Production mode»). Fragt die Konsole nach Edition und Kennung: «Standard», und die Kennung unverändert auf «(default)».</p>
            <a class="btn small" href=${consoleLink("firestore")} target="_blank" rel="noopener noreferrer"><${Icon} n="arrow" s=${16} />Firestore öffnen</a>
          </div></li>
          <li><div class="step">
            <strong>Regeln einsetzen</strong>
            <p>Zuerst hier die Regeln kopieren, dann den Regel-Editor öffnen. Dort den vorhandenen Text löschen, die Regeln einfügen und «Veröffentlichen» wählen («Publish»).</p>
            <div class="btn-row">
              ${rules !== "" && html`<button type="button" class="btn small" disabled=${rules === null} onClick=${copyRules}><${Icon} n="copy" s=${16} />Regeln kopieren</button>`}
              <a class="btn small" href=${consoleLink("firestore/rules")} target="_blank" rel="noopener noreferrer"><${Icon} n="arrow" s=${16} />Regel-Editor öffnen</a>
            </div>
            <p>Von Hand: auf der Seite «Firestore» steht über der Datenansicht eine Reihe von Reitern, darunter «Regeln» («Rules»). Auf dem Handy lässt sich die Reihe seitlich schieben. Fehlen die Reiter, gibt es die Datenbank noch nicht: zurück zu Schritt 2.</p>
            ${rules === "" && html`<p>Die Regeln stehen in der Datei firestore.rules in deinem GitHub-Projekt.</p>`}
            ${shown && rules && html`<p>Kopieren hat nicht geklappt. Halte den Finger auf den Text und kopiere ihn von Hand:</p><pre class="code">${rules}</pre>`}
          </div></li>
          <li><div class="step">
            <strong>Web-App registrieren</strong>
            <p>In den Projekteinstellungen (Zahnrad) nach unten zu «Meine Apps» gehen («Your apps») und das Symbol <span class="m">${"</>"}</span> (Web) wählen. Einen Namen eingeben, «Firebase Hosting» nicht ankreuzen und «App registrieren» wählen («Register app»). Firebase zeigt jetzt einen Block, der mit <span class="m">const firebaseConfig = {</span> beginnt und mit <span class="m">};</span> endet. Kopiere diesen Block.</p>
            <a class="btn small" href=${consoleLink("settings/general")} target="_blank" rel="noopener noreferrer"><${Icon} n="arrow" s=${16} />Projekteinstellungen öffnen</a>
          </div></li>
          <li><div class="step">
            <strong>Block in config.js einsetzen</strong>
            <p>Auf GitHub die Datei config.js zum Bearbeiten öffnen (Stift-Symbol) und die eine Zeile <span class="m">const firebaseConfig = null;</span> durch den kopierten Block ersetzen. Sonst nichts ändern. Mit «Commit changes» speichern.</p>
            ${edit && html`<a class="btn small" href=${edit} target="_blank" rel="noopener noreferrer"><${Icon} n="arrow" s=${16} />config.js auf GitHub bearbeiten</a>`}
          </div></li>
          <li><div class="step">
            <strong>Prüfen</strong>
            <p>Ein bis zwei Minuten warten und die Ferienkasse neu laden. Danach steht hier oben «eingeschaltet», und «Verbindung prüfen» sagt, ob noch etwas fehlt.</p>
            <button type="button" class="btn small" onClick=${() => location.reload()}><${Icon} n="refresh" s=${16} />Neu laden</button>
          </div></li>
        </ol>
        <div class="field">
          <span class="label">Danach</span>
          <p class="hint">Neue Reisen werden automatisch für die Gruppe gespeichert. In der Reise auf «Einladen» tippen und den Link oder den QR-Code weitergeben: Wer ihn öffnet, ist dabei. Eine Reise, die schon auf diesem Gerät liegt, gibst du ebenfalls über «Einladen» frei.</p>
          <p class="hint">Die Werte in config.js sind keine Passwörter. Wer eine Reise sehen darf, bestimmt der Einladungslink: Gib ihn nur an eure Gruppe.</p>
        </div>
      <//>`;
  }
  /* «Einladen» in a trip that lives on this device only, with the group sync switched on: one tap moves it to the group. */
  function ShareSheet({ onPublish, onClose }) {
    const [busy, setBusy] = useState(false);
    const go = async () => { if (busy) return; setBusy(true); await onPublish(); setBusy(false); };
    return html`
      <${Sheet} title="Einladen" onClose=${onClose}>
        <p class="lead">Diese Reise liegt bisher nur auf diesem Gerät. Gib sie für die Gruppe frei: Dann wird sie laufend gemeinsam gespeichert, und du bekommst den Einladungslink.</p>
        <div class="foot"><button type="button" class="btn primary block" disabled=${busy} onClick=${go}><${Icon} n="people" s=${18} />${busy ? "Wird freigegeben …" : "Für die Gruppe freigeben"}</button></div>
        <p class="hint">Alle Buchungen bleiben erhalten. Wer den Link öffnet, sieht die Reise und kann eintragen, ohne Konto und ohne Passwort.</p>
      <//>`;
  }

  function SettingsSheet({ onClose, onImported, onSetup, onInstall }) {
    const [err, setErr] = useState(null);
    const onFile = ev => {
      const file = ev.target.files && ev.target.files[0];
      ev.target.value = "";
      if (!file) return;
      const rd = new FileReader();
      rd.onload = () => {
        try { onImported(Store.importBackup(JSON.parse(String(rd.result)))); }
        catch (e) { setErr(e && e.code === "storage" ? FAIL.storage : "Diese Datei ist keine Sicherung der Ferienkasse."); }
      };
      rd.onerror = () => setErr("Die Datei liess sich nicht lesen.");
      rd.readAsText(file);
    };
    return html`
      <${Sheet} title="Einstellungen" onClose=${onClose} closeLabel="Fertig" error=${err}>
        <div class="field">
          <span class="label">Gruppen-Sync</span>
          <p class="hint">${Store.cloudOn
            ? html`Eingeschaltet, Firebase-Projekt <span class="m">${Store.projectId}</span>. Neue Reisen werden für die Gruppe synchronisiert. Einträge ohne Netz gehen nicht verloren, sie werden später gesendet.`
            : SYNC_TEXT[Store.configState] || SYNC_TEXT.off}</p>
          ${Store.cloudOn && html`<${CloudCheck} />`}
          <div><button type="button" class=${"btn small" + (Store.cloudOn ? " ghost" : "")} onClick=${onSetup}>${Store.cloudOn ? "Anleitung zum Einrichten" : "Gruppen-Sync einrichten"}</button></div>
        </div>
        <div class="field">
          <span class="label">Sicherung einlesen</span>
          <p class="hint">Eine heruntergeladene Sicherung wird als neue Reise auf diesem Gerät angelegt.</p>
          <input id="fk-import" class="sr" type="file" accept="application/json,.json" onChange=${onFile} />
          <label class="btn" for="fk-import"><${Icon} n="upload" s=${18} />Datei wählen</label>
        </div>
        <div class="field">
          <span class="label">Als App aufs Handy</span>
          <p class="hint">Android: im Browser-Menü «App installieren». iPhone: in Safari auf «Teilen», dann «Zum Home-Bildschirm». Danach startet die Ferienkasse wie eine App, auch ohne Netz.</p>
          <p class="hint">Auf dem iPhone beginnt die App vom Home-Bildschirm mit leerem Speicher. Geteilte Reisen holst du mit dem Einladungslink über «Mit Link beitreten» dazu. Eine Reise, die nur auf diesem Gerät liegt, nimmst du als Sicherung mit: hier herunterladen, in der App einlesen.</p>
          ${!isStandalone() && html`<div><button type="button" class="btn small" onClick=${onInstall}>Anleitung zum Installieren</button></div>`}
        </div>
      <//>`;
  }

  /* ---------- new trip ---------- */
  function TripNew({ act, onClose, onCreated }) {
    const [name, setName] = useState("");
    const [base, setBase] = useState("CHF");
    const [people, setPeople] = useState([]);
    const [draft, setDraft] = useState("");
    const [me, setMe] = useState(null);
    const [err, setErr] = useState(null);
    const [busy, setBusy] = useState(false);
    const addRef = useRef(null), lock = useRef(false);
    const withDraft = () => {
      const n = draft.trim();
      if (!n || people.some(p => p.name.toLowerCase() === n.toLowerCase())) return people;
      return people.concat({ k: Store.randomId(8, "m"), name: n, a: FK.pickAvatar(people.map(p => p.a)) });
    };
    const reroll = () => { const used = []; setPeople(people.map(p => { const a = FK.pickAvatar(used); used.push(a); return Object.assign({}, p, { a }); })); };
    const add = () => {
      const n = draft.trim();
      if (!n) return;
      if (people.some(p => p.name.toLowerCase() === n.toLowerCase())) { setErr("«" + n + "» ist schon dabei. Nimm bei gleichen Namen einen Zusatz, zum Beispiel den ersten Buchstaben des Nachnamens."); return; }
      const next = withDraft();
      setPeople(next); setDraft(""); setErr(null);
      if (!me) setMe(next[next.length - 1].k);
      if (addRef.current) addRef.current.focus();
    };
    const create = async () => {
      if (lock.current) return;
      const list = withDraft();
      if (!name.trim()) { setErr("Gib der Reise einen Namen."); return; }
      if (list.length < 2) { setErr("Trag mindestens zwei Personen ein."); return; }
      const mine = me && list.some(p => p.k === me) ? me : null;
      const members = {};
      list.forEach((p, i) => { members[p.k] = { name: p.name, c: i % 8, o: i, gone: false, a: p.a }; });
      lock.current = true; setBusy(true);
      const id = await act.createTrip({ name: name.trim(), base, rates: {}, members, created: Date.now() });
      lock.current = false; setBusy(false);
      if (id) onCreated(id, mine);
    };
    return html`
      <${Sheet} title="Neue Reise" onClose=${onClose} error=${err} action=${html`<button type="button" class="btn primary small" disabled=${busy} onClick=${create}>Anlegen</button>`}>
        <div class="field">
          <label for="fk-trip-name">Name der Reise</label>
          <input id="fk-trip-name" class="input" maxlength="60" placeholder="z. B. Sardinien 2026" value=${name} onInput=${e => { setName(e.target.value); setErr(null); }} data-autofocus="" />
        </div>
        <div class="field">
          <label for="fk-trip-person">Wer kommt mit?</label>
          <div class="inline">
            <input id="fk-trip-person" class="input" maxlength="30" placeholder="Vorname" value=${draft} ref=${addRef}
              onInput=${e => { setDraft(e.target.value); setErr(null); }} onKeyDown=${e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
            <button type="button" class="btn" onClick=${add}>Hinzufügen</button>
          </div>
          ${people.length > 0 && html`
            <div class="chips">${people.map((p, i) => html`
              <span key=${p.k} class="chip static"><${Av} m=${{ name: p.name, c: i, a: p.a }} s=${1} />${p.name}
                <button type="button" class="rm" aria-label=${p.name + " entfernen"} onClick=${() => { setPeople(people.filter(x => x.k !== p.k)); if (me === p.k) setMe(null); }}><${Icon} n="close" s=${14} /></button>
              </span>`)}
            </div>`}
          ${people.length > 0 && html`<div><button type="button" class="btn small" onClick=${reroll}><span class="emo" aria-hidden="true">🎲</span>Avatare neu würfeln</button></div>`}
          <p class="hint">Trag auch dich selbst ein. Später kommen jederzeit weitere Personen dazu, und jede Person wählt ihren Avatar selbst.</p>
        </div>
        ${people.length > 0 && html`
          <div class="field">
            <span class="label" id="fk-trip-me">Wer davon bist du?</span>
            <div class="chips" role="radiogroup" aria-labelledby="fk-trip-me">${people.map((p, i) => html`
              <button type="button" key=${p.k} role="radio" aria-checked=${String(me === p.k)} class="chip" onClick=${() => setMe(p.k)}><${Av} m=${{ name: p.name, c: i, a: p.a }} s=${1} />${p.name}</button>`)}
            </div>
          </div>`}
        <div class="field">
          <label for="fk-trip-base">Abrechnen in</label>
          <${CurSelect} id="fk-trip-base" value=${base} onChange=${setBase} label="Hauptwährung" />
          <p class="hint">In dieser Währung rechnet ihr am Schluss ab. Bezahlen könnt ihr unterwegs in jeder Währung, umgerechnet wird zum Tageskurs.</p>
        </div>
        <div class="field">
          <span class="label">Wo wird gespeichert?</span>
          <p class="hint">${Store.cloudOn ? "Im Gruppen-Sync: Nach dem Anlegen lädst du die anderen mit einem Link ein, und alle tragen selbst ein." : "Nur auf diesem Gerät, weil noch kein Gruppen-Sync eingeschaltet ist. Du kannst die Reise später für die Gruppe freigeben."}</p>
        </div>
        <div class="foot"><button type="button" class="btn primary block" disabled=${busy} onClick=${create}>Reise anlegen</button></div>
      <//>`;
  }

  /* ---------- trip settings ---------- */
  function TripEdit({ trip, mode, list, loading, meId, setMe, act, onClose, onDelete, onLeave, onPublish, onAvatar }) {
    const all = membersOf(trip, true), ms = all.filter(m => !m.gone);
    const [name, setName] = useState(trip.name || "");
    const [names, setNames] = useState({});
    const [draft, setDraft] = useState("");
    const [err, setErr] = useState(null);
    const [busy, setBusy] = useState(false);
    const used = useMemo(() => { const u = {}; list.forEach(e => refsOf(e).forEach(id => { u[id] = (u[id] || 0) + 1; })); return u; }, [list]);
    const saveName = () => { const n = name.trim(); if (n && n !== trip.name) act.patchTrip(trip.id, { name: n }); else setName(trip.name || ""); };
    const saveMember = m => {
      const n = (names[m.id] == null ? m.name : names[m.id]).trim();
      if (!n) { setNames(Object.assign({}, names, { [m.id]: m.name })); return; }
      if (n !== m.name) act.patchTrip(trip.id, { members: { [m.id]: { name: n } } });
    };
    const add = () => {
      const n = draft.trim();
      if (!n) return;
      if (ms.some(m => m.name.toLowerCase() === n.toLowerCase())) { setErr("«" + n + "» ist schon dabei. Nimm bei gleichen Namen einen Zusatz."); return; }
      const o = all.reduce((x, m) => Math.max(x, m.o), -1) + 1;
      act.patchTrip(trip.id, { members: { [Store.randomId(8, "m")]: { name: n, c: all.length % 8, o, gone: false, a: FK.pickAvatar(all.map(m => m.a)) } } });
      setDraft(""); setErr(null);
    };
    const remove = m => {
      if (loading) { setErr("Die Buchungen werden noch geladen. Versuch es gleich nochmal."); return; }
      if (used[m.id]) { setErr(m.name + " steht in " + used[m.id] + (used[m.id] === 1 ? " Buchung" : " Buchungen") + " und kann deshalb nicht entfernt werden. Ändere oder lösche zuerst diese Buchungen."); return; }
      if (ms.length <= 2) { setErr("Eine Reise braucht mindestens zwei Personen."); return; }
      setErr(null);
      act.patchTrip(trip.id, { members: { [m.id]: { gone: true } } });
    };
    const backup = () => {
      const no = () => setErr("Die Sicherung liess sich nicht erstellen.");
      try { Store.download(fileName(trip.name), Store.backup(trip, list)).catch(no); } catch (e) { no(); }
    };
    const publish = async () => { if (busy) return; setBusy(true); setErr(null); await onPublish(); setBusy(false); };
    return html`
      <${Sheet} title="Reise" onClose=${onClose} closeLabel="Fertig" error=${err}>
        <div class="field">
          <label for="fk-set-name">Name der Reise</label>
          <input id="fk-set-name" class="input" maxlength="60" value=${name} onInput=${e => setName(e.target.value)} onBlur=${saveName} />
        </div>
        <div class="field">
          <span class="label">Mitreisende</span>
          <div class="rows">${ms.map(m => html`
            <div class="row" key=${m.id}>
              <button type="button" class="av-btn" aria-label=${"Avatar von " + m.name + " ändern"} onClick=${() => onAvatar(m.id)}><${Av} m=${m} /></button>
              <input id=${"fk-set-m-" + m.id} class="input name" maxlength="30" aria-label=${"Name von " + m.name} value=${names[m.id] == null ? m.name : names[m.id]}
                onInput=${e => setNames(Object.assign({}, names, { [m.id]: e.target.value }))} onBlur=${() => saveMember(m)} />
              <button type="button" class="chip" aria-pressed=${String(meId === m.id)} onClick=${() => setMe(m.id)}>${meId === m.id ? "Das bin ich" : "Ich"}</button>
              <button type="button" class="icon-btn" aria-label=${m.name + " entfernen"} onClick=${() => remove(m)}><${Icon} n="close" s=${18} /></button>
            </div>`)}
          </div>
          <div class="inline">
            <input id="fk-set-add" class="input" maxlength="30" placeholder="Weitere Person" value=${draft} onInput=${e => { setDraft(e.target.value); setErr(null); }}
              onKeyDown=${e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
            <button type="button" class="btn" onClick=${add}>Hinzufügen</button>
          </div>
          <p class="hint">Tippe auf ein Bild, um den Avatar zu ändern.</p>
        </div>
        <div class="field">
          <label for="fk-set-base">Abrechnen in</label>
          <${CurSelect} id="fk-set-base" value=${trip.base} trip=${trip} label="Hauptwährung" disabled=${loading || list.length > 0} onChange=${c => { if (!loading && !list.length && c && c !== trip.base) act.patchTrip(trip.id, { base: c }); }} />
          ${list.length > 0 && html`<p class="hint">Die Hauptwährung bleibt, sobald Buchungen erfasst sind. Sonst würden alle Kurse nicht mehr stimmen.</p>`}
        </div>
        <div class="field">
          <span class="label">Daten</span>
          <p class="hint">${mode === "cloud"
            ? "Diese Reise wird für die Gruppe synchronisiert. Eine Sicherung als Datei schadet trotzdem nicht."
            : "Diese Reise liegt nur auf diesem Gerät. Löscht der Browser seinen Speicher, ist sie weg. Lade deshalb ab und zu eine Sicherung herunter."}</p>
          <div class="btn-row">
            <button type="button" class="btn small" disabled=${!!loading} onClick=${backup}><${Icon} n="download" s=${16} />Sicherung herunterladen</button>
            ${mode === "local" && Store.cloudOn && html`<button type="button" class="btn small" disabled=${busy} onClick=${publish}><${Icon} n="people" s=${16} />${busy ? "Wird freigegeben …" : "Für die Gruppe freigeben"}</button>`}
          </div>
        </div>
        <div class="foot">
          ${mode === "cloud" && html`
            <button type="button" class="btn block" onClick=${onLeave}>Von diesem Gerät entfernen</button>
            <p class="meta">Für die anderen bleibt die Reise bestehen. Mit dem Einladungslink kommst du wieder dazu.</p>`}
          <${DeleteButton} label=${mode === "cloud" ? "Reise für alle löschen" : "Reise löschen"} onConfirm=${onDelete} disabled=${!!loading} />
          <p class="meta">Löschen entfernt die Reise mit allen Buchungen${mode === "cloud" ? ", für die ganze Gruppe" : ""}.</p>
        </div>
      <//>`;
  }

  /* ---------- avatar ---------- */
  /* An emoji and one of eight colours. The choice is part of the trip, so everybody in the group sees it. */
  function AvatarSheet({ trip, member, isMe, act, onClose, say }) {
    const [a, setA] = useState(member.a);
    const [c, setC] = useState((member.c || 0) % 8);
    const [busy, setBusy] = useState(false);
    const lock = useRef(false);
    const taken = useMemo(() => membersOf(trip).filter(m => m.id !== member.id).map(m => m.a), [trip, member.id]);
    const cur = FK.avatar(a);
    const dice = () => { setA(FK.pickAvatar(taken.concat(a))); setC(Math.floor(Math.random() * 8)); };
    const save = async () => {
      if (lock.current) return;
      lock.current = true; setBusy(true);
      const ok = await act.patchTrip(trip.id, { members: { [member.id]: { a, c } } });
      lock.current = false; setBusy(false);
      if (ok) { onClose(); say(isMe ? "Avatar gespeichert. Steht dir." : "Avatar gespeichert."); }
    };
    return html`
      <${Sheet} title=${isMe ? "Dein Avatar" : "Avatar von " + member.name} onClose=${onClose} action=${html`<button type="button" class="btn primary small" disabled=${busy} onClick=${save}>Speichern</button>`}>
        <div class="av-stage">
          <${Av} m=${{ name: member.name, c, a }} s=${3} />
          <strong>${member.name}</strong>
          <span class="hint" aria-live="polite">${cur ? cur.label : ""}</span>
          <button type="button" class="btn small" onClick=${dice}><span class="emo" aria-hidden="true">🎲</span>Würfeln</button>
        </div>
        <div class="field">
          <span class="label" id="fk-av-c">Farbe</span>
          <div class="swatches" role="radiogroup" aria-labelledby="fk-av-c">${COLOR_NAMES.map((name, i) => html`
            <button type="button" key=${i} role="radio" aria-checked=${String(c === i)} aria-label=${name} title=${name} class=${"swatch c" + (i + 1)} onClick=${() => setC(i)}></button>`)}
          </div>
        </div>
        ${FK.AVATARS.map((g, gi) => html`
          <div class="field" key=${g.title}>
            <span class="label" id=${"fk-av-g" + gi}>${g.title}</span>
            <div class="av-grid" role="radiogroup" aria-labelledby=${"fk-av-g" + gi}>${g.items.map(it => html`
              <button type="button" key=${it[0]} role="radio" aria-checked=${String(a === it[0])} aria-label=${it[2] + (taken.indexOf(it[0]) >= 0 ? " (schon vergeben)" : "")} title=${it[2]}
                class=${"av-pick" + (taken.indexOf(it[0]) >= 0 ? " taken" : "")} onClick=${() => setA(it[0])}>${it[1]}</button>`)}
            </div>
          </div>`)}
        <p class="hint">Blasse Bilder hat schon jemand aus der Gruppe. Nehmen darfst du sie trotzdem.</p>
        <div class="foot"><button type="button" class="btn primary block" disabled=${busy} onClick=${save}>Speichern</button></div>
      <//>`;
  }

  /* ---------- expense form ---------- */
  const MODES = [["equal", "Gleich"], ["shares", "Anteile"], ["exact", "Beträge"], ["items", "Positionen"]];

  function toDraft(e, trip, people, meId) {
    const sel = {}, sh = {}, ex = {};
    people.forEach(m => { sel[m.id] = !m.gone; sh[m.id] = "1"; ex[m.id] = ""; });
    const rateStr = cur => (cur !== trip.base && (trip.rates || {})[cur] ? FK.rateText(trip.rates[cur]) : "");
    if (!e) {
      let cur = ls.get("fk.cur." + trip.id, trip.base);
      if (!FK.isCurrency(cur)) cur = trip.base;
      return { id: expenseId(), isNew: true, amountStr: "", cur, rateStr: "", rateMode: "auto", rateInfo: null, title: "", cat: "food", date: FK.today(),
        payer: meId || (people[0] && people[0].id) || null, mode: "equal", sel, shares: sh, exact: ex, items: [], ts: Date.now(), by: meId || null };
    }
    const mode = MODES.some(x => x[0] === e.mode) ? e.mode : "equal";
    const d = { id: e.id, isNew: false, amountStr: FK.plain(e.amount, e.cur), cur: e.cur, rateStr: e.rate > 0 ? FK.rateText(e.rate) : rateStr(e.cur),
      rateMode: e.rate > 0 && e.rateAuto ? "auto" : "manual", rateInfo: e.rate > 0 && e.rateAuto && e.rateDate ? { date: e.rateDate, source: "" } : null,
      title: e.title || "", cat: FK.isCat(e.cat) ? e.cat : "other", date: FK.validDate(e.date) ? e.date : FK.today(), payer: e.payer || null, mode,
      sel, shares: sh, exact: ex, items: [], ts: e.ts || Date.now(), by: e.by || null };
    if (mode === "equal" || mode === "items") {
      let part = e.for && e.for.length ? e.for : null;
      if (!part && mode === "items") { const u = new Set(); (e.items || []).forEach(it => (it.for || []).forEach(id => u.add(id))); if (u.size) part = Array.from(u); }
      if (part) people.forEach(m => { sel[m.id] = part.indexOf(m.id) >= 0; });
    }
    if (mode === "shares") people.forEach(m => { sh[m.id] = String((e.weights || {})[m.id] || 0); });
    if (mode === "exact") people.forEach(m => { ex[m.id] = (e.weights || {})[m.id] ? FK.plain(e.weights[m.id], e.cur) : ""; });
    if (mode === "items") {
      const part = people.filter(m => sel[m.id]).map(m => m.id);
      d.items = (e.items || []).map(it => {
        const f = (it.for || []).filter(id => part.indexOf(id) >= 0), forMap = {};
        if (f.length && f.length < part.length) f.forEach(id => { forMap[id] = true; });
        return { k: newId(), name: it.name || "", amountStr: FK.plain(it.amount || 0, e.cur), for: forMap };
      });
    }
    return d;
  }
  function toBody(d, trip, people) {
    const ids = people.map(m => m.id);
    const e = { id: d.id, kind: "expense", title: d.title.trim(), amount: FK.parseAmount(d.amountStr, d.cur) || 0, cur: d.cur, rate: null, rateAuto: false, rateDate: "", date: d.date, cat: d.cat,
      payer: d.payer, mode: d.mode, by: d.by, ts: d.ts, up: Date.now() };
    if (d.cur !== trip.base) Object.assign(e, rateFields(d));
    if (d.mode === "equal") e.for = ids.filter(id => d.sel[id]);
    else if (d.mode === "shares") { e.weights = {}; ids.forEach(id => { const v = FK.parseRate(d.shares[id]); if (v) e.weights[id] = v; }); }
    else if (d.mode === "exact") { e.weights = {}; ids.forEach(id => { const v = FK.parseAmount(d.exact[id], d.cur); if (v > 0) e.weights[id] = v; }); }
    else {
      const part = ids.filter(id => d.sel[id]);
      e.for = part;
      e.items = d.items.map(it => {
        const f = part.filter(id => it.for[id]);
        return { name: it.name.trim().slice(0, 60), amount: FK.parseAmount(it.amountStr, d.cur) || 0, for: f.length ? f : part };
      }).filter(it => it.amount || it.name);
    }
    return e;
  }

  function ExpenseForm({ trip, expense, meId, act, onClose, say }) {
    const base = trip.base;
    const people = useMemo(() => {
      const ms = membersOf(trip), all = membersOf(trip, true), have = new Set(ms.map(m => m.id)), extra = [];
      if (expense) refsOf(expense).forEach(id => { if (!have.has(id)) { have.add(id); extra.push(all.find(m => m.id === id) || GHOST(id)); } });
      return ms.concat(extra);
    }, [trip, expense]);
    const [d, setD] = useState(() => toDraft(expense, trip, people, meId));
    const [err, setErr] = useState(null);
    const [busy, setBusy] = useState(false);
    const lock = useRef(false), slow = useSlow(busy);
    const set = patch => { setErr(null); setD(prev => Object.assign({}, prev, typeof patch === "function" ? patch(prev) : patch)); };

    const foreign = d.cur !== base;
    const rate = foreign ? FK.parseRate(d.rateStr) : 1;
    const body = toBody(d, trip, people);
    const amount = body.amount;
    const part = people.filter(m => d.sel[m.id]);
    const parts = FK.preview(body, people.filter(m => !m.gone).map(m => m.id));
    const rateCtl = useRate(trip, d, set, expense && expense.cur !== base && expense.rate > 0 ? { cur: expense.cur, date: d.date } : null);
    const changeCur = cur => { if (cur && cur !== d.cur) set({ cur, rateStr: "", rateMode: "auto", rateInfo: null }); };

    const save = async () => {
      if (lock.current) return;
      if (foreign && rateCtl.busy) { setErr("Der Tageskurs wird noch geladen. Einen Moment, dann nochmal speichern."); return; }
      if (foreign && !rate) { setErr("Gib den Wechselkurs für " + d.cur + " ein: Wie viel " + base + " kostet 1 " + d.cur + "?"); return; }
      const problem = FK.check(body, trip);
      if (problem) { setErr(problem); return; }
      lock.current = true; setErr(null); setBusy(true);
      if (foreign) act.rememberRate(trip, d.cur, rate);
      const ok = await act.saveExpense(trip.id, body);
      lock.current = false; setBusy(false);
      if (!ok) return;
      ls.set("fk.cur." + trip.id, d.cur);
      onClose(); say(d.isNew ? "Ausgabe gespeichert." : "Änderung gespeichert.");
    };
    const del = async () => {
      if (lock.current) return;
      lock.current = true; setBusy(true);
      const ok = await act.removeExpense(trip.id, d.id);
      lock.current = false; setBusy(false);
      if (ok) { onClose(); say("Ausgabe gelöscht."); }
    };

    const setItem = (k, patch) => set(prev => ({ items: prev.items.map(it => it.k === k ? Object.assign({}, it, patch) : it) }));
    const toggleItem = (it, id) => { const f = Object.assign({}, it.for); if (f[id]) delete f[id]; else f[id] = true; setItem(it.k, { for: f }); };
    const itemSum = d.items.reduce((a, it) => a + (FK.parseAmount(it.amountStr, d.cur) || 0), 0);
    const exactSum = people.reduce((a, m) => a + (FK.parseAmount(d.exact[m.id], d.cur) || 0), 0);
    const amt = id => (parts[id] ? FK.num(parts[id], d.cur) : "–");
    const byName = d.by && people.find(m => m.id === d.by);

    return html`
      <${Sheet} title=${d.isNew ? "Neue Ausgabe" : "Ausgabe"} onClose=${onClose} error=${err} action=${html`<button type="button" class="btn primary small" disabled=${busy} onClick=${save}>Speichern</button>`}>
        <div class="field">
          <label for="fk-amount">Betrag</label>
          <div class="amount-row">
            <input id="fk-amount" class="input amount" inputmode="decimal" autocomplete="off" placeholder=${FK.plain(0, d.cur)} value=${d.amountStr} onInput=${e => set({ amountStr: e.target.value })} data-autofocus=${d.isNew ? "" : null} />
            <${CurSelect} id="fk-cur" cls="cur" value=${d.cur} trip=${trip} onChange=${changeCur} />
          </div>
          ${foreign && rate && amount > 0 && html`<p class="hint m">≈ ${FK.money(FK.toBase(amount, d.cur, base, rate), base)}</p>`}
        </div>
        ${foreign && html`<${RateField} cur=${d.cur} base=${base} d=${d} busy=${rateCtl.busy} onValue=${v => set({ rateStr: v, rateMode: "manual", rateInfo: null })} onRefresh=${rateCtl.refresh} />`}
        <div class="field">
          <label for="fk-title">Wofür?</label>
          <input id="fk-title" class="input" maxlength="80" autocomplete="off" placeholder=${FK.catLabel(d.cat)} value=${d.title} onInput=${e => set({ title: e.target.value })} />
        </div>
        <div class="field">
          <span class="label" id="fk-cat-l">Kategorie</span>
          <div class="chips" role="radiogroup" aria-labelledby="fk-cat-l">${FK.CATS.map(c => html`
            <button type="button" key=${c.id} role="radio" aria-checked=${String(d.cat === c.id)} class="chip" onClick=${() => set({ cat: c.id })}><span class="emo" aria-hidden="true">${c.emoji}</span>${c.label}</button>`)}
          </div>
        </div>
        <div class="field">
          <span class="label" id="fk-payer-l">Bezahlt von</span>
          <div class="chips" role="radiogroup" aria-labelledby="fk-payer-l">${people.map(m => html`
            <button type="button" key=${m.id} role="radio" aria-checked=${String(d.payer === m.id)} class="chip" onClick=${() => set({ payer: m.id })}><${Av} m=${m} s=${1} />${m.id === meId ? m.name + " (ich)" : m.name}</button>`)}
          </div>
        </div>
        <div class="field">
          <span class="label">Aufteilen</span>
          <div class="seg" role="group" aria-label="Art der Aufteilung">${MODES.map(([id, label]) => html`
            <button type="button" key=${id} aria-pressed=${String(d.mode === id)} onClick=${() => set({ mode: id })}>${label}</button>`)}
          </div>

          ${d.mode === "equal" && html`
            <div class="rows">${people.map(m => html`
              <label class="row" key=${m.id}>
                <input id=${"fk-eq-" + m.id} type="checkbox" checked=${!!d.sel[m.id]} onChange=${e => set(prev => ({ sel: Object.assign({}, prev.sel, { [m.id]: e.target.checked }) }))} />
                <${Av} m=${m} /><span class="grow">${m.name}</span><span class="amt">${amt(m.id)}</span>
              </label>`)}
            </div>`}

          ${d.mode === "shares" && html`
            <p class="hint">Wer zwei Anteile hat, zahlt doppelt so viel wie jemand mit einem. Praktisch für Paare, Familien oder unterschiedlich viele Nächte.</p>
            <div class="rows">${people.map(m => {
              const v = FK.parseRate(d.shares[m.id]) || 0;
              const step = n => set(prev => ({ shares: Object.assign({}, prev.shares, { [m.id]: String(Math.max(0, Math.round((v + n) * 2) / 2)) }) }));
              return html`
                <div class="row" key=${m.id}>
                  <${Av} m=${m} /><span class="grow">${m.name}</span><span class="amt">${amt(m.id)}</span>
                  <span class="stepper">
                    <button type="button" aria-label=${"Weniger Anteile für " + m.name} disabled=${v <= 0} onClick=${() => step(-1)}>−</button>
                    <output aria-label=${"Anteile von " + m.name}>${String(v).replace(".", ",")}</output>
                    <button type="button" aria-label=${"Mehr Anteile für " + m.name} onClick=${() => step(1)}>+</button>
                  </span>
                </div>`;
            })}</div>`}

          ${d.mode === "exact" && html`
            <div class="rows">${people.map(m => html`
              <div class="row" key=${m.id}>
                <${Av} m=${m} /><span class="grow">${m.name}</span>
                <input id=${"fk-ex-" + m.id} class="input num" inputmode="decimal" autocomplete="off" placeholder=${FK.plain(0, d.cur)} aria-label=${"Betrag für " + m.name} value=${d.exact[m.id]}
                  onInput=${e => set(prev => ({ exact: Object.assign({}, prev.exact, { [m.id]: e.target.value }) }))} />
              </div>`)}
            </div>
            <div class="sumline"><span>Verteilt <b>${FK.num(exactSum, d.cur)}</b> von ${FK.num(amount, d.cur)}</span>
              ${amount - exactSum !== 0 ? html`<span class="neg">${amount > exactSum ? "noch offen " : "zu viel "}${FK.num(Math.abs(amount - exactSum), d.cur)}</span>` : html`<span class="pos">geht auf</span>`}
            </div>`}

          ${d.mode === "items" && html`
            <div class="chips" role="group" aria-label="Wer war dabei?">${people.map(m => html`
              <button type="button" key=${m.id} class="chip" aria-pressed=${String(!!d.sel[m.id])} onClick=${() => set(prev => ({ sel: Object.assign({}, prev.sel, { [m.id]: !prev.sel[m.id] }) }))}><${Av} m=${m} s=${1} />${m.name}</button>`)}
            </div>
            <p class="hint">Oben wählst du, wer dabei war. Bei jeder Position tippst du die Personen an, die sie hatten. «Alle» teilt sie unter allen, die dabei waren.</p>
            <div class="receipt">
              ${d.items.map((it, i) => {
                const picked = part.filter(m => it.for[m.id]);
                return html`
                  <div class="item" key=${it.k}>
                    <div class="item-top">
                      <input id=${"fk-it-n-" + it.k} class="input" maxlength="60" autocomplete="off" placeholder="Position" aria-label=${"Bezeichnung Position " + (i + 1)} value=${it.name} onInput=${e => setItem(it.k, { name: e.target.value })} />
                      <input id=${"fk-it-a-" + it.k} class="input num" inputmode="decimal" autocomplete="off" placeholder=${FK.plain(0, d.cur)} aria-label=${"Betrag Position " + (i + 1)} value=${it.amountStr} onInput=${e => setItem(it.k, { amountStr: e.target.value })} />
                      <button type="button" class="icon-btn" aria-label=${"Position " + (i + 1) + " entfernen"} onClick=${() => set(prev => ({ items: prev.items.filter(x => x.k !== it.k) }))}><${Icon} n="close" s=${18} /></button>
                    </div>
                    <div class="item-who" role="group" aria-label=${"Wer hatte Position " + (i + 1) + "?"}>
                      <button type="button" class="tog" aria-pressed=${String(picked.length === 0)} onClick=${() => setItem(it.k, { for: {} })}>Alle</button>
                      ${part.map(m => html`<button type="button" key=${m.id} class=${"tog p" + (picked.length === 0 || it.for[m.id] ? " on" : "")} aria-pressed=${String(!!it.for[m.id])} aria-label=${m.name} title=${m.name} onClick=${() => toggleItem(it, m.id)}><${Av} m=${m} /></button>`)}
                    </div>
                  </div>`;
              })}
              <div><button type="button" class="btn small" onClick=${() => set(prev => ({ items: prev.items.concat({ k: newId(), name: "", amountStr: "", for: {} }) }))}><${Icon} n="plus" s=${16} />Position</button></div>
              <div class="sumline"><span>Positionen <b>${FK.num(itemSum, d.cur)}</b></span>
                ${amount > 0 && amount !== itemSum && html`<span>${amount > itemSum ? "Rest " : "Abzug "}<b>${FK.num(Math.abs(amount - itemSum), d.cur)}</b>, anteilig verteilt</span>`}
              </div>
            </div>
            ${amount > 0 && html`
              <div class="rows">${part.map(m => html`<div class="row" key=${m.id}><${Av} m=${m} /><span class="grow">${m.name}</span><span class="amt">${amt(m.id)}</span></div>`)}</div>`}`}
        </div>
        <div class="field">
          <label for="fk-date">Datum</label>
          <input id="fk-date" class="input" type="date" value=${d.date} onInput=${e => set({ date: e.target.value })} />
        </div>
        ${slow && html`<p class="hint" role="status">${SLOW}</p>`}
        <div class="foot">
          <button type="button" class="btn primary block" disabled=${busy} onClick=${save}>Speichern</button>
          ${!d.isNew && html`<${DeleteButton} label="Ausgabe löschen" onConfirm=${del} disabled=${busy} />`}
          ${!d.isNew && byName && html`<p class="meta">Erfasst von ${byName.name}</p>`}
        </div>
      <//>`;
  }

  /* ---------- payment between two people ---------- */
  function TransferForm({ trip, transfer, preset, meId, act, onClose, say }) {
    const base = trip.base;
    const people = useMemo(() => {
      const ms = membersOf(trip), all = membersOf(trip, true), have = new Set(ms.map(m => m.id)), extra = [];
      if (transfer) refsOf(transfer).forEach(id => { if (!have.has(id)) { have.add(id); extra.push(all.find(m => m.id === id) || GHOST(id)); } });
      return ms.concat(extra);
    }, [trip, transfer]);
    const tripRate = cur => (cur !== base && (trip.rates || {})[cur] ? FK.rateText(trip.rates[cur]) : "");
    const [d, setD] = useState(() => {
      if (transfer) return { id: transfer.id, isNew: false, from: transfer.payer, to: transfer.to, amountStr: FK.plain(transfer.amount, transfer.cur), cur: transfer.cur,
        rateStr: transfer.rate > 0 ? FK.rateText(transfer.rate) : tripRate(transfer.cur), rateMode: transfer.rate > 0 && transfer.rateAuto ? "auto" : "manual",
        rateInfo: transfer.rate > 0 && transfer.rateAuto && transfer.rateDate ? { date: transfer.rateDate, source: "" } : null, date: FK.validDate(transfer.date) ? transfer.date : FK.today(), ts: transfer.ts || Date.now(), by: transfer.by || null };
      const p = preset || {};
      return { id: expenseId(), isNew: true, from: p.from || meId || null, to: p.to || null, amountStr: p.amount ? FK.plain(p.amount, base) : "", cur: base, rateStr: "", rateMode: "auto", rateInfo: null, date: FK.today(), ts: Date.now(), by: meId || null };
    });
    const [err, setErr] = useState(null);
    const [busy, setBusy] = useState(false);
    const lock = useRef(false), slow = useSlow(busy);
    const set = patch => { setErr(null); setD(prev => Object.assign({}, prev, typeof patch === "function" ? patch(prev) : patch)); };
    const rateCtl = useRate(trip, d, set, transfer && transfer.cur !== base && transfer.rate > 0 ? { cur: transfer.cur, date: d.date } : null);
    const foreign = d.cur !== base, rate = foreign ? FK.parseRate(d.rateStr) : 1;
    const amount = FK.parseAmount(d.amountStr, d.cur) || 0;
    const save = async () => {
      if (lock.current) return;
      if (foreign && rateCtl.busy) { setErr("Der Tageskurs wird noch geladen. Einen Moment, dann nochmal speichern."); return; }
      if (foreign && !rate) { setErr("Gib den Wechselkurs für " + d.cur + " ein: Wie viel " + base + " kostet 1 " + d.cur + "?"); return; }
      const body = Object.assign({ id: d.id, kind: "transfer", amount, cur: d.cur, rate: null, rateAuto: false, rateDate: "", date: d.date, payer: d.from, to: d.to, by: d.by, ts: d.ts, up: Date.now() }, foreign ? rateFields(d) : {});
      const problem = FK.check(body, trip);
      if (problem) { setErr(problem); return; }
      lock.current = true; setErr(null); setBusy(true);
      if (foreign) act.rememberRate(trip, d.cur, rate);
      const ok = await act.saveExpense(trip.id, body);
      lock.current = false; setBusy(false);
      if (ok) { onClose(); say(d.isNew ? "Zahlung eingetragen." : "Änderung gespeichert."); }
    };
    const del = async () => {
      if (lock.current) return;
      lock.current = true; setBusy(true);
      const ok = await act.removeExpense(trip.id, d.id);
      lock.current = false; setBusy(false);
      if (ok) { onClose(); say("Zahlung gelöscht."); }
    };
    const pick = (key, labelId, label) => html`
      <div class="field">
        <span class="label" id=${labelId}>${label}</span>
        <div class="chips" role="radiogroup" aria-labelledby=${labelId}>${people.map(m => html`
          <button type="button" key=${m.id} role="radio" aria-checked=${String(d[key] === m.id)} class="chip" onClick=${() => set({ [key]: m.id })}><${Av} m=${m} s=${1} />${m.id === meId ? m.name + " (ich)" : m.name}</button>`)}
        </div>
      </div>`;
    return html`
      <${Sheet} title=${d.isNew ? "Zahlung eintragen" : "Zahlung"} onClose=${onClose} error=${err} action=${html`<button type="button" class="btn primary small" disabled=${busy} onClick=${save}>Speichern</button>`}>
        <p class="hint">Hier trägst du ein, wenn jemand einer anderen Person Geld zurückgegeben hat, bar oder per Twint. Das gleicht die Salden aus.</p>
        ${pick("from", "fk-tr-from", "Wer hat bezahlt?")}
        ${pick("to", "fk-tr-to", "An wen?")}
        <div class="field">
          <label for="fk-tr-amount">Betrag</label>
          <div class="amount-row">
            <input id="fk-tr-amount" class="input amount" inputmode="decimal" autocomplete="off" placeholder=${FK.plain(0, d.cur)} value=${d.amountStr} onInput=${e => set({ amountStr: e.target.value })} />
            <${CurSelect} id="fk-tr-cur" cls="cur" value=${d.cur} trip=${trip} onChange=${cur => { if (cur && cur !== d.cur) set({ cur, rateStr: "", rateMode: "auto", rateInfo: null }); }} />
          </div>
          ${foreign && rate && amount > 0 && html`<p class="hint m">≈ ${FK.money(FK.toBase(amount, d.cur, base, rate), base)}</p>`}
        </div>
        ${foreign && html`<${RateField} cur=${d.cur} base=${base} d=${d} busy=${rateCtl.busy} onValue=${v => set({ rateStr: v, rateMode: "manual", rateInfo: null })} onRefresh=${rateCtl.refresh} />`}
        <div class="field">
          <label for="fk-tr-date">Datum</label>
          <input id="fk-tr-date" class="input" type="date" value=${d.date} onInput=${e => set({ date: e.target.value })} />
        </div>
        ${slow && html`<p class="hint" role="status">${SLOW}</p>`}
        <div class="foot">
          <button type="button" class="btn primary block" disabled=${busy} onClick=${save}>Speichern</button>
          ${!d.isNew && html`<${DeleteButton} label="Zahlung löschen" onConfirm=${del} disabled=${busy} />`}
        </div>
      <//>`;
  }

  /* ---------- trip: expense list ---------- */
  function ExpenseList({ trip, expenses, who, meId, nActive, canEdit, onEdit }) {
    const base = trip.base;
    const groups = useMemo(() => {
      const g = {};
      (expenses || []).forEach(e => { const k = FK.validDate(e.date) ? e.date : ""; (g[k] || (g[k] = [])).push(e); });
      return Object.keys(g).sort().reverse().map(date => {
        const items = g[date].slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
        let sum = 0;
        items.forEach(e => { if (e.kind !== "transfer") { const s = FK.shares(e, trip); if (s) sum += s.total; } });
        return { date, items, sum };
      });
    }, [expenses, trip]);
    if (expenses === null) return html`<p class="status" role="status">Buchungen werden geladen …</p>`;
    if (!groups.length) return html`
      <section class="empty">
        <span class="empty-e" aria-hidden="true">🧾</span>
        <h2>Noch keine Ausgaben</h2>
        <p>${canEdit ? "Tippe unten auf «Ausgabe» und trag die erste ein. Fremdwährungen rechnet die Ferienkasse zum Tageskurs um." : "Sobald jemand eine Ausgabe erfasst, erscheint sie hier."}</p>
      </section>`;
    const row = e => {
      const s = FK.shares(e, trip), payer = who(e.payer), foreign = e.cur !== base;
      let icon, title, sub, top, small, smallCls = "";
      if (e.kind === "transfer") {
        icon = "pay"; title = payer.name + " → " + who(e.to).name; sub = "Zahlung" + (foreign ? " · " + FK.money(e.amount, e.cur) : "");
        top = s ? FK.money(s.total, base) : FK.money(e.amount, e.cur);
        small = s ? (meId === e.payer ? "von dir" : meId === e.to ? "an dich" : "") : "Kurs fehlt";
      } else {
        const n = s ? Object.keys(s.parts).length : 0;
        icon = FK.isCat(e.cat) ? e.cat : "other"; title = e.title || FK.catLabel(e.cat);
        sub = (e.payer === meId ? "Du hast bezahlt" : payer.name + " hat bezahlt") + (s ? (n >= nActive ? " · für alle" : " · für " + n) : "") + (foreign ? " · " + FK.money(e.amount, e.cur) : "");
        top = s ? FK.money(s.total, base) : FK.money(e.amount, e.cur);
        small = !s ? "Kurs fehlt" : !meId ? "" : s.parts[meId] ? html`dein Anteil <span class="m">${FK.num(s.parts[meId], base)}</span>` : "ohne dich";
      }
      if (!s) smallCls = "neg";
      const inner = html`
        <span class=${"x-ic k-" + icon} aria-hidden="true">${icon === "pay" ? "🤝" : FK.catEmoji(icon)}</span>
        <span class="x-main"><span class="x-t">${title}</span><span class="x-s">${sub}</span></span>
        <span class="x-a"><span>${top}</span>${small && html`<small class=${smallCls}>${small}</small>`}</span>`;
      return canEdit
        ? html`<button type="button" key=${e.id} class="x" onClick=${() => onEdit(e)}>${inner}</button>`
        : html`<div key=${e.id} class="x">${inner}</div>`;
    };
    return groups.map(g => html`
      <section class="stack" key=${g.date || "none"}>
        <div class="day"><h2 class="day-date">${g.date ? FK.dayLabel(g.date) : "Ohne Datum"}</h2>${g.sum > 0 && html`<span class="day-sum">${FK.money(g.sum, base)}</span>`}</div>
        <div class="list">${g.items.map(row)}</div>
      </section>`);
  }

  /* ---------- trip: balances and settling up ---------- */
  function Settle({ trip, bal, plan, who, meId, canEdit, onPay, onTransfer, say }) {
    const base = trip.base;
    const [copyText, setCopyText] = useState(null);
    const ids = Object.keys(bal.per).sort((a, b) => bal.per[b].net - bal.per[a].net || (who(a).name < who(b).name ? -1 : 1));
    const max = ids.reduce((m, id) => Math.max(m, Math.abs(bal.per[id].net)), 0);
    const last = ids.length ? ids[ids.length - 1] : null;
    const copy = () => {
      const text = FK.summaryText(trip, bal, plan), fallback = () => setCopyText(text);
      try { navigator.clipboard.writeText(text).then(() => { setCopyText(null); say("Abrechnung kopiert. Füg sie in euren Gruppenchat ein."); }, fallback); } catch (e) { fallback(); }
    };
    const canShare = typeof navigator.share === "function";
    const share = () => { navigator.share({ text: FK.summaryText(trip, bal, plan) }).catch(() => {}); };
    const meme = FK.meme({ net: meId && bal.per[meId] ? bal.per[meId].net : null, base, count: bal.count, payments: plan.payments.length, seed: trip.id });
    const square = bal.count > 0 && plan.payments.length === 0 && !bal.missing;
    return html`
      ${square && html`<${Confetti} />`}
      <${Meme} m=${meme} />
      ${bal.missing > 0 && html`
        <div class="note warn"><${Icon} n="swap" /><div>${bal.missing === 1 ? "Eine Buchung hat" : bal.missing + " Buchungen haben"} keinen Wechselkurs und ${bal.missing === 1 ? "fehlt" : "fehlen"} in der Abrechnung. Öffne sie in der Liste und trag den Kurs ein.</div></div>`}
      <section class="panel">
        <div class="panel-head"><h2 class="sec-h">Salden in ${base}</h2></div>
        <div>${ids.map(id => {
          const p = bal.per[id], m = who(id), w = max ? Math.abs(p.net) / max * 50 : 0;
          return html`
            <div class="bal" key=${id}>
              <${Av} m=${m} />
              <span class="bal-name"><b>${id === meId ? m.name + " (ich)" : m.name}</b><span>${p.net > 0 ? "bekommt Geld" : p.net < 0 ? "schuldet Geld" : "ist quitt"}</span></span>
              <span class=${"bal-v " + (p.net > 0 ? "pos" : p.net < 0 ? "neg" : "")}>${FK.signed(p.net, base)}</span>
              <span class="bal-track" aria-hidden="true">${p.net !== 0 && html`<i class=${"bal-fill " + (p.net > 0 ? "up" : "down")} style=${"width:" + w.toFixed(2) + "%"}></i>`}</span>
            </div>`;
        })}</div>
        ${last && bal.per[last].net < 0 && html`<p>Tipp: Die nächste Runde geht auf ${who(last).name}, dort ist das Minus am grössten.</p>`}
      </section>
      <section class="panel">
        <div class="panel-head"><h2 class="sec-h">So seid ihr quitt</h2></div>
        ${plan.payments.length === 0
          ? html`<p>${bal.count ? "Alle sind quitt. Niemand schuldet jemandem etwas." : "Sobald Ausgaben erfasst sind, steht hier, wer wem wie viel zahlt."}</p>`
          : html`
            <div>${plan.payments.map(p => html`
              <div class="pay" key=${p.from + p.to}>
                <span class="pay-who"><span><${Av} m=${who(p.from)} s=${1} />${who(p.from).name}</span><${Icon} n="arrow" s=${16} /><span><${Av} m=${who(p.to)} s=${1} />${who(p.to).name}</span></span>
                <span class="pay-amt">${FK.money(p.amount, base)}</span>
                ${canEdit && html`<button type="button" class="btn small" onClick=${() => onPay(p)}><${Icon} n="check" s=${16} />Als bezahlt eintragen</button>`}
              </div>`)}
            </div>
            <p>${plan.payments.length === 1 ? "Eine Zahlung genügt." : plan.payments.length + " Zahlungen genügen." }${plan.exact ? " Weniger geht nicht." : ""}</p>`}
        <div class="btn-row">
          ${bal.count > 0 && canShare && html`<button type="button" class="btn small" onClick=${share}><${Icon} n="share" s=${16} />Abrechnung teilen</button>`}
          ${bal.count > 0 && html`<button type="button" class="btn small" onClick=${copy}><${Icon} n="copy" s=${16} />Abrechnung kopieren</button>`}
          ${canEdit && html`<button type="button" class="btn small" onClick=${onTransfer}><${Icon} n="swap" s=${16} />Zahlung eintragen</button>`}
        </div>
        ${copyText && html`
          <div class="field">
            <label for="fk-copy">Kopieren hat nicht geklappt. Markiere den Text und kopiere ihn von Hand.</label>
            <textarea id="fk-copy" class="copybox" readonly value=${copyText} onFocus=${e => e.target.select()}></textarea>
          </div>`}
      </section>`;
  }

  /* ---------- trip: statistics and stamps ---------- */
  const ROT = [-3, 2, -1.5, 3, -2.5, 1.5, -2, 2.5];
  function Stats({ trip, expenses, bal, who, meId, nActive }) {
    const base = trip.base, f = Math.pow(10, FK.digits(base));
    const [scope, setScope] = useState("all");
    const [hot, setHot] = useState(null);
    const mine = scope === "me" && meId;
    const st = useMemo(() => FK.stats(trip, expenses || [], mine ? meId : null), [trip, expenses, mine, meId]);
    const aw = useMemo(() => FK.awards(trip, expenses || [], bal), [trip, expenses, bal]);
    const all = useMemo(() => (mine ? FK.stats(trip, expenses || [], null) : st), [trip, expenses, mine, st]);
    if (!all.count) return html`
      <section class="empty"><span class="empty-e" aria-hidden="true">📊</span><h2>Noch keine Zahlen</h2><p>Sobald Ausgaben erfasst sind, siehst du hier, wofür das Geld weggeht, was jeder Tag gekostet hat und wer welchen Stempel verdient.</p></section>`;
    const catMax = st.cats.length ? st.cats[0].amount : 0;
    const dayMax = st.days.reduce((m, d) => Math.max(m, d.amount), 0), top = FK.niceMax(dayMax);
    const peak = st.days.reduce((b, d, i) => (b == null || d.amount > st.days[b].amount ? i : b), null);
    const shown = hot != null && st.days[hot] ? hot : peak;
    const tick = v => (v % f === 0 ? FK.whole(v, base) : FK.num(v, base));
    const nDays = st.days.length, every = nDays <= 16 ? 1 : nDays <= 32 ? 2 : 5;
    const pids = Object.keys(bal.per).filter(id => bal.per[id].share > 0 || bal.per[id].paid > 0).sort((a, b) => bal.per[b].share - bal.per[a].share);
    const pMax = pids.reduce((m, id) => Math.max(m, bal.per[id].share), 0);
    const boom = FK.memeTotal(all.total, base);
    return html`
      ${boom && html`<${Meme} m=${boom} />`}
      ${meId && html`
        <div class="seg onbg" role="group" aria-label="Auswertung für">
          <button type="button" aria-pressed=${String(!mine)} onClick=${() => { setScope("all"); setHot(null); }}>Ganze Gruppe</button>
          <button type="button" aria-pressed=${String(!!mine)} onClick=${() => { setScope("me"); setHot(null); }}>Nur mein Anteil</button>
        </div>`}
      <section class="kpis" aria-label="Kennzahlen">
        <div class="kpi"><span class="eyebrow">${mine ? "Mein Anteil " + base : "Total " + base}</span><span class="fig">${FK.num(st.total, base)}</span></div>
        ${mine
          ? html`<div class="kpi"><span class="eyebrow">Buchungen</span><span class="fig">${st.count}</span></div>`
          : html`<div class="kpi"><span class="eyebrow">Pro Person</span><span class="fig">${FK.whole(st.total / Math.max(1, nActive), base)}</span></div>`}
        <div class="kpi"><span class="eyebrow">Pro Tag</span><span class="fig">${FK.whole(st.total / Math.max(1, st.span), base)}</span></div>
      </section>
      ${st.count === 0 && html`<section class="panel"><p>Du bist bisher an keiner Ausgabe beteiligt.</p></section>`}
      ${st.cats.length > 0 && html`
        <section class="panel">
          <div class="panel-head"><h2 class="sec-h">Nach Kategorie</h2></div>
          <div class="bars">${st.cats.map(c => html`
            <div class="bar" key=${c.id}>
              <span class="bar-l"><span class="emo" aria-hidden="true">${FK.catEmoji(c.id)}</span>${c.label}</span>
              <span class="bar-v">${FK.num(c.amount, base)}<small>${Math.round(c.amount / st.total * 100)} %</small></span>
              <span class="bar-t" aria-hidden="true"><i class="bar-f" style=${"display:block;width:" + (c.amount / catMax * 100).toFixed(2) + "%"}></i></span>
            </div>`)}
          </div>
        </section>`}
      ${nDays > 1 && html`
        <section class="panel">
          <div class="panel-head"><h2 class="sec-h">Pro Tag</h2></div>
          <div class="readout" aria-live="polite">
            <span>${shown != null ? (hot == null ? "Teuerster Tag: " : "") + FK.dayLabel(st.days[shown].date) : ""}</span>
            <b>${shown != null ? FK.money(st.days[shown].amount, base) : ""}</b>
          </div>
          <div class="plot-scroll">
            <div class="plot">
              <div class="cols" onMouseLeave=${() => setHot(null)}>
                <span class="grid-l" style="bottom:100%"><span>${tick(top)}</span></span>
                <span class="grid-l" style="bottom:50%"><span>${tick(top / 2)}</span></span>
                ${st.days.map((d, i) => html`
                  <button type="button" key=${d.date} class="col" aria-pressed=${String(hot === i)} aria-label=${FK.dayLabel(d.date) + ": " + FK.money(d.amount, base)}
                    onMouseEnter=${() => setHot(i)} onFocus=${() => setHot(i)} onClick=${() => setHot(i)}>
                    <i style=${"height:" + (d.amount / top * 100).toFixed(2) + "%" + (d.amount > 0 ? ";min-height:2px" : "")}></i>
                  </button>`)}
              </div>
              <div class="col-x" aria-hidden="true">${st.days.map((d, i) => html`<span key=${d.date}>${i % every === 0 ? +d.date.slice(8) : ""}</span>`)}</div>
            </div>
          </div>
          <p>${FK.rangeLabel(st.first, st.last)}. Tippe auf einen Tag für den Betrag.</p>
        </section>`}
      ${!mine && pids.length > 0 && html`
        <section class="panel">
          <div class="panel-head"><h2 class="sec-h">Pro Person</h2></div>
          <p>Der Balken zeigt, was die Reise jede Person gekostet hat. Darunter steht, was sie vorgestreckt hat.</p>
          <div class="ptable">${pids.map(id => html`
            <div class="prow" key=${id}>
              <${Av} m=${who(id)} /><b>${who(id).name}</b><span class="bar-v">${FK.num(bal.per[id].share, base)}</span>
              <span class="bar-t" aria-hidden="true"><i class="bar-f" style=${"display:block;width:" + (pMax ? bal.per[id].share / pMax * 100 : 0).toFixed(2) + "%"}></i></span>
              <small>vorgestreckt ${FK.num(bal.per[id].paid, base)}</small>
            </div>`)}
          </div>
        </section>`}
      <section class="panel">
        <div class="panel-head"><h2 class="sec-h">Stempel der Reise</h2></div>
        ${aw.length === 0
          ? html`<p>Ab drei Ausgaben gibt es Stempel: für die Spendierhose, den Feinschmecker, den Sparfuchs und andere.</p>`
          : html`<div class="stamps">${aw.map((a, i) => html`
              <div class=${"stamp s" + (i % 4 + 1)} key=${a.id} style=${"--rot:" + ROT[i % ROT.length] + "deg"}>
                <span class="stamp-e" aria-hidden="true">${a.emoji}</span><span class="stamp-t">${a.title}</span><span class="stamp-w">${a.who}</span><span class="stamp-n">${a.note}</span>
              </div>`)}
            </div>`}
      </section>`;
  }

  /* ---------- trip view ---------- */
  const TABS = [["list", "Ausgaben", "🧾"], ["settle", "Abrechnung", "⚖️"], ["stats", "Statistik", "📊"]];
  function TripView({ trip, mode, expenses, meId, canEdit, tab, setTab, onBack, open, setMe, say, note }) {
    const ms = useMemo(() => membersOf(trip), [trip]);
    const byId = useMemo(() => { const o = {}; membersOf(trip, true).forEach(m => { o[m.id] = m; }); return o; }, [trip]);
    const who = useCallback(id => byId[id] || GHOST(id), [byId]);
    const bal = useMemo(() => FK.balances(trip, expenses || []), [trip, expenses]);
    const plan = useMemo(() => FK.settle(FK.netOf(bal)), [bal]);
    const range = useMemo(() => {
      const ds = (expenses || []).filter(e => e.kind !== "transfer" && FK.validDate(e.date)).map(e => e.date).sort();
      return ds.length ? FK.rangeLabel(ds[0], ds[ds.length - 1]) : "";
    }, [expenses]);
    const [pick, setPick] = useState(false);
    const base = trip.base, my = meId && bal.per[meId] ? bal.per[meId].net : null;
    const meM = meId ? ms.find(m => m.id === meId) || null : null;
    /* The bar at the bottom works like in a phone app: every view starts at its top, and a tap on the open one leads back up. */
    const pickTab = id => { if (id !== tab) setTab(id); try { window.scrollTo(0, 0); } catch (e) { /* nothing to scroll */ } };
    return html`
      <div class="top">
        <button type="button" class="back" onClick=${onBack}><${Icon} n="back" />Reisen</button>
        <span class="top-actions">
          <button type="button" class="btn small" onClick=${() => open({ t: "invite" })}><${Icon} n="share" s=${16} />Einladen</button>
          <button type="button" class="icon-btn" aria-label="Reise bearbeiten" onClick=${() => open({ t: "trip-edit" })}><${Icon} n="sliders" s=${22} /></button>
        </span>
      </div>
      ${note}
      <${InstallHint} slim onHow=${() => open({ t: "install" })} />
      <section class="ticket">
        <div class="ticket-main">
          <span class="eyebrow">Reise</span>
          <h1>${trip.name}</h1>
          <div class="ticket-meta">
            <span>${range || "Noch keine Ausgaben"} · ${ms.length} Personen</span>
            <span class="avs" aria-hidden="true">${ms.slice(0, 8).map(m => html`<${Av} key=${m.id} m=${m} s=${1} />`)}</span>
          </div>
        </div>
        ${meM
          ? html`<button type="button" class="me" aria-label=${meM.chosen ? "Deinen Avatar ändern" : "Deinen Avatar wählen"} onClick=${() => open({ t: "avatar", m: meM.id })}><${Av} m=${meM} s=${2} /><span class="pen" aria-hidden="true"><${Icon} n="pen" s=${15} /></span></button>`
          : html`<button type="button" class="me" aria-label="Zuerst deinen Namen wählen" aria-expanded=${String(pick)} onClick=${() => setPick(!pick)}><span class="ask" aria-hidden="true">?</span></button>`}
        <div class="ticket-stub">
          <div class="cell"><span class="eyebrow">Total ${base}</span><span class="fig">${FK.num(bal.total, base)}</span><span class="fig-note">${bal.count === 1 ? "1 Ausgabe" : bal.count + " Ausgaben"}</span></div>
          <div class="cell"><span class="eyebrow">Mein Saldo</span>
            ${my != null
              ? html`<span class=${"fig " + (my > 0 ? "pos" : my < 0 ? "neg" : "")}>${FK.signed(my, base)}</span><span class="fig-note">${my > 0 ? "du bekommst Geld" : my < 0 ? "du schuldest Geld" : "du bist quitt"}</span>`
              : html`<button type="button" class="btn small" aria-expanded=${String(pick)} onClick=${() => setPick(!pick)}><${Icon} n="user" s=${16} />Wer bist du?</button>`}
          </div>
        </div>
      </section>
      ${pick && my == null && html`
        <section class="who">
          <span class="label" id="fk-who-l">Tippe auf deinen Namen</span>
          <div class="chips" role="radiogroup" aria-labelledby="fk-who-l">${ms.map(m => html`
            <button type="button" key=${m.id} role="radio" aria-checked="false" class="chip" onClick=${() => { setMe(m.id); setPick(false); open({ t: "avatar", m: m.id }); }}><${Av} m=${m} s=${1} />${m.name}</button>`)}
          </div>
        </section>`}
      <div class="tabs" role="tablist" aria-label="Ansicht">${TABS.map(([id, label, icon]) => html`
        <button type="button" key=${id} role="tab" id=${"fk-tab-" + id} aria-selected=${String(tab === id)} class="tab" onClick=${() => pickTab(id)}><span class="tab-e" aria-hidden="true">${icon}</span><span>${label}</span></button>`)}
      </div>
      <div class="stack" role="tabpanel" aria-labelledby=${"fk-tab-" + tab} style="gap:16px">
        ${tab === "list" && html`<${ExpenseList} trip=${trip} expenses=${expenses} who=${who} meId=${meId} nActive=${ms.length} canEdit=${canEdit}
          onEdit=${e => open(e.kind === "transfer" ? { t: "transfer", e } : { t: "expense", e })} />`}
        ${tab === "settle" && html`<${Settle} trip=${trip} bal=${bal} plan=${plan} who=${who} meId=${meId} canEdit=${canEdit} say=${say}
          onPay=${p => open({ t: "transfer", preset: p })} onTransfer=${() => open({ t: "transfer" })} />`}
        ${tab === "stats" && html`<${Stats} trip=${trip} expenses=${expenses} bal=${bal} who=${who} meId=${meId} nActive=${ms.length} />`}
      </div>
      ${canEdit && html`<button type="button" class="fab" onClick=${() => open({ t: "expense" })}><${Icon} n="plus" s=${22} />Ausgabe</button>`}
    `;
  }

  /* ---------- app ---------- */
  /* Why a shared trip cannot be shown, by the answer of the sync server. */
  const GATE = { "permission-denied": "denied", unconfigured: "unconfigured", "setup-db": "setup-db", "invalid-argument": "setup", unauthenticated: "setup", "failed-precondition": "setup", "resource-exhausted": "quota" };
  /* What is wrong with the group sync, in one line above the trip. */
  const TROUBLE = {
    "permission-denied": "Der Gruppen-Sync lehnt den Zugriff ab. In Firebase fehlen vermutlich die Sicherheitsregeln (README, Abschnitt «Gruppen-Sync einrichten»).",
    "setup-db": "Im Firebase-Projekt gibt es noch keine Firestore-Datenbank (README, Abschnitt «Gruppen-Sync einrichten»).",
    "resource-exhausted": "Das kostenlose Tageskontingent von Firebase ist aufgebraucht. Am Morgen wird es wieder frei.",
    "invalid-argument": "Firebase lehnt die Angaben aus config.js ab. Prüf sie auf der Startseite in den Einstellungen mit «Verbindung prüfen».",
    internal: "Beim Gruppen-Sync ist etwas durcheinandergeraten. Lade die Seite neu."
  };
  TROUBLE.unauthenticated = TROUBLE["failed-precondition"] = TROUBLE["invalid-argument"];
  const HOME_URL = location.pathname + location.search;
  const historyState = () => { try { return history.state || null; } catch (e) { return null; } };
  /* The address always names the open trip, so the page can be bookmarked and the back button works.
     A trip opened on top of the list is marked ("over"): leaving it is then one step back, and no dead entries pile up. */
  function setUrl(id, push) {
    try {
      if (!id) history.replaceState({ fk: "home" }, "", HOME_URL);
      else if (push) history.pushState({ fk: "trip", over: true }, "", "#" + id);
      else { const st = historyState(); history.replaceState({ fk: "trip", over: !!(st && st.fk === "trip" && st.over && location.hash === "#" + id) }, "", "#" + id); }
    } catch (e) { /* the address is a convenience */ }
  }

  function App() {
    const [reg, setReg] = useState(() => Store.registry.list());
    const [tripId, setTripId] = useState(null);
    /* What the store reported, and for which trip. raw: undefined = loading, null = gone, a string = why it cannot be shown, an object = the trip. */
    const [live, setLive] = useState({ id: null, raw: undefined, expenses: null });
    const [sync, setSync] = useState({ pending: false, cached: false });
    const [online, setOnline] = useState(() => navigator.onLine !== false);
    const [stuck, setStuck] = useState(false);
    const [slow, setSlow] = useState(false);             // online, but the sync server has not confirmed the shown data for a while
    const [trouble, setTrouble] = useState(null);        // the server's reason when the sync does not work although the device is online
    const [tab, setTab] = useState("list");
    const [sheet, setSheet] = useState(null);
    const [toast, setToast] = useState(null);
    const [meMap, setMeMap] = useState(() => ls.get("fk.me", {}));
    const sheetRef = useRef(null), tripRef = useRef(null), leaving = useRef(false);
    sheetRef.current = sheet; tripRef.current = tripId;
    const say = useCallback((msg, kind) => setToast({ msg, kind: kind || "ok", k: Date.now() }), []);
    const refreshReg = useCallback(() => setReg(Store.registry.list()), []);

    const entry = useMemo(() => reg.find(e => e.id === tripId) || null, [reg, tripId]);
    const mode = entry ? entry.mode : null;
    const raw = live.id === tripId ? live.raw : undefined, expenses = live.id === tripId ? live.expenses : null;

    const showTrip = useCallback((id, push) => {
      setTripId(id); setTab("list"); setSheet(null); setTrouble(null);
      ls.set("fk.last", id || "");
      if (id) { Store.registry.touch(id); setReg(Store.registry.list()); }
      const st = historyState();
      if (id && push && st && st.fk === "sheet") {                    // from a sheet on the start page: the trip takes the sheet's place
        try { history.replaceState({ fk: "trip", over: true }, "", "#" + id); } catch (e) { /* the address is a convenience */ }
      } else setUrl(id, push);
      try { window.scrollTo(0, 0); } catch (e) { /* nothing to scroll */ }
    }, []);
    const goHome = useCallback(() => {
      setTripId(null); setTab("list"); setSheet(null); setTrouble(null);
      sheetRef.current = null; tripRef.current = null;
      ls.set("fk.last", "");
      try { window.scrollTo(0, 0); } catch (e) { /* nothing to scroll */ }
      const st = historyState();
      if (st && st.fk === "trip" && st.over) {
        leaving.current = true; setTimeout(() => { leaving.current = false; }, 1000);
        try { history.back(); return; } catch (e) { leaving.current = false; }
      }
      setUrl(null);
    }, []);
    const join = useCallback((id, push) => {
      if (!Store.registry.get(id)) {
        if (!Store.cloudOn) { say("Dieser Link gehört zu einer geteilten Reise. " + FAIL.unconfigured, "err"); return false; }
        Store.registry.put({ id, name: "", mode: "cloud" });
      }
      showTrip(id, push);
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* optional */ }
      return true;
    }, [say, showTrip]);

    useEffect(() => {
      const hashId = () => { try { return (location.hash || "").replace(/^#/, ""); } catch (e) { return ""; } };
      const h = hashId();
      let start = null;
      if (h && Store.validId(h)) start = h;
      else {
        const last = ls.get("fk.last", null), list = Store.registry.list();
        if (last && list.some(e => e.id === last)) start = last;
        else if (list.length === 1 && last !== "") start = list[0].id;
      }
      if (start) {
        /* The list always lies beneath the first trip, so "back" leads to the list instead of out of the app. */
        const st = historyState(), kept = !!(st && st.fk === "trip" && st.over && h === start);
        if (!kept) setUrl(null);
        if (!join(start, !kept)) setUrl(null);
      } else setUrl(null);
      const onHash = () => {
        const x = hashId();
        if (leaving.current) { leaving.current = false; if (x) setUrl(null); return; }      // arrived beneath the trip after "Reisen"
        if (x && Store.validId(x)) { if (x !== tripRef.current) join(x, false); return; }
        if (sheetRef.current && tripRef.current) {                                         // "back" closes an open sheet first and stays in the trip
          setUrl(tripRef.current, true); setSheet(null); return;
        }
        if (sheetRef.current) { setSheet(null); return; }                                  // the same on the start page
        setTripId(null); setSheet(null); setTrouble(null); ls.set("fk.last", "");
      };
      const on = () => setOnline(true), off = () => setOnline(false);
      window.addEventListener("hashchange", onHash);
      window.addEventListener("online", on);
      window.addEventListener("offline", off);
      return () => { window.removeEventListener("hashchange", onHash); window.removeEventListener("online", on); window.removeEventListener("offline", off); };
    }, []);

    /* Live data of the open trip. A first answer from the device copy can be empty although the server knows more: it is held
       back for a moment, so the page never claims "nothing here" too early. A listener that the server ends is started again
       after a pause, so the page recovers by itself once the reason is gone. */
    useEffect(() => {
      setSync({ pending: false, cached: false }); setTrouble(null);
      setLive(prev => (prev.id === tripId ? prev : { id: tripId, raw: undefined, expenses: null }));
      if (!tripId || !mode) return;
      const a = Store.adapter(mode);
      let alive = true, sure = false, shown = false, latest = [], t1 = null, t2 = null, retry = null, attempt = 0, stops = [], meta = { trip: {}, ex: {} };
      const put = patch => { if (alive) setLive(prev => (prev.id === tripId ? Object.assign({}, prev, patch) : prev)); };
      const pushSync = () => setSync({ pending: !!(meta.trip.pending || meta.ex.pending), cached: !!(meta.trip.cached || meta.ex.cached) });
      const detach = () => { stops.forEach(f => { try { f(); } catch (e) { /* already stopped */ } }); stops = []; };
      const failed = e => {
        if (!alive || retry) return;
        const code = (e && e.code) || "internal";
        detach(); meta = { trip: {}, ex: {} }; pushSync();
        if (sure) setTrouble(code); else put({ raw: GATE[code] || "offline" });
        if (code !== "unconfigured") retry = setTimeout(attach, Math.min(60000, 4000 * Math.pow(2, attempt++)));
      };
      const onTrip = (data, m) => {
        if (!alive) return;
        meta.trip = m || {}; pushSync();
        if (!m || !m.cached) { attempt = 0; setTrouble(null); }
        if (data) { sure = true; if (t1) { clearTimeout(t1); t1 = null; } put({ raw: data }); }
        else if (!m || !m.cached) { sure = true; if (t1) { clearTimeout(t1); t1 = null; } put({ raw: null }); }
        else if (!t1 && !sure) t1 = setTimeout(() => { t1 = null; if (alive && !sure) put({ raw: "offline" }); }, 3000);
      };
      const onEx = (rows, m) => {
        if (!alive) return;
        meta.ex = m || {}; pushSync();
        latest = rows.map(r => { try { return FK.normExpense(r.id, r.data); } catch (e) { return null; } }).filter(Boolean);
        if (m && m.cached && !latest.length && !shown) {
          if (!t2) t2 = setTimeout(() => { t2 = null; shown = true; put({ expenses: latest }); }, 3000);
          return;
        }
        shown = true; if (t2) { clearTimeout(t2); t2 = null; }
        put({ expenses: latest });
      };
      function attach() {
        if (!alive) return;
        retry = null;
        stops = [a.watchTrip(tripId, onTrip, failed), a.watchExpenses(tripId, onEx, failed)];
      }
      attach();
      return () => { alive = false; detach(); [t1, t2, retry].forEach(t => { if (t) clearTimeout(t); }); };
    }, [tripId, mode]);

    const trip = useMemo(() => {
      if (!raw || typeof raw !== "object") return null;
      try { return FK.normTrip(tripId, raw); } catch (e) { return null; }
    }, [raw, tripId]);
    const tripName = trip ? trip.name : null, knownName = entry ? entry.name : null;
    useEffect(() => {
      if (tripName && tripId && knownName !== tripName) { Store.registry.put({ id: tripId, name: tripName }); refreshReg(); }
    }, [tripName, knownName, tripId, refreshReg]);

    useEffect(() => { if (!sync.pending) { setStuck(false); return; } const t = setTimeout(() => setStuck(true), 5000); return () => clearTimeout(t); }, [sync.pending]);
    const unconfirmed = mode === "cloud" && online && sync.cached;
    useEffect(() => { if (!unconfirmed) { setSlow(false); return; } const t = setTimeout(() => setSlow(true), 6000); return () => clearTimeout(t); }, [unconfirmed]);
    /* Online, and still a shared trip stays unreachable, entries stay unsent or the server stays silent: the running sync never
       says why (a missing database or a used-up quota look like "no connection" to it). So ask the server directly, once a minute. */
    const ask = mode === "cloud" && online && (raw === "offline" || stuck || slow);
    useEffect(() => {
      if (!ask) return;
      let alive = true, t = null;
      const run = () => Store.checkCloud().then(
        () => { if (alive) setTrouble(null); },
        e => { if (alive) setTrouble(e && TROUBLE[e.code] ? e.code : null); }
      ).then(() => { if (alive) t = setTimeout(run, 60000); });
      run();
      return () => { alive = false; if (t) clearTimeout(t); };
    }, [ask]);
    useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), toast.kind === "err" ? 6500 : 3200); return () => clearTimeout(t); }, [toast]);

    const fail = useCallback(e => {
      say(FAIL[e && e.code] || "Speichern fehlgeschlagen. Prüf die Verbindung und versuch es nochmal.", "err");
      return false;
    }, [say]);
    useEffect(() => Store.onLateError(fail), [fail]);

    const act = useMemo(() => {
      const a = Store.adapter(mode || "local"), ok = p => p.then(() => true, fail);
      return {
        async createTrip(data) {
          const id = Store.randomId(22), m = Store.cloudOn ? "cloud" : "local";
          try { await Store.adapter(m).createTrip(id, clean(data)); } catch (e) { fail(e); return null; }
          Store.registry.put({ id, name: data.name, mode: m });
          try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* optional */ }
          return id;
        },
        patchTrip(id, patch) { return ok(a.patchTrip(id, clean(patch))); },
        /* Remember the last rate per currency in the trip: the fallback for devices without network. */
        rememberRate(t, cur, rate) {
          const known = (t.rates || {})[cur];
          if (rate > 0 && (!known || Math.abs(known - rate) / rate > 0.01)) a.patchTrip(t.id, { rates: { [cur]: rate } }).catch(() => {});
        },
        saveExpense(tid, e) { const body = clean(e), id = body.id; delete body.id; return ok(a.saveExpense(tid, id, body)); },
        removeExpense(tid, id) { return ok(a.removeExpense(tid, id)); },
        removeTrip(tid, list) { return ok(a.removeTrip(tid, list.map(e => e.id))); }
      };
    }, [mode, fail]);

    const meId = useMemo(() => {
      if (!trip) return null;
      const id = meMap[trip.id], m = trip.members || {};
      return typeof id === "string" && Object.prototype.hasOwnProperty.call(m, id) && !m[id].gone ? id : null;
    }, [trip, meMap]);
    const rememberMe = useCallback((tid, mid) => {
      setMeMap(prev => { const next = Object.assign({}, prev, { [tid]: mid }); ls.set("fk.me", next); return next; });
    }, []);
    const setMe = useCallback(mid => { if (tripRef.current) rememberMe(tripRef.current, mid); }, [rememberMe]);

    const close = useCallback(() => {
      setSheet(null);
      const st = historyState();
      if (st && st.fk === "sheet") {                                  // take the sheet's history entry away again
        leaving.current = true; setTimeout(() => { leaving.current = false; }, 1000);
        try { history.back(); } catch (e) { leaving.current = false; }
      }
    }, []);
    const open = useCallback(s => {
      setSheet(Object.assign({ k: newId() }, s));
      if (!tripRef.current) {
        const st = historyState();
        if (!(st && st.fk === "sheet")) { try { history.pushState({ fk: "sheet" }, "", "#s"); } catch (e) { /* then "back" simply leaves */ } }
      }
    }, []);

    let note = null;
    if (trip && mode === "cloud") {
      if (online && trouble && TROUBLE[trouble]) note = html`<div class="note warn" role="status"><${Icon} n="offline" /><div>${TROUBLE[trouble]}${sync.pending ? " Deine Einträge bleiben auf diesem Gerät, bis es wieder geht." : ""}</div></div>`;
      else if (!online) note = html`<p class="syncline" role="status"><${Icon} n="offline" s=${18} /><span>${Store.cloudDurable
        ? "Ohne Netz. Deine Einträge bleiben auf dem Gerät und werden gesendet, sobald du wieder online bist."
        : "Ohne Netz. Dieser Browser speichert nichts dauerhaft: Lass die Seite offen, bis du wieder online bist, sonst gehen neue Einträge verloren."}</span></p>`;
      else if (stuck) note = html`<p class="syncline" role="status"><span class="spin" aria-hidden="true"></span><span>Einträge werden gesendet …</span></p>`;
      else if (slow) note = html`<p class="syncline" role="status"><span class="spin" aria-hidden="true"></span><span>${Store.cloudDurable
        ? "Der Gruppen-Sync antwortet noch nicht. Deine Einträge bleiben auf dem Gerät und werden gesendet, sobald die Verbindung steht."
        : "Der Gruppen-Sync antwortet noch nicht. Lass die Seite offen, bis die Verbindung steht, sonst gehen neue Einträge verloren."}</span></p>`;
      /* The usual case, and the answer to "is it saved?": the line says so by itself, a moment after every entry. */
      else if (sync.pending || sync.cached) note = html`<p class="syncline busy"><span class="spin" aria-hidden="true"></span><span>${sync.pending ? "Wird für die Gruppe gespeichert …" : "Verbindung zur Gruppe wird aufgebaut …"}</span></p>`;
      else note = html`<p class="syncline auto"><${Icon} n="check" s=${18} /><span>Automatisch für die ganze Gruppe gespeichert.</span></p>`;
    } else if (trip && mode === "local") note = html`<p class="syncline"><${Icon} n="device" s=${18} /><span>Nur auf diesem Gerät gespeichert. Für die ganze Gruppe: oben auf «Einladen».</span></p>`;

    /* Moves a trip from this device to the group. If the sheet it was started from is still open, the invitation takes its place;
       a form somebody opened meanwhile is left alone. */
    const publish = async (tid, name) => {
      try { await Store.publish(tid); } catch (e) { fail(e); return false; }
      Store.registry.put({ id: tid, name, mode: "cloud" }); refreshReg();
      const cur = sheetRef.current;
      if (tripRef.current === tid && cur && (cur.t === "trip-edit" || cur.t === "invite")) setSheet({ t: "invite", k: newId() });
      say("Freigegeben. Schick jetzt den Link an die Gruppe.");
      return true;
    };

    let sheetEl = null;
    if (sheet) {
      if (sheet.t === "trip-new") sheetEl = html`<${TripNew} key=${sheet.k} act=${act} onClose=${close}
        onCreated=${(id, mine) => { if (mine) rememberMe(id, mine); showTrip(id, true); say("Reise angelegt. Jetzt die erste Ausgabe erfassen."); }} />`;
      else if (sheet.t === "join") sheetEl = html`<${JoinSheet} key=${sheet.k} onClose=${close} onJoin=${id => { join(id, true); }} />`;
      else if (sheet.t === "settings") sheetEl = html`<${SettingsSheet} key=${sheet.k} onClose=${close}
        onSetup=${() => open({ t: "setup" })} onInstall=${() => open({ t: "install" })}
        onImported=${r => { refreshReg(); showTrip(r.id, true); say("Sicherung eingelesen: " + r.count + (r.count === 1 ? " Buchung." : " Buchungen.")); }} />`;
      else if (sheet.t === "setup") sheetEl = html`<${SetupSheet} key=${sheet.k} onClose=${close} say=${say} />`;
      else if (sheet.t === "install") sheetEl = html`<${InstallSheet} key=${sheet.k} link=${trip && mode === "cloud" ? Store.linkFor(trip.id) : null}
        hasCloud=${reg.some(e => e.mode === "cloud")} hasLocal=${reg.some(e => e.mode === "local")} onClose=${close} say=${say} />`;
      /* «Einladen» leads to the invitation, or to what is still missing for it: sharing this trip, or switching on the group sync. */
      else if (trip && sheet.t === "invite") sheetEl = mode === "cloud" ? html`<${InviteSheet} key=${sheet.k} trip=${trip} onClose=${close} say=${say} />`
        : Store.cloudOn ? html`<${ShareSheet} key=${sheet.k} onClose=${close} onPublish=${() => publish(trip.id, trip.name)} />`
        : html`<${SetupSheet} key=${sheet.k} onClose=${close} say=${say} />`;
      else if (trip && sheet.t === "avatar") {
        const mem = membersOf(trip, true).find(m => m.id === sheet.m);
        /* Opened from the trip settings, it leads back there. */
        if (mem) sheetEl = html`<${AvatarSheet} key=${sheet.k} trip=${trip} member=${mem} isMe=${mem.id === meId} act=${act} say=${say}
          onClose=${sheet.back ? () => setSheet({ t: sheet.back, k: newId() }) : close} />`;
      }
      else if (trip && sheet.t === "expense") sheetEl = html`<${ExpenseForm} key=${sheet.k} trip=${trip} expense=${sheet.e || null} meId=${meId} act=${act} onClose=${close} say=${say} />`;
      else if (trip && sheet.t === "transfer") sheetEl = html`<${TransferForm} key=${sheet.k} trip=${trip} transfer=${sheet.e || null} preset=${sheet.preset} meId=${meId} act=${act} onClose=${close} say=${say} />`;
      else if (trip && sheet.t === "trip-edit") sheetEl = html`<${TripEdit} key=${sheet.k} trip=${trip} mode=${mode} list=${expenses || []} loading=${expenses === null} meId=${meId} setMe=${setMe} act=${act} onClose=${close}
        onDelete=${async () => {
          const tid = trip.id, list = expenses || [], a = act;
          goHome();
          if (await a.removeTrip(tid, list)) { Store.registry.remove(tid); refreshReg(); say("Reise gelöscht."); }
        }}
        onLeave=${() => { const tid = trip.id; goHome(); Store.registry.remove(tid); refreshReg(); say("Reise von diesem Gerät entfernt."); }}
        onPublish=${() => publish(trip.id, trip.name)}
        onAvatar=${id => setSheet({ t: "avatar", m: id, back: "trip-edit", k: newId() })} />`;
    }
    /* The page behind a sheet does not scroll. Bound to what is really shown: a sheet whose trip has gone must not leave the page stuck. */
    const sheetShown = !!sheetEl;
    useEffect(() => { document.documentElement.classList.toggle("locked", sheetShown); return () => document.documentElement.classList.remove("locked"); }, [sheetShown]);

    /* While online, a trip that stays unreachable gets the server's own reason if it has one. */
    const gate = raw === "offline" && online && trouble && GATE[trouble] ? GATE[trouble] : raw;
    let view;
    if (tripId && trip) view = html`<${TripView} trip=${trip} mode=${mode} expenses=${expenses} meId=${meId} canEdit=${true} tab=${tab} setTab=${setTab} open=${open} setMe=${setMe} say=${say} note=${note} onBack=${goHome} />`;
    else if (tripId) view = html`<${TripGate} state=${gate && typeof gate === "object" ? null : gate} onBack=${goHome}
      onForget=${() => { const tid = tripId; goHome(); Store.registry.remove(tid); refreshReg(); }} />`;
    else view = html`<${Home} reg=${reg} onOpen=${id => showTrip(id, true)} onNew=${() => open({ t: "trip-new" })} onJoin=${() => open({ t: "join" })} onSettings=${() => open({ t: "settings" })}
      onSetup=${() => open({ t: "setup" })} onInstall=${() => open({ t: "install" })} />`;

    /* An open trip has the navigation bar and the add button at the bottom: the column and the messages keep clear of them. */
    const bar = !!(tripId && trip);
    return html`
      <div class=${"wrap" + (bar ? " with-bar" : "")}>${view}</div>
      ${sheetEl}
      ${toast && html`<div class=${"toast" + (bar && !sheet ? " up" : "")} role="status" aria-live="polite" key=${toast.k}>${toast.msg}</div>`}
    `;
  }

  function Shell() {
    const [crash] = useErrorBoundary();
    if (!crash) return html`<${App} />`;
    /* A trip that cannot be drawn would reopen by itself at the next start: the second button leads past it. */
    const toList = () => { ls.set("fk.last", ""); try { history.replaceState(null, "", HOME_URL); } catch (e) { /* reload anyway */ } location.reload(); };
    return html`
      <div class="wrap">
        <header class="brand"><h1><span class="logo" aria-hidden="true">🏝️</span><span class="word">Ferienkasse</span></h1></header>
        <div class="note warn" role="alert"><${Icon} n="close" /><div><strong>Da ist etwas schiefgelaufen.</strong> Alles, was schon gespeichert war, ist noch da.</div></div>
        <div class="btn-row">
          <button type="button" class="btn primary" onClick=${() => location.reload()}>Neu laden</button>
          <button type="button" class="btn" onClick=${toList}>Zur Reiseliste</button>
        </div>
      </div>`;
  }

  root.textContent = "";
  render(html`<${Shell} />`, root);

  /* Offline start: the service worker keeps a copy of the app files. */
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
  }
})();
