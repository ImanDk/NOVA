
const STORE_KEY="nova_v05";
const defaults={tasks:[{id:1,title:"پروپوزال پروژه NOVA",time:"10:00",done:false},{id:2,title:"ورزش صبحگاهی",time:"07:30",done:true},{id:3,title:"تماس با سارا",time:"12:30",done:false}],parking:[{id:1,text:"ایده برای اپلیکیشن جدید",age:"۲ ساعت پیش"},{id:2,text:"یادآوری خرید هدیه برای تولد",age:"دیروز"}],memory:[{id:1,title:"سبک تمرکز",text:"وقتی فقط یک کار مشخص جلویم باشد بهتر پیش می‌روم.",strength:3},{id:2,title:"نحوه تصمیم‌گیری",text:"برای انتخاب‌ها پیشنهاد مستقیم و کوتاه را ترجیح می‌دهم.",strength:2}],chat:[]};
let state=JSON.parse(localStorage.getItem(STORE_KEY)||"null")||structuredClone(defaults);
const $=id=>document.getElementById(id);
function save(){localStorage.setItem(STORE_KEY,JSON.stringify(state));render()}
function faNum(n){return new Intl.NumberFormat("fa-IR",{useGrouping:false}).format(n)}
function faDate(){return new Intl.DateTimeFormat("fa-IR",{weekday:"long",day:"numeric",month:"long"}).format(new Date())}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function icon(name){const x={
home:`<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></svg>`,
calendar:`<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>`,
check:`<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>`,
parking:`<svg viewBox="0 0 24 24"><path d="M5 19c4-1 6-4 6-8 0-3 2-5 5-5 2 0 3 1 3 3 0 3-3 5-7 5"/><circle cx="6" cy="19" r="2"/></svg>`,
memory:`<svg viewBox="0 0 24 24"><path d="M8 4h8a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>`,
chat:`<svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4Z"/></svg>`,
plus:`<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>`,
search:`<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>`,
bulb:`<svg viewBox="0 0 24 24"><path d="M9 18h6M10 22h4"/><path d="M8 14a7 7 0 1 1 8 0c-1 1-1 2-1 3H9c0-1 0-2-1-3Z"/></svg>`,
sliders:`<svg viewBox="0 0 24 24"><path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h8M16 18h4"/><circle cx="16" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="14" cy="18" r="2"/></svg>`};return x[name]||x.home}
function taskRow(t){return `<div class="task-row"><button class="task-check ${t.done?"done":""}" onclick="toggleTask(${t.id})">${icon("check")}</button><div class="task-copy"><b>${esc(t.title)}</b><small>${t.done?"انجام شده":"در انتظار انجام"}</small></div><div class="time-pill">${esc(t.time||"امروز")}</div></div>`}
function empty(s){return `<div style="color:var(--muted);font-size:12px;padding:18px;text-align:center">${esc(s)}</div>`}
function render(){
 $("dateText").textContent=faDate();
 const done=state.tasks.filter(t=>t.done).length,total=state.tasks.length,open=total-done;
 $("sumProgress").textContent=faNum(total?Math.round(done/total*100):0)+"٪";$("sumTasks").textContent=faNum(open);$("sumDone").textContent=faNum(done);
 $("homeTasks").innerHTML=state.tasks.slice(0,3).map(taskRow).join("")||empty("کاری ثبت نشده.");
 $("todayList").innerHTML=state.tasks.map(taskRow).join("")||empty("کاری ثبت نشده.");
 $("doneList").innerHTML=state.tasks.filter(t=>t.done).map(taskRow).join("")||empty("هنوز کاری انجام نشده.");
 $("parkingList").innerHTML=state.parking.map((p,i)=>`<div class="parking-row"><div class="parking-dot">${icon("bulb")}</div><div class="parking-copy"><b>${esc(p.text)}</b><small>${esc(p.age||"ثبت شده")}</small></div><button class="icon-btn" style="width:38px;height:38px" onclick="promoteParking(${i})">${icon("plus")}</button></div>`).join("")||empty("پارکینگ خالی است.");
 $("memoryList").innerHTML=state.memory.map(m=>`<div class="memory-card"><h4>${esc(m.title)}</h4><p>${esc(m.text)}</p><div class="memory-meta"><span>قدرت ${faNum(m.strength||1)}/۳</span><span>حافظه محلی</span></div></div>`).join("")||empty("حافظه‌ای ثبت نشده.");
 renderChat();
}
window.toggleTask=id=>{const t=state.tasks.find(x=>x.id===id);if(t){t.done=!t.done;save()}}
window.promoteParking=i=>{const p=state.parking.splice(i,1)[0];state.tasks.push({id:Date.now(),title:p.text,time:"امروز",done:false});save();switchPage("today")}
window.switchPage=id=>{document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));$(id).classList.add("active");document.querySelectorAll(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.page===id));window.scrollTo({top:0,behavior:"smooth"})}
window.openQuickAdd=()=>{$("quickadd").classList.add("show");setTimeout(()=>$("quickTitle").focus(),120)}
window.closeQuickAdd=e=>{if(!e||e.target.id==="quickadd")$("quickadd").classList.remove("show")}
window.addTaskFromSheet=()=>{const v=$("quickTitle").value.trim();if(!v)return;state.tasks.push({id:Date.now(),title:v,time:$("quickWhen").dataset.value||"امروز",done:false});$("quickTitle").value="";$("quickadd").classList.remove("show");save();toast("کار به برنامه اضافه شد")}
window.setWhen=(b,v)=>{$("quickWhen").dataset.value=v}
function normalize(s){return String(s||"").trim().replace(/ي/g,"ی").replace(/ك/g,"ک").replace(/\s+/g," ")}
function localTime(){return new Intl.DateTimeFormat("fa-IR",{hour:"2-digit",minute:"2-digit"}).format(new Date())}
function localDate(){return new Intl.DateTimeFormat("fa-IR",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date())}
function simpleRoute(q){q=normalize(q);if(q.includes("ساعت")&&q.includes("چند"))return `الان ساعت ${localTime()} است.`;if(q.includes("امروز")&&(q.includes("چندمه")||q.includes("چه روز")||q.includes("تاریخ")))return `امروز ${localDate()} است.`;if(q.includes("چه کار")&&q.includes("مونده")){const a=state.tasks.filter(t=>!t.done);return a.length?`الان ${faNum(a.length)} کار باز داری: ${a.slice(0,3).map(x=>x.title).join("، ")}`:"کار بازی باقی نمانده."}if(q.includes("چه کار")&&(q.includes("انجام")||q.includes("تموم"))){const a=state.tasks.filter(t=>t.done);return a.length?`${faNum(a.length)} کار انجام شده: ${a.slice(-3).map(x=>x.title).join("، ")}`:"هنوز کاری انجام‌شده ثبت نشده."}if(q.includes("یادم بنداز")||q.includes("یادآوری کن")){const t=q.replace("یادم بنداز","").replace("یادآوری کن","").trim();if(t){state.tasks.push({id:Date.now(),title:t,time:"یادآوری NOVA",done:false});save();return "به برنامه NOVA اضافه شد. اعلان سیستمی iOS را در فاز Device Bridge وصل می‌کنیم."}}if(q==="سلام"||q==="سلام نوا"||q==="سلام نووا")return "سلام، من اینجام. بگو الان چه کمکی می‌خوای.";return null}
function risk(q){const a=["پرداخت","کارت به کارت","انتقال وجه","بفرست","ارسال کن","ایمیل کن","پیام بده","منتشر کن","حذف دائمی","رمز","پسورد","کد ملی","اطلاعات بانکی","موقعیت دقیق"];return a.some(x=>q.includes(x))}
function identity(){return "من NOVA هستم؛ دستیار هوشمند شخصی تو. برای برنامه‌ریزی، تصمیم‌گیری، یادآوری، تمرکز و ثبت افکارت کنارت هستم."}
function isIdentity(q){return ["تو کی هستی","خودت رو معرفی","خودت را معرفی","نووا کیه","نوا کیه"].some(x=>q.includes(x))}
function renderChat(){$("messages").innerHTML=(state.chat.length?state.chat:[{role:"ai",text:"من NOVA هستم؛ دستیار هوشمند شخصی تو. بگو الان روی چی کار کنیم؟"}]).map(m=>`<div class="bubble ${m.role}">${esc(m.text)}</div>`).join("")}
function pushMsg(role,text){state.chat.push({role,text,at:Date.now()});state.chat=state.chat.slice(-30);save()}
window.askNOVA=()=>{const q=normalize($("askInput").value||$("chatInput").value);if(!q)return;$("askInput").value="";$("chatInput").value="";switchPage("chat");pushMsg("user",q);if(isIdentity(q)){pushMsg("ai",identity());return}const s=simpleRoute(q);if(s){pushMsg("ai",s);return}if(risk(q)){pushMsg("ai","این درخواست به یک اقدام یا دسترسی حساس مربوط می‌شود و قبل از اجرای واقعی باید تأییدت را بگیرم.");return}pushMsg("ai","این درخواست نیاز به تحلیل هوشمند دارد. موتور AI محلی در نسخه پایدار بعدی به این رابط متصل می‌شود.")}
window.showActionOverlay=()=>{$("actionOverlay").classList.add("show");setTimeout(()=>$("actionHint").textContent="آماده‌ام. فرمانت رو بگو.",700)}
window.closeActionOverlay=()=>{$("actionOverlay").classList.remove("show")}
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)}
document.addEventListener("DOMContentLoaded",()=>{document.querySelectorAll("[data-icon]").forEach(el=>el.innerHTML=icon(el.dataset.icon));render();if(new URLSearchParams(location.search).get("mode")==="action")setTimeout(showActionOverlay,250)})
