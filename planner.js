
const faCal=new Intl.DateTimeFormat("fa-IR-u-ca-persian",{year:"numeric",month:"numeric",day:"numeric"});
const faFull=new Intl.DateTimeFormat("fa-IR-u-ca-persian",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
const faMonth=new Intl.DateTimeFormat("fa-IR-u-ca-persian",{month:"long",year:"numeric"});
const faDay=new Intl.DateTimeFormat("fa-IR-u-ca-persian",{day:"numeric"});
const faWeekday=new Intl.DateTimeFormat("fa-IR",{weekday:"short"});
export function pParts(date){const p={};for(const x of faCal.formatToParts(date))if(x.type!=="literal")p[x.type]=x.value;return p}
export function pKey(date){const p=pParts(date);return `${p.year}-${p.month}-${p.day}`}
export function pFull(date){return faFull.format(date)}
export function pMonthTitle(date){return faMonth.format(date)}
export function pDayNum(date){return faDay.format(date)}
export function pWeekday(date){return faWeekday.format(date)}
export function addDays(date,n){const d=new Date(date);d.setDate(d.getDate()+n);return d}
export function startOfWeek(date){const d=new Date(date);d.setHours(12,0,0,0);const off=(d.getDay()+1)%7;d.setDate(d.getDate()-off);return d}
export function startOfPersianMonth(date){
  const target=pParts(date),d=new Date(date);d.setHours(12,0,0,0);
  for(let i=0;i<35;i++){const prev=new Date(d);prev.setDate(prev.getDate()-1);const pp=pParts(prev);if(pp.month!==target.month||pp.year!==target.year)return d;d.setDate(d.getDate()-1)}
  return d
}
export function endOfPersianMonth(date){
  const target=pParts(date),d=new Date(date);d.setHours(12,0,0,0);
  for(let i=0;i<35;i++){const next=new Date(d);next.setDate(next.getDate()+1);const pp=pParts(next);if(pp.month!==target.month||pp.year!==target.year)return d;d.setDate(d.getDate()+1)}
  return d
}
export function monthCells(anchor){
  const start=startOfPersianMonth(anchor),end=endOfPersianMonth(anchor);
  const offset=(start.getDay()+1)%7,first=new Date(start);first.setDate(first.getDate()-offset);
  return {cells:Array.from({length:42},(_,i)=>addDays(first,i)),start,end}
}
export function parseFaDigits(s){
  const map={"۰":"0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9","٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9"};
  return String(s||"").replace(/[۰-۹٠-٩]/g,c=>map[c]||c)
}
export function nextWeekday(jsDay,hour=9,minute=0){
  const now=new Date(),d=new Date(now);d.setHours(hour,minute,0,0);let delta=(jsDay-now.getDay()+7)%7;
  if(delta===0&&d<=now)delta=7;d.setDate(d.getDate()+delta);return d
}
export function parseNaturalEvent(input){
  let q=parseFaDigits(input).replace(/ي/g,"ی").replace(/ك/g,"ک").replace(/\s+/g," ").trim();
  const weekdays=[["چهارشنبه",3],["چهار شنبه",3],["پنجشنبه",4],["پنج شنبه",4],["سه‌شنبه",2],["سه شنبه",2],["دوشنبه",1],["دو شنبه",1],["یکشنبه",0],["یک شنبه",0],["شنبه",6],["جمعه",5]];
  let hour=9,minute=0,tm=q.match(/ساعت\s*(\d{1,2})(?::(\d{1,2}))?/),date=null;
  if(tm){hour=Math.min(23,+tm[1]);minute=Math.min(59,+(tm[2]||0))}
  if(q.includes("فردا")){date=addDays(new Date(),1);date.setHours(hour,minute,0,0)}
  else if(q.includes("امروز")){date=new Date();date.setHours(hour,minute,0,0)}
  else for(const [name,day] of weekdays)if(q.includes(name)){date=nextWeekday(day,hour,minute);break}
  if(!date&&tm){date=new Date();date.setHours(hour,minute,0,0);if(date<=new Date())date=addDays(date,1)}
  if(!date)return null;
  let title=q.replace(/ساعت\s*\d{1,2}(?::\d{1,2})?/,"").replace(/امروز|فردا|چهار[\s‌]?شنبه|پنج[\s‌]?شنبه|سه[\s‌]?شنبه|دو[\s‌]?شنبه|یک[\s‌]?شنبه|شنبه|جمعه/g,"").replace(/^(باید|که باید)\s*/,"").replace(/\s+/g," ").trim();
  if(!title)title="برنامه";
  return {title,startISO:date.toISOString(),durationMin:60,alertBeforeMin:60,type:"event"}
}
