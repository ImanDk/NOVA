function splitTopLevel(input,separator){
  const out=[];let buf="",quote="",escape=false,depth=0;
  for(const ch of String(input||"")){
    if(escape){buf+=ch;escape=false;continue}
    if(quote){buf+=ch;if(ch==="\\")escape=true;else if(ch===quote)quote="";continue}
    if(ch==='"'||ch==="'"){quote=ch;buf+=ch;continue}
    if(ch==='('){depth++;buf+=ch;continue}
    if(ch===')'){depth=Math.max(0,depth-1);buf+=ch;continue}
    if(ch===separator&&depth===0){if(buf.trim())out.push(buf.trim());buf="";continue}
    buf+=ch
  }
  if(buf.trim())out.push(buf.trim());
  return out
}
function parseArg(raw,event){
  const s=raw.trim();
  if(!s)return undefined;
  if(s==="event")return event;
  if(s==="true")return true;if(s==="false")return false;if(s==="null")return null;
  if(/^-?\d+(?:\.\d+)?$/.test(s))return Number(s);
  if((s.startsWith('"')&&s.endsWith('"'))||(s.startsWith("'")&&s.endsWith("'"))){
    if(s[0]==='"')try{return JSON.parse(s)}catch(_){return s.slice(1,-1)}
    return s.slice(1,-1).replace(/\\'/g,"'").replace(/\\\\/g,"\\")
  }
  throw new Error(`Unsupported action argument: ${s}`)
}
function runCall(call,event){
  if(call==="stopPropagation"||call==="event.stopPropagation()"){
    event.stopPropagation();return
  }
  const m=call.match(/^([A-Za-z_$][\w$]*)\((.*)\)$/s);
  if(!m)throw new Error(`Invalid action: ${call}`);
  const fn=window[m[1]];
  if(typeof fn!=="function")throw new Error(`Action handler not found: ${m[1]}`);
  const args=m[2].trim()?splitTopLevel(m[2],',').map(v=>parseArg(v,event)):[];
  return fn(...args)
}

export function installActionDelegation(){
  if(document.documentElement.dataset.miaActionsReady==="1")return;
  document.documentElement.dataset.miaActionsReady="1";
  document.addEventListener("click",event=>{
    const target=event.target.closest?.("[data-action]");
    if(!target)return;
    const expr=target.getAttribute("data-action")||"";
    try{
      for(const call of splitTopLevel(expr,';'))runCall(call,event)
    }catch(err){
      console.error("[MIA action]",expr,err);
      window.dispatchEvent(new CustomEvent("mia:action-error",{detail:{expr,message:err?.message||String(err)}}))
    }
  })
}
