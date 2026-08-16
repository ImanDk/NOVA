if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js?v=110").catch(err=>console.warn("SW registration failed",err)))
}
