const CACHE="mia-v120-manual-allocation-clean-ui";
const FILES=[
  "./","./index.html","./styles.css?v=120","./styles-features.css?v=120","./app.js?v=120","./db.js?v=120","./planner.js?v=120",
  "./sync.js?v=120","./core.js?v=120","./actions.js?v=120","./finance-store.js?v=120","./self-test.js?v=120",
  "./boot.js?v=120","./manifest.json","./mia-logo.png","./favicon.png","./apple-touch-icon.png","./icon-192.png","./icon-512.png","./setup-ios.html"
];

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(FILES))
      .then(()=>self.skipWaiting())
  )
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  )
});

self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET")return;

  const url=new URL(req.url);

  // Never intercept/cache authenticated APIs or third-party resources.
  if(url.origin!==self.location.origin)return;

  if(req.mode==="navigate"){
    event.respondWith(
      fetch(req)
        .then(response=>response)
        .catch(()=>caches.match("./index.html"))
    );
    return
  }

  event.respondWith(
    caches.match(req).then(cached=>{
      const network=fetch(req).then(response=>{
        if(response?.ok){
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(req,copy)).catch(()=>{});
        }
        return response
      });
      return cached||network
    })
  )
});
