if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js?v=113").catch(err=>console.warn("SW registration failed",err)))
}
