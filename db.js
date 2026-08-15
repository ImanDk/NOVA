
const DB_NAME="nova_core_v06",DB_VERSION=3;
let _db=null;
function reqP(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
export async function openDB(){
  if(_db)return _db;
  _db=await new Promise((resolve,reject)=>{
    const r=indexedDB.open(DB_NAME,DB_VERSION);
    r.onupgradeneeded=()=>{
      const db=r.result;
      for(const name of ["tasks","events","parking","memory","chat","settings","logs","projects","projectTasks","transactions","accounts","reels","budgets","incomeAllocations","financialGoals","workLogs"]){
        if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:name==="settings"?"key":"id"});
      }
    };
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)
  });
  try{if(navigator.storage?.persist)await navigator.storage.persist()}catch(_){}
  return _db
}
export async function all(store){const db=await openDB();return reqP(db.transaction(store,"readonly").objectStore(store).getAll())}
export async function get(store,key){const db=await openDB();return reqP(db.transaction(store,"readonly").objectStore(store).get(key))}
export async function put(store,value){const db=await openDB();return reqP(db.transaction(store,"readwrite").objectStore(store).put(value))}
export async function remove(store,key){const db=await openDB();return reqP(db.transaction(store,"readwrite").objectStore(store).delete(key))}
export async function clear(store){const db=await openDB();return reqP(db.transaction(store,"readwrite").objectStore(store).clear())}
