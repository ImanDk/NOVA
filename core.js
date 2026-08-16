export const PROFILE_ID="iman-dk";
export const PROFILE_NAME="Iman Dk";

export function newId(prefix="mia"){
  if(globalThis.crypto?.randomUUID)return `${prefix}-${crypto.randomUUID()}`;
  const rand=globalThis.crypto?.getRandomValues
    ?Array.from(crypto.getRandomValues(new Uint8Array(10)),b=>b.toString(16).padStart(2,"0")).join("")
    :Math.random().toString(36).slice(2)+Date.now().toString(36);
  return `${prefix}-${Date.now().toString(36)}-${rand}`
}

export function escapeHtml(value){
  return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]))
}

export function actionExpr(name,...args){
  const raw=`${name}(${args.map(v=>JSON.stringify(v)).join(",")})`;
  return escapeHtml(raw)
}
