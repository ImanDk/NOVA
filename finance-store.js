import {openDB,notifyDataChanged} from "./db.js?v=110";
import {PROFILE_ID,newId} from "./core.js?v=110";

function reqP(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error("IndexedDB request failed"))})}
function txP(tx){return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error("Finance transaction failed"));tx.onabort=()=>reject(tx.error||new Error("Finance transaction aborted"))})}
const scoped=row=>({...row,profileId:row.profileId||PROFILE_ID});

export async function recordExpenseAtomic({amount,category,note,at=Date.now(),id=newId("tx")}){
  const db=await openDB(),tx=db.transaction(["accounts","transactions"],"readwrite");
  const accounts=tx.objectStore("accounts"),transactions=tx.objectStore("transactions");
  const current=await reqP(accounts.get("current"));
  if(!current)throw new Error("حساب جاری پیدا نشد.");
  if(Number(amount)<=0)throw new Error("مبلغ هزینه معتبر نیست.");
  if(Number(current.balance||0)<Number(amount))throw new Error("موجودی حساب جاری برای این هزینه کافی نیست.");
  const record=scoped({id,type:"expense",amount:Number(amount),category,note,accountId:"current",at});
  transactions.put(record);
  accounts.put(scoped({...current,balance:Number(current.balance||0)-Number(amount)}));
  await txP(tx);notifyDataChanged({store:"finance",operation:"expense",key:id});
  return {id,before:Number(current.balance||0),after:Number(current.balance||0)-Number(amount)}
}

export async function recordIncomeAtomic({amount,source,note,parts,at=Date.now(),txId=newId("tx"),allocationId=newId("allocation")}){
  const db=await openDB(),tx=db.transaction(["accounts","transactions","incomeAllocations"],"readwrite");
  const accounts=tx.objectStore("accounts"),transactions=tx.objectStore("transactions"),allocations=tx.objectStore("incomeAllocations");
  const current=await reqP(accounts.get("current"));
  if(!current)throw new Error("حساب جاری پیدا نشد.");
  if(Number(amount)<=0)throw new Error("مبلغ درآمد معتبر نیست.");
  transactions.put(scoped({id:txId,type:"income",amount:Number(amount),source,note,accountId:"current",at}));
  accounts.put(scoped({...current,balance:Number(current.balance||0)+Number(amount)}));
  const allocation=scoped({id:allocationId,at,incomeTxId:txId,source,amount:Number(amount),parts,confirmed:false});
  allocations.put(allocation);
  await txP(tx);notifyDataChanged({store:"finance",operation:"income",key:txId});
  return allocation
}

export async function confirmAllocationAtomic(allocationId){
  const db=await openDB(),tx=db.transaction(["accounts","incomeAllocations"],"readwrite");
  const accounts=tx.objectStore("accounts"),allocations=tx.objectStore("incomeAllocations");
  const allocation=await reqP(allocations.get(allocationId));
  if(!allocation)throw new Error("پیشنهاد تقسیم درآمد پیدا نشد.");
  if(allocation.confirmed){await txP(tx);return allocation}
  const ids=["current","obligations","safe","growth"];
  const rows={};
  for(const id of ids){rows[id]=await reqP(accounts.get(id));if(!rows[id])throw new Error(`حساب ${id} پیدا نشد.`)}
  const move=["obligations","safe","growth"].reduce((s,id)=>s+Number(allocation.parts?.[id]?.amount||0),0);
  if(Number(rows.current.balance||0)<move)throw new Error("موجودی حساب جاری برای تأیید این تقسیم کافی نیست.");
  accounts.put(scoped({...rows.current,balance:Number(rows.current.balance||0)-move}));
  for(const id of ["obligations","safe","growth"]){
    accounts.put(scoped({...rows[id],balance:Number(rows[id].balance||0)+Number(allocation.parts?.[id]?.amount||0)}));
  }
  const updated=scoped({...allocation,confirmed:true,confirmedAt:Date.now()});
  allocations.put(updated);
  await txP(tx);notifyDataChanged({store:"finance",operation:"allocation",key:allocationId});
  return updated
}

export async function recordTransferAtomic({from,to,amount,note,at=Date.now(),id=newId("tx")}){
  if(from===to)throw new Error("حساب مبدأ و مقصد نمی‌تواند یکسان باشد.");
  const db=await openDB(),tx=db.transaction(["accounts","transactions"],"readwrite");
  const accounts=tx.objectStore("accounts"),transactions=tx.objectStore("transactions");
  const fromRow=await reqP(accounts.get(from)),toRow=await reqP(accounts.get(to));
  if(!fromRow||!toRow)throw new Error("حساب مبدأ یا مقصد پیدا نشد.");
  const value=Number(amount);
  if(value<=0)throw new Error("مبلغ انتقال معتبر نیست.");
  if(Number(fromRow.balance||0)<value)throw new Error("موجودی حساب مبدأ برای این انتقال کافی نیست.");
  accounts.put(scoped({...fromRow,balance:Number(fromRow.balance||0)-value}));
  accounts.put(scoped({...toRow,balance:Number(toRow.balance||0)+value}));
  transactions.put(scoped({id,type:"transfer",amount:value,from,to,note,at}));
  await txP(tx);notifyDataChanged({store:"finance",operation:"transfer",key:id});
  return id
}

export async function reconcileAccountAtomic({accountId,balance,bankName,note="تطبیق موجودی بانک",at=Date.now(),id=newId("tx")}){
  const db=await openDB(),tx=db.transaction(["accounts","transactions"],"readwrite");
  const accounts=tx.objectStore("accounts"),transactions=tx.objectStore("transactions");
  const row=await reqP(accounts.get(accountId));
  if(!row)throw new Error("حساب پیدا نشد.");
  const next=Number(balance);if(!Number.isFinite(next)||next<0)throw new Error("موجودی واردشده معتبر نیست.");
  const before=Number(row.balance||0),delta=next-before;
  accounts.put(scoped({...row,balance:next,bankName:String(bankName||"").trim()}));
  transactions.put(scoped({id,type:"reconcile",accountId,amount:Math.abs(delta),delta,beforeBalance:before,afterBalance:next,note,at}));
  await txP(tx);notifyDataChanged({store:"finance",operation:"reconcile",key:id});
  return {id,before,after:next,delta}
}

export async function undoExpenseAtomic(txId){
  const db=await openDB(),tx=db.transaction(["accounts","transactions"],"readwrite");
  const accounts=tx.objectStore("accounts"),transactions=tx.objectStore("transactions");
  const record=await reqP(transactions.get(txId));
  if(!record||record.type!=="expense")throw new Error("هزینه برای بازگردانی پیدا نشد.");
  const current=await reqP(accounts.get(record.accountId||"current"));
  if(!current)throw new Error("حساب مربوط به هزینه پیدا نشد.");
  transactions.delete(txId);
  accounts.put(scoped({...current,balance:Number(current.balance||0)+Number(record.amount||0)}));
  await txP(tx);notifyDataChanged({store:"finance",operation:"undo-expense",key:txId});
  return true
}
