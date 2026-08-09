
import {openDB,all,put,remove,count} from "./db.js";
import {pParts,pKey,pFull,pMonthTitle,pDayNum,pWeekday,monthCells,startOfWeek,addDays,parseNaturalEvent} from "./planner.js";
import {configureVoiceSession,startListening,stopListening,speakFa,getVoiceSupport,setAutoContinue,getAutoContinue,continueListeningAfter,isListening} from "./voice.js";
import {bridgeIsMarkedReady,setBridgeReady,launchNativeBridge,buildShortcutURL,makeBridgePayload} from "./device-bridge.js";

const $=id=>document.getElementById(id);
const now=()=>Date.now();
const ICONS={
 home:`<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></svg>`,
 planner:`<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M8 14h3M14 14h2M8 18h2"/></svg>`,
 check:`<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>`,
 parking:`<svg viewBox="0 0 24 24"><path d="M5 19c4-1 6-4 6-8 0-3 2-5 5-5 2 0 3 1 3 3 0 3-3 5-7 5"/><circle cx="6" cy="19" r="2"/></svg>`,
 memory:`<svg viewBox="0 0 24 24"><path d="M8 4h8a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>`,
 chat:`<svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4Z"/></svg>`,
 mic:`<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></svg>`,
 wave:`<svg viewBox="0 0 24 24"><path d="M3 12h2l2-5 3 10 3-13 3 15 2-7h3"/></svg>`,
 link:`<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/></svg>`,
 projects:`<svg viewBox="0 0 24 24"><path d="M4 7h6l2 2h8v10H4Z"/><path d="M4 7V5h6l2 2"/></svg>`,
 trash:`<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>`,
 plus:`<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>`,
 sliders:`<svg viewBox="0 0 24 24"><path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h8M16 18h4"/><circle cx="16" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="14" cy="18" r="2"/></svg>`
};
let state={tasks:[],events:[],parking:[],memory:[],chat:[],projects:[],projectTasks:[]};
let currentProjectId=null;
let lastDeletedTask=null;
let currentProjectTab="overview";
let planner={view:"month",anchor:new Date(),selected:new Date()};
let voiceSessionOpen=false;
let pendingBridgeIntent=null;
let currentTaskTab="open";
let persianPicker={hiddenId:null,labelId:null,anchor:new Date(),selected:new Date(),allowEmpty:false};

function icon(n){return ICONS[n]||ICONS.home}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function faNum(n){return new Intl.NumberFormat("fa-IR",{useGrouping:false}).format(n)}
function faTime(d){return new Intl.DateTimeFormat("fa-IR",{hour:"2-digit",minute:"2-digit",hour12:false}).format(d)}
function toast(msg,actionLabel=null,actionFn=null){
  const t=$("toast"), text=$("toastText")||t, action=$("toastAction");
  text.textContent=msg;
  if(action && actionLabel && actionFn){
    action.style.display="inline-block"; action.textContent=actionLabel; action.onclick=()=>{actionFn();t.classList.remove("show");action.style.display="none"};
  }else if(action){action.style.display="none";action.onclick=null}
  t.classList.add("show");clearTimeout(window._tt);window._tt=setTimeout(()=>{t.classList.remove("show");if(action)action.style.display="none"},3600)
}
function isSameDay(a,b){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}
function eventsFor(date){return state.events.filter(e=>isSameDay(new Date(e.startISO),date)).sort((a,b)=>new Date(a.startISO)-new Date(b.startISO))}
function normalize(s){return String(s||"").trim().replace(/ي/g,"ی").replace(/ك/g,"ک").replace(/\s+/g," ")}

