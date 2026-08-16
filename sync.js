import {get,putQuiet,snapshotDB,restoreSnapshot,pruneLogs} from "./db.js?v=130";

const DEFAULT_CONFIG={
  owner:"ImanDk",
  repo:"NOVA",
  branch:"mia-backup",
  path:"mia-data/iman-dk.mia.json",
  enabled:false,
  defaultBranch:"",
  lastSyncAt:0,
  lastError:"",
  connectedAt:0,
  dirty:false,
  dirtyAt:0,
  localRevision:0,
  lastRemoteSha:"",
  conflict:null
};

const AUTO_DEBOUNCE_MS=5000;
const MIN_AUTO_INTERVAL_MS=300000;

let config={...DEFAULT_CONFIG};
let token="";
let backupKey="";
let initialized=false;
let syncing=false;
let pendingTimer=null;
let pendingBecauseChange=false;
let lastAutoAttempt=0;

function currentStatus(detail={}){
  return {
    connected:!!token,
    enabled:!!config.enabled,
    syncing,
    owner:config.owner,
    repo:config.repo,
    branch:config.branch,
    path:config.path,
    lastSyncAt:Number(config.lastSyncAt)||0,
    lastError:config.lastError||"",
    hasRecoveryKey:!!backupKey,
    dirty:!!config.dirty,
    dirtyAt:Number(config.dirtyAt)||0,
    localRevision:Number(config.localRevision)||0,
    conflict:config.conflict||null,
    ...detail
  }
}
function status(detail={}){
  const payload=currentStatus(detail);
  try{window.dispatchEvent(new CustomEvent("mia:cloud-status",{detail:payload}))}catch(_){}
  return payload
}

function bytesToBase64(bytes){
  let out="";
  const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk){
    out+=String.fromCharCode(...bytes.subarray(i,i+chunk));
  }
  return btoa(out)
}
function base64ToBytes(input){
  const clean=String(input||"").replace(/\s+/g,"");
  const bin=atob(clean);
  const out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);
  return out
}
function bytesToBase64Url(bytes){
  return bytesToBase64(bytes).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")
}
function base64UrlToBytes(input){
  let s=String(input||"").trim().replace(/-/g,"+").replace(/_/g,"/");
  while(s.length%4)s+="=";
  return base64ToBytes(s)
}
function utf8ToBase64(text){
  return bytesToBase64(new TextEncoder().encode(String(text)))
}
function base64ToUtf8(input){
  return new TextDecoder().decode(base64ToBytes(input))
}

async function ensureBackupKey(){
  if(backupKey)return backupKey;
  const existing=await get("settings","cloudSyncKey");
  if(existing?.value){
    backupKey=existing.value;
    return backupKey
  }
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  backupKey=bytesToBase64Url(bytes);
  await putQuiet("settings",{key:"cloudSyncKey",value:backupKey,createdAt:Date.now()});
  return backupKey
}

async function encryptSnapshot(snapshot,keyText){
  if(!crypto?.subtle)throw new Error("Web Crypto is not available on this browser.");
  const keyBytes=base64UrlToBytes(keyText);
  if(keyBytes.length!==32)throw new Error("Recovery key is invalid.");

  const key=await crypto.subtle.importKey("raw",keyBytes,{name:"AES-GCM"},false,["encrypt"]);
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const plainBytes=new TextEncoder().encode(JSON.stringify(snapshot));
  const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,plainBytes));
  const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",plainBytes));

  return {
    format:"MIA-Encrypted-Backup",
    envelopeVersion:1,
    profileId:"iman-dk",
    profileName:"Iman Dk",
    encryptedAt:new Date().toISOString(),
    deviceId:config.deviceId||"",
    localRevision:Number(config.localRevision)||0,
    algorithm:"AES-GCM-256",
    iv:bytesToBase64Url(iv),
    sha256:bytesToBase64Url(digest),
    ciphertext:bytesToBase64(encrypted)
  }
}

