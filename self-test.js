export function runPureSelfTests({newId,escapeHtml,startOfDay}){
  const issues=[];
  try{
    const ids=new Set(Array.from({length:250},()=>newId("test")));
    if(ids.size!==250)issues.push("UUID uniqueness")
  }catch(err){issues.push(`UUID: ${err.message||err}`)}
  try{
    const escaped=escapeHtml('<img src=x onerror="1">');
    if(escaped.includes("<img")||escaped.includes('onerror="1"'))issues.push("HTML escaping")
  }catch(err){issues.push(`Escape: ${err.message||err}`)}
  try{
    const d=startOfDay(new Date("2026-08-16T13:22:45"));
    if(d.getHours()||d.getMinutes()||d.getSeconds()||d.getMilliseconds())issues.push("startOfDay")
  }catch(err){issues.push(`Date helper: ${err.message||err}`)}
  return issues
}
