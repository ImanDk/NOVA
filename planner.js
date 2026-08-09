
const faCal=new Intl.DateTimeFormat("fa-IR-u-ca-persian",{year:"numeric",month:"numeric",day:"numeric"});
const faFull=new Intl.DateTimeFormat("fa-IR-u-ca-persian",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
const faMonth=new Intl.DateTimeFormat("fa-IR-u-ca-persian",{month:"long",year:"numeric"});
const faDay=new Intl.DateTimeFormat("fa-IR-u-ca-persian",{day:"numeric"});
const faWeekday=new Intl.DateTimeFormat("fa-IR",{weekday:"short"});
export function pParts(date){
  const p={}; for(const x of faCal.formatToParts(date)) if(x.type!=="literal") p[x.type]=x.value;
  return p;
}
export function pKey(date){const p=pParts(date);return `${p.year}-${p.month}-${p.day}`}
export function pFull(date){return faFull.format(date)}
export function pMonthTitle(date){return faMonth.format(date)}
export function pDayNum(date){return faDay.format(date)}
export function pWeekday(date){return faWeekday.format(date)}
export function startOfPersianMonth(date){
  const target=pParts(date), d=new Date(date); d.setHours(12,0,0,0);
  for(let i=0;i<35;i++){
    const prev=new Date(d);prev.setDate(prev.getDate()-1);
    const pp=pParts(prev);
    if(pp.month!==target.month || pp.year!==target.year) return d;
    d.setDate(d.getDate()-1);
  } return d;
}
export function endOfPersianMonth(date){
  const target=pParts(date), d=new Date(date); d.setHours(12,0,0,0);
  for(let i=0;i<35;i++){
    const next=new Date(d);next.setDate(next.getDate()+1);
    const pp=pParts(next);
    if(pp.month!==target.month || pp.year!==target.year) return d;
    d.setDate(d.getDate()+1);
  } return d;
}
export function monthCells(anchor){
  const start=startOfPersianMonth(anchor), end=endOfPersianMonth(anchor);
  const jsDay=start.getDay(); // Sunday=0
  const offset=(jsDay+1)%7; // Saturday=0
  const first=new Date(start);first.setDate(first.getDate()-offset);
  const cells=[];
  for(let i=0;i<42;i++){const d=new Date(first);d.setDate(first.getDate()+i);cells.push(d)}
  return {cells,start,end};
}
export function addDays(date,n){const d=new Date(date);d.setDate(d.getDate()+n);return d}
export function startOfWeek(date){
  const d=new Date(date);d.setHours(12,0,0,0);const offset=(d.getDay()+1)%7;d.setDate(d.getDate()-offset);return d;
}
export function nextWeekday(jsDay, hour=9, minute=0){
  const now=new Date(), d=new Date(now);d.setHours(hour,minute,0,0);
  let delta=(jsDay-now.getDay()+7)%7;
  if(delta===0 && d<=now) delta=7;
  d.setDate(d.getDate()+delta);return d;
}
export function parseFaDigits(s){
  const map={"۰":"0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9","٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9"};
  return String(s||"").replace(/[۰-۹٠-٩]/g,c=>map[c]||c);
}
export function parseNaturalEvent(input){
  let q=parseFaDigits(input).replace(/ي/g,"ی").replace(/ك/g,"ک").replace(/\s+/g," ").trim();
  const weekdays={"شنبه":6,"یکشنبه":0,"یک شنبه":0,"دوشنبه":1,"دو شنبه":1,"سه‌شنبه":2,"سه شنبه":2,"چهارشنبه":3,"چهار شنبه":3,"پنجشنبه":4,"پنج شنبه":4,"جمعه":5};
  let hour=9,minute=0;
  let tm=q.match(/ساعت\s*(\d{1,2})(?::(\d{1,2}))?/);
  if(tm){hour=Math.min(23,+tm[1]);minute=Math.min(59,+(tm[2]||0))}
  let date=null;
  if(q.includes("فردا")){date=addDays(new Date(),1);date.setHours(hour,minute,0,0)}
  else if(q.includes("امروز")){date=new Date();date.setHours(hour,minute,0,0)}
  else{
    for(const [name,day] of Object.entries(weekdays)) if(q.includes(name)){date=nextWeekday(day,hour,minute);break}
  }
  if(!date && tm){date=new Date();date.setHours(hour,minute,0,0);if(date<=new Date()) date=addDays(date,1)}
  if(!date)return null;
  let title=q
    .replace(/ساعت\s*\d{1,2}(?::\d{1,2})?/,"")
    .replace(/امروز|فردا|شنبه|یکشنبه|یک شنبه|دوشنبه|دو شنبه|سه‌شنبه|سه شنبه|چهارشنبه|چهار شنبه|پنجشنبه|پنج شنبه|جمعه/g,"")
    .replace(/^(باید|که باید)\s*/,"")
    .replace(/\s*(یادم بنداز|یادآوری کن)\s*/g," ")
    .replace(/\s+/g," ").trim();
  title=title.replace(/^باید\s*/,"").replace(/^برم\s*/,"رفتن به ");
  if(!title)title="برنامه";
  return {title,date,startISO:date.toISOString(),durationMin:60,alertBeforeMin:60,type:"event"};
}
