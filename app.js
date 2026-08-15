
import {openDB,all,get,put,remove} from "./db.js";
import {pFull,pMonthTitle,pDayNum,pParts,pKey,monthCells,addDays,parseFaDigits,parseNaturalEvent,startOfWeek} from "./planner.js";

const $=id=>document.getElementById(id);
const fa=n=>new Intl.NumberFormat("fa-IR",{maximumFractionDigits:1}).format(Number(n)||0);
const toman=n=>{
  n=Number(n)||0;
  if(Math.abs(n)>=1_000_000_000)return `${fa(n/1_000_000_000)} میلیارد`;
  if(Math.abs(n)>=1_000_000)return `${fa(n/1_000_000)} میلیون`;
  if(Math.abs(n)>=1_000)return `${fa(n/1_000)} هزار`;
  return `${fa(n)} تومان`
};
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const norm=s=>parseFaDigits(String(s||"")).replace(/ي/g,"ی").replace(/ك/g,"ک").replace(/[٬,]/g,"").replace(/\s+/g," ").trim().toLowerCase();
const now=()=>Date.now();
const monthKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
const isSameDay=(a,b)=>a.toDateString()===b.toDateString();
const empty=t=>`<div class="empty">${t}</div>`;

const ACCOUNT_META={
  current:{name:"جاری",icon:"◉",desc:"خرج روزمره",cls:"current"},
  obligations:{name:"تعهدات",icon:"✓",desc:"اقساط و هزینه ثابت",cls:"obligations"},
  safe:{name:"ذخیره امن",icon:"⌂",desc:"هدف اولیه ۳۰M",cls:"safe"},
  growth:{name:"اهداف و رشد",icon:"↗",desc:"ماشین، تجهیزات و رشد",cls:"growth"}
};
const SOURCE_META={
  hirsa:{name:"هیرسا",color:"#f4bf62"},
  hoorsun:{name:"هورسان",color:"#42e6a4"},
  snapp:{name:"اسنپ",color:"#39d7e8"},
  freelance:{name:"فریلنس",color:"#8c9fff"},
  other:{name:"سایر",color:"#9baaa7"}
};
const EXPENSE_CATS=[
  ["cigarette","سیگار","🚬",4_200_000],
  ["kimia","کیمیا / رستوران","♥",15_000_000],
  ["fuel","بنزین","⛽",1_000_000],
  ["car","خودرو","🚗",3_000_000],
  ["home","خانه","⌂",3_000_000],
  ["internet","اینترنت و اشتراک","⌁",3_000_000],
  ["installments","اقساط","▣",4_500_000],
  ["fun","تفریح","◌",2_000_000],
  ["personal","خرید شخصی","◈",2_000_000],
  ["other","سایر","＋",1_000_000],
];
let state={tasks:[],events:[],projects:[],projectTasks:[],transactions:[],accounts:[],reels:[],budgets:[],allocations:[],goals:[]};
let planner={anchor:new Date(),selected:new Date()};
let amountCategory=null,editingAccount=null,pendingAllocation=null,lastUndo=null,prefillIncomeSource=null;