async function seed(){
  if(await count("tasks")===0){
    await put("tasks",{id:1,title:"مرور برنامه روز",time:"09:00",done:false,createdAt:now()});
    await put("tasks",{id:2,title:"۲۵ دقیقه کار متمرکز",time:"10:30",done:false,createdAt:now()});
  }
  if(await count("memory")===0){
    await put("memory",{id:1,title:"اصل تمرکز",text:"در هر لحظه فقط یک کار اصلی پیشنهاد شود.",strength:3});
    await put("memory",{id:2,title:"یادآوری",text:"برای قرارهای زمان‌دار، پیش‌فرض هشدار ۶۰ دقیقه قبل باشد.",strength:3});
  }
}
async function loadState(){
  state.tasks=await all("tasks");state.events=await all("events");state.parking=await all("parking");state.memory=await all("memory");state.chat=await all("chat");state.projects=await all("projects");state.projectTasks=await all("projectTasks");
}
async function init(){
  try{
    await openDB();await migrateLocalStorage();await seed();await loadState();wire();renderAll();
    $("storageStatus").textContent="IndexedDB فعال";
  }catch(e){console.error(e);$("storageStatus").textContent="خطای Storage";toast("ذخیره‌سازی محلی درست راه‌اندازی نشد")}
}
async function migrateLocalStorage(){
  for(const key of ["nova_v05","nova_v04_personal","nova_glass_v02"]){
    try{
      const old=JSON.parse(localStorage.getItem(key)||"null");if(!old)continue;
      if(await count("tasks")===0 && Array.isArray(old.tasks)) for(const t of old.tasks) await put("tasks",{id:t.id||now()+Math.random(),title:t.title||"کار",time:t.time||t.meta||"امروز",done:!!t.done,createdAt:t.createdAt||now()});
      if(await count("parking")===0 && Array.isArray(old.parking)) for(const p of old.parking) await put("parking",{id:p.id||now()+Math.random(),text:p.text||String(p),createdAt:p.createdAt||now()});
      if(await count("memory")===0 && Array.isArray(old.memory)) for(const m of old.memory) await put("memory",{id:m.id||now()+Math.random(),title:m.title||m.category||"حافظه",text:m.text||String(m),strength:m.strength||2});
      break;
    }catch(e){}
  }
}
function wire(){
  document.querySelectorAll("[data-icon]").forEach(el=>el.innerHTML=icon(el.dataset.icon));
  configureVoiceSession({
    onFinal:(text)=>handleVoiceCommand(text,{fromRecognition:true}),
    onStatus:(s)=>renderVoiceStatus(s),
    onInterim:(t)=>{const el=$("voiceTranscript");if(el)el.textContent=t}
  });
  $("dateText").textContent=pFull(new Date());
  document.querySelectorAll(".view-switch button").forEach(b=>b.onclick=()=>{planner.view=b.dataset.view;document.querySelectorAll(".view-switch button").forEach(x=>x.classList.toggle("active",x===b));renderPlanner()});
  $("askInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();askNOVA()}});
}
function renderAll(){
  renderHome();renderTasks();renderMemoryParking();renderChat();renderPlanner();renderProjects();if(currentProjectId)renderProjectDetail();
}
function renderHome(){
  const done=state.tasks.filter(t=>t.done).length,total=state.tasks.length,open=total-done,pct=total?Math.round(done/total*100):0;
  const activeProjects=state.projects.filter(p=>p.status!=="done").length;
  $("sumProgress").textContent=faNum(pct)+"٪";
  $("sumTasks").textContent=faNum(open);
  $("sumDone").textContent=faNum(done);
  if($("sumProjects"))$("sumProjects").textContent=faNum(activeProjects);
  if($("homeProgressFill"))$("homeProgressFill").style.width=pct+"%";

  const openTasks=state.tasks.filter(t=>!t.done);
  $("homeTasks").innerHTML=openTasks.slice(0,3).map(taskRow).join("")||empty("کار بازی نداری.");

  const next=state.events.filter(e=>new Date(e.startISO)>new Date()).sort((a,b)=>new Date(a.startISO)-new Date(b.startISO))[0];
  $("nextEvent").innerHTML=next
    ? `<b>${esc(next.title)}</b><small>${pFull(new Date(next.startISO))} · ${faTime(new Date(next.startISO))}</small>`
    : `<b>قرار بعدی ثبت نشده</b><small>از تقویم یا با صدای NOVA یک برنامه اضافه کن.</small>`;

  const nowTitle=$("homeNowTitle"),nowMeta=$("homeNowMeta");
  if(next && (new Date(next.startISO)-new Date()) < 6*60*60*1000){
    nowTitle.textContent=next.title;
    nowMeta.textContent=`قرار بعدی · ${pFull(new Date(next.startISO))} ساعت ${faTime(new Date(next.startISO))}`;
  }else if(openTasks.length){
    nowTitle.textContent=openTasks[0].title;
    nowMeta.textContent="پیشنهاد NOVA برای کار بعدی؛ یک کار را تمام کن و بعد سراغ بعدی برو.";
  }else if(next){
    nowTitle.textContent="برنامه‌ات تحت کنترل است";
    nowMeta.textContent=`قرار بعدی: ${next.title} · ${faTime(new Date(next.startISO))}`;
  }else{
    nowTitle.textContent="فعلاً کار فوری نداری";
    nowMeta.textContent="می‌تونی یک کار، قرار یا پروژه جدید به NOVA بگی.";
  }
}
function taskRow(t){return `<div class="task-row"><button class="task-check ${t.done?"done":""}" onclick="toggleTask(${t.id})">${icon("check")}</button><div class="task-copy"><b>${esc(t.title)}</b><small>${t.done?"انجام شده":"در انتظار انجام"}</small></div><span class="time-pill">${esc(t.time||"امروز")}</span></div>`}

function doneTaskRow(t){
  return `<div class="task-row" id="done-task-${t.id}">
    <button class="task-check done" onclick="toggleTask(${t.id})">${icon("check")}</button>
    <div class="task-copy"><b>${esc(t.title)}</b><small>انجام شده</small></div>
    <span class="time-pill">${esc(t.time||"امروز")}</span>
    <button class="delete-btn" aria-label="حذف" onclick="deleteDoneTask(${t.id})">${icon("trash")}</button>
  </div>`
}

function empty(s){return `<div class="timeline-empty">${esc(s)}</div>`}
function renderTasks(){
  const openTasks=state.tasks.filter(t=>!t.done);
  const doneTasks=state.tasks.filter(t=>t.done);
  $("todayList").innerHTML=openTasks.map(taskRow).join("")||empty("کار بازی نداری.");
  $("doneList").innerHTML=doneTasks.map(doneTaskRow).join("")||empty("هنوز کاری انجام نشده.");
  if($("openTasksCount"))$("openTasksCount").textContent=faNum(openTasks.length);
  if($("doneTasksCount"))$("doneTasksCount").textContent=faNum(doneTasks.length);
  switchTaskTab(currentTaskTab,false);
}
function renderMemoryParking(){
  $("parkingList").innerHTML=state.parking.map(p=>`<div class="task-row"><div class="task-copy"><b>${esc(p.text)}</b><small>پارک شده</small></div><button class="secondary" onclick="parkingToTask(${p.id})">تبدیل به کار</button></div>`).join("")||empty("پارکینگ خالی است.");
  $("memoryList").innerHTML=state.memory.map(m=>`<div class="event-box" style="margin-bottom:8px"><b>${esc(m.title)}</b><small>${esc(m.text)}</small><div class="event-meta"><span>قدرت ${faNum(m.strength||1)}/۳</span><span>حافظه محلی</span></div></div>`).join("")||empty("حافظه‌ای ثبت نشده.");
}
function renderChat(){
  $("messages").innerHTML=(state.chat.length?state.chat:[{role:"ai",text:"من NOVA هستم. یک کار، قرار یا سؤال رو طبیعی بگو؛ مثلاً «سه‌شنبه ساعت ۱۲ باید برم دفتر». "}]).sort((a,b)=>(a.at||0)-(b.at||0)).slice(-30).map(m=>`<div class="bubble ${m.role}">${esc(m.text)}</div>`).join("");
  $("messages").scrollTop=$("messages").scrollHeight;
}
function renderPlanner(){
  $("plannerMonthTitle").textContent=pMonthTitle(planner.anchor);
  $("selectedDateLabel").textContent=pFull(planner.selected);
  $("monthView").style.display=planner.view==="month"?"block":"none";
  $("weekView").style.display=planner.view==="week"?"block":"none";
  $("dayView").style.display=planner.view==="day"?"block":"none";
  if(planner.view==="month")renderMonth();
  if(planner.view==="week")renderWeek();
  if(planner.view==="day")renderDay();
  renderSelectedTimeline();
}
function renderMonth(){
  const {cells,start,end}=monthCells(planner.anchor), anchorParts=pParts(planner.anchor),today=new Date();
  $("monthGrid").innerHTML=cells.map(d=>{
    const pp=pParts(d),inside=pp.month===anchorParts.month&&pp.year===anchorParts.year, ev=eventsFor(d);
    return `<button class="day-cell ${inside?"":"muted"} ${isSameDay(d,today)?"today":""} ${isSameDay(d,planner.selected)?"selected":""}" onclick="selectPlannerDate('${d.toISOString()}')"><b>${pDayNum(d)}</b>${ev.length?`<div class="event-dots">${ev.slice(0,3).map(()=>"<i></i>").join("")}</div>`:""}</button>`;
  }).join("");
}
function renderWeek(){
  const s=startOfWeek(planner.selected), days=Array.from({length:7},(_,i)=>addDays(s,i));
  $("weekBoard").innerHTML=days.map(d=>`<button class="week-day ${isSameDay(d,planner.selected)?"active":""}" onclick="selectPlannerDate('${d.toISOString()}')"><div class="wd">${pWeekday(d)}</div><div class="dn">${pDayNum(d)}</div>${eventsFor(d).slice(0,3).map(e=>`<div class="mini-event">${esc(e.title)}<br>${faTime(new Date(e.startISO))}</div>`).join("")}</button>`).join("");
}
function renderDay(){
  $("dayFocusTitle").textContent=pFull(planner.selected);
  const ev=eventsFor(planner.selected);
  $("dayFocusBody").innerHTML=ev.length?ev.map(eventRow).join(""):empty("برای این روز برنامه‌ای ثبت نشده.");
}
function renderSelectedTimeline(){
  const ev=eventsFor(planner.selected);
  $("selectedTimeline").innerHTML=ev.length?ev.map(eventRow).join(""):empty("برای این روز قرار زمان‌داری ثبت نشده.");
}
function eventRow(e){
  const d=new Date(e.startISO);
  return `<div class="event-row"><div class="event-time">${faTime(d)}</div><div class="event-box"><b>${esc(e.title)}</b><small>${e.location?`مکان: ${esc(e.location)}`:""}${e.notes?`<br>${esc(e.notes)}`:""}</small><div class="event-meta"><span>${faNum(e.durationMin||60)} دقیقه</span><span>هشدار ${faNum(e.alertBeforeMin||60)} دقیقه قبل</span></div></div></div>`
}
window.selectPlannerDate=iso=>{planner.selected=new Date(iso);planner.anchor=new Date(iso);renderPlanner()}
window.shiftPlannerMonth=dir=>{const d=dir>0?addDays(monthCells(planner.anchor).end,1):addDays(monthCells(planner.anchor).start,-1);planner.anchor=d;planner.selected=d;renderPlanner()}
window.switchPage=id=>{document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));$(id).classList.add("active");document.querySelectorAll(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.page===id||(id==="projectDetail"&&n.dataset.page==="projects")));window.scrollTo({top:0,behavior:"smooth"});if(id==="planner")renderPlanner();if(id==="projects")renderProjects();if(id==="projectDetail"&&currentProjectId)renderProjectDetail()}
window.switchTaskTab=(tab,animate=true)=>{
  currentTaskTab=tab==="done"?"done":"open";
  const openTab=$("openTasksTab"),doneTab=$("doneTasksTab"),openPane=$("openTasksPane"),donePane=$("doneTasksPane");
  if(!openTab||!doneTab||!openPane||!donePane)return;
  openTab.classList.toggle("active",currentTaskTab==="open");
  doneTab.classList.toggle("active",currentTaskTab==="done");
  openPane.classList.toggle("active",currentTaskTab==="open");
  donePane.classList.toggle("active",currentTaskTab==="done");
  if(animate){
    const pane=currentTaskTab==="open"?openPane:donePane;
    pane.classList.remove("task-pane-pop");void pane.offsetWidth;pane.classList.add("task-pane-pop");
  }
};