async function decryptEnvelope(envelope,keyText){
  if(!envelope || envelope.format!=="MIA-Encrypted-Backup")throw new Error("Cloud backup format is invalid.");

  const keyBytes=base64UrlToBytes(keyText);
  if(keyBytes.length!==32)throw new Error("Recovery key is invalid.");

  const key=await crypto.subtle.importKey("raw",keyBytes,{name:"AES-GCM"},false,["decrypt"]);
  const iv=base64UrlToBytes(envelope.iv);
  const encrypted=base64ToBytes(envelope.ciphertext);

  let plain;
  try{
    plain=new Uint8Array(await crypto.subtle.decrypt({name:"AES-GCM",iv},key,encrypted));
  }catch(_){
    throw new Error("Could not decrypt backup. Check the recovery key.")
  }

  if(envelope.sha256){
    const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",plain));
    if(bytesToBase64Url(digest)!==envelope.sha256)throw new Error("Backup integrity check failed.");
  }

  return JSON.parse(new TextDecoder().decode(plain))
}

async function gh(path,options={}){
  if(!token)throw new Error("GitHub token is not configured.");

  const res=await fetch(`https://api.github.com${path}`,{
    ...options,
    headers:{
      "Accept":"application/vnd.github+json",
      "Authorization":`Bearer ${token}`,
      "X-GitHub-Api-Version":"2022-11-28",
      "Content-Type":"application/json",
      ...(options.headers||{})
    },
    cache:"no-store"
  });

  if(res.status===204)return null;

  let body=null;
  const text=await res.text();
  if(text){
    try{body=JSON.parse(text)}catch(_){body=text}
  }

  if(!res.ok){
    const msg=typeof body==="object" && body?.message ? body.message : `GitHub API ${res.status}`;
    const err=new Error(msg);
    err.status=res.status;
    err.body=body;
    throw err
  }

  return body
}