async function init(){
  await openDB();await seed();await load();
  $("todayLabel").textContent=pFull(new Date());
  renderAll();wireMode();
  $("dbStatus").textContent="MIA v0.8 آماده است";
}
async function seed(){
  for(const [id,m] of Object.entries(ACCOUNT_META)){
    const x=await get("accounts",id);if(!x)await put("accounts",{id,balance:0,bankName:"",...m})
  }
  for(const [id,name,icon,limit] of EXPENSE_CATS){
    const x=await get("budgets",id);if(!x)await put("budgets",{id,name,icon,monthlyLimit:limit})
  }
  const defaultGoals=[
    {id:"safe30",name:"ذخیره امن",target:30_000_000,accountId:"safe"},
    {id:"carUpgrade",name:"ارتقای خودرو",target:450_000_000,accountId:"growth"},
  ];
  for(const g of defaultGoals){const x=await get("financialGoals",g.id);if(!x)await put("financialGoals",g)}
  const s=await get("settings","profile");if(!s)await put("settings",{key:"profile",userName:"ایمان",hoorsunTarget:12,weeklyReelTarget:3,hoorsunCyclePay:25_000_000,hirsaSalary:25_000_000,safeTarget:30_000_000,payday:29})
}
async function load(){
  const names=["tasks","events","projects","projectTasks","transactions","accounts","reels","budgets","incomeAllocations","financialGoals"];
  const vals=await Promise.all(names.map(all));
  [state.tasks,state.events,state.projects,state.projectTasks,state.transactions,state.accounts,state.reels,state.budgets,state.allocations,state.goals]=vals;
}
function account(id){return state.accounts.find(a=>a.id===id)||{id,balance:0,...ACCOUNT_META[id]}}
function monthTx(type){const mk=monthKey(new Date());return state.transactions.filter(t=>t.type===type&&monthKey(new Date(t.at))===mk)}
function sum(arr,fn=x=>x){return arr.reduce((s,x)=>s+(Number(fn(x))||0),0)}
function expenseSpent(cat){return sum(monthTx("expense").filter(t=>t.category===cat),x=>x.amount)}
function sourceIncome(src){return sum(monthTx("income").filter(t=>t.source===src),x=>x.amount)}
function currentCycleReels(){return state.reels.filter(r=>!r.archived).sort((a,b)=>a.at-b.at)}
function weekReels(){
  const s=startOfWeek(new Date()),e=addDays(s,7);
  return currentCycleReels().filter(r=>new Date(r.at)>=s&&new Date(r.at)<e)
}
function daysToNextPay(){
  const d=new Date(),pay=29,x=new Date(d.getFullYear(),d.getMonth(),pay,12);
  if(d>x)x.setMonth(x.getMonth()+1);
  return Math.max(1,Math.ceil((x-d)/86400000))
}
function renderAll(){renderHome();renderFinance();renderWork();renderPlanner();renderTasks();renderProjects()}
function renderHome(){
  const curr=account("current").balance;
  $("homeSpendable").textContent=toman(curr)+" تومان";
  const days=daysToNextPay(),daily=curr/days;
  $("homeCashMeta").textContent=`${fa(days)} روز تا حقوق بعدی · بودجه روزانه تقریبی ${toman(daily)}`;
  $("cashHealthBar").style.width=Math.min(100,Math.max(8,curr/15_000_000*100))+"%";
  const reels=currentCycleReels(),wr=weekReels();
  $("homeReels").textContent=`${fa(reels.length)} / ۱۲`;
  $("homeReelWeek").textContent=`این هفته ${fa(wr.length)} / ۳`;
  const ev=state.events.filter(e=>new Date(e.startISO)>new Date()).sort((a,b)=>new Date(a.startISO)-new Date(b.startISO))[0];
  if(ev){const d=new Date(ev.startISO);$("homeNextTime").textContent=new Intl.DateTimeFormat("fa-IR",{hour:"2-digit",minute:"2-digit"}).format(d);$("homeNextTitle").textContent=ev.title}
  else{$("homeNextTime").textContent="—";$("homeNextTitle").textContent="برنامه‌ای ثبت نشده"}
  $("homeAccounts").innerHTML=["current","obligations","safe","growth"].map(id=>`<button class="account-mini" onclick="openAccount('${id}')"><b>${ACCOUNT_META[id].name}</b><span>${toman(account(id).balance)}</span></button>`).join("");
  const open=state.tasks.filter(t=>!t.done);
  $("homeTasks").innerHTML=open.length?open.slice(0,3).map(taskRow).join(""):empty("کار بازی نداری.");
  let insight="امروز وضعیتت تحت کنترله.";
  const needWeek=Math.max(0,3-wr.length);
  if(needWeek>0)insight=`برای هدف هورسان، این هفته ${fa(needWeek)} ریلز دیگه تکمیل کن.`;
  else if(curr>0&&daily<500_000)insight="بودجه روزانه‌ات فشرده شده؛ خرج‌های اختیاری رو سبک‌تر نگه دار.";
  else if(state.tasks.filter(t=>!t.done).length)insight=`اول «${state.tasks.find(t=>!t.done).title}» رو جمع کن.`;
  $("miaInsight").textContent=insight;
}
function renderFinance(){
  const curr=account("current").balance;$("financeSpendable").textContent=toman(curr)+" تومان";
  $("daysToPay").textContent=`حدود ${fa(daysToNextPay())} روز تا حقوق بعدی هیرسا`;
  $("financeAccounts").innerHTML=["current","obligations","safe","growth"].map(id=>{
    const a=account(id),m=ACCOUNT_META[id];
    return `<button class="money-card ${m.cls}" onclick="openAccount('${id}')"><div class="money-icon">${m.icon}</div><b>${m.name}</b><strong>${toman(a.balance)}</strong><small>${a.bankName||m.desc}</small></button>`
  }).join("");
  renderIncomeBreakdown();renderLastAllocation();renderGoals();renderExpenses();renderIncome();renderBudgets();
}
function renderIncomeBreakdown(){
  const sources=["hirsa","hoorsun","snapp","freelance","other"],vals=sources.map(s=>sourceIncome(s)),total=sum(vals);
  $("incomeMonthTotal").textContent=toman(total);
  $("incomeDonutText").textContent=total?toman(total):"۰";
  let angle=0,parts=[];
  const legend=sources.filter((s,i)=>vals[i]>0).map((s,i)=>{
    const realIndex=sources.indexOf(s),v=vals[realIndex],pct=total?Math.round(v/total*100):0,c=SOURCE_META[s].color;
    const start=angle;angle+=pct*3.6;parts.push(`${c} ${start}deg ${angle}deg`);
    return `<div class="legend-row"><i style="background:${c}"></i><span>${SOURCE_META[s].name}</span><small>${fa(pct)}٪ · ${toman(v)}</small></div>`
  }).join("");
  $("incomeLegend").innerHTML=legend||`<div class="empty">هنوز درآمدی ثبت نشده.</div>`;
  $("incomeDonut").style.background=parts.length?`conic-gradient(${parts.join(",")})`:"rgba(255,255,255,.05)";
}
function renderLastAllocation(){
  const a=[...state.allocations].sort((x,y)=>y.at-x.at)[0];
  if(!a){$("lastAllocation").innerHTML=empty("بعد از ثبت اولین درآمد، MIA تقسیم پیشنهادی می‌دهد.");return}
  $("lastAllocation").innerHTML=["current","obligations","safe","growth"].map(id=>{
    const x=a.parts[id];return `<div class="allocation-item"><div><b>${ACCOUNT_META[id].name}</b><small>${fa(x.percent)}٪ از ${SOURCE_META[a.source]?.name||"درآمد"}</small></div><span>${toman(x.amount)}</span></div>`
  }).join("");
}
function renderGoals(){
  $("goalsList").innerHTML=state.goals.map(g=>{
    const bal=account(g.accountId).balance,pct=Math.min(100,Math.round(bal/g.target*100));
    return `<div class="goal-card"><div class="goal-top"><b>${esc(g.name)}</b><span>${fa(pct)}٪</span></div><small>${toman(bal)} از ${toman(g.target)}</small><div class="bar"><i style="width:${pct}%"></i></div></div>`
  }).join("")
}
function renderExpenses(){
  $("expenseQuickGrid").innerHTML=EXPENSE_CATS.slice(0,9).map(([id,name,icon])=>`<button class="expense-cat" onclick="openAmount('${id}')"><i>${icon}</i><span>${name}</span></button>`).join("");
  const tx=monthTx("expense").sort((a,b)=>b.at-a.at);
  $("expenseList").innerHTML=tx.length?tx.slice(0,30).map(txRow).join(""):empty("هنوز هزینه‌ای ثبت نشده.")
}
function renderIncome(){
  $("incomeSourceCards").innerHTML=["hirsa","hoorsun","snapp","freelance"].map(s=>`<button class="source-card" onclick="openQuick('income','${s}')"><b>${SOURCE_META[s].name}</b><strong>${toman(sourceIncome(s))}</strong><small>دریافت‌شده این ماه</small></button>`).join("");
  const tx=monthTx("income").sort((a,b)=>b.at-a.at);
  $("incomeList").innerHTML=tx.length?tx.slice(0,30).map(txRow).join(""):empty("هنوز درآمدی ثبت نشده.")
}
function renderBudgets(){
  $("budgetList").innerHTML=state.budgets.map(b=>{
    const spent=expenseSpent(b.id),pct=Math.min(100,Math.round(spent/b.monthlyLimit*100));
    return `<div class="budget-card"><div class="budget-top"><b>${esc(b.name)}</b><span>${toman(spent)} / ${toman(b.monthlyLimit)}</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>`
  }).join("")
}
function txRow(t){
  const name=t.type==="income"?(SOURCE_META[t.source]?.name||"درآمد"):(state.budgets.find(b=>b.id===t.category)?.name||"هزینه");
  return `<div class="tx-row"><div class="tx-icon">${t.type==="income"?"↑":"↓"}</div><div><b>${esc(t.note||name)}</b><small>${name} · ${pFull(new Date(t.at))}</small></div><span class="tx-amount ${t.type}">${t.type==="income"?"+":"−"}${toman(t.amount)}</span></div>`
}
function renderWork(){
  const reels=currentCycleReels(),wr=weekReels(),pct=Math.min(100,reels.length/12*100),value=reels.length*(25_000_000/12);
  $("reelRing").style.background=`conic-gradient(var(--green) 0 ${pct}%,rgba(255,255,255,.06) ${pct}% 100%)`;
  $("reelRingText").textContent=`${fa(reels.length)}/۱۲`;
  $("reelValue").textContent=`${toman(value)} ارزش ایجادشده`;
  $("weekReels").textContent=`${fa(wr.length)} / ۳`;
  $("cycleRemain").textContent=fa(Math.max(0,12-reels.length));
  const need=Math.max(0,3-wr.length);
  $("reelPlanText").textContent=need?`برای هدف هفتگی ${fa(need)} ریلز دیگر لازم است.`:"هدف این هفته تکمیل شده ✓";
  $("reelsList").innerHTML=reels.length?reels.slice().reverse().map((r,i)=>`<div class="list-row"><div>${fa(reels.length-i)}</div><div><b>ریلز هورسان</b><small>${pFull(new Date(r.at))}</small></div><span>تحویل ✓</span></div>`).join(""):empty("اولین ریلز این چرخه را ثبت کن.");
  const sn=monthTx("income").filter(t=>t.source==="snapp");$("snappMonth").innerHTML=`<div class="allocation-item"><div><b>درآمد ثبت‌شده</b><small>${fa(sn.length)} ثبت</small></div><span>${toman(sum(sn,x=>x.amount))}</span></div>`;
}
function renderProjects(){
  $("projectsList").innerHTML=state.projects.length?state.projects.slice().reverse().map(p=>`<div class="project-card"><b>${esc(p.title)}</b><small>${p.value?toman(p.value):"بدون مبلغ"} · ${p.status||"فعال"}</small></div>`).join(""):empty("پروژه فریلنس فعالی نداری.")
}
function renderPlanner(){
  $("monthTitle").textContent=pMonthTitle(planner.anchor);$("selectedDate").textContent=pFull(planner.selected);
  const {cells}=monthCells(planner.anchor),ap=pParts(planner.anchor),today=new Date();
  $("monthGrid").innerHTML=cells.map(d=>{
    const pp=pParts(d),inside=pp.month===ap.month&&pp.year===ap.year,has=eventsFor(d).length>0;
    return `<button class="day-cell ${inside?"":"muted"} ${isSameDay(d,today)?"today":""} ${isSameDay(d,planner.selected)?"selected":""}" onclick="selectDate('${d.toISOString()}')">${pDayNum(d)}${has?'<i class="day-dot"></i>':""}</button>`
  }).join("");
  const ev=eventsFor(planner.selected);$("dayEvents").innerHTML=ev.length?ev.map(eventRow).join(""):empty("برای این روز برنامه‌ای ثبت نشده.")
}
function eventsFor(d){return state.events.filter(e=>isSameDay(new Date(e.startISO),d)).sort((a,b)=>new Date(a.startISO)-new Date(b.startISO))}
function eventRow(e){const d=new Date(e.startISO);return `<div class="event-row"><div class="event-time">${new Intl.DateTimeFormat("fa-IR",{hour:"2-digit",minute:"2-digit"}).format(d)}</div><div><b>${esc(e.title)}</b><small>${fa(e.durationMin||60)} دقیقه</small></div><span></span></div>`}
function renderTasks(){
  const open=state.tasks.filter(t=>!t.done),done=state.tasks.filter(t=>t.done);
  $("taskList").innerHTML=open.length?open.map(taskRow).join(""):empty("کار بازی نداری.");
  $("doneList").innerHTML=done.length?done.slice().reverse().map(doneRow).join(""):empty("هنوز کاری انجام نشده.")
}
function taskRow(t){return `<div class="list-row"><button class="check-btn" onclick="toggleTask(${JSON.stringify(t.id)})">✓</button><div><b>${esc(t.title)}</b><small>${t.time||"امروز"}</small></div><span></span></div>`}
function doneRow(t){return `<div class="list-row"><div class="check-btn">✓</div><div><b>${esc(t.title)}</b><small>انجام‌شده</small></div><button class="check-btn" onclick="reopenTask(${JSON.stringify(t.id)})">↶</button></div>`}

