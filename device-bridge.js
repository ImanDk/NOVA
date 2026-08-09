
const BRIDGE_NAME="NOVA Bridge";

export function bridgeIsMarkedReady(){
  return localStorage.getItem("nova_device_bridge_ready")==="1";
}
export function setBridgeReady(v){
  localStorage.setItem("nova_device_bridge_ready",v?"1":"0");
}
export function makeBridgePayload(intent){
  return {
    version:1,
    source:"NOVA",
    type:intent.type,
    title:intent.title||"",
    startISO:intent.startISO||"",
    endISO:intent.endISO||"",
    alertISO:intent.alertISO||"",
    alertBeforeMin:intent.alertBeforeMin??60,
    durationMin:intent.durationMin??60,
    notes:intent.notes||"",
    projectId:intent.projectId||null,
    id:intent.id||null
  };
}
export function buildShortcutURL(payload){
  const text=encodeURIComponent(JSON.stringify(payload));
  return `shortcuts://run-shortcut?name=${encodeURIComponent(BRIDGE_NAME)}&input=text&text=${text}`;
}
export function launchNativeBridge(intent){
  if(!bridgeIsMarkedReady())return {launched:false,reason:"not-ready",url:buildShortcutURL(makeBridgePayload(intent))};
  const url=buildShortcutURL(makeBridgePayload(intent));
  try{
    window.location.href=url;
    return {launched:true,url};
  }catch(e){
    return {launched:false,reason:"blocked",url};
  }
}
