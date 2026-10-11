// 先連網路拿最新版；三秒內連不上（場地沒訊號）就用上次存下來的版本。
const CACHE = 'songlist-v1';
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const fresh = fetch(request).then(response => {
    if (response.ok || response.type === 'opaque') {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy));
    }
    return response;
  });
  const timeout = new Promise((_, reject) => setTimeout(reject, 3000));
  event.respondWith(Promise.race([fresh, timeout]).catch(() => caches.match(request).then(hit => hit ?? fresh)));
});
