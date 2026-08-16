const DB_NAME="nova_core_v06",DB_VERSION=3;
const DEFAULT_PROFILE_ID="iman-dk";

export const DB_STORES=[
  "tasks","events","parking","memory","chat","settings","logs","projects",
  "projectTasks","transactions","accounts","reels","budgets",
  "incomeAllocations","financialGoals","workLogs"
];

const CLOUD_SECRET_SETTING_KEYS=new Set([
  "cloudSyncToken","cloudSyncKey","cloudSyncConfig","cloudSyncState"
]);

const PROFILE_SCOPED_STORES=new Set(DB_STORES.filter(name=>!["settings","logs"].includes(name)));

function withProfile(store,value){
  if(!PROFILE_SCOPED_STORES.has(store) || !value || typeof value!=="object" || Array.isArray(value))return value;
  return value.profileId ? value : {...value,profileId:DEFAULT_PROFILE_ID}
}

let _db=null;

function reqP(req){
  return new Promise((resolve,reject)=>{
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error("IndexedDB request failed"));
  })
}
function txP(tx){
  return new Promise((resolve,reject)=>{
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error||new Error("IndexedDB transaction failed"));
    tx.onabort=()=>reject(tx.error||new Error("IndexedDB transaction aborted"));
  })
}
function assertStore(store){
  if(!DB_STORES.includes(store))throw new Error(`Unknown DB store: ${store}`);
}
function emitChange(store,operation,key){
  try{
    document.dispatchEvent(new CustomEvent("mia:data-changed",{detail:{store,operation,key,at:Date.now()}}))
  }catch(_){}
}
export function notifyDataChanged(detail={}){
  emitChange(detail.store||"data",detail.operation||"change",detail.key??null)
}

export async function openDB(){
  if(_db)return _db;

  _db=await new Promise((resolve,reject)=>{
    const r=indexedDB.open(DB_NAME,DB_VERSION);

    r.onupgradeneeded=()=>{
      const db=r.result;
      for(const name of DB_STORES){
        if(!db.objectStoreNames.contains(name)){
          db.createObjectStore(name,{keyPath:name==="settings"?"key":"id"});
        }
      }
    };

    r.onblocked=()=>reject(new Error("Database upgrade is blocked by another MIA tab."));
    r.onerror=()=>reject(r.error||new Error("Could not open MIA database."));
    r.onsuccess=()=>{
      const db=r.result;
      db.onversionchange=()=>{
        try{db.close()}catch(_){}
        _db=null;
      };
      resolve(db);
    };
  });

  try{
    if(navigator.storage?.persist)await navigator.storage.persist();
  }catch(_){}

  return _db
}

export async function all(store){
  assertStore(store);
  const db=await openDB();
  return reqP(db.transaction(store,"readonly").objectStore(store).getAll())
}

export async function get(store,key){
  assertStore(store);
  const db=await openDB();
  return reqP(db.transaction(store,"readonly").objectStore(store).get(key))
}

async function writePut(store,value,emit=true){
  assertStore(store);
  const storedValue=withProfile(store,value);
  const db=await openDB();
  const tx=db.transaction(store,"readwrite");
  const req=tx.objectStore(store).put(storedValue);
  const result=await reqP(req);
  await txP(tx);
  if(emit)emitChange(store,"put",store==="settings"?storedValue?.key:storedValue?.id);
  return result
}
export async function put(store,value){return writePut(store,value,true)}
export async function putQuiet(store,value){return writePut(store,value,false)}

async function writeRemove(store,key,emit=true){
  assertStore(store);
  const db=await openDB();
  const tx=db.transaction(store,"readwrite");
  tx.objectStore(store).delete(key);
  await txP(tx);
  if(emit)emitChange(store,"remove",key);
}
export async function remove(store,key){return writeRemove(store,key,true)}
export async function removeQuiet(store,key){return writeRemove(store,key,false)}

async function writeClear(store,emit=true){
  assertStore(store);
  const db=await openDB();
  const tx=db.transaction(store,"readwrite");
  tx.objectStore(store).clear();
  await txP(tx);
  if(emit)emitChange(store,"clear",null);
}
export async function clear(store){return writeClear(store,true)}
export async function clearQuiet(store){return writeClear(store,false)}

export async function snapshotDB(){
  const stores={};

  for(const name of DB_STORES){
    if(name==="logs")continue; // diagnostic logs are local-only
    const rows=await all(name);

    if(name==="settings"){
      stores[name]=rows.filter(row=>!CLOUD_SECRET_SETTING_KEYS.has(row?.key));
    }else{
      stores[name]=rows;
    }
  }

  return {
    format:"MIA-DB-Snapshot",
    schemaVersion:DB_VERSION,
    databaseName:DB_NAME,
    createdAt:new Date().toISOString(),
    stores
  }
}

function validSnapshot(snapshot){
  return !!(
    snapshot &&
    snapshot.format==="MIA-DB-Snapshot" &&
    snapshot.stores &&
    typeof snapshot.stores==="object"
  )
}

export async function restoreSnapshot(snapshot,{preserveCloudSettings=true}={}){
  if(!validSnapshot(snapshot))throw new Error("Backup format is invalid.");

  const db=await openDB();
  const targetStores=Object.keys(snapshot.stores).filter(name=>DB_STORES.includes(name));

  if(!targetStores.length)throw new Error("Backup contains no recognized data stores.");

  let preservedSettings=[];
  if(preserveCloudSettings && targetStores.includes("settings")){
    const currentSettings=await all("settings");
    preservedSettings=currentSettings.filter(row=>CLOUD_SECRET_SETTING_KEYS.has(row?.key));
  }

  const tx=db.transaction(targetStores,"readwrite");

  for(const storeName of targetStores){
    const os=tx.objectStore(storeName);
    os.clear();

    const rows=Array.isArray(snapshot.stores[storeName])?snapshot.stores[storeName]:[];
    for(const row of rows){
      if(!row || typeof row!=="object")continue;
      if(storeName==="settings" && CLOUD_SECRET_SETTING_KEYS.has(row.key))continue;
      os.put(withProfile(storeName,row));
    }

    if(storeName==="settings"){
      for(const row of preservedSettings)os.put(row);
    }
  }

  await txP(tx);
  emitChange("restore","restore",null);
  return true
}

export async function pruneLogs({maxErrors=100,maxSafety=3}={}){
  const db=await openDB(),rows=await all("logs");
  const errors=rows.filter(x=>x?.type==="app-error").sort((a,b)=>(b.at||0)-(a.at||0));
  const safety=rows.filter(x=>x?.type==="pre-cloud-restore").sort((a,b)=>(b.at||0)-(a.at||0));
  const keep=new Set([...errors.slice(0,maxErrors),...safety.slice(0,maxSafety)].map(x=>x.id));
  const removable=rows.filter(x=>(x?.type==="app-error"||x?.type==="pre-cloud-restore")&&!keep.has(x.id));
  if(!removable.length)return 0;
  const tx=db.transaction("logs","readwrite"),os=tx.objectStore("logs");
  for(const row of removable)os.delete(row.id);
  await txP(tx);return removable.length
}

export async function databaseHealth(){
  const db=await openDB();
  const missing=DB_STORES.filter(name=>!db.objectStoreNames.contains(name));
  return {
    ok:missing.length===0,
    dbName:DB_NAME,
    dbVersion:DB_VERSION,
    missingStores:missing,
    persistent:await navigator.storage?.persisted?.().catch(()=>false) || false
  }
}
