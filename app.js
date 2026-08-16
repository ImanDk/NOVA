
import {openDB,all,get,put,remove} from "./db.js";
import {pFull,pMonthTitle,pDayNum,pParts,pKey,monthCells,addDays,parseFaDigits,parseNaturalEvent,startOfWeek} from "./planner.js";

const $=id=>document.getElementById(id);
const fa=n=>new Intl.NumberFormat("fa-IR",{maximumFractionDigits:1}).format(Number(n)||0);
const toman=n=>{
  n=Number(n)||0;
  let value;
  if(Math.abs(n)>=1_000_000_000)value=`${fa(n/1_000_000_000)} میلیارد`;
  else if(Math.abs(n)>=1_000_000)value=`${fa(n/1_000_000)} میلیون`;
  else if(Math.abs(n)>=1_000)value=`${fa(n/1_000)} هزار`;
  else value=fa(n);
  return `${value} تومان`;
};
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const norm=s=>parseFaDigits(String(s||"")).replace(/ي/g,"ی").replace(/ك/g,"ک").replace(/[٬,]/g,"").replace(/\s+/g," ").trim().toLowerCase();
const now=()=>Date.now();
const monthKey=d=>{const p=pParts(d);return `${p.year}-${p.month}`};
const isSameDay=(a,b)=>a.toDateString()===b.toDateString();
const empty=t=>`<div class="empty">${t}</div>`;

