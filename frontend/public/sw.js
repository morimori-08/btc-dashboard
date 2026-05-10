const CACHE = 'btc-dashboard-v1';
const OFFLINE_URL = '/';

// インストール: 基本ページをキャッシュ
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll([OFFLINE_URL, '/manifest.json']))
  );
  self.skipWaiting();
});

// フェッチ: APIはネットワーク優先、静的はキャッシュ優先
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) {
    // API: Network first (失敗時キャッシュ)
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
  } else {
    // 静的: Cache first
    e.respondWith(
      caches.match(e.request).then(c => c || fetch(e.request))
    );
  }
});