window.switchPage=id=>{
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));$(id)?.classList.add("active");
  document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.page===id));
  window.scrollTo({top:0,behavior:"smooth"});if(id==="finance")renderFinance();if(id==="work")renderWork();if(id==="planner")renderPlanner()
};
window.openFinanceTab=id=>{
  document.querySelectorAll(".finance-pane").forEach(x=>x.classList.remove("active"));$("finance-"+id).classList.add("active");
  document.querySelectorAll("#financeTabs button").forEach(b=>b.classList.toggle("active",b.dataset.ftab===id))
};
window.openWorkTab=id=>{
  document.querySelectorAll(".work-pane").forEach(x=>x.classList.remove("active"));$("work-"+id).classList.add("active");
  document.querySelectorAll(".work-tabs button").forEach(b=>b.classList.toggle("active",b.dataset.wtab===id))
};
window.openPlannerTab=id=>{
  document.querySelectorAll(".planner-pane").forEach(x=>x.classList.remove("active"));$("planner-"+id).classList.add("active");
  document.querySelectorAll(".planner-main-tabs button").forEach(b=>b.classList.toggle("active",b.dataset.ptab===id))
};
window.selectDate=iso=>{planner.selected=new Date(iso);planner.anchor=new Date(iso);renderPlanner()};
window.shiftMonth=dir=>{const {start,end}=monthCells(planner.anchor);planner.anchor=dir>0?addDays(end,1):addDays(start,-1);planner.selected=planner.anchor;renderPlanner()};