const ICONS={
home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/>',
wallet:'<path d="M3 7h15a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H4a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h13v4"/><path d="M16 12h5v4h-5a2 2 0 1 1 0-4Z"/>',
briefcase:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/>',
calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
plus:'<path d="M12 5v14M5 12h14"/>',
bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
settings:'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.8-1L14.4 3h-4.8L9.2 6a8 8 0 0 0-1.8 1L5 6.1 3 9.5 5.1 11a7 7 0 0 0 0 2L3 14.5l2 3.4 2.4-1a8 8 0 0 0 1.8 1l.4 3h4.8l.4-3a8 8 0 0 0 1.8-1l2.4 1 2-3.4-2.1-1.5c.1-.3.1-.7.1-1Z"/>',
receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/>',
shield:'<path d="M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z"/><path d="m9 12 2 2 4-4"/>',
target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M15 9 21 3M16 3h5v5"/>',
camera:'<path d="M4 7h4l2-3h4l2 3h4a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="4"/>',
scissors:'<circle cx="6" cy="7" r="3"/><circle cx="6" cy="17" r="3"/><path d="m8.5 8.5 11 6.5M8.5 15.5 19.5 9"/>',
upload:'<path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 14v5h14v-5"/>',
check:'<path d="m5 12 4 4 10-10"/>',
trash:'<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/>',
edit:'<path d="M4 20h4l11-11-4-4L4 16v4Z"/><path d="m13 7 4 4"/>',
'rotate-ccw':'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
download:'<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>',
smartphone:'<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/>',
'chevron-left':'<path d="m15 18-6-6 6-6"/>',
'chevron-right':'<path d="m9 18 6-6-6-6"/>',
'arrow-up':'<path d="M12 19V5M7 10l5-5 5 5"/>',
'arrow-down':'<path d="M12 5v14M7 14l5 5 5-5"/>',
cigarette:'<path d="M3 15h14v4H3zM17 15h4v4h-4z"/><path d="M16 9c2 0 3-1 3-3s-1-3-3-3"/>',
heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
fuel:'<path d="M3 22V3h11v19M3 8h11"/><path d="M14 7h2l3 3v8a2 2 0 0 0 4 0v-6l-3-3"/>',
car:'<path d="M5 17h14l1-5-2-5H6l-2 5 1 5Z"/><path d="M7 17v2M17 17v2M6 12h12"/>',
wifi:'<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1"/>',
smile:'<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
'shopping-bag':'<path d="M5 8h14l-1 13H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
building:'<path d="M4 21V4h10v17M14 9h6v12M7 8h4M7 12h4M7 16h4M17 13h1M17 17h1M2 21h20"/>',
sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.41M17.66 6.34l1.41-1.41"/>',
laptop:'<rect x="4" y="4" width="16" height="12" rx="2"/><path d="M2 20h20M8 20l1-4h6l1 4"/>',
user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
'more-horizontal':'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
};
function iconSvg(name){return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]||ICONS["more-horizontal"]}</svg>`}
function hydrateIcons(){document.querySelectorAll("[data-icon]").forEach(el=>{if(el.dataset.iconReady===el.dataset.icon)return;el.innerHTML=iconSvg(el.dataset.icon);el.dataset.iconReady=el.dataset.icon})}


const ACCOUNT_META={
  current:{name:"جاری",icon:"wallet",desc:"خرج روزمره",cls:"current",color:"#42e6a4"},
  obligations:{name:"تعهدات",icon:"receipt",desc:"اقساط و هزینه ثابت",cls:"obligations",color:"#f4bf62"},
  safe:{name:"ذخیره امن",icon:"shield",desc:"هدف اولیه ۳۰M",cls:"safe",color:"#4aa8ff"},
  growth:{name:"اهداف و رشد",icon:"target",desc:"ماشین، تجهیزات و رشد",cls:"growth",color:"#9b7cff"}
};
const SOURCE_META={
  hirsa:{name:"هیرسا",color:"#f4bf62"},
  hoorsun:{name:"هورسان",color:"#42e6a4"},
  snapp:{name:"اسنپ",color:"#39d7e8"},
  freelance:{name:"فریلنس",color:"#8c9fff"},
  other:{name:"سایر",color:"#9baaa7"}
};
const TASK_CATEGORY_META={
  hirsa:{name:"هیرسا",icon:"building",color:"#f4bf62",rgb:"244,191,98"},
  hoorsun:{name:"هورسان",icon:"sun",color:"#42e6a4",rgb:"66,230,164"},
  freelance:{name:"فریلنس",icon:"laptop",color:"#8c9fff",rgb:"140,159,255"},
  personal:{name:"شخصی",icon:"user",color:"#39d7e8",rgb:"57,215,232"},
  other:{name:"سایر",icon:"more-horizontal",color:"#9baaa7",rgb:"155,170,167"}
};
let doneCategoryFilter="all";

const EXPENSE_CATS=[
  ["cigarette","سیگار","cigarette",4_200_000],
  ["kimia","کیمیا / رستوران","heart",15_000_000],
  ["fuel","بنزین","fuel",1_000_000],
  ["car","خودرو","car",3_000_000],
  ["home","خانه","home",3_000_000],
  ["internet","اینترنت و اشتراک","wifi",3_000_000],
  ["installments","اقساط","receipt",4_500_000],
  ["fun","تفریح","smile",2_000_000],
  ["personal","خرید شخصی","shopping-bag",2_000_000],
  ["other","سایر","more-horizontal",1_000_000],
];
let state={tasks:[],events:[],projects:[],projectTasks:[],transactions:[],accounts:[],reels:[],budgets:[],allocations:[],goals:[],hoorsunStage:{shoot:false,edit:false,upload:false}};
let planner={anchor:new Date(),selected:new Date()};
let amountCategory=null,editingAccount=null,pendingAllocation=null,lastUndo=null,prefillIncomeSource=null,editingEventId=null,stageLock=false;

async function init(){
  await openDB();await seed();await load();await ensureDefaultThursdays();await load();
  $("todayLabel").textContent=pFull(new Date());
  renderAll();wireMode();
  $("dbStatus").textContent="MIA v0.8.6 آماده است";
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
  const s=await get("settings","profile");if(!s)await put("settings",{key:"profile",userName:"ایمان",hoorsunTarget:12,weeklyReelTarget:3,hoorsunCyclePay:25_000_000,hirsaSalary:25_000_000,safeTarget:30_000_000,payday:29});
  const hs=await get("settings","hoorsunStage");if(!hs)await put("settings",{key:"hoorsunStage",value:{shoot:false,edit:false,upload:false}});
  const ex=await get("settings","thursdayExceptions");if(!ex)await put("settings",{key:"thursdayExceptions",value:[]})
}
async function load(){
  const names=["tasks","events","projects","projectTasks","transactions","accounts","reels","budgets","incomeAllocations","financialGoals"];
  const vals=await Promise.all(names.map(all));
  [state.tasks,state.events,state.projects,state.projectTasks,state.transactions,state.accounts,state.reels,state.budgets,state.allocations,state.goals]=vals;
  const hs=await get("settings","hoorsunStage");state.hoorsunStage=hs?.value||{shoot:false,edit:false,upload:false};
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
function nextPersianPayDate(payDay=29){
  const now=new Date(),today=new Date(now);today.setHours(12,0,0,0);
  for(let i=0;i<40;i++){
    const d=addDays(today,i),day=Number(parseFaDigits(pParts(d).day));
    if(day===payDay&&d>=today)return d
  }
  return addDays(today,30)
}
function daysToNextPay(){
  const now=new Date(),pay=nextPersianPayDate(29);
  return Math.max(0,Math.ceil((pay-now)/86400000))
}
function renderAll(){renderHome();renderFinance();renderWork();renderPlanner();renderTasks();renderProjects();renderSettingsPage();renderNotificationBadge();hydrateIcons()}
function renderHome(){
  const curr=account("current").balance;
  const days=daysToNextPay(),daily=curr/days;
  const reels=currentCycleReels(),wr=weekReels(),reelPct=Math.min(100,reels.length/12*100);
  const open=state.tasks.filter(t=>!t.done&&isSameDay(taskDate(t),new Date())).sort((a,b)=>taskDate(a)-taskDate(b));
  let insight="امروز وضعیتت تحت کنترل است.";
  const needWeek=Math.max(0,3-wr.length),totalAccounts=["current","obligations","safe","growth"].reduce((s,id)=>s+account(id).balance,0);
  if(curr<=0&&totalAccounts>0)insight="حساب جاری خالی است؛ قبل از خرج بعدی، موجودی حساب‌ها را بررسی کن.";
  else if(curr>0&&daily<500_000)insight="بودجه روزانه محدود شده؛ هزینه‌های اختیاری را کمتر کن.";
  else if(open.length)insight=`اول «${open[0].title}» را انجام بده.`;
  else if(needWeek>0)insight=`برای هدف هورسان، این هفته ${fa(needWeek)} ریلز دیگر تکمیل کن.`;
  else{
    const nextTask=state.tasks.filter(t=>!t.done).sort((a,b)=>taskDate(a)-taskDate(b))[0];
    if(nextTask)insight=`کار بعدی: «${nextTask.title}».`;
  }
  $("miaInsight").textContent=insight;

  $("homeAccounts").innerHTML=["current","obligations","safe","growth"].map(id=>{
    const a=account(id),m=ACCOUNT_META[id],pct=totalAccounts?Math.round(a.balance/totalAccounts*100):0;
    return `<button class="home-account-card account-${id}" onclick="openAccount('${id}')">
      <span class="account-mini-icon" data-icon="${m.icon}"></span>
      <b>${m.name}</b><strong>${toman(a.balance)}</strong>
      <small>${fa(pct)}٪ از کل موجودی</small><div class="mini-progress"><i style="width:${pct}%"></i></div>
    </button>`
  }).join("");

  const sources=["hirsa","hoorsun","snapp","freelance","other"],vals=sources.map(s=>sourceIncome(s)),total=sum(vals);
  $("homeIncomeTotal").textContent=toman(total);
  $("homeIncomeDonutText").textContent=total?toman(total):"۰";
  let angle=0,parts=[];
  $("homeIncomeLegend").innerHTML=sources.filter((s,i)=>vals[i]>0).map(s=>{
    const i=sources.indexOf(s),v=vals[i],pct=total?Math.round(v/total*100):0,c=SOURCE_META[s].color,start=angle;angle+=pct*3.6;parts.push(`${c} ${start}deg ${angle}deg`);
    return `<div><i style="background:${c}"></i><span>${SOURCE_META[s].name}</span><b>${fa(pct)}٪</b></div>`
  }).join("")||`<small>هنوز درآمدی ثبت نشده.</small>`;
  $("homeIncomeDonut").style.background=parts.length?`conic-gradient(${parts.join(",")})`:"rgba(255,255,255,.05)";

  $("homeTasks").innerHTML=open.length?open.slice(0,3).map(taskRow).join(""):empty("فعلاً کاری در لیست باز نیست.");

  $("homeReels").textContent=`${fa(reels.length)} / ۱۲`;
  $("homeReelWeek").textContent=`این هفته ${fa(wr.length)} / ۳`;
  $("homeReelRemain").textContent=`${fa(Math.max(0,12-reels.length))} ریلز باقی مانده`;
  $("homeReelRing").style.background=`conic-gradient(var(--green) 0 ${reelPct}%,rgba(255,255,255,.06) ${reelPct}% 100%)`;
  const stage=state.hoorsunStage||{shoot:false,edit:false,upload:false};
  [["shoot","homeStageShoot"],["edit","homeStageEdit"],["upload","homeStageUpload"]].forEach(([k,id])=>$(id)?.classList.toggle("done",!!stage[k]));
  hydrateIcons()
}
function renderFinance(){
  const curr=account("current").balance;$("financeSpendable").textContent=toman(curr);
  $("daysToPay").textContent=`حدود ${fa(daysToNextPay())} روز تا حقوق بعدی هیرسا`;
  const totalBalance=["current","obligations","safe","growth"].reduce((s,id)=>s+account(id).balance,0);
  $("financeAccounts").innerHTML=["current","obligations","safe","growth"].map(id=>{
    const a=account(id),m=ACCOUNT_META[id],pct=totalBalance?Math.round(a.balance/totalBalance*100):0;
    return `<button class="money-card ${m.cls} account-${id}" onclick="openAccount('${id}')"><div class="money-icon" data-icon="${m.icon}"></div><b>${m.name}</b><strong>${toman(a.balance)}</strong><div class="money-card-pct">${fa(pct)}٪</div><div class="mini-progress"><i style="width:${pct}%"></i></div><small>${a.bankName||m.desc}</small></button>`
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
    const x=a.parts[id];return `<div class="allocation-item account-accent-${id}"><div><b><i class="allocation-dot"></i>${ACCOUNT_META[id].name}</b><small>${fa(x.percent)}٪ از ${SOURCE_META[a.source]?.name||"درآمد"}</small></div><span>${toman(x.amount)}</span></div>`
  }).join("");
}
function renderGoals(){
  $("goalsList").innerHTML=state.goals.map(g=>{
    const bal=account(g.accountId).balance,pct=Math.min(100,Math.round(bal/g.target*100));
    return `<div class="goal-card"><div class="goal-top"><b>${esc(g.name)}</b><span>${fa(pct)}٪</span></div><small>${toman(bal)} از ${toman(g.target)}</small><div class="bar"><i style="width:${pct}%"></i></div></div>`
  }).join("")
}
function renderExpenses(){
  $("expenseQuickGrid").innerHTML=EXPENSE_CATS.slice(0,9).map(([id,name,icon])=>`<button class="expense-cat" onclick="openAmount('${id}')"><i data-icon="${icon}"></i><span>${name}</span></button>`).join("");
  const tx=monthTx("expense").sort((a,b)=>b.at-a.at);
  $("expenseList").innerHTML=tx.length?tx.slice(0,30).map(txRow).join(""):empty("هنوز هزینه‌ای ثبت نشده.")
}
function renderIncome(){
  const sources=["hirsa","hoorsun","snapp","freelance"],total=sum(sources,s=>sourceIncome(s));
  $("incomeSourceCards").innerHTML=sources.map(s=>{
    const value=sourceIncome(s),pct=total?Math.round(value/total*100):0;
    return `<button class="source-card source-${s}" onclick="openQuick('income','${s}')"><div class="source-card-top"><b>${SOURCE_META[s].name}</b><span>${fa(pct)}٪</span></div><strong>${toman(value)}</strong><div class="source-progress"><i style="width:${pct}%;background:${SOURCE_META[s].color}"></i></div><small>از درآمد دریافت‌شده این ماه</small></button>`
  }).join("");
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
  return `<div class="tx-row"><div class="tx-icon" data-icon="${t.type==="income"?"arrow-up":"arrow-down"}"></div><div><b>${esc(t.note||name)}</b><small>${name} · ${pFull(new Date(t.at))}</small></div><span class="tx-amount ${t.type}">${t.type==="income"?"+":"−"}${toman(t.amount)}</span></div>`
}
function renderWork(){
  const reels=currentCycleReels(),wr=weekReels(),pct=Math.min(100,reels.length/12*100),value=reels.length*(25_000_000/12);
  $("reelRing").style.background=`conic-gradient(var(--green) 0 ${pct}%,rgba(255,255,255,.06) ${pct}% 100%)`;
  $("reelRingText").textContent=`${fa(reels.length)}/۱۲`;
  $("reelValue").textContent=`${toman(value)} ارزش کار تکمیل‌شده`;
  $("weekReels").textContent=`${fa(wr.length)} / ۳`;
  $("cycleRemain").textContent=fa(Math.max(0,12-reels.length));
  const need=Math.max(0,3-wr.length);
  $("reelPlanText").textContent=need?`برای هدف هفتگی ${fa(need)} ریلز دیگر لازم است.`:"هدف این هفته تکمیل شده ✓";
  const stage=state.hoorsunStage||{shoot:false,edit:false,upload:false};
  const doneStages=["shoot","edit","upload"].filter(k=>stage[k]).length;
  $("stageProgressText").textContent=`${fa(doneStages)} از ۳ مرحله`;
  [["shoot","stageShoot"],["edit","stageEdit"],["upload","stageUpload"]].forEach(([k,id])=>$(id)?.classList.toggle("done",!!stage[k]));
  $("reelsList").innerHTML=reels.length?reels.slice().reverse().map((r,i)=>`<div class="list-row reel-history-row"><span class="row-icon" data-icon="check"></span><div><b>ریلز ${fa(reels.length-i)} هورسان</b><small>${pFull(new Date(r.at))}</small></div><span class="status-pill">تکمیل</span></div>`).join(""):empty("برای ثبت اولین ریلز، سه مرحله را به‌ترتیب تکمیل کن.");
  const sn=monthTx("income").filter(t=>t.source==="snapp");$("snappMonth").innerHTML=`<div class="allocation-item"><div><b>درآمد ثبت‌شده</b><small>${fa(sn.length)} ثبت</small></div><span>${toman(sum(sn,x=>x.amount))}</span></div>`;
  hydrateIcons();
}
function renderProjects(){
  $("projectsList").innerHTML=state.projects.length?state.projects.slice().reverse().map(p=>`<div class="project-card"><b>${esc(p.title)}</b><small>${p.value?toman(p.value):"بدون مبلغ"} · ${p.status||"فعال"}</small></div>`).join(""):empty("فعلاً پروژه فریلنس فعالی ثبت نشده.")
}

function localDateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
async function ensureDefaultThursdays(){
  const ex=(await get("settings","thursdayExceptions"))?.value||[],today=new Date();today.setHours(10,0,0,0);
  for(let i=0;i<84;i++){const d=addDays(today,i);if(d.getDay()!==4)continue;const key=localDateKey(d);if(ex.includes(key))continue;if(!state.events.some(e=>e.recurrenceKey===key))await put("events",{id:now()+i,title:"فیلم‌برداری هورسان",startISO:d.toISOString(),durationMin:180,alertBeforeMin:60,type:"work",source:"system-hoorsun",defaultThursday:true,recurrenceKey:key,createdAt:now()})}
}
async function persistHoorsunStage(next){
  state.hoorsunStage=next;await put("settings",{key:"hoorsunStage",value:next});renderWork();renderHome()
}
window.toggleReelStage=async stage=>{
  if(stageLock)return;
  if(currentCycleReels().length>=12)return toast("چرخه ۱۲ ریلزی کامل شده؛ ابتدا چرخه جدید هورسان را شروع کن.");
  const cur={...(state.hoorsunStage||{shoot:false,edit:false,upload:false})};

  if(stage==="edit"&&!cur.shoot)return toast("ابتدا مرحله فیلم‌برداری را تکمیل کن.");
  if(stage==="upload"&&!cur.edit)return toast("ابتدا مرحله تدوین را تکمیل کن.");

  if(stage==="shoot"&&cur.shoot){await persistHoorsunStage({shoot:false,edit:false,upload:false});return}
  if(stage==="edit"&&cur.edit){await persistHoorsunStage({shoot:true,edit:false,upload:false});return}
  if(stage==="upload"&&cur.upload){await persistHoorsunStage({shoot:true,edit:true,upload:false});return}

  const next={...cur,[stage]:true};
  await persistHoorsunStage(next);

  if(next.shoot&&next.edit&&next.upload){
    stageLock=true;
    await new Promise(r=>setTimeout(r,280));
    await addReel("تکمیل فیلم‌برداری + تدوین + بارگذاری");
    await persistHoorsunStage({shoot:false,edit:false,upload:false});
    stageLock=false
  }
};
async function setReelStageDone(stage){
  const cur=state.hoorsunStage||{shoot:false,edit:false,upload:false};
  if(cur[stage])return toast("این مرحله قبلاً ثبت شده.");
  return toggleReelStage(stage)
}
function normalizeWorkTitle(input){
  let q=norm(input)
    .replace(/[.!؟?،]/g," ")
    .replace(/\s+/g," ")
    .trim();

  q=q.replace(/ساعت\s*\d{1,2}(?::\d{1,2})?/g," ")
     .replace(/امروز|فردا|پس ?فردا|چهار[\s‌]?شنبه|پنج[\s‌]?شنبه|سه[\s‌]?شنبه|دو[\s‌]?شنبه|یک[\s‌]?شنبه|شنبه|جمعه/g," ")
     .replace(/\b(من|میخوام|می‌خوام|می خواهم|می‌خواهم|لازمه|قراره)\b/g," ")
     .replace(/\b(باید)\b/g," ")
     .replace(/\s+(رو|را)\s+/g," ")
     .replace(/\s+/g," ")
     .trim();

  const brand=/هورسان/.test(q)?"هورسان":/هیرسا/.test(q)?"هیرسا":"";
  const media=/ریلز/.test(q)?"ریلز":/ویدیو|فیلم/.test(q)?"ویدیو":"";

  if(/تماس با/.test(q)){
    const m=q.match(/تماس با\s+(.+?)(?:\s+(?:کنم|بگیرم|داشته باشم|بزنم))?$/);
    if(m?.[1])return `تماس با ${m[1].trim()}`;
  }
  if(/زنگ/.test(q)){
    let m=q.match(/(?:به\s+)?(.+?)\s+زنگ\s*(?:بزنم|بزن|بگیرم)?$/);
    if(m?.[1])return `تماس با ${m[1].trim()}`;
    m=q.match(/زنگ\s+(?:به\s+)?(.+?)(?:\s+(?:بزنم|بزن|بگیرم))?$/);
    if(m?.[1])return `تماس با ${m[1].trim()}`;
  }

  if(media&&brand&&/فیلم ?برداری|ضبط/.test(q))return `فیلم‌برداری ${media} ${brand}`;
  if(media&&brand&&/ادیت|تدوین|ویرایش|بزنم|بزن|بسازم|ساخت/.test(q))return `تدوین ${media} ${brand}`;
  if(media&&brand&&/بارگذاری|آپلود|منتشر/.test(q))return `بارگذاری ${media} ${brand}`;

  if(/لوگو/.test(q)){
    const subject=brand?`لوگو ${brand}`:"لوگو";
    if(/ویرایش|اصلاح|ادیت|تغییر/.test(q))return `ویرایش ${subject}`;
    if(/طراحی|ساخت/.test(q))return `طراحی ${subject}`;
  }

  if(/(?:پیج|صفحه)/.test(q)&&brand&&/افتتاح|راه ?انداز|ایجاد|ساخت/.test(q))return `افتتاح پیج ${brand}`;

  if(/سایت/.test(q)&&/اصلاح|ویرایش|ادیت|تغییر/.test(q)){
    let target=q.replace(/اصلاح|ویرایش|ادیت|تغییر|کنم|کردم|شد|سایت/g," ").replace(/\s+/g," ").trim();
    return target?`اصلاح سایت ${target}`:"اصلاح سایت";
  }

  q=q.replace(/\b(انجامش|انجام)\s*(?:بدم|دهم|کنم)?\b/g," ")
     .replace(/\b(کردم|کرده شد|شد|کنم|بکنم|بدم|بدهم|بزنم|بزن|برم|بریم)\b/g," ")
     .replace(/\s+/g," ")
     .trim();

  return q||String(input||"").trim();
}
function detectTaskCategory(text){
  const q=norm(text);

  if(/(?:افتتاح|راه ?انداز|ایجاد|ساخت).*(?:پیج|صفحه).*هورسان|(?:پیج|صفحه).*هورسان.*(?:افتتاح|راه ?انداز|ایجاد|ساخت)/.test(q))return"hirsa";

  if(/هیرسا|hirsa/.test(q))return"hirsa";
  if(/هورسان|hoorsun|پنل خورشیدی|خورشیدی|سولار/.test(q))return"hoorsun";
  if(/فریلنس|freelance|مشتری|طراحی سایت|سایت مشتری|پروژه مشتری|کارفرمای شخصی/.test(q))return"freelance";
  if(/شخصی|خونه|خانه|کیمیا|ماشین|خودرو|خرید|دکتر|پزشک|خانواده|تفریح/.test(q))return"personal";
  return"other"
}
function taskCategory(t){return t.category||detectTaskCategory(t.title||"")}
function isCompletedPhrase(q){
  return /انجام شد|انجام دادم|انجامش دادم|ویرایش شد|ویرایش کردم|اصلاح شد|اصلاح کردم|تمام شد|تموم شد|تکمیل شد|نهایی شد|فرستادم|ارسال شد|تحویل شد|آپلود شد|بارگذاری شد|منتشر شد|منتشر کردم|بسته شد|اوکی شد|حل شد|ثبت شد|افتتاح کردم|افتتاح شد|راه اندازی کردم|راه‌اندازی کردم|راه اندازی شد|راه‌اندازی شد|ایجاد کردم|ساختم|طراحی کردم/.test(q)
}
async function addCompletedTask(rawTitle){
  const title=normalizeWorkTitle(rawTitle);
  const category=detectTaskCategory(`${rawTitle} ${title}`),ts=now();
  await put("tasks",{id:ts,title,time:"انجام‌شده",dueISO:new Date(ts).toISOString(),done:true,doneAt:ts,category,createdAt:ts,completedVia:"quick",rawTitle});
  await load();renderAll();openPlannerTab("done");
  toast(`«${title}» در ${TASK_CATEGORY_META[category].name} ثبت شد ✓`)
}

function taskDate(t){return t.dueISO?new Date(t.dueISO):new Date(t.createdAt||now())}
function tasksForDate(d,includeDone=true){return state.tasks.filter(t=>(includeDone||!t.done)&&isSameDay(taskDate(t),d))}
function samePersianMonth(a,b){const x=pParts(a),y=pParts(b);return x.year===y.year&&x.month===y.month}
function monthLabel(d){return new Intl.DateTimeFormat("fa-IR-u-ca-persian",{month:"long",year:"numeric"}).format(d)}

function renderPlanner(){
  $("monthTitle").textContent=pMonthTitle(planner.anchor);$("selectedDate").textContent=pFull(planner.selected);
  const {cells}=monthCells(planner.anchor),ap=pParts(planner.anchor),today=new Date();
  $("monthGrid").innerHTML=cells.map(d=>{const pp=pParts(d),inside=pp.month===ap.month&&pp.year===ap.year,evCount=eventsFor(d).length,taskCount=tasksForDate(d,true).length,has=evCount+taskCount>0;return `<button class="day-cell ${inside?"":"muted"} ${isSameDay(d,today)?"today":""} ${isSameDay(d,planner.selected)?"selected":""}" onclick="selectDate('${d.toISOString()}')"><span>${pDayNum(d)}</span>${has?`<i class="day-indicator ${taskCount&&evCount?"mixed":taskCount?"task":"event"}"></i>`:""}</button>`}).join("");
  const ev=eventsFor(planner.selected),tasks=tasksForDate(planner.selected,true);
  const rows=[...ev.map(e=>({date:new Date(e.startISO),html:eventRow(e)})),...tasks.map(t=>({date:taskDate(t),html:dayTaskRow(t)}))].sort((a,b)=>a.date-b.date);
  $("dayEvents").innerHTML=rows.length?rows.map(x=>x.html).join(""):empty("برای این روز کار یا برنامه‌ای ثبت نشده.");hydrateIcons()
}
function eventsFor(d){return state.events.filter(e=>isSameDay(new Date(e.startISO),d)).sort((a,b)=>new Date(a.startISO)-new Date(b.startISO))}
function eventRow(e){const d=new Date(e.startISO);return `<div class="event-row"><div class="event-time">${new Intl.DateTimeFormat("fa-IR",{hour:"2-digit",minute:"2-digit"}).format(d)}</div><div><b>${esc(e.title)}</b><small>${e.defaultThursday?"پیش‌فرض پنجشنبه · ":""}${fa(e.durationMin||60)} دقیقه</small></div><div class="row-actions"><button class="mini-action" onclick="editEvent(${JSON.stringify(e.id)})"><span data-icon="edit"></span></button><button class="mini-action danger" onclick="deleteEvent(${JSON.stringify(e.id)})"><span data-icon="trash"></span></button></div></div>`}
function dayTaskRow(t){return `<div class="event-row task-event-row ${t.done?"completed":""}"><div class="event-time"><span data-icon="${t.done?"check":"briefcase"}"></span></div><div><b>${esc(t.title)}</b><small>${t.done?"انجام‌شده":"کار"}</small></div><div class="row-actions">${t.done?`<button class="mini-action" onclick="reopenTask(${JSON.stringify(t.id)})"><span data-icon="rotate-ccw"></span></button>`:`<button class="mini-action success" onclick="toggleTask(${JSON.stringify(t.id)})"><span data-icon="check"></span></button>`}<button class="mini-action danger" onclick="deleteTask(${JSON.stringify(t.id)})"><span data-icon="trash"></span></button></div></div>`}
function renderTasks(){
  const open=state.tasks.filter(t=>!t.done).sort((a,b)=>taskDate(a)-taskDate(b)),done=state.tasks.filter(t=>t.done).sort((a,b)=>(b.doneAt||0)-(a.doneAt||0));
  $("taskList").innerHTML=open.length?open.map(taskRow).join(""):empty("فعلاً کاری در لیست باز نیست.");renderDoneArchive(done);hydrateIcons()
}
function renderDoneArchive(done){
  const current=new Date(),currentDone=done.filter(t=>samePersianMonth(new Date(t.doneAt||t.createdAt),current)),currentOpen=state.tasks.filter(t=>!t.done&&samePersianMonth(taskDate(t),current)),currentEvents=state.events.filter(e=>samePersianMonth(new Date(e.startISO),current)),currentReels=state.reels.filter(r=>samePersianMonth(new Date(r.at),current));
  $("monthlyDoneSummary").innerHTML=`<div class="month-summary panel"><div class="month-summary-head"><div><span>جمع‌بندی ${monthLabel(current)}</span><b>${fa(currentDone.length)} کار انجام‌شده</b></div><span class="summary-check" data-icon="check"></span></div><div class="summary-grid"><div><b>${fa(currentDone.length)}</b><span>انجام‌شده</span></div><div><b>${fa(currentOpen.length)}</b><span>باز</span></div><div><b>${fa(currentEvents.length)}</b><span>برنامه</span></div><div><b>${fa(currentReels.length)}</b><span>ریلز</span></div></div></div>`;

  const cats=["all","hirsa","hoorsun","freelance","personal","other"];
  $("doneFilters").innerHTML=cats.map(id=>{
    const count=id==="all"?done.length:done.filter(t=>taskCategory(t)===id).length;
    const meta=id==="all"?{name:"همه",icon:"check"}:TASK_CATEGORY_META[id];
    return `<button class="done-filter ${doneCategoryFilter===id?"active":""} ${id!=="all"?`cat-${id}`:""}" onclick="setDoneCategory('${id}')"><span data-icon="${meta.icon}"></span><b>${meta.name}</b><small>${fa(count)}</small></button>`
  }).join("");

  const filtered=doneCategoryFilter==="all"?done:done.filter(t=>taskCategory(t)===doneCategoryFilter);
  if(!filtered.length){
    const label=doneCategoryFilter==="all"?"هنوز کاری انجام نشده.":`هنوز کاری در دسته «${TASK_CATEGORY_META[doneCategoryFilter].name}» انجام نشده.`;
    $("doneList").innerHTML=empty(label);hydrateIcons();return
  }

  const groups=new Map();
  filtered.forEach(t=>{
    const d=new Date(t.doneAt||t.createdAt),pp=pParts(d),key=`${pp.year}-${pp.month}`;
    if(!groups.has(key))groups.set(key,{label:monthLabel(d),items:[]});
    groups.get(key).items.push(t)
  });
  $("doneList").innerHTML=[...groups.values()].map(g=>`<section class="done-month-group"><div class="done-month-title"><b>${g.label}</b><span class="month-closed"><i data-icon="check"></i>${fa(g.items.length)} مورد</span></div><div class="done-card-list">${g.items.map(doneRow).join("")}</div></section>`).join("");
  hydrateIcons()
}
window.setDoneCategory=id=>{doneCategoryFilter=id;renderTasks()};
function taskRow(t){
  const cat=taskCategory(t),m=TASK_CATEGORY_META[cat],d=taskDate(t),today=isSameDay(d,new Date());
  return `<div class="list-row task-row cat-${cat}">
    <button class="check-btn" onclick="toggleTask(${JSON.stringify(t.id)})"><span data-icon="check"></span></button>
    <div class="task-row-copy"><div class="task-row-meta"><span class="task-cat-pill">${m.name}</span><small>${today?"امروز":pFull(d)}</small></div><b>${esc(t.title)}</b></div>
    <button class="mini-action danger" onclick="deleteTask(${JSON.stringify(t.id)})"><span data-icon="trash"></span></button>
  </div>`
}
function doneRow(t){
  const cat=taskCategory(t),m=TASK_CATEGORY_META[cat],d=new Date(t.doneAt||t.createdAt);
  return `<article class="done-card cat-${cat}">
    <div class="done-cat-icon"><span data-icon="${m.icon}"></span></div>
    <div class="done-card-copy">
      <div class="done-card-top"><span class="done-category-badge">${m.name}</span><span class="done-status"><i data-icon="check"></i> انجام شد</span></div>
      <b>${esc(t.title)}</b>
      <small>${pFull(d)} · ${new Intl.DateTimeFormat("fa-IR",{hour:"2-digit",minute:"2-digit"}).format(d)}</small>
    </div>
    <div class="done-actions">
      <button class="mini-action" onclick="reopenTask(${JSON.stringify(t.id)})" aria-label="بازگردانی"><span data-icon="rotate-ccw"></span></button>
      <button class="mini-action danger" onclick="deleteTask(${JSON.stringify(t.id)})" aria-label="حذف"><span data-icon="trash"></span></button>
    </div>
  </article>`
}


function buildMiaNotifications(){
  const items=[],today=new Date();
  const todayTasks=state.tasks.filter(t=>!t.done&&isSameDay(taskDate(t),today));
  if(todayTasks.length){
    items.push({kind:"tasks",icon:"briefcase",tone:"green",title:`${fa(todayTasks.length)} کار برای امروز`,text:todayTasks.slice(0,2).map(t=>t.title).join(" · ")})
  }

  const upcoming=state.events
    .filter(e=>new Date(e.startISO)>=new Date()&&new Date(e.startISO)<=addDays(new Date(),2))
    .sort((a,b)=>new Date(a.startISO)-new Date(b.startISO));
  if(upcoming.length){
    const e=upcoming[0],d=new Date(e.startISO);
    items.push({kind:"calendar",icon:"calendar",tone:"blue",title:"برنامه نزدیک",text:`${e.title} · ${pFull(d)} ${new Intl.DateTimeFormat("fa-IR",{hour:"2-digit",minute:"2-digit"}).format(d)}`})
  }

  const wr=weekReels(),remain=Math.max(0,3-wr.length);
  if(remain>0&&currentCycleReels().length<12){
    const stage=state.hoorsunStage||{shoot:false,edit:false,upload:false};
    const next=!stage.shoot?"فیلم‌برداری":!stage.edit?"تدوین":"بارگذاری";
    items.push({kind:"work",icon:"camera",tone:"purple",title:`${fa(remain)} ریلز تا هدف هفتگی هورسان`,text:`مرحله بعدی ریلز فعلی: ${next}`})
  }

  const curr=account("current").balance;
  if(curr>0&&curr<3_000_000){
    items.push({kind:"finance",icon:"wallet",tone:"yellow",title:"موجودی جاری پایین است",text:`موجودی ثبت‌شده: ${toman(curr)}`})
  }
  return items
}
function renderNotificationBadge(){
  const badge=$("notificationBadge");if(!badge)return;
  const count=buildMiaNotifications().length;
  badge.textContent=fa(count);
  badge.classList.toggle("hidden",count===0)
}
function renderNotifications(){
  const items=buildMiaNotifications(),list=$("notificationList"),summary=$("notificationSummary");
  if(!list||!summary)return;
  summary.innerHTML=items.length
    ?`<div><b>${fa(items.length)} مورد نیاز به توجه</b><small>بر اساس کارها، برنامه‌ها، مالی و هورسان</small></div><span data-icon="bell"></span>`
    :`<div><b>همه‌چیز مرتب است</b><small>فعلاً مورد فوری برای پیگیری نداری.</small></div><span data-icon="check"></span>`;
  list.innerHTML=items.length?items.map(n=>`<button class="notification-item tone-${n.tone}" onclick="openNotificationTarget('${n.kind}')">
    <span class="notification-item-icon" data-icon="${n.icon}"></span>
    <div><b>${esc(n.title)}</b><small>${esc(n.text)}</small></div>
    <span class="notification-chevron" data-icon="chevron-left"></span>
  </button>`).join(""):empty("اعلان جدیدی نداری.");
  hydrateIcons()
}
window.openNotifications=()=>{renderNotifications();openSheet("notificationSheet")};
window.openNotificationTarget=kind=>{
  closeSheet("notificationSheet");
  if(kind==="tasks"){switchPage("planner");openPlannerTab("tasks")}
  else if(kind==="calendar"){switchPage("planner");openPlannerTab("calendar")}
  else if(kind==="work"){switchPage("work");openWorkTab("hoorsun")}
  else if(kind==="finance"){switchPage("finance");openFinanceTab("overview")}
};

window.switchPage=id=>{
  const current=document.querySelector(".page.active"),next=$(id);
  if(!next||current===next)return;
  if(current){current.classList.add("page-leaving");setTimeout(()=>{current.classList.remove("active","page-leaving")},120)}
  next.classList.add("active","page-entering");requestAnimationFrame(()=>requestAnimationFrame(()=>next.classList.remove("page-entering")));
  document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.page===id));
  window.scrollTo({top:0,behavior:"smooth"});
  if(id==="finance")renderFinance();if(id==="work")renderWork();if(id==="planner")renderPlanner();if(id==="settingsPage")renderSettingsPage();hydrateIcons()
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
  document.querySelectorAll(".planner-main-tabs button").forEach(b=>b.classList.toggle("active",b.dataset.ptab===id));
  if(id==="done"||id==="tasks")renderTasks()
};
window.selectDate=iso=>{planner.selected=new Date(iso);planner.anchor=new Date(iso);renderPlanner()};
window.shiftMonth=dir=>{const {start,end}=monthCells(planner.anchor);planner.anchor=dir>0?addDays(end,1):addDays(start,-1);planner.selected=planner.anchor;renderPlanner()};

function openSheet(id){$(id).classList.add("show")}
window.closeSheet=id=>$(id).classList.remove("show");
window.closeOverlay=(e,id)=>{if(e.target.id===id)closeSheet(id)};
window.openSettings=()=>{switchPage("settingsPage");renderSettingsPage()};

window.openQuick=(kind="",source="")=>{
  prefillIncomeSource=source||null;$("quickInput").value="";
  if(kind==="income")$("quickInput").placeholder=`مثلاً: ۲۵ میلیون حقوق ${SOURCE_META[source]?.name||"هورسان"} واریز شد`;
  else if(kind==="expense")$("quickInput").placeholder="مثلاً: ۱۴۰ سیگار";
  else $("quickInput").placeholder="مثلاً: فردا سایت مشتری را اصلاح کنم\nیا: سه‌شنبه ساعت ۱۲ جلسه دارم";
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
  if(/سیگار|وینستون|مارلبرو|کنت|دخانیات|پاکت/.test(q))return"cigarette";
  if(/کیمیا|رستوران|شام|ناهار|صبحانه|کافه|قرار|فست ?فود|غذا/.test(q))return"kimia";
  if(/بنزین|سوخت|پمپ بنزین/.test(q))return"fuel";
  if(/ماشین|خودرو|روغن|تعویض روغن|تعمیر|لاستیک|کارواش|مکانیک/.test(q))return"car";
  if(/خانه|خونه|شارژ ساختمان|خانواده|سوپرمارکت|خرید خانه/.test(q))return"home";
  if(/اینترنت|اشتراک|پریمیر|ادوبی|نرم افزار|نرم‌افزار|فیلترشکن|vpn/.test(q))return"internet";
  if(/قسط|وام|قرعه|بدهی/.test(q))return"installments";
  if(/تفریح|سینما|بازی|گردش|سرگرمی/.test(q))return"fun";
  if(/لباس|کفش|خرید شخصی|آرایش|اکسسوری/.test(q))return"personal";
  return"other"
}
function sourceFrom(q){
  q=norm(q);if(q.includes("هورسان"))return"hoorsun";if(q.includes("هیرسا"))return"hirsa";if(q.includes("اسنپ"))return"snapp";if(/فریلنس|سایت|مشتری/.test(q))return"freelance";return prefillIncomeSource||"other"
}
function isEventIntent(q){return /ساعت\s*\d|جلسه|قرار|ملاقات|مصاحبه|نوبت|وقت دکتر|رزرو/.test(q)}
function isIncomeIntent(q){
  if(/قسط|خرید|هزینه|پرداخت|واریز کردم|پرداخت کردم/.test(q))return false;
  return /حقوق|درآمد|دریافتی|دستمزد|فروش|واریزی|اومد|آمد|به حسابم/.test(q)
}
window.submitQuick=async()=>{
  const raw=$("quickInput").value.trim();if(!raw)return toast("یک مورد بنویس تا ثبت کنم.");
  const q=norm(raw);

  if(q.includes("هورسان")&&/فیلم ?برداری|ضبط/.test(q)&&/انجام|زدم|تموم|تمام|تکمیل/.test(q)){await setReelStageDone("shoot");closeSheet("quickSheet");return}
  if(q.includes("هورسان")&&/تدوین|ادیت/.test(q)&&/انجام|زدم|تموم|تمام|تکمیل/.test(q)){await setReelStageDone("edit");closeSheet("quickSheet");return}
  if(q.includes("هورسان")&&/بارگذاری|آپلود/.test(q)&&/انجام|زدم|تموم|تمام|تکمیل/.test(q)){await setReelStageDone("upload");closeSheet("quickSheet");return}
  if(q.includes("هورسان")&&/ریلز|ویدیو/.test(q)&&/تحویل دادم|کامل کردم|تکمیل کردم|تموم کردم|تمام کردم/.test(q)){
    closeSheet("quickSheet");toast("برای ثبت ریلز هورسان، سه مرحله فیلم‌برداری، تدوین و بارگذاری را جداگانه تکمیل کن.");return
  }

  if(isIncomeIntent(q)){
    const amount=parseAmount(q,"income");if(amount){await addIncome(amount,sourceFrom(q),raw);closeSheet("quickSheet");return}
  }

  if(/از\s+(جاری|تعهدات|ذخیره|اهداف)/.test(q)&&/به\s+(جاری|تعهدات|ذخیره|اهداف)/.test(q)){
    const amount=parseAmount(q);if(amount){await quickTransfer(q,amount);closeSheet("quickSheet");return}
  }

  const amount=parseAmount(q,"expense");
  if(amount&&(/\d/.test(q))){const ok=await addExpense(amount,categoryFrom(q),raw);if(ok!==false)closeSheet("quickSheet");return}

  if(isCompletedPhrase(q)){await addCompletedTask(raw);closeSheet("quickSheet");return}

  const dated=parseNaturalEvent(raw);
  if(dated){
    if(isEventIntent(q)){
      await put("events",{id:now(),...dated,createdAt:now()});await load();renderAll();closeSheet("quickSheet");toast("برنامه زمان‌دار ثبت شد ✓");return
    }
    const smartTitle=normalizeWorkTitle(dated.title||raw);
    await put("tasks",{id:now(),title:smartTitle,rawTitle:raw,time:pFull(new Date(dated.startISO)),dueISO:dated.startISO,done:false,category:detectTaskCategory(`${raw} ${smartTitle}`),createdAt:now()});
    await load();renderAll();closeSheet("quickSheet");toast(`«${smartTitle}» به کارهای ${isSameDay(new Date(dated.startISO),new Date())?"امروز":"تاریخ انتخاب‌شده"} اضافه شد ✓`);return
  }

  const smartTitle=normalizeWorkTitle(raw);
  await put("tasks",{id:now(),title:smartTitle,rawTitle:raw,time:"امروز",dueISO:new Date().toISOString(),done:false,category:detectTaskCategory(`${raw} ${smartTitle}`),createdAt:now()});
  await load();renderAll();closeSheet("quickSheet");toast(`«${smartTitle}» به کارهای امروز اضافه شد ✓`)
};

async function addExpense(amount,category,note){
  const id=now(),before=account("current").balance;
  if(amount>before)return toast("موجودی حساب جاری برای این هزینه کافی نیست؛ ابتدا موجودی را تطبیق بده یا انتقال بین حساب‌ها را ثبت کن."),false;
  await put("transactions",{id,type:"expense",amount,category,note,accountId:"current",at:now()});
  await put("accounts",{...account("current"),balance:before-amount});
  lastUndo={kind:"expense",id,amount,before};await load();renderAll();
  const b=state.budgets.find(x=>x.id===category),spent=expenseSpent(category),remain=b?Math.max(0,b.monthlyLimit-spent):0;
  toast(`${toman(amount)} در «${b?.name||"هزینه"}» ثبت شد · بودجه باقی‌مانده ${toman(remain)}`,"برگرداندن",undoLast);return true
}
async function addIncome(amount,source,note){
  const id=now();await put("transactions",{id,type:"income",amount,source,note,accountId:"current",at:now()});
  await put("accounts",{...account("current"),balance:account("current").balance+amount});
  const parts=buildAllocation(amount);
  const alloc={id:now()+1,at:now(),incomeTxId:id,source,amount,parts,confirmed:false};await put("incomeAllocations",alloc);
  pendingAllocation=alloc;await load();renderAll();showAllocation(alloc)
}
function buildAllocation(amount){
  const safeTarget=30_000_000;
  const monthlyObligationTarget=7_500_000;
  const currentComfortTarget=12_000_000;

  let current=45,obligations=20,safe=25,growth=10;

  if(account("current").balance<5_000_000){current+=7;growth-=4;safe-=3}
  else if(account("current").balance>currentComfortTarget){current-=5;growth+=3;safe+=2}

  if(account("obligations").balance<monthlyObligationTarget){obligations+=5;growth-=3;current-=2}
  else if(account("obligations").balance>=monthlyObligationTarget){obligations-=5;growth+=3;current+=2}

  if(account("safe").balance<safeTarget*.5){safe+=7;growth-=5;current-=2}
  else if(account("safe").balance>=safeTarget){safe-=12;growth+=9;current+=3}

  const raw={current,obligations,safe,growth};
  const total=Object.values(raw).reduce((a,b)=>a+b,0);
  const normalized={};
  let used=0;
  ["current","obligations","safe"].forEach(id=>{
    const percent=Math.max(5,Math.round(raw[id]/total*100));
    normalized[id]=percent;used+=percent;
  });
  normalized.growth=Math.max(5,100-used);
  const fix=100-Object.values(normalized).reduce((a,b)=>a+b,0);
  normalized.current+=fix;

  return Object.fromEntries(Object.entries(normalized).map(([id,percent])=>[id,{percent,amount:Math.round(amount*percent/100)}]))
}
function showAllocation(a){
  $("allocationTitle").textContent=`پیشنهاد تقسیم ${toman(a.amount)} ${SOURCE_META[a.source]?.name||""} · بر اساس موجودی فعلی`;
  $("allocationRows").innerHTML=["current","obligations","safe","growth"].map(id=>`<div class="allocation-item account-accent-${id}"><div><b><i class="allocation-dot"></i>${ACCOUNT_META[id].name}</b><small>${fa(a.parts[id].percent)}٪</small></div><span>${toman(a.parts[id].amount)}</span></div>`).join("");
  openSheet("allocationSheet")
}
window.confirmAllocation=async()=>{
  const a=pendingAllocation||[...state.allocations].sort((x,y)=>y.at-x.at).find(x=>!x.confirmed);if(!a)return closeSheet("allocationSheet");
  const cur=account("current"),move=a.parts.obligations.amount+a.parts.safe.amount+a.parts.growth.amount;
  if(cur.balance<move)return toast("موجودی حساب جاری برای تأیید این تقسیم کافی نیست؛ ابتدا موجودی بانک‌ها را تطبیق بده.");
  await put("accounts",{...cur,balance:cur.balance-move});
  for(const id of ["obligations","safe","growth"])await put("accounts",{...account(id),balance:account(id).balance+a.parts[id].amount});
  await put("incomeAllocations",{...a,confirmed:true,confirmedAt:now()});pendingAllocation=null;await load();renderAll();closeSheet("allocationSheet");toast("تقسیم درآمد با موجودی چهار حساب هماهنگ شد ✓")
};
async function addReel(note){
  const reels=currentCycleReels();if(reels.length>=12)return toast("چرخه ۱۲ ریلزی کامل شده؛ از بخش تنظیمات، چرخه جدید را شروع کن.");
  await put("reels",{id:now(),at:now(),status:"delivered",note,archived:false});await load();renderAll();
  const n=currentCycleReels().length,remain=12-n,wr=weekReels().length,need=Math.max(0,3-wr);
  toast(`ریلز ${fa(n)} از ۱۲ ثبت شد · ${fa(remain)} تا پایان چرخه · ${fa(need)} تا هدف این هفته`)
}
async function quickTransfer(q,amount){
  const map={"جاری":"current","تعهدات":"obligations","ذخیره":"safe","اهداف":"growth"};
  const fromName=Object.keys(map).find(x=>new RegExp(`از\\s+${x}`).test(q)),toName=Object.keys(map).find(x=>new RegExp(`به\\s+${x}`).test(q));
  if(!fromName||!toName)return toast("مبدأ یا مقصد انتقال مشخص نیست.");
  const from=map[fromName],to=map[toName],fromAccount=account(from);if(fromAccount.balance<amount)return toast(`موجودی ${fromName} برای این انتقال کافی نیست.`);
  await put("accounts",{...fromAccount,balance:fromAccount.balance-amount});await put("accounts",{...account(to),balance:account(to).balance+amount});
  await put("transactions",{id:now(),type:"transfer",amount,from,to,note:`${fromName} → ${toName}`,at:now()});await load();renderAll();toast(`${toman(amount)} از ${fromName} به ${toName} منتقل شد ✓`)
}
window.openAccount=id=>{
  editingAccount=id;const a=account(id);
  $("accountSheetTitle").textContent=ACCOUNT_META[id].name;
  $("accountBankInput").value=a.bankName||"";
  $("accountBalanceInput").value=a.balance?(a.balance/1_000_000):"";
  openSheet("accountSheet");setTimeout(()=>$("accountBalanceInput").focus(),120)
};
window.saveAccountBalance=async()=>{
  const raw=$("accountBalanceInput").value.trim();if(!raw)return toast("موجودی واقعی بانک را وارد کن.");
  const amount=parseAmount(raw),bankName=$("accountBankInput").value.trim();
  await put("accounts",{...account(editingAccount),balance:amount,bankName});
  await load();renderAll();closeSheet("accountSheet");toast("موجودی و نام بانک هماهنگ شد ✓")
};

window.openEventSheet=()=>{editingEventId=null;$("eventModeLabel").textContent="برنامه جدید";$("eventSaveBtn").textContent="ثبت در تقویم";$("eventDateText").textContent=pFull(planner.selected);$("eventTitle").value="";$("eventTime").value="10:00";$("eventDuration").value="60";openSheet("eventSheet");setTimeout(()=>$("eventTitle").focus(),120)};
window.editEvent=id=>{const e=state.events.find(x=>x.id===id);if(!e)return;editingEventId=id;const d=new Date(e.startISO);planner.selected=new Date(d);planner.anchor=new Date(d);$("eventModeLabel").textContent="ویرایش برنامه";$("eventSaveBtn").textContent="ذخیره تغییرات";$("eventDateText").textContent=pFull(d);$("eventTitle").value=e.title;$("eventTime").value=`${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;$("eventDuration").value=e.durationMin||60;openSheet("eventSheet")};
window.saveEvent=async()=>{const title=$("eventTitle").value.trim();if(!title)return toast("عنوان را وارد کن.");const [h,m]=($("eventTime").value||"10:00").split(":").map(Number),d=new Date(planner.selected);d.setHours(h,m,0,0);const old=editingEventId?state.events.find(x=>x.id===editingEventId):null;await put("events",{...(old||{}),id:old?.id||now(),title,startISO:d.toISOString(),durationMin:+$("eventDuration").value||60,alertBeforeMin:60,type:old?.type||"event",createdAt:old?.createdAt||now(),updatedAt:now(),defaultThursday:false});editingEventId=null;await load();planner.selected=d;planner.anchor=d;renderAll();closeSheet("eventSheet");toast(old?"تغییرات برنامه ذخیره شد ✓":"در برنامه ثبت شد ✓")};
window.deleteEvent=async id=>{
  const e=state.events.find(x=>x.id===id);if(!e)return;if(!confirm(`«${e.title}» حذف شود؟`))return;
  if(e.recurrenceKey&&e.source==="system-hoorsun"){
    const s=await get("settings","thursdayExceptions"),list=[...new Set([...(s?.value||[]),e.recurrenceKey])];
    await put("settings",{key:"thursdayExceptions",value:list})
  }
  await remove("events",id);await load();renderAll();toast("برنامه حذف شد")
};
window.openTaskSheet=()=>{$("taskTitle").value="";$("taskDateText").textContent=pFull(planner.selected);openSheet("taskSheet");setTimeout(()=>$("taskTitle").focus(),120)};
window.saveTask=async()=>{const rawTitle=$("taskTitle").value.trim();if(!rawTitle)return;const title=normalizeWorkTitle(rawTitle),d=new Date(planner.selected);d.setHours(9,0,0,0);await put("tasks",{id:now(),title,rawTitle,time:pFull(d),dueISO:d.toISOString(),done:false,category:detectTaskCategory(`${rawTitle} ${title}`),createdAt:now()});await load();renderAll();closeSheet("taskSheet");toast(`«${title}» به فهرست کارها اضافه شد ✓`)};
window.toggleTask=async id=>{const t=state.tasks.find(x=>x.id===id);if(!t)return;const category=t.category||detectTaskCategory(t.title);await put("tasks",{...t,category,done:true,doneAt:now()});await load();renderAll();toast(`انجام شد · در دسته «${TASK_CATEGORY_META[category].name}» ثبت شد ✓`)};
window.reopenTask=async id=>{const t=state.tasks.find(x=>x.id===id);if(!t)return;await put("tasks",{...t,done:false,doneAt:null});await load();renderAll();openPlannerTab("tasks");toast("کار دوباره به فهرست باز برگشت")};
window.deleteTask=async id=>{const t=state.tasks.find(x=>x.id===id);if(!t)return;if(!confirm(`«${t.title}» حذف شود؟`))return;await remove("tasks",id);await load();renderAll();toast("کار حذف شد")};
window.openProjectSheet=()=>{$("projectTitle").value="";$("projectValue").value="";openSheet("projectSheet")};
window.saveProject=async()=>{const title=$("projectTitle").value.trim();if(!title)return toast("نام پروژه را وارد کن.");const value=parseAmount($("projectValue").value,"income");await put("projects",{id:now(),title,value,status:"فعال",createdAt:now()});await load();renderAll();closeSheet("projectSheet");toast("پروژه فریلنس ساخته شد ✓")};
window.resetHoorsunCycle=async()=>{
  if(!confirm("چرخه فعلی هورسان آرشیو و چرخه جدید شروع شود؟"))return;
  for(const r of currentCycleReels())await put("reels",{...r,archived:true,archivedAt:now()});
  await put("settings",{key:"hoorsunStage",value:{shoot:false,edit:false,upload:false}});
  await load();renderAll();switchPage("work");openWorkTab("hoorsun");toast("چرخه جدید هورسان شروع شد ✓")
};
function renderSettingsPage(){
  const el=$("settingsTotalBalance");if(el)el.textContent=toman(["current","obligations","safe","growth"].reduce((s,id)=>s+account(id).balance,0));
  hydrateIcons()
}

window.exportData=async()=>{
  const data={exportedAt:new Date().toISOString(),version:"MIA 0.8.6",...state};
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
