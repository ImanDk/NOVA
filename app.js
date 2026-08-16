
import {openDB,all,get,put,putQuiet,remove,snapshotDB,databaseHealth,pruneLogs} from "./db.js?v=130";
import {pFull,pMonthTitle,pDayNum,pParts,pKey,monthCells,addDays,parseFaDigits,parseNaturalEvent,startOfWeek,startOfDay} from "./planner.js?v=130";
import {
  initCloudSync,getCloudSyncStatus,connectGitHub,syncNow,
  restoreFromGitHub,getRecoveryKey,setCloudAutoEnabled,disconnectCloud
} from "./sync.js?v=130";

import {PROFILE_ID,PROFILE_NAME,newId,escapeHtml,actionExpr} from "./core.js?v=130";
import {installActionDelegation} from "./actions.js?v=130";
import {formatMoneyInteger,formatMoneyInputValue,parseFormattedMoney,bindMoneyInputs} from "./money-format.js?v=130";
import {runPureSelfTests} from "./self-test.js?v=130";
import {
  recordExpenseAtomic,recordIncomeAtomic,confirmAllocationAtomic,recordTransferAtomic,reconcileAccountAtomic,
  undoExpenseAtomic,updateExpenseAtomic,updateIncomeAtomic,updateTransactionNoteAtomic,deleteFinancialTransactionAtomic
} from "./finance-store.js?v=130";

const APP_VERSION="1.3.0";


const $=id=>document.getElementById(id);
const fa=n=>new Intl.NumberFormat("fa-IR",{maximumFractionDigits:1}).format(Number(n)||0);
const moneyNumber=n=>formatMoneyInteger(Number(n)||0);
const toman=n=>`${moneyNumber(n)} تومان`;
const esc=escapeHtml;
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
let state={tasks:[],events:[],projects:[],projectTasks:[],transactions:[],accounts:[],reels:[],budgets:[],allocations:[],goals:[],profile:{profileId:PROFILE_ID,userName:PROFILE_NAME},hoorsunStage:{shoot:false,edit:false,upload:false}};
let planner={anchor:new Date(),selected:new Date()};
let amountCategory=null,editingAccount=null,pendingAllocation=null,lastUndo=null,prefillIncomeSource=null,prefillQuickKind=null,editingEventId=null,stageLock=false;
let pendingExpenseDraft=null,editingTransactionId=null,detailedTransactionId=null;
let pendingQuickInterpretation=null,confirmResolver=null;
let visibleWorkSources=["hoorsun","hirsa","snapp","freelance"];
let appHealth={ok:true,lastCheck:0,issues:[]};
let lastRenderFailures=0;
let appInitialized=false;


async function recordAppError(source,error,extra={}){
  try{
    const message=error?.message||String(error||"Unknown error");
    await putQuiet("logs",{
      id:newId("log"),
      type:"app-error",
      source,
      message,
      stack:String(error?.stack||"").slice(0,6000),
      at:Date.now(),
      version:APP_VERSION,
      ...extra
    });
    await pruneLogs().catch(()=>{})
  }catch(_){}
}

function showHealthBanner(title,message){
  const bar=$("appHealthBanner");if(!bar)return;
  $("appHealthTitle").textContent=title;
  $("appHealthMessage").textContent=message;
  bar.hidden=false
}
function hideHealthBanner(){
  const bar=$("appHealthBanner");if(bar)bar.hidden=true
}
window.retryAppStart=()=>location.reload();

function safeRender(name,fn){
  try{
    fn();
    return true
  }catch(err){
    console.error(`[MIA:${name}]`,err);
    recordAppError(`render:${name}`,err);
    return false
  }
}

function installGlobalErrorCapture(){
  window.addEventListener("error",event=>{
    recordAppError("window.error",event.error||event.message||"Unknown window error");
  });
  window.addEventListener("unhandledrejection",event=>{
    recordAppError("unhandledrejection",event.reason||"Unhandled promise rejection");
  });
}

async function init(){
  installGlobalErrorCapture();
  installActionDelegation();

  await openDB();
  await seed();
  await load();

  try{
    await ensureDefaultThursdays();
    await load();
  }catch(err){
    console.warn("Default Thursday generation skipped",err);
    recordAppError("ensureDefaultThursdays",err);
  }

  $("todayLabel").textContent=`دستیار مالی و کاری · ${PROFILE_NAME}`;
  renderAll();
  installInteractionGuards();
  bindMoneyInputs(document);
  wireMode();

  try{
    await initCloudSync();
  }catch(err){
    console.warn("Cloud sync initialization failed",err);
    recordAppError("cloud:init",err);
  }

  appInitialized=true;
  $("dbStatus").textContent=`MIA v${APP_VERSION} آماده است`;

  await runHealthCheck(false);
}

async function migrateProfileOwnership(){
  const stores=[
    "tasks","events","parking","memory","chat","projects","projectTasks",
    "transactions","accounts","reels","budgets","incomeAllocations",
    "financialGoals","workLogs"
  ];

  for(const store of stores){
    try{
      const rows=await all(store);
      for(const row of rows){
        if(row && typeof row==="object" && !row.profileId){
          await putQuiet(store,{...row,profileId:PROFILE_ID})
        }
      }
    }catch(err){
      recordAppError(`profile-migration:${store}`,err)
    }
  }
}

async function seed(){
  for(const [id,m] of Object.entries(ACCOUNT_META)){
    const x=await get("accounts",id);
    if(!x)await put("accounts",{id,balance:0,bankName:"",...m})
  }

  for(const [id,name,icon,limit] of EXPENSE_CATS){
    const x=await get("budgets",id);
    if(!x)await put("budgets",{id,name,icon,monthlyLimit:limit})
  }

  const defaultGoals=[
    {id:"safe30",name:"ذخیره امن",target:30_000_000,accountId:"safe"},
    {id:"carUpgrade",name:"ارتقای خودرو",target:450_000_000,accountId:"growth"},
  ];
  for(const g of defaultGoals){
    const x=await get("financialGoals",g.id);
    if(!x)await put("financialGoals",g)
  }

  const defaults={
    key:"profile",
    profileId:PROFILE_ID,
    userName:PROFILE_NAME,
    displayName:PROFILE_NAME,
    localName:"ایمان",
    hoorsunTarget:12,
    weeklyReelTarget:3,
    hoorsunCyclePay:25_000_000,
    hirsaSalary:25_000_000,
    safeTarget:30_000_000,
    payday:29
  };
  const existing=await get("settings","profile");
  const merged={...defaults,...(existing||{}),key:"profile",profileId:PROFILE_ID,userName:PROFILE_NAME,displayName:PROFILE_NAME};
  if(!existing || existing.userName!==PROFILE_NAME || existing.profileId!==PROFILE_ID){
    await put("settings",merged)
  }

  await migrateProfileOwnership();

  const hs=await get("settings","hoorsunStage");
  if(!hs)await put("settings",{key:"hoorsunStage",value:{shoot:false,edit:false,upload:false}});

  const ex=await get("settings","thursdayExceptions");
  if(!ex)await put("settings",{key:"thursdayExceptions",value:[]});

  const vw=await get("settings","visibleWorkSources");
  if(!vw)await put("settings",{key:"visibleWorkSources",value:["hoorsun","hirsa","snapp","freelance"]})
}

async function load(){
  const names=["tasks","events","projects","projectTasks","transactions","accounts","reels","budgets","incomeAllocations","financialGoals"];
  const vals=await Promise.all(names.map(all));
  const safe=vals.map(v=>Array.isArray(v)?v:[]);

  [state.tasks,state.events,state.projects,state.projectTasks,state.transactions,state.accounts,state.reels,state.budgets,state.allocations,state.goals]=safe;

  const hs=await get("settings","hoorsunStage");
  state.hoorsunStage=hs?.value&&typeof hs.value==="object"
    ?hs.value
    :{shoot:false,edit:false,upload:false};

  const profile=await get("settings","profile");
  state.profile={profileId:PROFILE_ID,userName:PROFILE_NAME,...(profile||{})};

  const visible=await get("settings","visibleWorkSources");
  visibleWorkSources=Array.isArray(visible?.value)&&visible.value.length?visible.value:["hoorsun","hirsa","snapp","freelance"];
}