function openSheet(id){$(id).classList.add("show")}
window.closeSheet=id=>$(id).classList.remove("show");
window.closeOverlay=(e,id)=>{if(e.target.id===id)closeSheet(id)};
window.openSettings=()=>openSheet("settingsSheet");

window.openQuick=(kind="",source="")=>{
  prefillIncomeSource=source||null;$("quickInput").value="";
  if(kind==="income")$("quickInput").placeholder=`مثلاً: ۲۵ میلیون حقوق ${SOURCE_META[source]?.name||"هورسان"} اومد`;
  else if(kind==="expense")$("quickInput").placeholder="مثلاً: ۱۴۰ سیگار";
  else $("quickInput").placeholder="مثلاً: ۱.۵ شام با کیمیا\nیا: امروز یه ریلز هورسان زدم";
  openSheet("quickSheet");setTimeout(()=>$("quickInput").focus(),180)
};
window.prefillQuick=t=>{$("quickInput").value=t;$("quickInput").focus()};
function parseAmount(text,context="expense"){
  const q=norm(text),m=q.match(/(\d+(?:\.\d+)?)/);if(!m)return 0;const v=+m[1];
  if(/میلیون/.test(q))return Math.round(v*1_000_000);
  if(/هزار/.test(q))return Math.round(v*1_000);
  if(v<100)return Math.round(v*1_000_000);
  if(v<1000)return Math.round(v*1_000);
  return Math.round(v)
}
function categoryFrom(q){
  q=norm(q);
  if(/سیگار|وینستون|مارلبرو|کنت/.test(q))return"cigarette";
  if(/کیمیا|رستوران|شام|ناهار|کافه|قرار/.test(q))return"kimia";
  if(/بنزین|سوخت/.test(q))return"fuel";
  if(/ماشین|خودرو|روغن|تعمیر|لاستیک/.test(q))return"car";
  if(/خانه|خونه|شارژ ساختمان|خانواده/.test(q))return"home";
  if(/اینترنت|اشتراک|پریمیر|ادوبی|نرم افزار/.test(q))return"internet";
  if(/قسط|وام|قرعه/.test(q))return"installments";
  if(/تفریح|سینما|بازی/.test(q))return"fun";
  if(/لباس|خرید شخصی/.test(q))return"personal";
  return"other"
}
function sourceFrom(q){
  q=norm(q);if(q.includes("هورسان"))return"hoorsun";if(q.includes("هیرسا"))return"hirsa";if(q.includes("اسنپ"))return"snapp";if(/فریلنس|سایت|مشتری/.test(q))return"freelance";return prefillIncomeSource||"other"
}
window.submitQuick=async()=>{
  const raw=$("quickInput").value.trim();if(!raw)return toast("یه چیزی بنویس تا ثبتش کنم.");
  const q=norm(raw);
  if(q.includes("هورسان")&&/ریلز|ویدیو/.test(q)&&/زدم|تحویل|ساختم|تموم|تمام|تکمیل/.test(q)){await addReel(raw);closeSheet("quickSheet");return}
  if(/حقوق|درآمد|واریز|اومد|آمد/.test(q)){
    const amount=parseAmount(q,"income");if(amount){await addIncome(amount,sourceFrom(q),raw);closeSheet("quickSheet");return}
  }
  if(/از\s+(جاری|تعهدات|ذخیره|اهداف)/.test(q)&&/به\s+(جاری|تعهدات|ذخیره|اهداف)/.test(q)){
    const amount=parseAmount(q);if(amount){await quickTransfer(q,amount);closeSheet("quickSheet");return}
  }
  const amount=parseAmount(q,"expense");
  if(amount&&(/\d/.test(q))){await addExpense(amount,categoryFrom(q),raw);closeSheet("quickSheet");return}
  const ev=parseNaturalEvent(raw);
  if(ev){await put("events",{id:now(),...ev,createdAt:now()});await load();renderAll();closeSheet("quickSheet");toast("برنامه ثبت شد ✓");return}
  if(/ایده|بعدا|بعداً|پارکینگ/.test(q)){await put("parking",{id:now(),text:raw,createdAt:now()});closeSheet("quickSheet");toast("در پارکینگ ذخیره شد.");return}
  await put("tasks",{id:now(),title:raw,time:"امروز",done:false,createdAt:now()});await load();renderAll();closeSheet("quickSheet");toast("به کارها اضافه شد ✓")
};
window.openAmount=cat=>{amountCategory=cat;$("amountCategoryTitle").textContent=state.budgets.find(b=>b.id===cat)?.name||"هزینه";$("amountInput").value="";openSheet("amountSheet");setTimeout(()=>$("amountInput").focus(),150)};
window.saveQuickExpense=async()=>{const v=parseAmount($("amountInput").value);if(!v)return toast("مبلغ رو وارد کن.");await addExpense(v,amountCategory,state.budgets.find(b=>b.id===amountCategory)?.name||"هزینه");closeSheet("amountSheet")};
async function addExpense(amount,category,note){
  const id=now();const before=account("current").balance;
  await put("transactions",{id,type:"expense",amount,category,note,accountId:"current",at:now()});
  await put("accounts",{...account("current"),balance:Math.max(0,before-amount)});
  lastUndo={kind:"expense",id,amount,before};await load();renderAll();
  const b=state.budgets.find(x=>x.id===category),spent=expenseSpent(category),remain=b?Math.max(0,b.monthlyLimit-spent):0;
  toast(`${toman(amount)} → ${b?.name||"هزینه"} ثبت شد · باقی بودجه ${toman(remain)}`,"برگرداندن",undoLast)
}
async function addIncome(amount,source,note){
  const id=now();await put("transactions",{id,type:"income",amount,source,note,accountId:"current",at:now()});
  await put("accounts",{...account("current"),balance:account("current").balance+amount});
  const parts=buildAllocation(amount);
  const alloc={id:now()+1,at:now(),incomeTxId:id,source,amount,parts,confirmed:false};await put("incomeAllocations",alloc);
  pendingAllocation=alloc;await load();renderAll();showAllocation(alloc)
}
function buildAllocation(amount){
  const safeLow=account("safe").balance<30_000_000;
  const p=safeLow?{current:40,obligations:20,safe:30,growth:10}:{current:45,obligations:20,safe:15,growth:20};
  return Object.fromEntries(Object.entries(p).map(([id,percent])=>[id,{percent,amount:Math.round(amount*percent/100)}]))
}
function showAllocation(a){
  $("allocationTitle").textContent=`پیشنهاد تقسیم ${toman(a.amount)} ${SOURCE_META[a.source]?.name||""}`;
  $("allocationRows").innerHTML=["current","obligations","safe","growth"].map(id=>`<div class="allocation-item"><div><b>${ACCOUNT_META[id].name}</b><small>${fa(a.parts[id].percent)}٪</small></div><span>${toman(a.parts[id].amount)}</span></div>`).join("");
  openSheet("allocationSheet")
}
window.confirmAllocation=async()=>{
  const a=pendingAllocation||[...state.allocations].sort((x,y)=>y.at-x.at).find(x=>!x.confirmed);if(!a)return closeSheet("allocationSheet");
  // Income was initially deposited in current. Move suggested parts except current.
  const cur=account("current"),move=a.parts.obligations.amount+a.parts.safe.amount+a.parts.growth.amount;
  await put("accounts",{...cur,balance:Math.max(0,cur.balance-move)});
  for(const id of ["obligations","safe","growth"])await put("accounts",{...account(id),balance:account(id).balance+a.parts[id].amount});
  await put("incomeAllocations",{...a,confirmed:true,confirmedAt:now()});pendingAllocation=null;await load();renderAll();closeSheet("allocationSheet");toast("چهار حساب MIA با انتقال‌های بانکی هماهنگ شد ✓")
};
async function addReel(note){
  const reels=currentCycleReels();if(reels.length>=12)return toast("چرخه ۱۲ ریلزی کامل شده؛ از تنظیمات چرخه جدید رو شروع کن.");
  await put("reels",{id:now(),at:now(),status:"delivered",note,archived:false});await load();renderAll();
  const n=currentCycleReels().length,remain=12-n,wr=weekReels().length,need=Math.max(0,3-wr);
  toast(`ریلز ${fa(n)} از ۱۲ ثبت شد · ${fa(remain)} تا پایان چرخه · ${fa(need)} تا هدف این هفته`)
}
window.completeReel=()=>addReel("ثبت دستی از صفحه هورسان");
async function quickTransfer(q,amount){
  const map={"جاری":"current","تعهدات":"obligations","ذخیره":"safe","اهداف":"growth"};
  const fromName=Object.keys(map).find(x=>new RegExp(`از\\s+${x}`).test(q)),toName=Object.keys(map).find(x=>new RegExp(`به\\s+${x}`).test(q));
  if(!fromName||!toName)return toast("مبدأ یا مقصد انتقال مشخص نیست.");
  const from=map[fromName],to=map[toName];await put("accounts",{...account(from),balance:Math.max(0,account(from).balance-amount)});await put("accounts",{...account(to),balance:account(to).balance+amount});
  await put("transactions",{id:now(),type:"transfer",amount,from,to,note:`${fromName} → ${toName}`,at:now()});await load();renderAll();toast(`${toman(amount)} از ${fromName} به ${toName} منتقل شد`)
}
window.openAccount=id=>{editingAccount=id;$("accountSheetTitle").textContent=ACCOUNT_META[id].name;$("accountBalanceInput").value=(account(id).balance/1_000_000)||"";openSheet("accountSheet");setTimeout(()=>$("accountBalanceInput").focus(),120)};
window.saveAccountBalance=async()=>{const raw=$("accountBalanceInput").value.trim();if(!raw)return;const amount=parseAmount(raw);await put("accounts",{...account(editingAccount),balance:amount});await load();renderAll();closeSheet("accountSheet");toast("موجودی بانک به‌روزرسانی شد ✓")};

