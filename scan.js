/* Ferienkasse: Beleg-Scan (freiwillig).
   Eine Webseite auf GitHub hat keine eigene KI. Der Scan funktioniert deshalb nur auf Geräten, auf denen jemand
   einen eigenen Schlüssel hinterlegt hat: von Google (Gemini, beginnt mit "AIza") oder Anthropic (Claude, beginnt mit "sk-ant-").
   Der Schlüssel bleibt in diesem Browser. Das Foto geht verkleinert direkt vom Gerät an den Anbieter, sonst nirgends hin. */
window.FKScan = (function () {
  "use strict";
  var KEY = "fk.ai";
  /* Google: der Name "gemini-flash-latest" zeigt immer auf das aktuelle Flash-Modell und veraltet deshalb nicht.
     Anthropic kennt keinen solchen Namen: Ist das Modell eines Tages eingestellt, trägt man in den Einstellungen ein neues ein. */
  var MODELS = { gemini: "gemini-flash-latest", anthropic: "claude-haiku-4-5-20251001" };
  var NAMES = { gemini: "Google Gemini", anthropic: "Anthropic Claude" };

  function settings() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || "null");
      if (v && typeof v.key === "string") return { key: v.key, model: typeof v.model === "string" ? v.model : "" };
    } catch (e) { /* kein Schlüssel hinterlegt */ }
    return { key: "", model: "" };
  }
  function save(key, model) {
    key = String(key || "").trim(); model = String(model || "").trim();
    try {
      if (key) localStorage.setItem(KEY, JSON.stringify({ key: key, model: model })); else localStorage.removeItem(KEY);
      return true;
    } catch (e) { return false; }
  }
  function provider(key) {
    key = String(key || "").trim();
    if (/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key)) return "anthropic";
    if (/^AIza[A-Za-z0-9_-]{20,}$/.test(key)) return "gemini";
    return null;
  }
  function ready() { return !!provider(settings().key); }
  function current() {
    var s = settings(), p = provider(s.key);
    return p ? { provider: p, key: s.key.trim(), model: s.model || MODELS[p], label: NAMES[p] } : null;
  }

  /* ---------- Foto verkleinern: höchstens 1600 Pixel Kantenlänge, als JPEG ---------- */
  function viaImg(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject({ code: "image" }); };
      img.src = url;
    });
  }
  function decode(file) {
    try {
      if (window.createImageBitmap) return createImageBitmap(file, { imageOrientation: "from-image" }).catch(function () { return viaImg(file); });
    } catch (e) { /* ältere Browser kennen die Option nicht */ }
    return viaImg(file);
  }
  function shrink(file) {
    return decode(file).then(function (img) {
      var w = img.width, h = img.height;
      if (!w || !h) throw { code: "image" };
      var f = Math.min(1, 1600 / Math.max(w, h)), c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w * f)); c.height = Math.max(1, Math.round(h * f));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      if (img.close) img.close();
      var url = c.toDataURL("image/jpeg", 0.82), i = url.indexOf(",");
      if (i < 0) throw { code: "image" };
      return { mime: "image/jpeg", data: url.slice(i + 1) };
    }, function (e) { throw e && e.code ? e : { code: "image" }; });
  }

  /* ---------- Anfragen ---------- */
  function http(url, init) {
    return fetch(url, init).then(function (res) {
      return res.text().then(function (t) {
        var j = null;
        try { j = JSON.parse(t); } catch (e) { j = null; }
        if (res.ok && j) return j;
        var msg = String((j && j.error && (j.error.message || j.error.type)) || ("HTTP " + res.status)).slice(0, 300);
        var code = res.status === 401 || res.status === 403 || /api[ _-]?key/i.test(msg) ? "key"
          : res.status === 429 ? "rate" : res.status === 404 ? "model" : res.status >= 500 ? "busy" : "request";
        throw { code: code, status: res.status, message: msg };
      });
    }, function (e) { throw { code: e && e.name === "AbortError" ? "cancelled" : "network", message: String((e && e.message) || e) }; });
  }
  /* Schickt Text (und optional ein Bild) an den hinterlegten Anbieter und liefert dessen Antworttext. */
  function ask(cfg, prompt, image, signal, wantJson) {
    if (cfg.provider === "anthropic") {
      var content = [];
      if (image) content.push({ type: "image", source: { type: "base64", media_type: image.mime, data: image.data } });
      content.push({ type: "text", text: prompt });
      return http("https://api.anthropic.com/v1/messages", {
        method: "POST", signal: signal,
        headers: { "content-type": "application/json", "x-api-key": cfg.key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: cfg.model, max_tokens: 2000, messages: [{ role: "user", content: content }] })
      }).then(function (j) {
        return (Array.isArray(j.content) ? j.content : []).map(function (b) { return b && b.type === "text" ? b.text : ""; }).join("");
      });
    }
    var parts = [];
    if (image) parts.push({ inline_data: { mime_type: image.mime, data: image.data } });
    parts.push({ text: prompt });
    var body = { contents: [{ parts: parts }] };
    if (wantJson) body.generationConfig = { response_mime_type: "application/json" };
    return http("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(cfg.model) + ":generateContent", {
      method: "POST", signal: signal,
      headers: { "content-type": "application/json", "x-goog-api-key": cfg.key },
      body: JSON.stringify(body)
    }).then(function (j) {
      var c = j.candidates && j.candidates[0], ps = (c && c.content && c.content.parts) || [];
      return ps.map(function (p) { return (p && p.text) || ""; }).join("");
    });
  }
  function parseJson(text) {
    var t = String(text || "").trim(), m, a, b;
    try { return JSON.parse(t); } catch (e) { /* weiter unten nochmal versuchen */ }
    m = /```(?:json)?\s*([\s\S]*?)```/.exec(t);
    if (m) { try { return JSON.parse(m[1]); } catch (e) { /* weiter */ } }
    a = t.indexOf("{"); b = t.lastIndexOf("}");
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { /* weiter */ } }
    throw { code: "format", message: "Antwort enthält kein JSON" };
  }

  /* Liest einen Beleg. Ergebnis ist das JSON-Objekt aus der Antwort; geprüft wird es danach in FK.parseReceipt. */
  function scan(file, prompt, signal) {
    var cfg = current();
    if (!cfg) return Promise.reject({ code: "key" });
    return shrink(file).then(function (image) {
      if (signal && signal.aborted) throw { code: "cancelled" };
      return ask(cfg, prompt, image, signal, true);
    }).then(parseJson);
  }
  /* Kurzer Test ohne Bild: stimmt der Schlüssel, gibt es das Modell? */
  function test() {
    var cfg = current();
    if (!cfg) return Promise.reject({ code: "key" });
    return ask(cfg, "Antworte nur mit dem Wort OK.", null, undefined, false).then(function (text) {
      if (!String(text).trim()) throw { code: "format" };
      return { provider: cfg.provider, label: cfg.label, model: cfg.model };
    });
  }

  return { settings: settings, save: save, provider: provider, ready: ready, current: current, scan: scan, test: test, MODELS: MODELS, NAMES: NAMES };
})();