window.toggleTask=async id=>{const t=state.tasks.find(x=>x.id===id);if(!t)return;t.done=!t.done;await put("tasks",t);await loadState();renderAll();toast(t.done?"انجام‌شده ثبت شد":"کار دوباره باز شد")}
window.parkingToTask=async id=>{const p=state.parking.find(x=>x.id===id);if(!p)return;await put("tasks",{id:now(),title:p.text,time:"امروز",done:false,createdAt:now()});await remove("parking",id);await loadState();renderAll();toast("به کارهای امروز منتقل شد")}
window.openEventSheet=()=>{$("eventSheet").classList.add("show");$("eventTitle").focus();$("eventDateLabel").value=pFull(planner.selected)}
window.closeEventSheet=e=>{if(!e||e.target.id==="eventSheet")$("eventSheet").classList.remove("show")}
window.saveEvent=async()=>{
  const title=$("eventTitle").value.trim();if(!title)return toast("عنوان برنامه رو وارد کن");
  const ts=$("eventTime").value||"09:00";
  const [hh,mm]=ts.split(":").map(Number);const dt=new Date(planner.selected);dt.setHours(hh,mm,0,0);
  const e={id:now(),title,startISO:dt.toISOString(),durationMin:+$("eventDuration").value||60,alertBeforeMin:+$("eventAlert").value||60,location:$("eventLocation").value.trim(),notes:$("eventNotes").value.trim(),type:"event",createdAt:now()};
  await put("events",e);$("eventSheet").classList.remove("show");["eventTitle","eventLocation","eventNotes"].forEach(id=>$(id).value="");await loadState();planner.selected=dt;planner.anchor=dt;renderAll();toast("در تقویم NOVA ثبت شد")
}
async function pushChat(role,text){const m={id:now()+Math.random(),role,text,at:now()};await put("chat",m);state.chat.push(m);renderChat()}
window.askNOVA=async()=>{
  const q=normalize($("askInput").value||$("chatInput").value);if(!q)return;$("askInput").value="";$("chatInput").value="";switchPage("chat");await pushChat("user",q);
  if(q.includes("ساعت")&&q.includes("چند")) return pushChat("ai",`الان ساعت ${faTime(new Date())} است.`);
  if(q.includes("چه کار")&&q.includes("مونده")){const a=state.tasks.filter(t=>!t.done);return pushChat("ai",a.length?`${faNum(a.length)} کار باز داری: ${a.slice(0,3).map(x=>x.title).join("، ")}`:"کار بازی باقی نمونده.");}
  if(q.includes("پارکینگ")&&(q.includes("بذار")||q.includes("بزار")||q.includes("ثبت"))){let t=q.replace(/.*پارکینگ/,"").replace(/^(بذار|بزار|ثبت کن|تو)/,"").trim();if(t){await put("parking",{id:now(),text:t,createdAt:now()});await loadState();renderAll();return pushChat("ai","گذاشتمش تو پارکینگ. برگردیم به کار اصلی.");}}

  // Project-aware lightweight command
  const pMatch=state.projects.find(p=>q.includes(p.title));
  if(pMatch && (q.includes("کار")||q.includes("پروژه")||q.includes("انجام"))){
    if(q.includes("انجام شد")){
      const pt=state.projectTasks.find(t=>t.projectId===pMatch.id && !t.done && q.includes(t.title));
      if(pt){pt.done=true;await put("projectTasks",pt);await loadState();renderAll();return pushChat("ai",`ثبت شد؛ «${pt.title}» در پروژه «${pMatch.title}» انجام شد.`)}
    }
  }

  const parsed=parseNaturalEvent(q);
  if(parsed){
    await put("events",{id:now(),...parsed,createdAt:now(),location:"",notes:""});await loadState();planner.selected=new Date(parsed.startISO);planner.anchor=new Date(parsed.startISO);renderAll();
    return pushChat("ai",`ثبت شد: «${parsed.title}» در ${pFull(new Date(parsed.startISO))} ساعت ${faTime(new Date(parsed.startISO))}. هشدار پیش‌فرض NOVA روی ۶۰ دقیقه قبل تنظیم شد. آلارم سیستمی iPhone در فاز Device Bridge به این رویداد وصل می‌شه.`);
  }
  if(q.includes("یادم بنداز")||q.includes("یادآوری کن")){const t=q.replace("یادم بنداز","").replace("یادآوری کن","").trim()||"یادآوری";await put("tasks",{id:now(),title:t,time:"یادآوری NOVA",done:false,createdAt:now()});await loadState();renderAll();return pushChat("ai","به کارهای NOVA اضافه شد.");}
  return pushChat("ai","این درخواست نیاز به تحلیل هوشمندتر داره. در v0.6 برای پایداری، AI سنگین هنوز روشن نمی‌شه؛ Smart Router و Planner محلی فعال هستن.");
}
window.openQuickTask=()=>{$("taskSheet").classList.add("show");$("taskTitle").focus()}
window.closeTaskSheet=e=>{if(!e||e.target.id==="taskSheet")$("taskSheet").classList.remove("show")}
window.saveTask=async()=>{const t=$("taskTitle").value.trim();if(!t)return;await put("tasks",{id:now(),title:t,time:$("taskWhen").value||"امروز",done:false,createdAt:now()});$("taskTitle").value="";$("taskSheet").classList.remove("show");await loadState();renderAll();toast("کار اضافه شد")}
window.showDiagnostics=async()=>{const est=await navigator.storage?.estimate?.();const vs=getVoiceSupport();alert(`NOVA v0.7\nTasks: ${state.tasks.length}\nEvents: ${state.events.length}\nProjects: ${state.projects.length}\nStorage: ${est?Math.round((est.usage||0)/1024/1024)+" MB":"unknown"}\nVoice Output: ${vs.synthesis?"yes":"no"}\nVoice Input: ${vs.recognition?"yes":"no"}\nPersian Voice: ${vs.persianVoice?"yes":"fallback"}\nDevice Bridge: ${bridgeIsMarkedReady()?"ready":"setup needed"}`)}