function renderAll(){
  const results=[
    safeRender("home",renderHome),
    safeRender("finance",renderFinance),
    safeRender("work",renderWork),
    safeRender("planner",renderPlanner),
    safeRender("tasks",renderTasks),
    safeRender("projects",renderProjects),
    safeRender("settings",renderSettingsPage),
    safeRender("notifications",renderNotificationBadge),
    safeRender("icons",hydrateIcons)
  ];
  lastRenderFailures=results.filter(x=>!x).length;
  if(lastRenderFailures){
    showHealthBanner("بخشی از MIA با خطا اجرا شد",`${fa(lastRenderFailures)} بخش ایزوله شد؛ اطلاعات ذخیره‌شده حذف نشده‌اند.`);
  }
  bindMoneyInputs(document);
  return lastRenderFailures
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
function renderHome(){
  const curr=account("current").balance;
  const reels=currentCycleReels(),wr=weekReels(),reelPct=Math.min(100,reels.length/12*100);
  const open=state.tasks.filter(t=>!t.done&&isSameDay(taskDate(t),new Date())).sort((a,b)=>taskDate(a)-taskDate(b));
  const totalAccounts=["current","obligations","safe","growth"].reduce((s,id)=>s+account(id).balance,0);

  $("homeAccounts").innerHTML=`<button class="home-balance-summary" data-action="switchPage('finance')"><div><span>کل دارایی</span><strong>${toman(totalAccounts)}</strong></div><span class="quick-arrow" data-icon="chevron-left"></span></button>`+["current","obligations","safe","growth"].map(id=>{
    const a=account(id),m=ACCOUNT_META[id],pct=totalAccounts?Math.round(a.balance/totalAccounts*100):0;
    return `<button class="home-account-line account-${id}" data-action="${actionExpr('openAccount',id)}"><span class="account-line-dot"></span><b>${m.name}</b><strong>${toman(a.balance)}</strong><small>${fa(pct)}٪</small></button>`
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
  if($("financeTotalBalance"))$("financeTotalBalance").textContent=toman(totalBalance);
  $("financeAccounts").innerHTML=["current","obligations","safe","growth"].map(id=>{
    const a=account(id),m=ACCOUNT_META[id],pct=totalBalance?Math.round(a.balance/totalBalance*100):0;
    return `<button class="money-card ${m.cls} account-${id}" data-action="${actionExpr('openAccount',id)}"><div class="money-icon" data-icon="${m.icon}"></div><b>${m.name}</b><strong>${toman(a.balance)}</strong><div class="money-card-pct">${fa(pct)}٪</div><div class="mini-progress"><i style="width:${pct}%"></i></div><small>${esc(a.bankName||m.desc)}</small></button>`
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
  const pending=[...state.allocations].filter(x=>!x.confirmed).sort((x,y)=>y.at-x.at)[0];
  const wrap=$("allocationAttentionWrap");
  if(wrap)wrap.hidden=!pending;
  if(!pending){if($("lastAllocation"))$("lastAllocation").innerHTML="";return}
  const a=pending;
  const rows=["current","obligations","safe","growth"].map(id=>{
    const x=a.parts?.[id]||{percent:0,amount:0};return `<div class="allocation-item account-accent-${id}"><div><b><i class="allocation-dot"></i>${ACCOUNT_META[id].name}</b><small>${fa(x.percent)}٪ پیشنهاد</small></div><span>${toman(x.amount)}</span></div>`
  }).join("");
  $("lastAllocation").innerHTML=`<div class="attention-copy"><b>${SOURCE_META[a.source]?.name||"درآمد"} · ${toman(a.amount)}</b><small>این درآمد هنوز بین حساب‌ها تقسیم نشده است.</small></div>${rows}<button class="primary big allocation-review-btn" data-action="${actionExpr('openAllocationById',a.id)}">بررسی و تقسیم</button>`;
}
function renderGoals(){
  $("goalsList").innerHTML=state.goals.map(g=>{
    const bal=account(g.accountId).balance,pct=Math.min(100,Math.round(bal/g.target*100));
    return `<div class="goal-card"><div class="goal-top"><b>${esc(g.name)}</b><span>${fa(pct)}٪</span></div><small>${toman(bal)} از ${toman(g.target)}</small><div class="bar"><i style="width:${pct}%"></i></div></div>`
  }).join("")
}
function renderExpenses(){
  $("expenseQuickGrid").innerHTML=EXPENSE_CATS.slice(0,9).map(([id,name,icon])=>`<button class="expense-cat" data-action="${actionExpr('openAmount',id)}"><i data-icon="${icon}"></i><span>${name}</span></button>`).join("");
  const tx=monthTx("expense").sort((a,b)=>b.at-a.at);
  $("expenseList").innerHTML=tx.length?tx.slice(0,30).map(txRow).join(""):empty("هنوز هزینه‌ای ثبت نشده.")
}
function renderIncome(){
  const sources=["hirsa","hoorsun","snapp","freelance"],total=sum(sources,s=>sourceIncome(s));
  $("incomeSourceCards").innerHTML=sources.map(s=>{
    const value=sourceIncome(s),pct=total?Math.round(value/total*100):0;
    return `<button class="source-card source-${s}" data-action="${actionExpr('openQuick','income',s)}"><div class="source-card-top"><b>${SOURCE_META[s].name}</b><span>${fa(pct)}٪</span></div><strong>${toman(value)}</strong><div class="source-progress"><i style="width:${pct}%;background:${SOURCE_META[s].color}"></i></div><small>از درآمد دریافت‌شده این ماه</small></button>`
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
  const status=t.type==="income"&&t.allocationStatus!=="confirmed"?" · تقسیم‌نشده":"";
  return `<button class="tx-row tx-row-button" data-action="${actionExpr('openTransactionDetail',t.id)}"><div class="tx-icon" data-icon="${t.type==="income"?"arrow-up":"arrow-down"}"></div><div class="tx-copy"><b>${esc(t.note||name)}</b><small>${name}${status} · ${pFull(new Date(t.at))}</small></div><span class="tx-amount ${t.type}">${t.type==="income"?"+":"−"}${toman(t.amount)}</span><span class="tx-chevron" data-icon="chevron-left"></span></button>`
}
function renderWork(){
  applyWorkSourceVisibility();
  const reels=currentCycleReels(),wr=weekReels(),pct=Math.min(100,reels.length/12*100),value=reels.length*(25_000_000/12);
  if($("reelRing"))$("reelRing").style.background=`conic-gradient(var(--green) 0 ${pct}%,rgba(255,255,255,.06) ${pct}% 100%)`;
  if($("reelCycleBar"))$("reelCycleBar").style.width=`${pct}%`;
  $("reelRingText").textContent=`${fa(reels.length)}/۱۲`;
  $("reelValue").textContent=`${toman(value)} ارزش کار تکمیل‌شده`;
  $("weekReels").textContent=`${fa(wr.length)} / ۳`;
  $("cycleRemain").textContent=fa(Math.max(0,12-reels.length));
  const need=Math.max(0,3-wr.length);
  $("reelPlanText").textContent=need?`برای هدف هفتگی ${fa(need)} ریلز دیگر لازم است.`:"هدف این هفته تکمیل شده ✓";
  const stage=state.hoorsunStage||{shoot:false,edit:false,upload:false};
  const doneStages=["shoot","edit","upload"].filter(k=>stage[k]).length;
  if($("stageProgressText"))$("stageProgressText").textContent=`${fa(doneStages)} از ۳ مرحله`;
  [["shoot","stageShoot"],["edit","stageEdit"],["upload","stageUpload"]].forEach(([k,id])=>$(id)?.classList.toggle("done",!!stage[k]));
  document.querySelectorAll("[data-stage-mini]").forEach(el=>el.classList.toggle("done",!!stage[el.dataset.stageMini]));

  const nextStage=!stage.shoot?"shoot":!stage.edit?"edit":!stage.upload?"upload":"upload";
  const nextMeta={shoot:{title:`فیلم‌برداری ریلز ${fa(reels.length+1)}`,help:"ویدیوهای این هفته را ضبط کن.",icon:"camera"},edit:{title:`تدوین ریلز ${fa(reels.length+1)}`,help:"ویدیوهای ضبط‌شده را تدوین کن.",icon:"scissors"},upload:{title:`بارگذاری ریلز ${fa(reels.length+1)}`,help:"نسخه نهایی را منتشر یا تحویل کن.",icon:"upload"}}[nextStage];
  $("nextStageTitle").textContent=nextMeta.title;$("nextStageHelp").textContent=nextMeta.help;$("nextStageIcon").dataset.icon=nextMeta.icon;$("nextStageIcon").dataset.iconReady="";
  const nextBtn=$("nextStageButton");
  nextBtn.dataset.nextStage=nextStage;
  nextBtn.textContent=currentCycleReels().length>=12?"چرخه کامل شده":"انجام شد";
  nextBtn.disabled=currentCycleReels().length>=12;

  $("reelsList").innerHTML=reels.length?reels.slice().reverse().map((r,i)=>`<div class="list-row reel-history-row"><span class="row-icon" data-icon="check"></span><div><b>ریلز ${fa(reels.length-i)} هورسان</b><small>${pFull(new Date(r.at))}</small></div><span class="status-pill">تکمیل</span></div>`).join(""):empty("برای ثبت اولین ریلز، اقدام بعدی را انجام بده.");
  const sn=monthTx("income").filter(t=>t.source==="snapp");$("snappMonth").innerHTML=`<div class="allocation-item"><div><b>درآمد ثبت‌شده</b><small>${fa(sn.length)} ثبت</small></div><span>${toman(sum(sn,x=>x.amount))}</span></div>`;

  const hirsaDone=state.tasks.filter(t=>t.done&&taskCategory(t)==="hirsa").sort((a,b)=>(b.doneAt||b.createdAt||0)-(a.doneAt||a.createdAt||0));
  const hirsaMonthDone=hirsaDone.filter(t=>samePersianMonth(new Date(t.doneAt||t.createdAt),new Date()));
  if($("hirsaDoneCount"))$("hirsaDoneCount").textContent=fa(hirsaDone.length);
  if($("hirsaDoneMonthCount"))$("hirsaDoneMonthCount").textContent=`${fa(hirsaMonthDone.length)} مورد`;
  if($("hirsaDoneList"))$("hirsaDoneList").innerHTML=hirsaDone.length?hirsaDone.slice(0,5).map(hirsaWorkDoneRow).join(""):empty("هنوز کار انجام‌شده‌ای برای هیرسا ثبت نشده.");
  hydrateIcons();
}
window.completeNextHoorsunStage=()=>{
  const stage=$("nextStageButton")?.dataset.nextStage||"shoot";
  return window.toggleReelStage(stage)
};

function applyWorkSourceVisibility(){
  const sel=$("workSourceSelect");if(!sel)return;
  const current=sel.value,labels={hoorsun:"هورسان",hirsa:"هیرسا",snapp:"اسنپ",freelance:"فریلنس"};
  sel.innerHTML=visibleWorkSources.map(id=>`<option value="${id}">${labels[id]}</option>`).join("");
  const next=visibleWorkSources.includes(current)?current:(visibleWorkSources[0]||"hoorsun");sel.value=next;
  document.querySelectorAll(".work-pane").forEach(p=>p.classList.toggle("active",p.id===`work-${next}`));
}
window.toggleWorkSourceVisibility=async source=>{
  const checked=document.querySelector(`[data-work-visible="${source}"]`)?.checked;
  let next=checked?[...new Set([...visibleWorkSources,source])]:visibleWorkSources.filter(x=>x!==source);
  if(!next.length){
    toast("حداقل یک حوزه کاری باید فعال بماند.");
    const box=document.querySelector(`[data-work-visible="${source}"]`);if(box)box.checked=true;return
  }
  visibleWorkSources=next;await put("settings",{key:"visibleWorkSources",value:next});applyWorkSourceVisibility();renderSettingsPage();
};
function renderProjects(){
  $("projectsList").innerHTML=state.projects.length?state.projects.slice().reverse().map(p=>`<div class="project-card"><b>${esc(p.title)}</b><small>${p.value?toman(p.value):"بدون مبلغ"} · ${esc(p.status||"فعال")}</small></div>`).join(""):empty("فعلاً پروژه فریلنس فعالی ثبت نشده.")
}

function localDateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
async function ensureDefaultThursdays(){
  const ex=(await get("settings","thursdayExceptions"))?.value||[],today=new Date();today.setHours(10,0,0,0);
  for(let i=0;i<84;i++){const d=addDays(today,i);if(d.getDay()!==4)continue;const key=localDateKey(d);if(ex.includes(key))continue;if(!state.events.some(e=>e.recurrenceKey===key))await put("events",{id:newId("event"),title:"فیلم‌برداری هورسان",startISO:d.toISOString(),durationMin:180,alertBeforeMin:60,type:"work",source:"system-hoorsun",defaultThursday:true,recurrenceKey:key,createdAt:now()})}
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

  if(!(next.shoot&&next.edit&&next.upload)){
    const labels={shoot:"فیلم‌برداری",edit:"تدوین",upload:"بارگذاری"};
    toast(`${labels[stage]} ثبت شد ✓`,"برگرداندن",async()=>{
      const rollback=stage==="shoot"?{shoot:false,edit:false,upload:false}:stage==="edit"?{shoot:true,edit:false,upload:false}:{shoot:true,edit:true,upload:false};
      await persistHoorsunStage(rollback);toast("مرحله به حالت قبل برگشت")
    });
  }

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
  return window.toggleReelStage(stage)
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
  await put("tasks",{id:newId("task"),title,time:"انجام‌شده",dueISO:new Date(ts).toISOString(),done:true,doneAt:ts,category,createdAt:ts,completedVia:"quick",rawTitle});
  await load();renderAll();openPlannerTab("done");
  toast(`«${title}» در ${TASK_CATEGORY_META[category].name} ثبت شد ✓`)
}

function taskDate(t){return t.dueISO?new Date(t.dueISO):new Date(t.createdAt||now())}
function tasksForDate(d,includeDone=true){return state.tasks.filter(t=>(includeDone||!t.done)&&isSameDay(taskDate(t),d))}
function samePersianMonth(a,b){const x=pParts(a),y=pParts(b);return x.year===y.year&&x.month===y.month}
function monthLabel(d){return new Intl.DateTimeFormat("fa-IR-u-ca-persian",{month:"long",year:"numeric"}).format(d)}


function hirsaWorkDoneRow(t){
  const d=new Date(t.doneAt||t.createdAt);
  return `<article class="hirsa-done-row">
    <span class="hirsa-done-row-icon" data-icon="check"></span>
    <div>
      <b>${esc(t.title)}</b>
      <small>${pFull(d)} · ${new Intl.DateTimeFormat("fa-IR",{hour:"2-digit",minute:"2-digit"}).format(d)}</small>
    </div>
    <span class="hirsa-done-status">انجام شد</span>
  </article>`
}
window.openHirsaDone=()=>{
  doneCategoryFilter="hirsa";
  switchPage("planner");
  openPlannerTab("done");
  renderTasks();
};

function renderPlanner(){
  $("monthTitle").textContent=pMonthTitle(planner.anchor);$("selectedDate").textContent=pFull(planner.selected);
  const {cells}=monthCells(planner.anchor),ap=pParts(planner.anchor),today=new Date();
  $("monthGrid").innerHTML=cells.map(d=>{const pp=pParts(d),inside=pp.month===ap.month&&pp.year===ap.year,evCount=eventsFor(d).length,taskCount=tasksForDate(d,true).length,has=evCount+taskCount>0,key=localDateKey(d);return `<button class="day-cell ${inside?"":"muted"} ${isSameDay(d,today)?"today":""} ${isSameDay(d,planner.selected)?"selected":""}" data-day-key="${key}" data-action="${actionExpr('handleDayClick',d.toISOString(),key)}"><span>${pDayNum(d)}</span>${has?`<i class="day-indicator ${taskCount&&evCount?"mixed":taskCount?"task":"event"}"></i>`:""}</button>`}).join("");
  renderInlineDayItems();
  hydrateIcons()
}
function eventsFor(d){return state.events.filter(e=>isSameDay(new Date(e.startISO),d)).sort((a,b)=>new Date(a.startISO)-new Date(b.startISO))}
function eventRow(e){const d=new Date(e.startISO);return `<div class="event-row"><div class="event-time">${new Intl.DateTimeFormat("fa-IR",{hour:"2-digit",minute:"2-digit"}).format(d)}</div><div><b>${esc(e.title)}</b><small>${e.defaultThursday?"پیش‌فرض پنجشنبه · ":""}${fa(e.durationMin||60)} دقیقه</small></div><div class="row-actions"><button class="mini-action" data-action="${actionExpr('editEvent',e.id)}"><span data-icon="edit"></span></button><button class="mini-action danger" data-action="${actionExpr('deleteEvent',e.id)}"><span data-icon="trash"></span></button></div></div>`}
function dayTaskRow(t){return `<div class="event-row task-event-row ${t.done?"completed":""}"><div class="event-time"><span data-icon="${t.done?"check":"briefcase"}"></span></div><div><b>${esc(t.title)}</b><small>${t.done?"انجام‌شده":"کار"}</small></div><div class="row-actions">${t.done?`<button class="mini-action" data-action="${actionExpr('reopenTask',t.id)}"><span data-icon="rotate-ccw"></span></button>`:`<button class="mini-action success" data-action="${actionExpr('toggleTask',t.id)}"><span data-icon="check"></span></button>`}<button class="mini-action danger" data-action="${actionExpr('deleteTask',t.id)}"><span data-icon="trash"></span></button></div></div>`}
function renderTasks(){
  const open=state.tasks.filter(t=>!t.done).sort((a,b)=>taskDate(a)-taskDate(b)),done=state.tasks.filter(t=>t.done).sort((a,b)=>(b.doneAt||0)-(a.doneAt||0));
  $("taskList").innerHTML=open.length?open.map(taskRow).join(""):empty("فعلاً کاری در لیست باز نیست.");renderDoneArchive(done);hydrateIcons()
}
function renderDoneArchive(done){
  const current=new Date(),currentDone=done.filter(t=>samePersianMonth(new Date(t.doneAt||t.createdAt),current)),currentOpen=state.tasks.filter(t=>!t.done&&samePersianMonth(taskDate(t),current)),currentEvents=state.events.filter(e=>samePersianMonth(new Date(e.startISO),current)),currentReels=state.reels.filter(r=>samePersianMonth(new Date(r.at),current));
  $("monthlyDoneSummary").innerHTML=`<div class="month-summary panel"><div class="month-summary-head"><div><span>جمع‌بندی ${monthLabel(current)}</span><b>${fa(currentDone.length)} کار انجام‌شده</b></div><span class="summary-check" data-icon="check"></span></div><div class="summary-grid"><div><b>${fa(currentDone.length)}</b><span>انجام‌شده</span></div><div><b>${fa(currentOpen.length)}</b><span>باز</span></div><div><b>${fa(currentEvents.length)}</b><span>رویداد</span></div><div><b>${fa(currentReels.length)}</b><span>ریلز</span></div></div></div>`;

  const cats=["all","hirsa","hoorsun","freelance","personal","other"];
  $("doneFilters").innerHTML=cats.map(id=>{
    const count=id==="all"?done.length:done.filter(t=>taskCategory(t)===id).length;
    const meta=id==="all"?{name:"همه",icon:"check"}:TASK_CATEGORY_META[id];
    return `<button class="done-filter ${doneCategoryFilter===id?"active":""} ${id!=="all"?`cat-${id}`:""}" data-action="${actionExpr('setDoneCategory',id)}"><span data-icon="${meta.icon}"></span><b>${meta.name}</b><small>${fa(count)}</small></button>`
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
    <button class="check-btn" data-action="${actionExpr('toggleTask',t.id)}"><span data-icon="check"></span></button>
    <div class="task-row-copy"><div class="task-row-meta"><span class="task-cat-pill">${m.name}</span><small>${today?"امروز":pFull(d)}</small></div><b>${esc(t.title)}</b></div>
    <button class="mini-action danger" data-action="${actionExpr('deleteTask',t.id)}"><span data-icon="trash"></span></button>
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
      <button class="mini-action" data-action="${actionExpr('reopenTask',t.id)}" aria-label="بازگردانی"><span data-icon="rotate-ccw"></span></button>
      <button class="mini-action danger done-delete-btn" data-action="${actionExpr('deleteCompletedTask',t.id)}" aria-label="حذف کار انجام‌شده"><span data-icon="trash"></span></button>
    </div>
  </article>`
}


function buildMiaNotifications(){
  const items=[],today=new Date(),todayStart=startOfDay(today);

  const overdueTasks=state.tasks
    .filter(t=>!t.done&&startOfDay(taskDate(t))<todayStart)
    .sort((a,b)=>taskDate(a)-taskDate(b));
  if(overdueTasks.length){
    const oldest=overdueTasks[0];
    items.push({
      kind:"overdue",
      icon:"briefcase",
      tone:"red",
      title:`${fa(overdueTasks.length)} کار انجام‌نشده از روزهای قبل`,
      text:overdueTasks.length===1
        ?`${oldest.title} · مربوط به ${pFull(taskDate(oldest))}`
        :overdueTasks.slice(0,2).map(t=>t.title).join(" · ")
    })
  }

  const todayTasks=state.tasks.filter(t=>!t.done&&isSameDay(taskDate(t),today));
  if(todayTasks.length){
    items.push({kind:"tasks",icon:"briefcase",tone:"green",title:`${fa(todayTasks.length)} کار برای امروز`,text:todayTasks.slice(0,2).map(t=>t.title).join(" · ")})
  }

  const upcoming=state.events
    .filter(e=>new Date(e.startISO)>=new Date()&&new Date(e.startISO)<=addDays(new Date(),2))
    .sort((a,b)=>new Date(a.startISO)-new Date(b.startISO));
  if(upcoming.length){
    const e=upcoming[0],d=new Date(e.startISO);
    items.push({kind:"calendar",icon:"calendar",tone:"blue",title:"رویداد نزدیک",text:`${e.title} · ${pFull(d)} ${new Intl.DateTimeFormat("fa-IR",{hour:"2-digit",minute:"2-digit"}).format(d)}`})
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
    ?`<div><b>${fa(items.length)} مورد نیاز به توجه</b><small>بر اساس کارها، رویدادها، مالی و هورسان</small></div><span data-icon="bell"></span>`
    :`<div><b>همه‌چیز مرتب است</b><small>فعلاً مورد فوری برای پیگیری نداری.</small></div><span data-icon="check"></span>`;
  list.innerHTML=items.length?items.map(n=>`<button class="notification-item tone-${n.tone}" data-action="${actionExpr('openNotificationTarget',n.kind)}">
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
  else if(kind==="overdue"){switchPage("planner");openPlannerTab("tasks")}
  else if(kind==="calendar"){switchPage("planner");openPlannerTab("calendar")}
  else if(kind==="work"){switchPage("work");openWorkTab("hoorsun")}
  else if(kind==="finance"){switchPage("finance");openFinanceTab("overview")}
};

const PAGE_ORDER={home:0,finance:1,work:2,planner:3,settingsPage:4};
let pageMotionToken=0;
window.switchPage=id=>{
  const current=document.querySelector(".page.active"),next=$(id);
  if(!next||current===next)return;

  const token=++pageMotionToken;
  const from=PAGE_ORDER[current?.id]??0,to=PAGE_ORDER[id]??from;
  const forward=to>from;

  document.querySelectorAll(".page").forEach(p=>{
    if(p!==current&&p!==next)p.classList.remove("active","page-leaving","page-entering","motion-forward","motion-back");
  });

  if(current){
    current.classList.remove("page-entering","motion-forward","motion-back");
    current.classList.add("page-leaving",forward?"motion-forward":"motion-back");
  }

  next.classList.remove("page-leaving","page-entering","motion-forward","motion-back");
  next.classList.add("active","page-entering",forward?"motion-forward":"motion-back");

  document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.page===id));

  if(id==="finance")renderFinance();
  if(id==="work")renderWork();
  if(id==="planner")renderPlanner();
  if(id==="settingsPage")renderSettingsPage();
  hydrateIcons();

  window.scrollTo({top:0,behavior:"smooth"});

  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    next.classList.remove("page-entering");
  }));

  setTimeout(()=>{
    if(token!==pageMotionToken)return;
    if(current)current.classList.remove("active","page-leaving","motion-forward","motion-back");
    next.classList.remove("motion-forward","motion-back");
  },330);
};
const SUBTAB_MOTION_MS=250;
const SUBTAB_ORDER={
  finance:{overview:0,expenses:1,income:2,budget:3},
  work:{hoorsun:0,hirsa:1,snapp:2,freelance:3}
};
const subtabTokens={finance:0,work:0};

function switchSubPane(group,id){
  const paneClass=group==="finance"?"finance-pane":"work-pane";
  const prefix=group==="finance"?"finance-":"work-";
  const tabSelector=group==="finance"?"#financeTabs button":".work-tabs button";
  const dataKey=group==="finance"?"ftab":"wtab";
  const current=document.querySelector(`.${paneClass}.active`);
  const next=$(prefix+id);
  if(!next||current===next)return;

  const currentId=current?.id?.replace(prefix,"")||id;
  const from=SUBTAB_ORDER[group]?.[currentId]??0;
  const to=SUBTAB_ORDER[group]?.[id]??from;
  const forward=to>from;
  const token=++subtabTokens[group];

  document.querySelectorAll(tabSelector).forEach(b=>{
    const active=b.dataset[dataKey]===id;
    b.classList.toggle("active",active);
    if(active){
      b.classList.remove("tab-pop");
      void b.offsetWidth;
      b.classList.add("tab-pop");
    }
  });

  if(current){
    current.classList.remove("pane-entering","pane-forward","pane-back");
    current.classList.add("pane-leaving",forward?"pane-forward":"pane-back");
  }

  setTimeout(()=>{
    if(token!==subtabTokens[group])return;
    if(current)current.classList.remove("active","pane-leaving","pane-forward","pane-back");

    next.classList.remove("pane-leaving","pane-entering","pane-forward","pane-back");
    next.classList.add("active","pane-entering",forward?"pane-forward":"pane-back");

    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      next.classList.remove("pane-entering");
      hydrateIcons();
    }));

    setTimeout(()=>{
      if(token!==subtabTokens[group])return;
      next.classList.remove("pane-forward","pane-back");
    },SUBTAB_MOTION_MS);
  },85);
}

window.openFinanceTab=id=>switchSubPane("finance",id);
window.openWorkTab=id=>{if(!visibleWorkSources.includes(id))id=visibleWorkSources[0]||"hoorsun";const sel=$("workSourceSelect");if(sel&&sel.value!==id)sel.value=id;switchSubPane("work",id)};

const PLANNER_TAB_ORDER={calendar:0,tasks:1,done:2};
let plannerTabToken=0;

window.openPlannerTab=id=>{
  const current=document.querySelector(".planner-pane.active"),next=$("planner-"+id);
  if(!next||current===next)return;

  const token=++plannerTabToken;
  const currentId=current?.id?.replace("planner-","")||id;
  const from=PLANNER_TAB_ORDER[currentId]??0,to=PLANNER_TAB_ORDER[id]??from;
  const forward=to>from;

  document.querySelectorAll(".planner-main-tabs button").forEach(b=>{
    const active=b.dataset.ptab===id;
    b.classList.toggle("active",active);
    if(active){
      b.classList.remove("tab-pop");
      void b.offsetWidth;
      b.classList.add("tab-pop");
    }
  });

  if(current){
    current.classList.remove("pane-entering","pane-forward","pane-back");
    current.classList.add("pane-leaving",forward?"pane-forward":"pane-back");
  }

  setTimeout(()=>{
    if(token!==plannerTabToken)return;
    if(current)current.classList.remove("active","pane-leaving","pane-forward","pane-back");

    next.classList.remove("pane-leaving","pane-entering","pane-forward","pane-back");
    next.classList.add("active","pane-entering",forward?"pane-forward":"pane-back");

    if(id==="done"||id==="tasks")renderTasks();
    if(id==="calendar")renderPlanner();

    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      next.classList.remove("pane-entering");
      hydrateIcons();
    }));

    setTimeout(()=>{
      if(token!==plannerTabToken)return;
      next.classList.remove("pane-forward","pane-back");
    },260);
  },85);
};

