const CACHE_NAME = 'rede-sarelli-v6';
const STATIC_ASSETS = ['/'];

// ── Install — cache mínimo, ativação instantânea ────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting(); // Ativa imediatamente sem esperar
});

// ── Activate — limpar caches antigos + tomar controle ───────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()) // Controla todas as tabs imediatamente
  );
  // Notificar todas as tabs que há uma atualização
  self.clients.matchAll({ type: 'window' }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'SW_UPDATED' });
    });
  });
});

// ── Fetch — network-first para HTML, cache-first para assets ────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;

  // Nunca interceptar estas URLs
  if (url.startsWith('chrome-extension')) return;
  if (url.includes('/~oauth')) return;
  if (url.includes('nominatim')) return;
  if (url.includes('supabase.co')) return;
  if (url.includes('ipapi.co') || url.includes('ipwho.is') || url.includes('ip-api.com')) return;

  const isNavigation = event.request.mode === 'navigate';
  const isAsset = /\.(js|css|png|jpg|jpeg|svg|ico|woff2?|ttf)(\?|$)/.test(url);

  if (isNavigation) {
    // HTML: network-first (pega sempre a versão mais nova)
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match('/').then((cached) => cached || new Response('Offline', { status: 503 })))
    );
  } else if (isAsset) {
    // Assets: cache-first (carrega rápido)
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          // Atualiza no background para próxima vez
          fetch(event.request).then((response) => {
            if (response.status === 200 && response.type === 'basic') {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response));
            }
          }).catch(() => {});
          return cached;
        }
        return fetch(event.request).then((response) => {
          if (response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => new Response('', { status: 503 }));
      })
    );
  } else {
    // Outros: network-first
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});

// ── Background Sync ─────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-location') {
    event.waitUntil(captureAndBroadcast());
  }
  if (event.tag === 'sync-registrations') {
    event.waitUntil(notifyClientsToSync());
  }
});

// ── Periodic Background Sync (Android Chrome) ───────────────────────────────
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'location-sync') {
    event.waitUntil(captureAndBroadcast());
  }
});

// ── Push event ──────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  event.waitUntil(captureAndBroadcast());
});

// ── Message handler — force update ──────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Notify clients to run sync from their context (has access to IndexedDB + supabase)
async function notifyClientsToSync() {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_OFFLINE_DATA' });
  });
}

// IP-based location capture
const IP_PROVIDERS = [
  { url: 'https://ipapi.co/json/', extract: (d) => ({ lat: d?.latitude, lng: d?.longitude }) },
  { url: 'https://ipwho.is/', extract: (d) => ({ lat: d?.latitude, lng: d?.longitude }) },
  { url: 'https://ip-api.com/json/?fields=lat,lon', extract: (d) => ({ lat: d?.lat, lng: d?.lon }) },
];

async function captureAndBroadcast() {
  for (const p of IP_PROVIDERS) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(p.url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) continue;
      const data = await res.json();
      const c = p.extract(data);
      if (isFinite(c.lat) && isFinite(c.lng)) {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        clients.forEach((client) => {
          client.postMessage({
            type: 'BACKGROUND_LOCATION',
            latitude: c.lat,
            longitude: c.lng,
            fonte: 'sw_bg',
          });
        });
        return;
      }
    } catch {
      continue;
    }
  }
}