window.deleteDoneTask=async id=>{
  const t=state.tasks.find(x=>x.id===id);if(!t)return;
  const el=$(`done-task-${id}`);if(el)el.classList.add("removing");
  setTimeout(async()=>{
    lastDeletedTask={...t};
    await remove("tasks",id);await loadState();renderAll();
    toast("کار حذف شد","برگرداندن",async()=>{
      if(!lastDeletedTask)return;
      await put("tasks",lastDeletedTask);lastDeletedTask=null;await loadState();renderAll();toast("کار برگردانده شد")
    });
  },220)
};

function projectTasks(id){return state.projectTasks.filter(t=>t.projectId===id)}
function projectProgress(id){
  const a=projectTasks(id),done=a.filter(t=>t.done).length,total=a.length;
  return {total,done,left:total-done,pct:total?Math.round(done/total*100):0}
}
function projectStatusLabel(s){return s==="done"?"تکمیل‌شده":s==="paused"?"متوقف":"فعال"}
function dateValue(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function parseStoredDate(v){
  if(!v)return null;
  const [y,m,d]=String(v).split("-").map(Number);
  if(!y||!m||!d)return null;
  return new Date(y,m-1,d,12,0,0,0);
}
function formatStoredDate(v){
  const d=parseStoredDate(v);return d?pFull(d):"";
}
function shortPersianDate(d){
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian",{weekday:"short",month:"short",day:"numeric"}).format(d);
}

function renderProjects(){
  const root=$("projectsList");if(!root)return;
  if(!state.projects.length){
    root.innerHTML=`<div class="surface-card project-empty">هنوز پروژه‌ای ساخته نشده.<br><button class="primary" style="margin-top:14px" onclick="openProjectSheet()">ساخت اولین پروژه</button></div>`;return;
  }
  root.innerHTML=state.projects.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).map(p=>{
    const pr=projectProgress(p.id);
    const tasks=projectTasks(p.id).filter(t=>!t.done).sort((a,b)=>(a.dueISO||"9999").localeCompare(b.dueISO||"9999"));
    const next=tasks[0]||null;
    const due=next?.dueISO?new Date(next.dueISO):null;
    return `<button class="project-card" onclick="openProject(${p.id})">
      <div class="project-card-head">
        <div><h3>${esc(p.title)}</h3><p>${esc(p.description||"بدون توضیح")}</p></div>
        <div class="project-percent">${faNum(pr.pct)}٪</div>
      </div>
      ${next?`<div class="project-next"><span>اقدام بعدی</span><b>${esc(next.title)}</b><small>${due?`${shortPersianDate(due)} · ${faTime(due)}`:"بدون زمان مشخص"}</small></div>`:`<div class="project-next quiet"><span>اقدام بعدی</span><b>کاری باقی نمانده</b></div>`}
      <div class="progress-track"><div class="progress-fill" style="width:${pr.pct}%"></div></div>
      <div class="project-stats">
        <span class="chip">${faNum(pr.done)} / ${faNum(pr.total)} انجام</span>
        <span class="chip">${faNum(pr.left)} باقی</span>
        ${p.end?`<span class="chip">پایان: ${formatStoredDate(p.end)}</span>`:""}
      </div>
    </button>`
  }).join("");
}