function calendarDayItems(d){
  const events=eventsFor(d);
  const tasks=tasksForDate(d,true).sort((a,b)=>taskDate(a)-taskDate(b));
  return {events,tasks}
}

function renderInlineDayItems(){
  const container=$("dayEvents");
  if(!container)return;

  const {events,tasks}=calendarDayItems(planner.selected);
  const rows=[
    ...events.map(e=>({
      date:new Date(e.startISO),
      html:eventRow(e)
    })),
    ...tasks.map(t=>({
      date:taskDate(t),
      html:dayTaskRow(t)
    }))
  ].sort((a,b)=>a.date-b.date);

  container.classList.remove("day-list-enter");
  container.innerHTML=rows.length
    ?rows.map(x=>x.html).join("")
    :`<div class="calendar-empty-day">
        <span data-icon="calendar"></span>
        <div><b>برای این روز کاری ثبت نشده.</b><small>از دکمه «+ کار» برای اضافه کردن کار استفاده کن.</small></div>
      </div>`;

  void container.offsetWidth;
  container.classList.add("day-list-enter");
  setTimeout(()=>container.classList.remove("day-list-enter"),420);
  hydrateIcons()
}

window.handleDayClick=(iso,key)=>{
  planner.selected=new Date(iso);
  planner.anchor=new Date(iso);

  document.querySelectorAll(".day-cell").forEach(cell=>{
    cell.classList.toggle("selected",cell.dataset.dayKey===key)
  });

  $("selectedDate").textContent=pFull(planner.selected);
  renderInlineDayItems();

  const selected=document.querySelector(`.day-cell[data-day-key="${key}"]`);
  if(selected){
    selected.classList.remove("day-selected-pop");
    void selected.offsetWidth;
    selected.classList.add("day-selected-pop");
  }
};

