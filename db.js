
const DB_NAME="nova_core_v06", DB_VERSION=2;
let _db=null;
function reqP(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
export async function openDB(){
  if(_db)return _db;
  _db=await new Promise((resolve,reject)=>{
    const r=indexedDB.open(DB_NAME,DB_VERSION);
    r.onupgradeneeded=()=>{
      const db=r.result;
      if(!db.objectStoreNames.contains("tasks")) db.createObjectStore("tasks",{keyPath:"id"});
      if(!db.objectStoreNames.contains("events")) db.createObjectStore("events",{keyPath:"id"});
      if(!db.objectStoreNames.contains("parking")) db.createObjectStore("parking",{keyPath:"id"});
      if(!db.objectStoreNames.contains("memory")) db.createObjectStore("memory",{keyPath:"id"});
      if(!db.objectStoreNames.contains("chat")) db.createObjectStore("chat",{keyPath:"id"});
      if(!db.objectStoreNames.contains("settings")) db.createObjectStore("settings",{keyPath:"key"});
      if(!db.objectStoreNames.contains("logs")) db.createObjectStore("logs",{keyPath:"id"});
      if(!db.objectStoreNames.contains("projects")) db.createObjectStore("projects",{keyPath:"id"});
      if(!db.objectStoreNames.contains("projectTasks")) db.createObjectStore("projectTasks",{keyPath:"id"});
    };
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  try{if(navigator.storage?.persist) await navigator.storage.persist()}catch(e){}
  return _db;
}
export async function all(store){const db=await openDB();return reqP(db.transaction(store,"readonly").objectStore(store).getAll())}
export async function put(store,value){const db=await openDB();return reqP(db.transaction(store,"readwrite").objectStore(store).put(value))}
export async function remove(store,key){const db=await openDB();return reqP(db.transaction(store,"readwrite").objectStore(store).delete(key))}
export async function clear(store){const db=await openDB();return reqP(db.transaction(store,"readwrite").objectStore(store).clear())}
export async function get(store,key){const db=await openDB();return reqP(db.transaction(store,"readonly").objectStore(store).get(key))}
export async function count(store){const db=await openDB();return reqP(db.transaction(store,"readonly").objectStore(store).count())}
