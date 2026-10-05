/* Ferienkasse: Service Worker. Hält eine Kopie der App-Dateien bereit, damit die Ferienkasse auch ohne Netz startet.
   Mit Netz fragt er bei jedem Start nach, ob es auf dem Server eine neuere Fassung gibt (so wirkt eine geänderte config.js sofort).
   Ohne Netz oder bei sehr langsamem Netz kommt die gespeicherte Kopie. Daten und Kurse laufen nicht über diese Kopie. */
const CACHE = "ferienkasse-v1";
const FILES = [
  "./", "index.html", "style.css", "config.js", "logic.js", "store.js", "rates.js", "scan.js", "app.js",
  "vendor-preact.js", "vendor-qrcode.js", "vendor-firebase.js", "manifest.webmanifest", "favicon.svg",
  "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png",
  "barlow-400.woff2", "barlow-500.woff2", "barlow-600.woff2", "barlow-condensed-600.woff2", "barlow-condensed-700.woff2",
  "ibm-plex-mono-500.woff2", "ibm-plex-mono-600.woff2"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all(FILES.map(f => cache.add(f).catch(() => null))))   // eine fehlende Datei soll die anderen nicht blockieren
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("ferienkasse-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // Daten, Kurse und KI gehen direkt ins Netz
  event.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  const fromCache = async () => (await cache.match(req, { ignoreSearch: true })) || (req.mode === "navigate" ? await cache.match("index.html") : undefined);
  const fromNet = fetch(req, { cache: "no-cache" }).then(async res => {
    if (!res || res.type === "opaqueredirect") return res;
    if (res.ok) { cache.put(req, res.clone()).catch(() => {}); return res; }
    return (await fromCache()) || res;                        // Fehler vom Server (etwa 404 mitten in einem Hochladen): lieber die gespeicherte Kopie als eine halbe App
  });
  try {
    return await Promise.race([fromNet, new Promise((_, reject) => setTimeout(() => reject(new Error("slow")), 3500))]);
  } catch (e) {
    const hit = await fromCache();
    if (hit) { fromNet.catch(() => {}); return hit; }
    return fromNet;                                           // nichts gespeichert: weiter auf das Netz warten
  }
}