window.selectDate=iso=>{
  planner.selected=new Date(iso);
  planner.anchor=new Date(iso);
  renderPlanner()
};

window.shiftMonth=dir=>{
  const {start,end}=monthCells(planner.anchor);
  planner.anchor=dir>0?addDays(end,1):addDays(start,-1);
  planner.selected=planner.anchor;
  renderPlanner()
};

window.addTaskForSelectedDay=()=>{
  openTaskSheet()
};

const SHEET_MOTION_MS=300;
let sheetFocusTimer=null;

function focusSheetField(id,delay=SHEET_MOTION_MS-40){
  clearTimeout(sheetFocusTimer);
  sheetFocusTimer=setTimeout(()=>{
    const el=$(id);
    if(!el)return;
    try{el.focus({preventScroll:true})}catch{el.focus()}
  },delay)
}
function openSheet(id){
  const el=$(id);if(!el)return;
  el.classList.remove("closing");
  // Ensures the browser paints the hidden state before transitioning in.
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add("show")));
}
window.closeSheet=id=>{
  const el=$(id);if(!el||!el.classList.contains("show"))return;
  clearTimeout(sheetFocusTimer);
  const active=document.activeElement;
  if(active&&el.contains(active)&&typeof active.blur==="function")active.blur();
  el.classList.add("closing");
  el.classList.remove("show");
  setTimeout(()=>el.classList.remove("closing"),SHEET_MOTION_MS+30);
};
window.closeOverlay=(e,id)=>{if(e.target.id===id)closeSheet(id)};

window.openAmount=category=>{
  const budget=state.budgets.find(x=>x.id===category);
  if(!budget)return toast("دسته هزینه پیدا نشد.");
  amountCategory=category;
  pendingExpenseDraft=null;
  $("amountCategoryTitle").textContent=budget.name;
  if($("expenseAmountStep"))$("expenseAmountStep").textContent=category==="cigarette"?"مرحله ۱ از ۱ · مبلغ":"مرحله ۱ از ۲ · مبلغ";
  $("amountInput").value="";
  openSheet("amountSheet");
  focusSheetField("amountInput");
};
window.saveQuickExpense=async()=>{
  if(!amountCategory)return toast("اول دسته هزینه را انتخاب کن.");
  const raw=$("amountInput").value.trim();
  if(!raw)return toast("مبلغ هزینه را وارد کن.");
  const amount=parseFormattedMoney(raw)||parseAmount(raw,"expense");
  if(!amount||amount<=0)return toast("مبلغ واردشده معتبر نیست.");
  const budget=state.budgets.find(x=>x.id===amountCategory);
  if(amountCategory==="cigarette"){
    const ok=await addExpense(amount,amountCategory,"سیگار");
    if(ok===false)return;
    closeSheet("amountSheet");amountCategory=null;pendingExpenseDraft=null;return
  }
  pendingExpenseDraft={amount,category:amountCategory};
  $("expenseDescriptionTitle").textContent=budget?.name||"هزینه";
  $("expenseDescriptionInput").value="";
  closeSheet("amountSheet");
  setTimeout(()=>{openSheet("expenseDescriptionSheet");focusSheetField("expenseDescriptionInput")},190)
};
window.saveExpenseDescription=async()=>{
  const draft=pendingExpenseDraft;if(!draft)return closeSheet("expenseDescriptionSheet");
  const note=$("expenseDescriptionInput").value.trim();
  if(!note)return toast("برای این هزینه یک شرح کوتاه و دقیق بنویس.");
  const ok=await addExpense(draft.amount,draft.category,note);
  if(ok===false)return;
  pendingExpenseDraft=null;amountCategory=null;closeSheet("expenseDescriptionSheet")
};
window.openSettings=()=>{switchPage("settingsPage");renderSettingsPage()};

