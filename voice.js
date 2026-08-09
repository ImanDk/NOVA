
let recognition=null;
let listening=false;
let voices=[];
let autoContinue=false;
let onFinalHandler=null;
let onStatusHandler=null;
let onInterimHandler=null;

function loadVoices(){
  try{voices=window.speechSynthesis?.getVoices?.()||[]}catch(_){voices=[]}
  return voices;
}
if("speechSynthesis" in window){
  loadVoices();
  window.speechSynthesis.onvoiceschanged=loadVoices;
}

export function getVoiceSupport(){
  const Rec=window.SpeechRecognition||window.webkitSpeechRecognition;
  return {
    synthesis:"speechSynthesis" in window,
    recognition:!!Rec,
    persianVoice:(loadVoices().some(v=>(v.lang||"").toLowerCase().startsWith("fa")))
  };
}

export function getPersianVoice(){
  const list=loadVoices();
  const fa=list.filter(v=>(v.lang||"").toLowerCase().startsWith("fa"));
  if(fa.length){
    return fa.find(v=>/siri|premium|enhanced|female|darya|dariush|persian/i.test(v.name||"")) || fa[0];
  }
  return list.find(v=>(v.lang||"").toLowerCase().startsWith("ar")) || list[0] || null;
}

export function stopSpeaking(){
  try{window.speechSynthesis?.cancel?.()}catch(_){}
}

export function speakFa(text,{rate=.92,pitch=1.02,volume=1}={}){
  return new Promise(resolve=>{
    if(!("speechSynthesis" in window) || !text){resolve(false);return}
    try{
      window.speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(text);
      u.lang="fa-IR";u.rate=rate;u.pitch=pitch;u.volume=volume;
      const v=getPersianVoice();if(v)u.voice=v;
      let settled=false;
      const done=()=>{if(!settled){settled=true;resolve(true)}};
      u.onend=done;u.onerror=done;
      window.speechSynthesis.speak(u);
      setTimeout(done,Math.max(5000,text.length*120));
    }catch(_){resolve(false)}
  });
}

function status(s){try{onStatusHandler?.(s)}catch(_){}}
function interim(s){try{onInterimHandler?.(s)}catch(_){}}

export function configureVoiceSession({onFinal,onStatus,onInterim,continuous=false}={}){
  onFinalHandler=onFinal||null;onStatusHandler=onStatus||null;onInterimHandler=onInterim||null;
  autoContinue=!!continuous;
}

export function isListening(){return listening}
export function setAutoContinue(v){autoContinue=!!v}
export function getAutoContinue(){return autoContinue}

export function startListening(){
  const Rec=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Rec){status("unsupported");return false}
  if(listening)return true;
  try{
    recognition=new Rec();
    recognition.lang="fa-IR";
    recognition.continuous=false;
    recognition.interimResults=true;
    recognition.maxAlternatives=1;

    recognition.onstart=()=>{listening=true;status("listening")};
    recognition.onspeechstart=()=>status("hearing");
    recognition.onresult=e=>{
      let finalText="",partial="";
      for(let i=e.resultIndex;i<e.results.length;i++){
        const txt=e.results[i][0]?.transcript||"";
        if(e.results[i].isFinal)finalText+=txt;
        else partial+=txt;
      }
      if(partial)interim(partial.trim());
      if(finalText.trim()){
        listening=false;
        status("processing");
        onFinalHandler?.(finalText.trim());
      }
    };
    recognition.onerror=e=>{
      listening=false;
      status(e.error==="not-allowed"?"permission":"error");
    };
    recognition.onend=()=>{
      const was=listening;listening=false;
      if(was)status("idle");
    };
    recognition.start();
    return true;
  }catch(_){listening=false;status("error");return false}
}

export function stopListening(){
  try{recognition?.stop?.()}catch(_){}
  recognition=null;listening=false;status("idle");
}

export async function continueListeningAfter(delay=650){
  if(!autoContinue)return false;
  await new Promise(r=>setTimeout(r,delay));
  return startListening();
}
