// Service worker do VextriaHub. Objetivo: tornar o app INSTALÁVEL (PWA) e dar um
// shell offline — SEM nunca servir uma versão velha depois de um deploy.
//
// Estratégia de cache (pensada p/ um app que publica a cada push):
//   • navegação (documento HTML): NETWORK-FIRST → sempre busca o index.html novo
//     online; só cai pro cache quando o dispositivo está offline. Nunca "trava"
//     numa versão antiga.
//   • assets com hash (/assets/*): CACHE-FIRST → o nome tem hash de conteúdo, são
//     imutáveis, então cachear pra sempre é seguro e rápido; um deploy novo gera
//     hashes novos = busca automática.
//   • Supabase / fontes / outras origens: passam DIRETO pela rede (não intercepta).
const VERSION = 'v1';
const SHELL = `vextria-shell-${VERSION}`;
const ASSETS = `vextria-assets-${VERSION}`;
const OFFLINE_URL = '/index.html';
const ASSET_MAX = 80; // teto de entradas no cache de assets (evita crescer sem limite entre deploys)

// Mantém o cache de assets limitado: como o nome tem hash e é imutável, os chunks
// de builds antigos acumulariam pra sempre; aqui removemos os mais antigos (FIFO).
async function trimCache(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(SHELL).then((c) => c.add(OFFLINE_URL)).catch(() => {}));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }
  // Só mexe em same-origin. Supabase/fontes/CDN passam direto pela rede.
  if (url.origin !== self.location.origin) return;

  // Navegação (documento HTML): network-first, cai pro shell só offline.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(req);
      } catch {
        const cache = await caches.open(SHELL);
        return (await cache.match(OFFLINE_URL)) || Response.error();
      }
    })());
    return;
  }

  // Assets com hash (imutáveis): cache-first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cache = await caches.open(ASSETS);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && res.ok) { await cache.put(req, res.clone()); await trimCache(cache, ASSET_MAX); }
      return res;
    })());
    return;
  }

  // Demais same-origin (favicon, manifest, ícones): stale-while-revalidate leve.
  event.respondWith((async () => {
    const cache = await caches.open(ASSETS);
    const hit = await cache.match(req);
    const network = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => hit);
    return hit || network;
  })());
});