window.openQuick=(kind="",source="")=>{
  prefillQuickKind=kind||null;prefillIncomeSource=source||null;$("quickInput").value="";
  if(kind==="income")$("quickInput").placeholder=`مثلاً: ۲۵ میلیون حقوق ${SOURCE_META[source]?.name||"هورسان"} واریز شد`;
  else if(kind==="expense")$("quickInput").placeholder="مثلاً: ۱۴۰ سیگار";
  else $("quickInput").placeholder="مثلاً: فردا سایت مشتری را اصلاح کنم\nیا: سه‌شنبه ساعت ۱۲ جلسه دارم";
  openSheet("quickSheet");focusSheetField("quickInput")
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
function analyzeQuick(raw){
  const q=norm(raw),amount=parseAmount(q,"expense"),dated=parseNaturalEvent(raw);
  if(q.includes("هورسان")&&/فیلم ?برداری|ضبط/.test(q)&&/انجام|زدم|تموم|تمام|تکمیل/.test(q))return{kind:"special",special:"shoot",label:"تکمیل فیلم‌برداری هورسان",raw};
  if(q.includes("هورسان")&&/تدوین|ادیت/.test(q)&&/انجام|زدم|تموم|تمام|تکمیل/.test(q))return{kind:"special",special:"edit",label:"تکمیل تدوین هورسان",raw};
  if(q.includes("هورسان")&&/بارگذاری|آپلود/.test(q)&&/انجام|زدم|تموم|تمام|تکمیل/.test(q))return{kind:"special",special:"upload",label:"تکمیل بارگذاری هورسان",raw};
  if((prefillQuickKind==="income"||isIncomeIntent(q))&&amount)return{kind:"income",amount,source:sourceFrom(q),title:raw,raw};
  if(/از\s+(جاری|تعهدات|ذخیره|اهداف)/.test(q)&&/به\s+(جاری|تعهدات|ذخیره|اهداف)/.test(q)&&amount)return{kind:"special",special:"transfer",amount,label:"انتقال بین حساب‌ها",raw};
  if(amount&&/\d/.test(q))return{kind:"expense",amount,category:categoryFrom(q),title:raw,raw};
  if(isCompletedPhrase(q))return{kind:"special",special:"completed-task",label:`ثبت کار انجام‌شده: ${normalizeWorkTitle(raw)}`,raw};
  if(dated&&isEventIntent(q))return{kind:"event",title:normalizeWorkTitle(dated.title||raw),dated,raw};
  if(dated)return{kind:"task",title:normalizeWorkTitle(dated.title||raw),dated,raw};
  return{kind:"task",title:normalizeWorkTitle(raw),raw};
}
function quickKindLabel(kind){return({income:"درآمد",expense:"هزینه",task:"کار",event:"رویداد",special:"اقدام"})[kind]||"ثبت"}
function renderQuickInterpretation(){
  const x=pendingQuickInterpretation;if(!x)return;
  const isSpecial=x.kind==="special";
  $("quickEditableFields").hidden=isSpecial;
  if(!isSpecial){
    $("quickTypeSelect").value=x.kind;
    const kind=$("quickTypeSelect").value;
    $("quickFinanceFields").hidden=!['income','expense'].includes(kind);
    $("quickTextFields").hidden=!['task','event'].includes(kind);
    $("quickIncomeSourceWrap").hidden=kind!=="income";
    $("quickExpenseCategoryWrap").hidden=kind!=="expense";
    if(['income','expense'].includes(kind))$("quickEditAmount").value=formatMoneyInputValue(String(Math.round(x.amount||0)));
    if(kind==="income")$("quickEditSource").value=x.source||"other";
    if(kind==="expense")$("quickEditCategory").value=x.category||"other";
    if(['task','event'].includes(kind))$("quickEditTitle").value=x.title||normalizeWorkTitle(x.raw);
  }
  let summary='';
  if(isSpecial)summary=`<span>${quickKindLabel(x.kind)}</span><b>${esc(x.label||x.raw)}</b><small>${esc(x.raw)}</small>`;
  else if(x.kind==="income")summary=`<span>درآمد</span><b>${toman(x.amount)} · ${SOURCE_META[x.source]?.name||"سایر"}</b><small>${esc(x.raw)}</small>`;
  else if(x.kind==="expense")summary=`<span>هزینه</span><b>${toman(x.amount)} · ${state.budgets.find(b=>b.id===x.category)?.name||"سایر"}</b><small>${esc(x.raw)}</small>`;
  else summary=`<span>${quickKindLabel(x.kind)}</span><b>${esc(x.title||x.raw)}</b><small>${x.dated?pFull(new Date(x.dated.startISO)):"امروز"}</small>`;
  $("quickUnderstoodSummary").innerHTML=summary;hydrateIcons();bindMoneyInputs($("quickInterpretSheet"));
}
window.refreshQuickInterpretation=()=>{
  if(!pendingQuickInterpretation)return;
  const kind=$("quickTypeSelect").value;pendingQuickInterpretation.kind=kind;
  if(['task','event'].includes(kind)&&!pendingQuickInterpretation.title)pendingQuickInterpretation.title=normalizeWorkTitle(pendingQuickInterpretation.raw);
  renderQuickInterpretation()
};
window.submitQuick=async()=>{
  const raw=$("quickInput").value.trim();if(!raw)return toast("یک مورد بنویس تا بررسی کنم.");
  pendingQuickInterpretation=analyzeQuick(raw);prefillQuickKind=null;
  renderQuickInterpretation();closeSheet("quickSheet");setTimeout(()=>openSheet("quickInterpretSheet"),170)
};
window.backToQuickEntry=()=>{closeSheet("quickInterpretSheet");setTimeout(()=>{openSheet("quickSheet");focusSheetField("quickInput")},170)};
window.confirmQuickInterpretation=async()=>{
  const x=pendingQuickInterpretation;if(!x)return;
  if(x.kind!=="special"){
    x.kind=$("quickTypeSelect").value;
    if(['income','expense'].includes(x.kind))x.amount=Math.round(parseFormattedMoney($("quickEditAmount").value));
    if(x.kind==="income")x.source=$("quickEditSource").value;
    if(x.kind==="expense")x.category=$("quickEditCategory").value;
    if(['task','event'].includes(x.kind))x.title=$("quickEditTitle").value.trim()||normalizeWorkTitle(x.raw);
  }
  if(['income','expense'].includes(x.kind)&&(!x.amount||x.amount<=0))return toast("مبلغ معتبر وارد کن.");
  closeSheet("quickInterpretSheet");
  if(x.kind==="income"){const {amount,source,raw}=x;pendingQuickInterpretation=null;await new Promise(r=>setTimeout(r,170));await addIncome(amount,source,raw);return}
  if(x.kind==="expense"){
    if(x.category==="cigarette"){pendingQuickInterpretation=null;await addExpense(x.amount,x.category,"سیگار");return}
    pendingExpenseDraft={amount:x.amount,category:x.category};amountCategory=x.category;
    $("expenseDescriptionTitle").textContent=state.budgets.find(b=>b.id===x.category)?.name||"هزینه";
    $("expenseDescriptionInput").value=x.raw||"";pendingQuickInterpretation=null;
    setTimeout(()=>{openSheet("expenseDescriptionSheet");focusSheetField("expenseDescriptionInput")},180);return
  }
  if(x.kind==="event"){
    const dated=x.dated||parseNaturalEvent(x.raw);const d=dated?new Date(dated.startISO):new Date();
    const event={id:newId("event"),title:x.title,startISO:d.toISOString(),durationMin:dated?.durationMin||60,alertBeforeMin:60,type:"event",createdAt:now()};
    await put("events",event);await load();renderAll();pendingQuickInterpretation=null;toast("رویداد ثبت شد ✓","مشاهده",()=>{switchPage("planner");openPlannerTab("calendar")});return
  }
  if(x.kind==="task"){
    const dated=x.dated||parseNaturalEvent(x.raw),d=dated?new Date(dated.startISO):new Date();
    await put("tasks",{id:newId("task"),title:x.title,rawTitle:x.raw,time:pFull(d),dueISO:d.toISOString(),done:false,category:detectTaskCategory(`${x.raw} ${x.title}`),createdAt:now()});
    await load();renderAll();pendingQuickInterpretation=null;toast(`«${x.title}» به کارها اضافه شد ✓`);return
  }
  if(x.special==="transfer"){const q=norm(x.raw);pendingQuickInterpretation=null;await quickTransfer(q,x.amount);return}
  if(x.special==="completed-task"){pendingQuickInterpretation=null;await addCompletedTask(x.raw);return}
  if(["shoot","edit","upload"].includes(x.special)){const stage=x.special;pendingQuickInterpretation=null;await setReelStageDone(stage);return}
  pendingQuickInterpretation=null;
};


async function addExpense(amount,category,note){
  try{
    const result=await recordExpenseAtomic({amount,category,note});
    lastUndo={kind:"expense",id:result.id,amount};await load();renderAll();
    const b=state.budgets.find(x=>x.id===category),spent=expenseSpent(category),remain=b?Math.max(0,b.monthlyLimit-spent):0;
    toast(`${toman(amount)} در «${b?.name||"هزینه"}» ثبت شد · ${toman(remain)} از بودجه مانده`,"ویرایش",()=>window.openTransactionDetail(result.id));return true
  }catch(err){toast(err.message||"ثبت هزینه انجام نشد.");return false}
}
async function addIncome(amount,source,note){
  try{
    const parts=buildAllocation(amount);
    const alloc=await recordIncomeAtomic({amount,source,note,parts});
    pendingAllocation=alloc;await load();renderAll();showAllocation(alloc)
  }catch(err){toast(err.message||"ثبت درآمد انجام نشد.")}
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
  pendingAllocation=a;
  $("allocationTitle").textContent=`${SOURCE_META[a.source]?.name||"درآمد"} · ${toman(a.amount)}`;
  $("allocationRows").innerHTML=["current","obligations","safe","growth"].map(id=>{
    const part=a.parts?.[id]||{percent:0,amount:0};
    return `<div class="allocation-edit-row account-accent-${id}"><div class="allocation-edit-label"><b><i class="allocation-dot"></i>${ACCOUNT_META[id].name}</b><small data-allocation-percent="${id}">${fa(part.percent||0)}٪ پیشنهاد</small></div><div class="money-input allocation-money"><input data-allocation-account="${id}" data-money-input="true" inputmode="numeric" value="${formatMoneyInputValue(String(Math.round(part.amount||0)))}"><span>تومان</span></div></div>`
  }).join("");
  bindMoneyInputs($("allocationRows"));
  $("allocationRows").querySelectorAll("[data-allocation-account]").forEach(input=>input.addEventListener("input",updateAllocationSummary));
  updateAllocationSummary();
  openSheet("allocationSheet")
}
function allocationInputParts(){
  const a=pendingAllocation;if(!a)return{};
  const amount=Number(a.amount)||0;
  const parts={};
  ["current","obligations","safe","growth"].forEach(id=>{
    const input=document.querySelector(`[data-allocation-account="${id}"]`),value=Math.max(0,Math.round(parseFormattedMoney(input?.value||"0")));
    parts[id]={amount:value,percent:amount?Math.round(value/amount*100):0}
  });
  return parts
}
function updateAllocationSummary(){
  const a=pendingAllocation;if(!a)return;
  const parts=allocationInputParts(),total=Object.values(parts).reduce((s,x)=>s+x.amount,0),remain=Math.round(Number(a.amount||0)-total);
  Object.entries(parts).forEach(([id,p])=>{const el=document.querySelector(`[data-allocation-percent="${id}"]`);if(el)el.textContent=`${fa(p.percent)}٪`});
  if($("allocationEntered"))$("allocationEntered").textContent=toman(total);
  if($("allocationRemain")){
    $("allocationRemain").textContent=remain===0?"تقسیم کامل":remain>0?`${toman(remain)} تخصیص‌نیافته`:`${toman(Math.abs(remain))} بیشتر از درآمد`;
    $("allocationRemain").classList.toggle("allocation-error",remain<0)
  }
  const btn=$("allocationConfirmBtn");if(btn)btn.disabled=Math.abs(remain)>1
}
window.confirmAllocation=async()=>{
  const a=pendingAllocation||[...state.allocations].sort((x,y)=>y.at-x.at).find(x=>!x.confirmed);if(!a)return closeSheet("allocationSheet");
  try{
    const parts=allocationInputParts();
    const done=await confirmAllocationAtomic(a.id,parts);pendingAllocation=null;await load();renderAll();closeSheet("allocationSheet");toast("بودجه‌بندی در حساب‌ها ثبت شد ✓","جزئیات",()=>window.openTransactionDetail(done.incomeTxId))
  }catch(err){toast(err.message||"ثبت تقسیم درآمد انجام نشد.")}
};
window.deferAllocation=()=>{const txId=pendingAllocation?.incomeTxId;pendingAllocation=null;closeSheet("allocationSheet");toast("درآمد ثبت شد؛ هنوز بین حساب‌ها تقسیم نشده است.",txId?"جزئیات":"",txId?()=>window.openTransactionDetail(txId):null)};
window.openAllocationById=id=>{const a=state.allocations.find(x=>x.id===id);if(!a)return toast("پیشنهاد تقسیم پیدا نشد.");if(a.confirmed)return toast("این تقسیم قبلاً در حساب‌ها ثبت شده است.");showAllocation(a)};

window.openTransactionDetail=id=>{
  const t=state.transactions.find(x=>x.id===id);if(!t||!["income","expense"].includes(t.type))return;
  detailedTransactionId=id;
  const name=t.type==="income"?(SOURCE_META[t.source]?.name||"درآمد"):(state.budgets.find(b=>b.id===t.category)?.name||"هزینه");
  $("transactionDetailType").textContent=t.type==="income"?"واریز":"برداشت";
  $("transactionDetailTitle").textContent=name;
  $("transactionDetailAmount").textContent=`${t.type==="income"?"+":"−"}${toman(t.amount)}`;
  $("transactionDetailAmount").className=`transaction-detail-amount ${t.type}`;
  $("transactionDetailMeta").innerHTML=`<div><span>تاریخ</span><b>${pFull(new Date(t.at))}</b></div><div><span>${t.type==="income"?"منبع":"دسته"}</span><b>${esc(name)}</b></div><div><span>شرح</span><b>${esc(t.note||"—")}</b></div>${t.type==="income"?`<div><span>بودجه‌بندی</span><b>${t.allocationStatus==="confirmed"?"ثبت‌شده در حساب‌ها":"هنوز تقسیم نشده"}</b></div>`:""}`;
  openSheet("transactionDetailSheet");hydrateIcons()
};
window.editDetailedTransaction=()=>{const id=detailedTransactionId;if(!id)return;closeSheet("transactionDetailSheet");setTimeout(()=>window.openTransactionEditor(id),170)};
window.deleteDetailedTransaction=async()=>{
  const id=detailedTransactionId,t=state.transactions.find(x=>x.id===id);if(!t)return;
  const ok=await askConfirm(t.type==="income"?"حذف واریز؟":"حذف برداشت؟",`${toman(t.amount)} حذف می‌شود و موجودی حساب‌های مرتبط هم اصلاح خواهد شد.`,"حذف");if(!ok)return;
  try{await deleteFinancialTransactionAtomic(t.id);detailedTransactionId=null;await load();renderAll();closeSheet("transactionDetailSheet");toast("تراکنش حذف شد و موجودی‌ها اصلاح شدند ✓")}
  catch(err){toast(err.message||"حذف تراکنش انجام نشد.")}
};

window.openTransactionEditor=id=>{
  const t=state.transactions.find(x=>x.id===id);if(!t||!["income","expense"].includes(t.type))return toast("این مورد قابل ویرایش نیست.");
  editingTransactionId=id;
  $("transactionEditAccent").textContent=t.type==="income"?"ویرایش واریز":"ویرایش برداشت";
  $("transactionEditTitle").textContent=t.type==="income"?(SOURCE_META[t.source]?.name||"درآمد"):(state.budgets.find(b=>b.id===t.category)?.name||"هزینه");
  $("transactionEditAmount").value=formatMoneyInputValue(String(Math.round(t.amount||0)));
  $("transactionEditNote").value=t.note||"";
  $("transactionSourceField").hidden=t.type!=="income";
  $("transactionCategoryField").hidden=t.type!=="expense";
  $("transactionEditSource").value=t.source||"other";
  $("transactionEditCategory").value=t.category||"other";
  openSheet("transactionEditSheet");bindMoneyInputs($("transactionEditSheet"));focusSheetField("transactionEditNote")
};
window.saveTransactionEdit=async()=>{
  const t=state.transactions.find(x=>x.id===editingTransactionId);if(!t)return closeSheet("transactionEditSheet");
  const amount=Math.round(parseFormattedMoney($("transactionEditAmount").value));
  if(amount<=0)return toast("مبلغ معتبر وارد کن.");
  const note=$("transactionEditNote").value.trim();
  if(t.type==="expense"&&t.category!=="cigarette"&&!note)return toast("برای این هزینه شرح را وارد کن.");
  try{
    if(t.type==="expense"){
      const category=$("transactionEditCategory").value||t.category;
      await updateExpenseAtomic({txId:t.id,amount,category,note:note||"سیگار"});
      await load();renderAll();closeSheet("transactionEditSheet");editingTransactionId=null;toast("هزینه و موجودی حساب اصلاح شد ✓");return
    }
    const source=$("transactionEditSource").value||t.source||"other";
    if(amount===Math.round(Number(t.amount||0))){
      await updateTransactionNoteAtomic({txId:t.id,note,source});
      await load();renderAll();closeSheet("transactionEditSheet");editingTransactionId=null;toast("اطلاعات واریز ویرایش شد ✓");return
    }
    const parts=buildAllocation(amount);
    const allocation=await updateIncomeAtomic({txId:t.id,amount,source,note,parts});
    await load();renderAll();closeSheet("transactionEditSheet");editingTransactionId=null;
    setTimeout(()=>showAllocation(allocation),190)
  }catch(err){toast(err.message||"ویرایش تراکنش انجام نشد.")}
};
window.deleteEditingTransaction=async()=>{
  const t=state.transactions.find(x=>x.id===editingTransactionId);if(!t)return;
  const label=t.type==="income"?"این واریز":"این برداشت";
  if(!(await askConfirm("حذف تراکنش؟",`${label} حذف می‌شود و موجودی حساب‌های مرتبط هم اصلاح خواهد شد.`,"حذف")))return;
  try{
    await deleteFinancialTransactionAtomic(t.id);editingTransactionId=null;await load();renderAll();closeSheet("transactionEditSheet");toast("تراکنش حذف و موجودی‌ها اصلاح شد ✓")
  }catch(err){toast(err.message||"حذف تراکنش انجام نشد.")}
};
window.resetAccountBalance=async()=>{
  if(!editingAccount)return;
  const meta=ACCOUNT_META[editingAccount];
  if(!(await askConfirm("صفر کردن موجودی؟",`موجودی «${meta?.name||"این حساب"}» صفر می‌شود؛ خود حساب و تاریخچه حذف نمی‌شوند.`,"صفر کردن")))return;
  try{await reconcileAccountAtomic({accountId:editingAccount,balance:0,bankName:$("accountBankInput").value.trim(),note:"صفر کردن دستی موجودی"});await load();renderAll();closeSheet("accountSheet");toast("موجودی حساب صفر شد ✓")}
  catch(err){toast(err.message||"صفر کردن موجودی انجام نشد.")}
};

async function addReel(note){
  const reels=currentCycleReels();if(reels.length>=12)return toast("چرخه ۱۲ ریلزی کامل شده؛ از «گزارش هورسان» چرخه جدید را شروع کن.");
  await put("reels",{id:newId("reel"),at:now(),status:"delivered",note,archived:false});await load();renderAll();
  const n=currentCycleReels().length,remain=12-n,wr=weekReels().length,need=Math.max(0,3-wr);
  toast(`ریلز ${fa(n)} از ۱۲ ثبت شد · ${fa(remain)} تا پایان چرخه · ${fa(need)} تا هدف این هفته`)
}
async function quickTransfer(q,amount){
  const map={"جاری":"current","تعهدات":"obligations","ذخیره":"safe","اهداف":"growth"};
  const fromName=Object.keys(map).find(x=>new RegExp(`از\\s+${x}`).test(q)),toName=Object.keys(map).find(x=>new RegExp(`به\\s+${x}`).test(q));
  if(!fromName||!toName)return toast("مبدأ یا مقصد انتقال مشخص نیست.");
  const from=map[fromName],to=map[toName];
  try{await recordTransferAtomic({from,to,amount,note:`${fromName} → ${toName}`});await load();renderAll();toast(`${toman(amount)} از ${fromName} به ${toName} منتقل شد ✓`)}
  catch(err){toast(err.message||"انتقال انجام نشد.")}
}
window.openAccount=id=>{
  editingAccount=id;const a=account(id);
  $("accountSheetTitle").textContent=ACCOUNT_META[id].name;
  $("accountBankInput").value=a.bankName||"";
  $("accountBalanceInput").value=a.balance?formatMoneyInputValue(String(Math.round(a.balance))):"";
  openSheet("accountSheet");focusSheetField("accountBalanceInput")
};
window.saveAccountBalance=async()=>{
  const raw=$("accountBalanceInput").value.trim();if(!raw)return toast("موجودی واقعی بانک را وارد کن.");
  const amount=parseAmount(raw),bankName=$("accountBankInput").value.trim();
  try{await reconcileAccountAtomic({accountId:editingAccount,balance:amount,bankName});await load();renderAll();closeSheet("accountSheet");toast("موجودی بانک تطبیق شد؛ این اصلاح درآمد یا هزینه محسوب نشد ✓")}
  catch(err){toast(err.message||"تطبیق موجودی انجام نشد.")}
};

window.openEventSheet=()=>{editingEventId=null;$("eventModeLabel").textContent="رویداد جدید";$("eventSaveBtn").textContent="ثبت رویداد";$("eventDateText").textContent=pFull(planner.selected);$("eventTitle").value="";$("eventTime").value="10:00";$("eventDuration").value="60";openSheet("eventSheet");focusSheetField("eventTitle")};
window.editEvent=id=>{const e=state.events.find(x=>x.id===id);if(!e)return;editingEventId=id;const d=new Date(e.startISO);planner.selected=new Date(d);planner.anchor=new Date(d);$("eventModeLabel").textContent="ویرایش رویداد";$("eventSaveBtn").textContent="ذخیره تغییرات";$("eventDateText").textContent=pFull(d);$("eventTitle").value=e.title;$("eventTime").value=`${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;$("eventDuration").value=e.durationMin||60;openSheet("eventSheet")};
window.saveEvent=async()=>{const title=$("eventTitle").value.trim();if(!title)return toast("عنوان را وارد کن.");const [h,m]=($("eventTime").value||"10:00").split(":").map(Number),d=new Date(planner.selected);d.setHours(h,m,0,0);const old=editingEventId?state.events.find(x=>x.id===editingEventId):null;await put("events",{...(old||{}),id:old?.id||newId("event"),title,startISO:d.toISOString(),durationMin:+$("eventDuration").value||60,alertBeforeMin:60,type:old?.type||"event",createdAt:old?.createdAt||now(),updatedAt:now(),defaultThursday:false});editingEventId=null;await load();planner.selected=d;planner.anchor=d;renderAll();closeSheet("eventSheet");toast(old?"تغییرات رویداد ذخیره شد ✓":"رویداد ثبت شد ✓")};
window.deleteEvent=async id=>{
  const e=state.events.find(x=>x.id===id);if(!e)return;if(!(await askConfirm("حذف رویداد؟",`«${e.title}» از تقویم حذف می‌شود.`,"حذف")))return;
  if(e.recurrenceKey&&e.source==="system-hoorsun"){
    const s=await get("settings","thursdayExceptions"),list=[...new Set([...(s?.value||[]),e.recurrenceKey])];
    await put("settings",{key:"thursdayExceptions",value:list})
  }
  await remove("events",id);await load();renderAll();toast("رویداد حذف شد")
};
window.openTaskSheet=()=>{$("taskTitle").value="";$("taskDateText").textContent=pFull(planner.selected);openSheet("taskSheet");focusSheetField("taskTitle")};
window.saveTask=async()=>{
  const rawTitle=$("taskTitle").value.trim();if(!rawTitle)return;
  const title=normalizeWorkTitle(rawTitle),d=new Date(planner.selected);d.setHours(9,0,0,0);
  await put("tasks",{id:newId("task"),title,rawTitle,time:pFull(d),dueISO:d.toISOString(),done:false,category:detectTaskCategory(`${rawTitle} ${title}`),createdAt:now()});
  await load();renderAll();closeSheet("taskSheet");renderInlineDayItems();
  toast(`«${title}» به کارهای ${pFull(d)} اضافه شد ✓`)
};
window.toggleTask=async id=>{const t=state.tasks.find(x=>x.id===id);if(!t)return;const category=t.category||detectTaskCategory(t.title);await put("tasks",{...t,category,done:true,doneAt:now()});await load();renderAll();toast(`انجام شد · در دسته «${TASK_CATEGORY_META[category].name}» ثبت شد ✓`)};
window.reopenTask=async id=>{const t=state.tasks.find(x=>x.id===id);if(!t)return;await put("tasks",{...t,done:false,doneAt:null});await load();renderAll();openPlannerTab("tasks");toast("کار دوباره به فهرست باز برگشت")};
window.deleteCompletedTask=async id=>{
  const t=state.tasks.find(x=>x.id===id);if(!t)return;
  if(!t.done)return deleteTask(id);
  if(!(await askConfirm("حذف کار انجام‌شده؟",`«${t.title}» از آرشیو انجام‌شده‌ها حذف می‌شود.`,"حذف")))return;

  await remove("tasks",id);
  await load();
  renderAll();
  renderTasks();
  renderInlineDayItems();
  toast("کار انجام‌شده حذف شد")
};

window.deleteTask=async id=>{const t=state.tasks.find(x=>x.id===id);if(!t)return;if(!(await askConfirm("حذف کار؟",`«${t.title}» از فهرست کارها حذف می‌شود.`,"حذف")))return;await remove("tasks",id);await load();renderAll();renderInlineDayItems();toast("کار حذف شد")};
window.openProjectSheet=()=>{$("projectTitle").value="";$("projectValue").value="";openSheet("projectSheet");bindMoneyInputs(document)};
window.saveProject=async()=>{const title=$("projectTitle").value.trim();if(!title)return toast("نام پروژه را وارد کن.");const value=parseAmount($("projectValue").value,"income");await put("projects",{id:newId("project"),title,value,status:"فعال",createdAt:now()});await load();renderAll();closeSheet("projectSheet");toast("پروژه فریلنس ساخته شد ✓")};
window.resetHoorsunCycle=async()=>{
  if(!(await askConfirm("شروع چرخه جدید؟","چرخه فعلی هورسان آرشیو می‌شود و شمارش ۱۲ ریلز از صفر شروع خواهد شد.","شروع چرخه")))return;
  for(const r of currentCycleReels())await put("reels",{...r,archived:true,archivedAt:now()});
  await put("settings",{key:"hoorsunStage",value:{shoot:false,edit:false,upload:false}});
  await load();renderAll();switchPage("work");openWorkTab("hoorsun");toast("چرخه جدید هورسان شروع شد ✓")
};
function formatSyncTime(ts){
  if(!ts)return "—";
  const d=new Date(ts);
  return `${pFull(d)} · ${new Intl.DateTimeFormat("fa-IR",{hour:"2-digit",minute:"2-digit"}).format(d)}`
}

function renderCloudSyncStatus(){
  const s=getCloudSyncStatus();
  const connected=s.connected;
  const enabled=s.enabled;
  const syncing=s.syncing;
  const last=s.lastSyncAt?formatSyncTime(s.lastSyncAt):"—";

  const accountStatus=$("cloudAccountStatus");
  if(accountStatus){
    accountStatus.textContent=syncing
      ?"در حال همگام‌سازی امن…"
      :s.conflict
        ?"تداخل نسخه محلی و فضای ابری · نیاز به تصمیم"
        :connected
          ?s.dirty?"فضای ابری متصل · بکاپ در انتظار ارسال":enabled?"فضای ابری متصل · بکاپ خودکار فعال":"فضای ابری متصل · بکاپ خودکار متوقف"
          :"ذخیره محلی فعال · فضای ابری هنوز متصل نیست";
  }

  const lastEl=$("cloudLastSync");
  if(lastEl)lastEl.textContent=`آخرین همگام‌سازی: ${last}`;

  [$("cloudStatusDot"),$("cloudSheetStatusDot")].forEach(dot=>{
    if(!dot)return;
    dot.classList.toggle("connected",connected&&enabled&&!s.lastError);
    dot.classList.toggle("syncing",syncing);
    dot.classList.toggle("error",!!s.lastError||!!s.conflict);
    dot.classList.toggle("pending",!!s.dirty&&!syncing&&!s.conflict);
  });

  if($("cloudSheetStatus")){
    $("cloudSheetStatus").textContent=syncing
      ?"در حال همگام‌سازی…"
      :s.conflict
        ?"تداخل نسخه محلی و ابری"
        :s.lastError
          ?"خطا در همگام‌سازی"
          :connected
          ?enabled?"GitHub متصل و بکاپ خودکار فعال است":"GitHub متصل است"
          :"فقط ذخیره محلی فعال است";
  }

  if($("cloudSheetLastSync")){
    $("cloudSheetLastSync").textContent=s.conflict
      ?"نسخه GitHub تغییر کرده؛ بازیابی یا بازنویسی دستی را انتخاب کن."
      :s.lastError
        ?`خطا: ${s.lastError}`
        :s.dirty
          ?"تغییرات محلی ذخیره شده و در صف بکاپ هستند."
          :s.lastSyncAt
        ?`آخرین بکاپ موفق: ${last}`
        :"هنوز بکاپ ابری ثبت نشده.";
  }

  const toggle=$("cloudAutoToggle");
  if(toggle){
    toggle.textContent=`بکاپ خودکار: ${enabled?"روشن":"خاموش"}`;
    toggle.classList.toggle("active",enabled);
    toggle.disabled=!connected;
  }

  const connectBtn=$("cloudConnectBtn");
  if(connectBtn){
    connectBtn.textContent=connected?"به‌روزرسانی اتصال GitHub":"اتصال و فعال‌سازی بکاپ خودکار";
  }
}

function renderSettingsPage(){
  const el=$("settingsTotalBalance");
  if(el)el.textContent=toman(["current","obligations","safe","growth"].reduce((s,id)=>s+account(id).balance,0));

  const health=$("appHealthText");
  if(health){
    health.textContent=appHealth.lastCheck
      ?appHealth.ok?"ساختار، دیتابیس و رابط سالم هستند":`${fa(appHealth.issues.length)} مورد نیاز به بررسی`
      :"در حال بررسی ساختار برنامه…";
  }

  const vis=$("workVisibilitySettings");
  if(vis){
    const meta={hoorsun:"هورسان",hirsa:"هیرسا",snapp:"اسنپ",freelance:"فریلنس"};
    vis.innerHTML=Object.entries(meta).map(([id,name])=>`<label class="visibility-row"><span>${name}</span><input type="checkbox" data-work-visible="${id}" ${visibleWorkSources.includes(id)?"checked":""} data-action="toggleWorkSourceVisibility('${id}')"><i></i></label>`).join("");
  }
  renderCloudSyncStatus();
  hydrateIcons()
}

window.exportData=async()=>{
  try{
    const snapshot=await snapshotDB();
    const data={
      format:"MIA-Portable-Backup",
      exportedAt:new Date().toISOString(),
      version:`MIA ${APP_VERSION}`,
      profile:{id:PROFILE_ID,userName:PROFILE_NAME},
      snapshot
    };
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;
    a.download=`MIA-Iman-Dk-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000)
  }catch(err){
    recordAppError("export",err);
    toast("ساخت فایل پشتیبان با خطا روبه‌رو شد.")
  }
};
window.openCloudSyncSettings=async()=>{
  const s=getCloudSyncStatus();
  $("cloudOwnerInput").value=s.owner||"ImanDk";
  $("cloudRepoInput").value=s.repo||"NOVA";
  $("cloudBranchInput").value=s.branch||"mia-backup";
  $("cloudPathInput").value=s.path||"mia-data/iman-dk.mia.json";
  $("cloudTokenInput").value="";
  $("cloudRecoveryInput").value="";

  try{
    const key=await getRecoveryKey();
    $("cloudRecoveryKey").textContent=key?`${key.slice(0,8)}••••••••${key.slice(-6)}`:"—";
  }catch(_){
    $("cloudRecoveryKey").textContent="—";
  }

  renderCloudSyncStatus();
  openSheet("cloudSyncSheet")
};

