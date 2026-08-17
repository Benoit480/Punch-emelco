const CACHE='punch-v3-11-3-no-gps';
const ASSETS=['./','./index.html','./style.css?v=3.11.3','./app.js?v=3.11.3','./manifest.webmanifest',
'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js','https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js','https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(async c=>{for(const a of ASSETS){try{await c.add(a)}catch(x){}}}))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x))))])));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).then(r=>{const x=r.clone();caches.open(CACHE).then(c=>c.put('./index.html',x));return r}).catch(()=>caches.match('./index.html')));return}e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{if(r.ok||r.type==='opaque'){const x=r.clone();caches.open(CACHE).then(c=>c.put(e.request,x))}return r})))});