window.openProjectSheet=()=>{
  $("projectSheet").classList.add("show");$("projectTitle").focus();
  $("projectStart").value=dateValue();$("projectStartLabel").textContent=pFull(new Date());
  $("projectEnd").value="";$("projectEndLabel").textContent="بدون تاریخ";
}
window.closeProjectSheet=e=>{if(!e||e.target.id==="projectSheet")$("projectSheet").classList.remove("show")}
window.saveProject=async()=>{
  const title=$("projectTitle").value.trim();if(!title)return toast("نام پروژه رو وارد کن");
  const p={id:now(),title,description:$("projectDescription").value.trim(),start:$("projectStart").value,end:$("projectEnd").value,status:$("projectStatus").value||"active",createdAt:now()};
  await put("projects",p);$("projectSheet").classList.remove("show");["projectTitle","projectDescription","projectEnd"].forEach(id=>$(id).value="");$("projectEndLabel").textContent="بدون تاریخ";
  await loadState();renderAll();toast("پروژه ساخته شد");openProject(p.id)
}
window.openProject=id=>{currentProjectId=id;currentProjectTab="overview";switchPage("projectDetail");renderProjectDetail()}
window.switchProjectTab=tab=>{
  currentProjectTab=tab;document.querySelectorAll(".project-tab").forEach(b=>b.classList.toggle("active",b.dataset.projectTab===tab));
  document.querySelectorAll(".project-pane").forEach(p=>p.classList.remove("active"));
  const map={overview:"projectPaneOverview",tasks:"projectPaneTasks",planner:"projectPanePlanner",progress:"projectPaneProgress"};
  $(map[tab]).classList.add("active")
}
function renderProjectDetail(){
  const p=state.projects.find(x=>x.id===currentProjectId);if(!p)return;
  const pr=projectProgress(p.id),pts=projectTasks(p.id).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
  const openPts=pts.filter(t=>!t.done).sort((a,b)=>(a.dueISO||"9999").localeCompare(b.dueISO||"9999"));
  const nextAction=openPts[0]||null;
  $("projectDetailTitle").textContent=p.title;$("projectDetailDesc").textContent=p.description||"بدون توضیح";
  $("projectProgressText").textContent=faNum(pr.pct)+"٪";
  $("projectProgressRing").style.background=`conic-gradient(var(--purple) 0 ${pr.pct}%,rgba(255,255,255,.06) ${pr.pct}%)`;
  $("projectMetaChips").innerHTML=`<span class="chip">${projectStatusLabel(p.status)}</span>${p.start?`<span class="chip">شروع: ${formatStoredDate(p.start)}</span>`:""}${p.end?`<span class="chip">پایان: ${formatStoredDate(p.end)}</span>`:""}`;

  $("projectPaneOverview").innerHTML=`<div class="surface-card project-overview-card">
    ${nextAction?`<div class="next-action-feature"><span>اقدام بعدی</span><h3>${esc(nextAction.title)}</h3><p>${nextAction.dueISO?`${pFull(new Date(nextAction.dueISO))} · ${faTime(new Date(nextAction.dueISO))}`:"بدون زمان مشخص"}</p></div>`:`<div class="next-action-feature done-feature"><span>وضعیت</span><h3>همه کارهای پروژه انجام شده</h3></div>`}
    <div class="project-kpis"><div class="kpi"><b>${faNum(pr.total)}</b><span>کل کارها</span></div><div class="kpi"><b>${faNum(pr.done)}</b><span>انجام‌شده</span></div><div class="kpi"><b>${faNum(pr.left)}</b><span>باقی‌مانده</span></div></div>
    <div class="project-overall-chart"><div class="chart-head"><span>پیشرفت پروژه</span><b>${faNum(pr.pct)}٪</b></div><div class="bar"><i style="width:${pr.pct}%"></i></div></div>
    <button class="primary" style="width:100%;margin-top:14px" onclick="openProjectTaskSheet()">+ افزودن کار پروژه</button>
  </div>`;

  $("projectPaneTasks").innerHTML=`<div class="surface-card project-task-list">${pts.length?pts.map(pt=>projectTaskRow(pt)).join(""):'<div class="project-empty">کاری برای این پروژه ثبت نشده.</div>'}<button class="primary" style="width:100%;margin-top:12px" onclick="openProjectTaskSheet()">+ کار جدید</button></div>`;
  const scheduled=pts.filter(t=>t.dueISO).sort((a,b)=>new Date(a.dueISO)-new Date(b.dueISO));
  $("projectPanePlanner").innerHTML=`<div class="surface-card project-planner-card">${scheduled.length?scheduled.map(t=>`<div class="project-schedule-item"><div class="project-schedule-time">${faTime(new Date(t.dueISO))}<br>${new Intl.DateTimeFormat("fa-IR-u-ca-persian",{month:"short",day:"numeric"}).format(new Date(t.dueISO))}</div><div><b>${esc(t.title)}</b><div class="pt-meta">${t.addToCalendar?"در تقویم NOVA":"فقط پروژه"} · ${t.done?"انجام شده":"باز"}</div></div></div>`).join(""):'<div class="project-empty">برنامه زمان‌داری ثبت نشده.</div>'}<button class="primary" style="width:100%;margin-top:12px" onclick="openProjectTaskSheet()">+ برنامه‌ریزی کار</button></div>`;
  $("projectPaneProgress").innerHTML=`<div class="surface-card project-progress-card"><div class="project-kpis"><div class="kpi"><b>${faNum(pr.pct)}٪</b><span>پیشرفت</span></div><div class="kpi"><b>${faNum(pr.done)}</b><span>تکمیل</span></div><div class="kpi"><b>${faNum(pr.left)}</b><span>باز</span></div></div><div class="project-overall-chart"><div class="chart-head"><span>درصد تکمیل بر اساس کارها</span><b>${faNum(pr.done)} / ${faNum(pr.total)}</b></div><div class="bar"><i style="width:${pr.pct}%"></i></div></div></div>`;
  switchProjectTab(currentProjectTab);
}
function projectTaskRow(t){
  return `<div class="project-task ${t.done?"done":""}" id="pt-${t.id}">
    <button class="task-check ${t.done?"done":""}" onclick="toggleProjectTask(${t.id})">${icon("check")}</button>
    <div class="pt-copy"><div class="pt-title">${esc(t.title)}</div><div class="pt-meta">${t.dueISO?`${pFull(new Date(t.dueISO))} · ${faTime(new Date(t.dueISO))}`:"بدون زمان"} · ${t.priority==="high"?"مهم":t.priority==="low"?"کم":"عادی"}</div></div>
    <button class="delete-btn" onclick="deleteProjectTask(${t.id})">${icon("trash")}</button>
  </div>`
}
window.openProjectTaskSheet=()=>{
  if(!currentProjectId)return;
  $("projectTaskSheet").classList.add("show");$("projectTaskTitle").focus();
  $("projectTaskDate").value=dateValue();$("projectTaskDateLabel").textContent=pFull(new Date());
}
window.closeProjectTaskSheet=e=>{if(!e||e.target.id==="projectTaskSheet")$("projectTaskSheet").classList.remove("show")}
window.saveProjectTask=async()=>{
  if(!currentProjectId)return;
  const title=$("projectTaskTitle").value.trim();if(!title)return toast("عنوان کار رو وارد کن");
  let dueISO="";const ds=$("projectTaskDate").value,ts=$("projectTaskTime").value||"09:00";
  if(ds){const [y,m,d]=ds.split("-").map(Number),[h,mi]=ts.split(":").map(Number);dueISO=new Date(y,m-1,d,h,mi,0,0).toISOString()}
  const addToCalendar=$("projectTaskCalendar").value==="yes";
  const id=now();
  const t={id,projectId:currentProjectId,title,dueISO,priority:$("projectTaskPriority").value||"normal",addToCalendar,done:false,createdAt:now()};
  await put("projectTasks",t);
  if(addToCalendar && dueISO){
    const p=state.projects.find(x=>x.id===currentProjectId);
    await put("events",{id:id+1,title:`${p?.title||"پروژه"} — ${title}`,startISO:dueISO,durationMin:60,alertBeforeMin:60,location:"",notes:"کار پروژه",type:"project",projectId:currentProjectId,projectTaskId:id,createdAt:now()});
  }
  $("projectTaskSheet").classList.remove("show");$("projectTaskTitle").value="";
  await loadState();renderAll();renderProjectDetail();toast("کار پروژه اضافه شد")
}
window.toggleProjectTask=async id=>{
  const t=state.projectTasks.find(x=>x.id===id);if(!t)return;t.done=!t.done;await put("projectTasks",t);
  await loadState();renderAll();renderProjectDetail();toast(t.done?"کار پروژه انجام شد":"کار دوباره باز شد")
}
window.deleteProjectTask=async id=>{
  const t=state.projectTasks.find(x=>x.id===id);if(!t)return;await remove("projectTasks",id);
  const linked=state.events.filter(e=>e.projectTaskId===id);for(const e of linked)await remove("events",e.id);
  await loadState();renderAll();renderProjectDetail();toast("کار پروژه حذف شد")
};

