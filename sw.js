// Eris service worker: network-first for the same-origin app shell under /eris/ only.
// Never cached / never intercepted: any cross-origin request (DexScreener, RugCheck, Solana RPC, Phantom, pump.fun),
// any .json, any non-GET request, and WebSockets (PumpPortal; WebSockets never pass through a SW anyway).
const VERSION = "eris-v1";
const SHELL = ["./", "index.html", "styles.css", "manifest.webmanifest", "src/app.js", "src/api.js", "src/wallet.js", "src/portfolio.js", "js/install.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-192.png", "icons/maskable-512.png", "icons/apple-touch-icon.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  const scope = new URL(self.registration.scope).pathname;
  if (e.request.method !== "GET" || u.origin !== location.origin || !u.pathname.startsWith(scope) || u.pathname.endsWith(".json") || /\/(api|rpc|auth)\b/i.test(u.pathname) || u.protocol.startsWith("ws")) return; // network only
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then((r) => { if (r.ok && r.type === "basic") { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, cp)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || (e.request.mode === "navigate" ? caches.match("index.html") : Response.error()))));
});