window.connectCloudGitHub=async()=>{
  const btn=$("cloudConnectBtn");
  if(btn)btn.disabled=true;

  try{
    const s=getCloudSyncStatus();
    const tokenInput=$("cloudTokenInput").value.trim();

    await connectGitHub({
      owner:$("cloudOwnerInput").value.trim()||"ImanDk",
      repo:$("cloudRepoInput").value.trim()||"NOVA",
      branch:$("cloudBranchInput").value.trim()||"mia-backup",
      path:$("cloudPathInput").value.trim()||"mia-data/iman-dk.mia.json",
      token:tokenInput||undefined
    });

    $("cloudTokenInput").value="";
    const key=await getRecoveryKey();
    $("cloudRecoveryKey").textContent=`${key.slice(0,8)}••••••••${key.slice(-6)}`;
    renderCloudSyncStatus();
    const status=getCloudSyncStatus();
    toast(status.conflict?"GitHub متصل شد؛ یک بکاپ قبلی پیدا شد. برای حفظ اطلاعات، ابتدا بازیابی یا همگام‌سازی دستی را انتخاب کن.":"GitHub متصل شد و اولین بکاپ رمزگذاری‌شده ثبت شد ✓")
  }catch(err){
    console.error(err);
    recordAppError("cloud:connect",err);
    renderCloudSyncStatus();
    toast(`اتصال GitHub ناموفق بود: ${err.message||"خطای نامشخص"}`)
  }finally{
    if(btn)btn.disabled=false
  }
};