/* tactile visual response on touch / pointer */
document.addEventListener("pointerdown",e=>{
  const b=e.target.closest("button");if(!b)return;
  b.classList.remove("icon-pop");void b.offsetWidth;b.classList.add("icon-pop","is-pressing");
},{passive:true});
["pointerup","pointercancel","pointerleave"].forEach(type=>document.addEventListener(type,e=>{
  const b=e.target.closest?.("button");if(b)b.classList.remove("is-pressing");
},{passive:true}));



window.openSettingsSheet=()=>{$("settingsSheet").classList.add("show");renderBridgeSetupState()}
window.closeSettingsSheet=e=>{if(!e||e.target?.id==="settingsSheet")$("settingsSheet").classList.remove("show")}

window.openPersianDatePicker=(hiddenId,labelId,allowEmpty=false)=>{
  persianPicker.hiddenId=hiddenId;persianPicker.labelId=labelId;persianPicker.allowEmpty=!!allowEmpty;
  const current=parseStoredDate($(hiddenId).value)||new Date();
  persianPicker.selected=current;persianPicker.anchor=current;
  $("persianPickerClear").style.visibility=allowEmpty?"visible":"hidden";
  renderPersianPicker();$("persianDateSheet").classList.add("show");
}
window.closePersianDatePicker=e=>{if(!e||e.target?.id==="persianDateSheet")$("persianDateSheet").classList.remove("show")}
window.shiftPersianPickerMonth=dir=>{
  const range=monthCells(persianPicker.anchor);
  persianPicker.anchor=dir>0?addDays(range.end,1):addDays(range.start,-1);
  renderPersianPicker();
}
window.selectPersianPickerDate=iso=>{
  persianPicker.selected=new Date(iso);persianPicker.anchor=new Date(iso);renderPersianPicker();
}
function renderPersianPicker(){
  $("persianPickerTitle").textContent=pMonthTitle(persianPicker.anchor);
  $("persianPickerSelected").textContent=pFull(persianPicker.selected);
  const {cells}=monthCells(persianPicker.anchor),anchorParts=pParts(persianPicker.anchor),today=new Date();
  $("persianPickerGrid").innerHTML=cells.map(d=>{
    const pp=pParts(d),inside=pp.month===anchorParts.month&&pp.year===anchorParts.year;
    return `<button class="day-cell ${inside?"":"muted"} ${isSameDay(d,today)?"today":""} ${isSameDay(d,persianPicker.selected)?"selected":""}" onclick="selectPersianPickerDate('${d.toISOString()}')"><b>${pDayNum(d)}</b></button>`
  }).join("");
}
window.confirmPersianDate=()=>{
  if(!persianPicker.hiddenId)return;
  $(persianPicker.hiddenId).value=dateValue(persianPicker.selected);
  $(persianPicker.labelId).textContent=pFull(persianPicker.selected);
  $("persianDateSheet").classList.remove("show");
}
window.clearPersianDate=()=>{
  if(!persianPicker.allowEmpty||!persianPicker.hiddenId)return;
  $(persianPicker.hiddenId).value="";
  $(persianPicker.labelId).textContent="بدون تاریخ";
  $("persianDateSheet").classList.remove("show");
}