window.openEventSheet=()=>{$("eventDateText").textContent=pFull(planner.selected);$("eventTitle").value="";openSheet("eventSheet");setTimeout(()=>$("eventTitle").focus(),120)};
window.saveEvent=async()=>{const title=$("eventTitle").value.trim();if(!title)return toast("عنوان رو وارد کن.");const [h,m]=($("eventTime").value||"10:00").split(":").map(Number),d=new Date(planner.selected);d.setHours(h,m,0,0);await put("events",{id:now(),title,startISO:d.toISOString(),durationMin:+$("eventDuration").value||60,alertBeforeMin:60,type:"event",createdAt:now()});await load();planner.selected=d;planner.anchor=d;renderAll();closeSheet("eventSheet");toast("در برنامه ثبت شد ✓")};
window.openTaskSheet=()=>{$("taskTitle").value="";openSheet("taskSheet");setTimeout(()=>$("taskTitle").focus(),120)};
window.saveTask=async()=>{const title=$("taskTitle").value.trim();if(!title)return;await put("tasks",{id:now(),title,time:"امروز",done:false,createdAt:now()});await load();renderAll();closeSheet("taskSheet");toast("کار اضافه شد ✓")};
window.toggleTask=async id=>{const t=state.tasks.find(x=>x.id===id);if(!t)return;await put("tasks",{...t,done:true,doneAt:now()});await load();renderAll();toast("انجام شد ✓")};
window.reopenTask=async id=>{const t=state.tasks.find(x=>x.id===id);if(!t)return;await put("tasks",{...t,done:false});await load();renderAll();toast("کار دوباره باز شد")};
window.openProjectSheet=()=>{$("projectTitle").value="";$("projectValue").value="";openSheet("projectSheet")};
window.saveProject=async()=>{const title=$("projectTitle").value.trim();if(!title)return toast("نام پروژه رو وارد کن.");const value=parseAmount($("projectValue").value,"income");await put("projects",{id:now(),title,value,status:"فعال",createdAt:now()});await load();renderAll();closeSheet("projectSheet");toast("پروژه فریلنس ساخته شد ✓")};
window.resetHoorsunCycle=async()=>{if(!confirm("چرخه فعلی هورسان آرشیو و چرخه جدید شروع شود؟"))return;for(const r of currentCycleReels())await put("reels",{...r,archived:true,archivedAt:now()});await load();renderAll();closeSheet("settingsSheet");toast("چرخه جدید هورسان شروع شد")};
window.exportData=async()=>{
  const data={exportedAt:new Date().toISOString(),version:"MIA 0.8",...state};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`MIA-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
};
async function undoLast(){
  if(!lastUndo)return;const u=lastUndo;lastUndo=null;
  if(u.kind==="expense"){await remove("transactions",u.id);await put("accounts",{...account("current"),balance:u.before});await load();renderAll();toast("هزینه برگردانده شد")}
}
function toast(text,actionText="",action=null){
  $("toastText").textContent=text;const b=$("toastAction");b.textContent=actionText;b.style.display=actionText?"block":"none";b.onclick=()=>{if(action)action();$("toast").classList.remove("show")};
  $("toast").classList.add("show");clearTimeout(toast._t);toast._t=setTimeout(()=>$("toast").classList.remove("show"),4200)
}
function wireMode(){
  const p=new URLSearchParams(location.search);
  if(p.get("mode")==="quick")setTimeout(()=>openQuick(),350);
}
init().catch(e=>{console.error(e);$("dbStatus").textContent="خطای راه‌اندازی";alert("MIA درست راه‌اندازی نشد. صفحه را دوباره باز کن.")});