window.manualCloudSync=async()=>{
  try{
    await syncNow({reason:"manual",force:true});
    renderCloudSyncStatus();
    toast("آخرین اطلاعات Iman Dk روی GitHub ذخیره شد ✓")
  }catch(err){
    if(err?.code==="CLOUD_CONFLICT"){
      renderCloudSyncStatus();
      if(await askConfirm("جایگزینی بکاپ GitHub؟","نسخه GitHub متفاوت است. اگر ادامه بدهی، نسخه محلی جایگزین بکاپ ابری می‌شود.","جایگزین کن")){
        try{await syncNow({reason:"manual-conflict",force:true,forceConflict:true});renderCloudSyncStatus();toast("نسخه محلی با تأیید تو روی GitHub جایگزین شد ✓");return}catch(nextErr){err=nextErr}
      }else{toast("همگام‌سازی متوقف شد؛ می‌توانی از دکمه بازیابی، نسخه GitHub را دریافت کنی.");return}
    }
    recordAppError("cloud:manual-sync",err);renderCloudSyncStatus();toast(`همگام‌سازی انجام نشد: ${err.message||"خطا"}`)
  }
};

window.toggleCloudAutoSync=async()=>{
  const s=getCloudSyncStatus();
  try{
    await setCloudAutoEnabled(!s.enabled);
    renderCloudSyncStatus();
    toast(!s.enabled?"بکاپ خودکار روشن شد ✓":"بکاپ خودکار متوقف شد")
  }catch(err){
    toast(err.message||"تغییر وضعیت همگام‌سازی انجام نشد.")
  }
};