function minutesBeforeISO(startISO,minutes=60){
  const d=new Date(startISO);d.setMinutes(d.getMinutes()-minutes);return d.toISOString()
}
function localVoiceIntent(text){
  const q=normalize(text);
  if(!q)return {type:"none"};

  if(q.includes("ساعت")&&(q.includes("چنده")||q.includes("چند است")||q.includes("چند"))){
    return {type:"answer",answer:`الان ساعت ${faTime(new Date())} است.`};
  }
  if(q.includes("امروز")&&(q.includes("چه کار")||q.includes("برنامه"))){
    const open=state.tasks.filter(t=>!t.done).slice(0,3);
    const ev=eventsFor(new Date()).slice(0,3);
    let parts=[];
    if(ev.length)parts.push(`${faNum(ev.length)} برنامه زمان‌دار داری`);
    if(open.length)parts.push(`${faNum(open.length)} کار باز داری`);
    return {type:"answer",answer:parts.length?`امروز ${parts.join(" و ")}.`:"برای امروز چیزی ثبت نشده."};
  }
  if(q.includes("پارکینگ")&&(q.includes("بذار")||q.includes("بزار")||q.includes("ثبت"))){
    let title=q.replace(/.*پارکینگ/,"").replace(/^(بذار|بزار|ثبت کن|تو)/,"").trim();
    if(!title)title="یادداشت";
    return {type:"parking",title};
  }

  const parsed=parseNaturalEvent(q);
  const looksTimed=!!parsed;
  const reminderWords=q.includes("یادم بنداز")||q.includes("یادآوری کن");
  const eventWords=/جلسه|قرار|ملاقات|باید برم|باید بروم|می‌رم|میرم|می روم/.test(q);

  if(looksTimed && reminderWords){
    return {...parsed,type:"reminder",alertBeforeMin:0,
      confirmation:`باشه، ${pFull(new Date(parsed.startISO))} ساعت ${faTime(new Date(parsed.startISO))} یادت می‌اندازم که ${parsed.title}.`};
  }
  if(looksTimed && eventWords){
    return {...parsed,type:"event",alertBeforeMin:60,
      confirmation:`باشه، ${pFull(new Date(parsed.startISO))} ساعت ${faTime(new Date(parsed.startISO))} ثبتش می‌کنم. یک ساعت قبل هم یادت می‌اندازم.`};
  }
  if(looksTimed){
    return {...parsed,type:"event",alertBeforeMin:60,
      confirmation:`باشه، برای ${pFull(new Date(parsed.startISO))} ساعت ${faTime(new Date(parsed.startISO))} ثبتش می‌کنم و یک ساعت قبل یادت می‌اندازم.`};
  }

  if(reminderWords){
    const title=q.replace("یادم بنداز","").replace("یادآوری کن","").trim()||"یادآوری";
    return {type:"task",title,time:"یادآوری NOVA",confirmation:`باشه، «${title}» رو به کارهات اضافه می‌کنم.`};
  }
  if(/اضافه کن|کار جدید|تسک/.test(q)){
    const title=q.replace(/کار جدید|تسک|اضافه کن|به کارهام|به کارها/g,"").trim()||q;
    return {type:"task",title,time:"امروز",confirmation:`باشه، «${title}» رو به کارهات اضافه می‌کنم.`};
  }
  return {type:"conversation",text:q};
}

async function persistVoiceIntent(intent){
  const id=now();
  if(intent.type==="event"){
    const event={id,title:intent.title,startISO:intent.startISO,durationMin:intent.durationMin||60,
      alertBeforeMin:intent.alertBeforeMin??60,location:"",notes:"ثبت‌شده با NOVA Voice",type:"event",createdAt:now()};
    await put("events",event);
    await loadState();planner.selected=new Date(event.startISO);planner.anchor=new Date(event.startISO);renderAll();
    return {...event,alertISO:minutesBeforeISO(event.startISO,event.alertBeforeMin)};
  }
  if(intent.type==="reminder"){
    const event={id,title:intent.title,startISO:intent.startISO,durationMin:0,alertBeforeMin:0,
      location:"",notes:"یادآوری صوتی NOVA",type:"reminder",createdAt:now()};
    await put("events",event);await loadState();renderAll();
    return {...event,alertISO:event.startISO};
  }
  if(intent.type==="task"){
    const task={id,title:intent.title,time:intent.time||"امروز",done:false,createdAt:now()};
    await put("tasks",task);await loadState();renderAll();return task;
  }
  if(intent.type==="parking"){
    const p={id,text:intent.title,createdAt:now()};await put("parking",p);await loadState();renderAll();return p;
  }
  return intent;
}

async function conversationReply(text){
  const q=normalize(text);
  if(q.includes("خودت رو معرفی")||q.includes("خودتو معرفی")){
    return "من نووا هستم؛ دستیار شخصی تو برای برنامه‌ریزی، یادآوری، تمرکز، پروژه‌ها و تصمیم‌گیری.";
  }
  if(q.includes("چه کار")&&q.includes("مونده")){
    const open=state.tasks.filter(t=>!t.done);
    return open.length?`${faNum(open.length)} کار باز داری. مهم‌ترین‌ها: ${open.slice(0,3).map(t=>t.title).join("، ")}.`:"کار بازی باقی نمونده.";
  }
  return "این سؤال به تحلیل هوشمندتر نیاز داره. فعلاً هسته صوتی و فرمان‌های محلی فعاله و موتور هوش ترکیبی در مرحله بعد کامل می‌شه.";
}