async function ensureBackupBranch(){
  const owner=encodeURIComponent(config.owner);
  const repo=encodeURIComponent(config.repo);
  const branch=config.branch||"mia-backup";

  try{
    await gh(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
    return branch
  }catch(err){
    if(err.status!==404)throw err
  }

  const base=config.defaultBranch||"main";
  const baseRef=await gh(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(base)}`);
  const sha=baseRef?.object?.sha;
  if(!sha)throw new Error("Could not resolve the repository default branch.");

  await gh(`/repos/${owner}/${repo}/git/refs`,{
    method:"POST",
    body:JSON.stringify({ref:`refs/heads/${branch}`,sha})
  });

  return branch
}

async function readRemoteFile(){
  const owner=encodeURIComponent(config.owner);
  const repo=encodeURIComponent(config.repo);
  const path=config.path.split("/").map(encodeURIComponent).join("/");
  const ref=encodeURIComponent(config.branch);

  return gh(`/repos/${owner}/${repo}/contents/${path}?ref=${ref}`,{method:"GET"})
}

async function writeRemoteFile(contentText,knownSha=null){
  const owner=encodeURIComponent(config.owner);
  const repo=encodeURIComponent(config.repo);
  const path=config.path.split("/").map(encodeURIComponent).join("/");

  const payload={
    message:`MIA backup · ${new Date().toISOString()}`,
    content:utf8ToBase64(contentText),
    branch:config.branch
  };
  if(knownSha)payload.sha=knownSha;

  return gh(`/repos/${owner}/${repo}/contents/${path}`,{
    method:"PUT",
    body:JSON.stringify(payload)
  })
}

async function loadLocalConfig(){
  const cfg=await get("settings","cloudSyncConfig");
  const tok=await get("settings","cloudSyncToken");
  const key=await get("settings","cloudSyncKey");

  config={...DEFAULT_CONFIG,...(cfg?.value||{})};
  token=String(tok?.value||"");
  backupKey=String(key?.value||"");
  if(!config.deviceId){
    config.deviceId=globalThis.crypto?.randomUUID?.()||`device-${Date.now().toString(36)}`;
    await putQuiet("settings",{key:"cloudSyncConfig",value:config,updatedAt:Date.now()});
  }
  return config
}

async function saveConfig(patch={}){
  config={...config,...patch};
  await putQuiet("settings",{key:"cloudSyncConfig",value:config,updatedAt:Date.now()});
  return config
}
async function markDirty(){
  const at=Date.now();
  await saveConfig({dirty:true,dirtyAt:config.dirtyAt||at,localRevision:(Number(config.localRevision)||0)+1,lastError:""});
  return config
}
function conflictError(remoteSha,remoteEnvelope){
  const err=new Error("نسخه GitHub با آخرین نسخه شناخته‌شده MIA متفاوت است.");
  err.code="CLOUD_CONFLICT";
  err.remoteSha=remoteSha||"";
  err.remoteEncryptedAt=remoteEnvelope?.encryptedAt||"";
  return err
}

function shouldIgnoreDBEvent(detail){
  if(!detail)return false;
  if(detail.store==="logs")return true;
  if(detail.store==="settings" && String(detail.key||"").startsWith("cloudSync"))return true;
  return false
}

export async function initCloudSync(){
  if(initialized)return status();
  initialized=true;
  await loadLocalConfig();

  document.addEventListener("mia:data-changed",e=>{
    if(shouldIgnoreDBEvent(e.detail))return;
    markDirty().then(()=>scheduleCloudSync("data-change")).catch(()=>{});
  });

  window.addEventListener("online",()=>{if(config.dirty)scheduleCloudSync("online")});

  const flushPending=()=>{
    if(config.dirty && config.enabled && token){
      syncNow({reason:"background",force:true,silent:true}).catch(()=>{});
    }
  };
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")flushPending()});
  window.addEventListener("pagehide",flushPending);

  if(config.dirty && config.enabled && token)scheduleCloudSync("startup-pending");
  status();
  return getCloudSyncStatus()
}

export function getCloudSyncStatus(){
  return currentStatus()
}

export async function connectGitHub({owner,repo,branch,path,token:nextToken}){
  const cleanToken=String(nextToken||token||"").trim();
  if(!cleanToken)throw new Error("GitHub token is required.");

  token=cleanToken;
  config={
    ...config,
    owner:String(owner||DEFAULT_CONFIG.owner).trim(),
    repo:String(repo||DEFAULT_CONFIG.repo).trim(),
    branch:String(branch||DEFAULT_CONFIG.branch).trim()||DEFAULT_CONFIG.branch,
    path:String(path||DEFAULT_CONFIG.path).trim()||DEFAULT_CONFIG.path
  };

  if(!config.owner || !config.repo)throw new Error("GitHub repository information is incomplete.");

  syncing=true;status({phase:"connecting"});
  try{
    const repoInfo=await gh(`/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`,{method:"GET"});
    config.defaultBranch=repoInfo?.default_branch||"main";

    await putQuiet("settings",{key:"cloudSyncToken",value:token,updatedAt:Date.now()});
    await ensureBackupKey();
    await ensureBackupBranch();

    await saveConfig({
      enabled:true,
      connectedAt:config.connectedAt||Date.now(),
      lastError:""
    });

    syncing=false;status({phase:"connected"});
    try{await syncNow({reason:"first-connect",force:true})}
    catch(err){if(err?.code!=="CLOUD_CONFLICT")throw err}
    return getCloudSyncStatus()
  }catch(err){
    syncing=false;
    await saveConfig({lastError:err.message||String(err)});
    status({phase:"error"});
    throw err
  }
}

export async function setCloudAutoEnabled(enabled){
  if(enabled && !token)throw new Error("Connect GitHub first.");
  await saveConfig({enabled:!!enabled,lastError:""});
  status();
  if(enabled)scheduleCloudSync("enabled");
  return getCloudSyncStatus()
}

export async function disconnectCloud(){
  token="";
  if(pendingTimer)clearTimeout(pendingTimer);
  pendingTimer=null;
  pendingBecauseChange=false;

  await putQuiet("settings",{key:"cloudSyncToken",value:"",updatedAt:Date.now()});
  await saveConfig({enabled:false,lastError:"",conflict:null});
  status({phase:"disconnected"});
  return getCloudSyncStatus()
}

export function scheduleCloudSync(reason="change"){
  if(!initialized || !config.enabled || !token || !config.dirty)return;
  pendingBecauseChange=true;

  if(pendingTimer)clearTimeout(pendingTimer);

  const elapsed=Date.now()-(Number(config.lastSyncAt)||0);
  const wait=Math.max(AUTO_DEBOUNCE_MS,MIN_AUTO_INTERVAL_MS-elapsed);

  pendingTimer=setTimeout(()=>{
    pendingTimer=null;
    syncNow({reason,silent:true}).catch(()=>{});
  },wait);
}

export async function syncNow({reason="manual",force=false,silent=false,forceConflict=false}={}){
  if(syncing)return getCloudSyncStatus();
  if(!token)throw new Error("GitHub is not connected.");
  if(!config.enabled && !force)throw new Error("Automatic cloud sync is disabled.");
  if(!navigator.onLine)throw new Error("Internet connection is unavailable.");

  const elapsed=Date.now()-(Number(config.lastSyncAt)||0);
  if(!force && reason!=="manual" && elapsed<MIN_AUTO_INTERVAL_MS){
    scheduleCloudSync(reason);return getCloudSyncStatus()
  }

  syncing=true;lastAutoAttempt=Date.now();status({phase:"syncing"});
  try{
    await ensureBackupBranch();
    const key=await ensureBackupKey();
    const snapshot=await snapshotDB();
    snapshot.profile={id:"iman-dk",userName:"Iman Dk"};
    snapshot.appVersion="1.1.0";

    let current=null,remoteEnvelope=null;
    try{
      current=await readRemoteFile();
      if(current?.content){try{remoteEnvelope=JSON.parse(base64ToUtf8(current.content))}catch(_){}}
    }catch(err){if(err.status!==404)throw err}

    const remoteSha=current?.sha||"";
    const knownSha=config.lastRemoteSha||"";
    const changedRemotely=!!remoteSha && ((!knownSha)||remoteSha!==knownSha);
    if(changedRemotely && !forceConflict){
      const conflict={remoteSha,remoteEncryptedAt:remoteEnvelope?.encryptedAt||"",detectedAt:Date.now()};
      await saveConfig({conflict,lastError:""});
      throw conflictError(remoteSha,remoteEnvelope)
    }

    const envelope=await encryptSnapshot(snapshot,key);
    const result=await writeRemoteFile(JSON.stringify(envelope,null,2),remoteSha||null);
    const newSha=result?.content?.sha||remoteSha||"";
    const at=Date.now();pendingBecauseChange=false;
    await saveConfig({lastSyncAt:at,lastError:"",dirty:false,dirtyAt:0,lastRemoteSha:newSha,conflict:null});
    syncing=false;status({phase:"synced"});return getCloudSyncStatus()
  }catch(err){
    syncing=false;
    if(err?.code!=="CLOUD_CONFLICT")await saveConfig({lastError:err.message||String(err)});
    status({phase:err?.code==="CLOUD_CONFLICT"?"conflict":"error"});
    if(!silent)throw err;return getCloudSyncStatus()
  }
}

export async function restoreFromGitHub({recoveryKey=""}={}){
  if(syncing)throw new Error("A sync is already running.");
  if(!token)throw new Error("GitHub is not connected.");
  if(!navigator.onLine)throw new Error("Internet connection is unavailable.");

  syncing=true;status({phase:"restoring"});

  try{
    const remote=await readRemoteFile();
    if(!remote?.content)throw new Error("Cloud backup file is empty.");

    const envelope=JSON.parse(base64ToUtf8(remote.content));
    const key=String(recoveryKey||backupKey||"").trim();
    if(!key)throw new Error("Recovery key is required.");

    const snapshot=await decryptEnvelope(envelope,key);

    // Keep a local emergency snapshot before destructive restore.
    const localSafety=await snapshotDB();
    await putQuiet("logs",{
      id:globalThis.crypto?.randomUUID?.()||`restore-${Date.now()}`,
      type:"pre-cloud-restore",
      at:Date.now(),
      snapshot:localSafety
    });
    await pruneLogs().catch(()=>{});

    await restoreSnapshot(snapshot,{preserveCloudSettings:true});

    // If a recovery key from another device was used successfully, adopt it.
    if(recoveryKey && recoveryKey!==backupKey){
      backupKey=recoveryKey;
      await putQuiet("settings",{key:"cloudSyncKey",value:backupKey,updatedAt:Date.now()});
    }

    await loadLocalConfig();
    await saveConfig({lastError:"",lastSyncAt:Date.now(),dirty:false,dirtyAt:0,lastRemoteSha:remote.sha||"",conflict:null});

    syncing=false;
    status({phase:"restored"});
    window.dispatchEvent(new CustomEvent("mia:cloud-restored"));
    return true
  }catch(err){
    syncing=false;
    await saveConfig({lastError:err.message||String(err)});
    status({phase:"error"});
    throw err
  }
}

export async function getRecoveryKey(){
  return ensureBackupKey()
}