window.disconnectCloudSync=async()=>{
  const s=getCloudSyncStatus();
  if(!s.connected)return toast("GitHub متصل نیست.");
  if(!(await askConfirm("قطع اتصال فضای ابری؟","اطلاعات محلی MIA حذف نمی‌شوند و فقط اتصال GitHub قطع می‌شود.","قطع اتصال")))return;

  await disconnectCloud();
  renderCloudSyncStatus();
  toast("اتصال GitHub قطع شد؛ اطلاعات محلی حفظ شده است.")
};

window.copyCloudRecoveryKey=async()=>{
  try{
    const key=await getRecoveryKey();
    await navigator.clipboard.writeText(key);
    toast("کلید بازیابی کپی شد. آن را خارج از MIA نگه دار ✓")
  }catch(err){
    const key=await getRecoveryKey().catch(()=>"");
    if(key)prompt("کلید بازیابی را کپی کن:",key);
    else toast("کلید بازیابی در دسترس نیست.")
  }
};

window.restoreCloudBackup=async()=>{
  if(!(await askConfirm("بازیابی از فضای ابری؟","اطلاعات GitHub جایگزین اطلاعات فعلی MIA می‌شوند؛ قبل از بازیابی یک نسخه اضطراری محلی نگه داشته می‌شود.","بازیابی")))return;

  try{
    const recoveryKey=$("cloudRecoveryInput").value.trim();
    await restoreFromGitHub({recoveryKey});
    $("cloudRecoveryInput").value="";
    renderCloudSyncStatus();
    toast("اطلاعات از بکاپ GitHub بازیابی شد ✓")
  }catch(err){
    recordAppError("cloud:restore",err);
    renderCloudSyncStatus();
    toast(`بازیابی انجام نشد: ${err.message||"خطا"}`)
  }
};

window.runHealthCheck=async(showResult=false)=>{
  const issues=[];

  try{
    const db=await databaseHealth();
    if(!db.ok)issues.push(`DB: ${db.missingStores.join(", ")}`);
  }catch(err){
    issues.push(`Database: ${err.message||err}`);
  }

  const requiredIds=[
    "home","finance","work","planner","settingsPage","quickSheet",
    "notificationSheet","financeTabs","monthGrid","dayEvents",
    "cloudSyncSheet","cloudAccountStatus"
  ];
  const missingIds=requiredIds.filter(id=>!$(id));
  if(missingIds.length)issues.push(`DOM: ${missingIds.join(", ")}`);

  for(const key of ["tasks","events","projects","transactions","accounts","reels","budgets","goals"]){
    if(!Array.isArray(state[key]))issues.push(`State: ${key}`);
    else if(state[key].some(row=>row && typeof row==="object" && row.profileId!==PROFILE_ID))issues.push(`Profile ownership: ${key}`);
  }

  if(typeof startOfDay!=="function")issues.push("Date helper: startOfDay");
  if(!window.crypto?.subtle)issues.push("Web Crypto unavailable");
  issues.push(...runPureSelfTests({newId,escapeHtml,startOfDay}));
  if(lastRenderFailures>0)issues.push(`Render isolation: ${lastRenderFailures}`);

  appHealth={
    ok:issues.length===0,
    lastCheck:Date.now(),
    issues
  };

  renderSettingsPage();

  if(appHealth.ok){
    hideHealthBanner();
    if(showResult)toast("بررسی سلامت MIA بدون خطا پاس شد ✓")
  }else{
    showHealthBanner("MIA نیاز به بررسی دارد",`${fa(issues.length)} مورد در بررسی سلامت شناسایی شد.`);
    if(showResult)toast(`${fa(issues.length)} مورد در بررسی سلامت پیدا شد.`)
  }

  return appHealth
};

window.addEventListener("mia:action-error",e=>recordAppError("action",new Error(e.detail?.message||"Action error"),{expr:e.detail?.expr||""}));
window.addEventListener("mia:cloud-status",()=>safeRender("cloud-status",renderCloudSyncStatus));
window.addEventListener("mia:cloud-restored",async()=>{
  try{
    await load();
    renderAll();
    await runHealthCheck(false);
  }catch(err){
    recordAppError("cloud:post-restore",err)
  }
});

async function undoLast(){
  if(!lastUndo)return;const u=lastUndo;lastUndo=null;
  if(u.kind==="expense"){try{await undoExpenseAtomic(u.id);await load();renderAll();toast("هزینه برگردانده شد")}catch(err){toast(err.message||"بازگردانی هزینه انجام نشد.")}}
}
function askConfirm(title,message,acceptText="تأیید"){
  if(confirmResolver){try{confirmResolver(false)}catch(_){} confirmResolver=null}
  $("confirmTitle").textContent=title||"مطمئنی؟";$("confirmMessage").textContent=message||"";$("confirmAcceptBtn").textContent=acceptText;
  openSheet("confirmSheet");
  return new Promise(resolve=>{confirmResolver=resolve})
}
window.resolveConfirm=value=>{const r=confirmResolver;confirmResolver=null;closeSheet("confirmSheet");if(r)r(!!value)};

function toast(text,actionText="",action=null){
  $("toastText").textContent=text;const b=$("toastAction");b.textContent=actionText;b.style.display=actionText?"block":"none";b._miaAction=action;
  if(!b.dataset.listenerReady){b.dataset.listenerReady="1";b.addEventListener("click",()=>{const fn=b._miaAction;b._miaAction=null;if(typeof fn==="function")fn();$("toast").classList.remove("show")})}
  $("toast").classList.add("show");clearTimeout(toast._t);toast._t=setTimeout(()=>$("toast").classList.remove("show"),4200)
}
function installInteractionGuards(){
  const editable=el=>!!el?.closest?.("input,textarea,select,[contenteditable='true']");

  // Safari gesture events can still zoom even when viewport settings are strict.
  ["gesturestart","gesturechange","gestureend"].forEach(type=>{
    document.addEventListener(type,e=>e.preventDefault(),{passive:false})
  });

  // Prevent double-tap zoom while preserving normal taps and vertical scrolling.
  let lastTouchEnd=0;
  document.addEventListener("touchend",e=>{
    if(editable(e.target))return;
    const t=Date.now();
    if(t-lastTouchEnd<=320)e.preventDefault();
    lastTouchEnd=t;
  },{passive:false});

  // No copy/select/context menu for ordinary UI. Editing fields are exempt.
  document.addEventListener("contextmenu",e=>{
    if(!editable(e.target))e.preventDefault()
  });
  document.addEventListener("selectstart",e=>{
    if(!editable(e.target))e.preventDefault()
  });

  // Enter confirms the amount, then non-cigarette expenses continue to description.
  $("amountInput")?.addEventListener("keydown",e=>{
    if(e.key==="Enter"){e.preventDefault();saveQuickExpense()}
  });
  $("workSourceSelect")?.addEventListener("change",e=>openWorkTab(e.target.value));
  $("quickTypeSelect")?.addEventListener("change",()=>refreshQuickInterpretation());
}

function wireMode(){
  const p=new URLSearchParams(location.search);
  if(p.get("mode")==="quick")setTimeout(()=>openQuick(),350);
}
init().catch(async e=>{
  console.error("MIA startup failed",e);
  await recordAppError("startup",e).catch(()=>{});
  if($("dbStatus"))$("dbStatus").textContent="خطای راه‌اندازی";
  showHealthBanner("MIA کامل راه‌اندازی نشد",e?.message||"اطلاعات محلی حذف نشده‌اند. دوباره تلاش کن.");
});