window.handleVoiceCommand=async(text,{fromRecognition=false,fromAction=false}={})=>{
  const clean=normalize(text);if(!clean)return;
  voiceSessionOpen=true;
  $("voiceTranscript").textContent=clean;
  renderVoiceStatus("processing");
  await pushChat("user",clean);

  const intent=localVoiceIntent(clean);

  if(intent.type==="answer"){
    $("voiceResponse").textContent=intent.answer;
    await pushChat("ai",intent.answer);
    renderVoiceStatus("speaking");
    await speakFa(intent.answer);
    renderVoiceStatus("idle");
    if(fromRecognition&&getAutoContinue())continueListeningAfter(650);
    return;
  }

  if(intent.type==="conversation"){
    const reply=await conversationReply(clean);
    $("voiceResponse").textContent=reply;
    await pushChat("ai",reply);
    renderVoiceStatus("speaking");
    await speakFa(reply);
    renderVoiceStatus("idle");
    if(fromRecognition&&getAutoContinue())continueListeningAfter(700);
    return;
  }

  const confirm=intent.confirmation || (intent.type==="parking"?"باشه، گذاشتمش تو پارکینگ.":"باشه، انجامش می‌دم.");
  $("voiceResponse").textContent=confirm;
  await pushChat("ai",confirm);

  // Confirm understanding first, then apply the low-risk action.
  renderVoiceStatus("speaking");
  await speakFa(confirm);
  renderVoiceStatus("applying");

  const saved=await persistVoiceIntent(intent);

  if(intent.type==="event"||intent.type==="reminder"){
    pendingBridgeIntent={...saved,type:intent.type};
    const bridgeResult=launchNativeBridge(pendingBridgeIntent);
    if(!bridgeResult.launched){
      $("bridgeFallback").style.display="inline-flex";
      $("bridgeFallback").dataset.url=bridgeResult.url;
      if(bridgeResult.reason==="not-ready"){
        toast("داخل NOVA ثبت شد؛ برای هشدار واقعی آیفون Device Bridge را یک‌بار فعال کن")
      }
    }
  }else{
    toast(intent.type==="parking"?"در پارکینگ ثبت شد":"ثبت شد");
  }

  renderVoiceStatus("done");
  setTimeout(()=>renderVoiceStatus("idle"),900);
  if(fromRecognition&&getAutoContinue() && !(intent.type==="event"||intent.type==="reminder")) continueListeningAfter(900);
}

window.openVoiceSession=(autoStart=false)=>{
  voiceSessionOpen=true;$("voiceOverlay").classList.add("show");
  $("voiceTranscript").textContent="";$("voiceResponse").textContent="آماده‌ام.";
  const support=getVoiceSupport();
  $("voiceSupport").textContent=support.recognition?"ورودی صوتی آماده":"ورودی صوتی وب روی این دستگاه در دسترس نیست؛ از Action Button/Dictation استفاده کن";
  $("voiceAutoContinue").checked=getAutoContinue();
  renderVoiceStatus("idle");
  if(autoStart)setTimeout(()=>startVoiceCapture(),280);
}
window.closeVoiceSession=()=>{
  voiceSessionOpen=false;stopListening();$("voiceOverlay").classList.remove("show");
}
window.startVoiceCapture=()=>{
  if(isListening()){stopListening();renderVoiceStatus("idle");return}
  const ok=startListening();
  if(!ok)toast("Speech Recognition در این Web App در دسترس نیست؛ مسیر Action Button را استفاده کن");
}
window.toggleVoiceConversation=el=>{
  setAutoContinue(!!el.checked);
  toast(el.checked?"حالت مکالمه روشن شد":"حالت مکالمه خاموش شد")
}
window.renderVoiceStatus=s=>{
  const orb=$("voiceOrb"),lab=$("voiceStatus");if(!orb||!lab)return;
  orb.classList.remove("listening","processing","speaking","applying","done");
  const labels={idle:"برای صحبت لمس کن",listening:"دارم گوش می‌دم…",hearing:"صدات رو گرفتم…",processing:"دارم می‌فهمم…",
    speaking:"NOVA در حال پاسخ…",applying:"در حال اجرا…",done:"انجام شد",unsupported:"ورودی صوتی پشتیبانی نمی‌شه",
    permission:"اجازه میکروفن داده نشده",error:"خطای ورودی صوتی"};
  if(["listening","hearing"].includes(s))orb.classList.add("listening");
  else if(["processing"].includes(s))orb.classList.add("processing");
  else if(s==="speaking")orb.classList.add("speaking");
  else if(s==="applying")orb.classList.add("applying");
  else if(s==="done")orb.classList.add("done");
  lab.textContent=labels[s]||labels.idle;
}
window.runBridgeFallback=()=>{
  const u=$("bridgeFallback").dataset.url;if(u)window.location.href=u;
}
window.openDeviceBridgeSetup=()=>{window.location.href="./setup-v07.html"}
window.markBridgeReady=()=>{
  setBridgeReady(true);renderBridgeSetupState();toast("Device Bridge به‌عنوان آماده ثبت شد")
}
window.markBridgeNotReady=()=>{
  setBridgeReady(false);renderBridgeSetupState();toast("Device Bridge غیرفعال شد")
}
function renderBridgeSetupState(){
  const ready=bridgeIsMarkedReady();
  const s=$("bridgeState");
  if(s){
    s.textContent=ready?"آماده و متصل":"نیاز به راه‌اندازی یک‌باره";
    s.classList.toggle("ready",ready);
  }
  const alert=$("homeBridgeAlert");
  if(alert)alert.style.display=ready?"none":"flex";
}

async function processActionMode(){
  const url=new URL(location.href),mode=url.searchParams.get("mode"),cmd=url.searchParams.get("cmd");
  if(mode==="voice"){
    switchPage("home");openVoiceSession(true);return;
  }
  if(mode==="action"&&cmd){
    switchPage("home");openVoiceSession(false);
    $("voiceTranscript").textContent=cmd;
    await handleVoiceCommand(cmd,{fromAction:true});
    return;
  }
  if(mode==="return"){
    toast("اجرای iPhone تکمیل شد");
  }
}

init();
setTimeout(()=>{renderBridgeSetupState();processActionMode()},400);

if("serviceWorker" in navigator){navigator.serviceWorker.register("./sw.js").catch(console.error)}


/* ===== iOS UI selection hard-stop ===== */
(function(){
  const editable = el => !!el && !!el.closest?.('input,textarea,[contenteditable="true"],.allow-select');

  document.addEventListener('selectstart', e => {
    if(!editable(e.target)) e.preventDefault();
  }, {capture:true});

  document.addEventListener('contextmenu', e => {
    if(!editable(e.target)) e.preventDefault();
  }, {capture:true});

  document.addEventListener('dragstart', e => {
    if(!editable(e.target)) e.preventDefault();
  }, {capture:true});

  document.addEventListener('selectionchange', () => {
    const active = document.activeElement;
    if(editable(active)) return;
    const sel = window.getSelection?.();
    if(sel && sel.rangeCount && !sel.isCollapsed){
      try{ sel.removeAllRanges(); }catch(_){}
    }
  });

  // iOS can create a selection just after a long touch; clear it again after touch end.
  document.addEventListener('touchend', e => {
    if(editable(e.target)) return;
    setTimeout(() => {
      const sel = window.getSelection?.();
      if(sel && !sel.isCollapsed){
        try{ sel.removeAllRanges(); }catch(_){}
      }
    }, 0);
  }, {passive:true,capture:true});
})();

