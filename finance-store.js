import {openDB,notifyDataChanged} from "./db.js?v=130";
import {PROFILE_ID,newId} from "./core.js?v=130";

function reqP(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error("IndexedDB request failed"))})}
function txP(tx){return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error("Finance transaction failed"));tx.onabort=()=>reject(tx.error||new Error("Finance transaction aborted"))})}
const scoped=row=>({...row,profileId:row.profileId||PROFILE_ID});
const ACCOUNT_IDS=["current","obligations","safe","growth"];
const valueOf=x=>Number(x||0);

async function allocationForIncome(allocationsStore,incomeTxId){
  const rows=await reqP(allocationsStore.getAll());
  return rows.find(x=>x?.incomeTxId===incomeTxId&&(!x.profileId||x.profileId===PROFILE_ID))||null
}
async function readAccounts(accountsStore){
  const rows={};
  for(const id of ACCOUNT_IDS){
    rows[id]=await reqP(accountsStore.get(id));
    if(!rows[id])throw new Error(`حساب ${id} پیدا نشد.`)
  }
  return rows
}
function allocationAmounts(parts={}){
  return Object.fromEntries(ACCOUNT_IDS.map(id=>[id,Math.max(0,Math.round(valueOf(parts?.[id]?.amount)))]))
}
function allocationTotal(parts={}){
  return Object.values(allocationAmounts(parts)).reduce((a,b)=>a+b,0)
}
function ensureCanSubtract(rows,amounts,message="موجودی حساب‌ها برای این تغییر کافی نیست."){
  for(const id of ACCOUNT_IDS){
    if(valueOf(rows[id]?.balance)<valueOf(amounts[id]))throw new Error(message)
  }
}
function putBalances(accountsStore,rows,nextBalances){
  for(const id of ACCOUNT_IDS){
    accountsStore.put(scoped({...rows[id],balance:Math.max(0,Math.round(nextBalances[id]))}))
  }
}

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

// v1.2.0: income is recorded first, but no account balance changes until the user
// explicitly confirms the editable allocation proposal.
export async function recordIncomeAtomic({amount,source,note,parts,at=Date.now(),txId=newId("tx"),allocationId=newId("allocation")}){
  const db=await openDB(),tx=db.transaction(["transactions","incomeAllocations"],"readwrite");
  const transactions=tx.objectStore("transactions"),allocations=tx.objectStore("incomeAllocations");
  if(Number(amount)<=0)throw new Error("مبلغ درآمد معتبر نیست.");
  transactions.put(scoped({id:txId,type:"income",amount:Number(amount),source,note,accountId:null,at,allocationStatus:"pending"}));
  const allocation=scoped({id:allocationId,at,incomeTxId:txId,source,amount:Number(amount),parts,confirmed:false,accountingMode:"manual-allocation"});
  allocations.put(allocation);
  await txP(tx);notifyDataChanged({store:"finance",operation:"income",key:txId});
  return allocation
}

export async function confirmAllocationAtomic(allocationId,partsOverride=null){
  const db=await openDB(),tx=db.transaction(["accounts","transactions","incomeAllocations"],"readwrite");
  const accounts=tx.objectStore("accounts"),transactions=tx.objectStore("transactions"),allocations=tx.objectStore("incomeAllocations");
  const allocation=await reqP(allocations.get(allocationId));
  if(!allocation)throw new Error("پیشنهاد تقسیم درآمد پیدا نشد.");
  if(allocation.confirmed){await txP(tx);return allocation}

  const parts=partsOverride||allocation.parts||{};
  const total=allocationTotal(parts);
  if(Math.abs(total-valueOf(allocation.amount))>1)throw new Error("جمع مبالغ چهار حساب باید دقیقاً برابر با مبلغ درآمد باشد.");
  const rows=await readAccounts(accounts);

  if(allocation.accountingMode==="manual-allocation"){
    const amounts=allocationAmounts(parts);
    putBalances(accounts,rows,Object.fromEntries(ACCOUNT_IDS.map(id=>[id,valueOf(rows[id].balance)+amounts[id]])))
  }else{
    // Compatibility for unconfirmed v1.1.x income: that version already put the
    // full income into current, so confirmation only moves the non-current parts.
    const amounts=allocationAmounts(parts);
    const move=amounts.obligations+amounts.safe+amounts.growth;
    if(valueOf(rows.current.balance)<move)throw new Error("موجودی حساب جاری برای تأیید این تقسیم کافی نیست.");
    const next={
      current:valueOf(rows.current.balance)-move,
      obligations:valueOf(rows.obligations.balance)+amounts.obligations,
      safe:valueOf(rows.safe.balance)+amounts.safe,
      growth:valueOf(rows.growth.balance)+amounts.growth
    };
    putBalances(accounts,rows,next)
  }

  const updated=scoped({...allocation,parts,confirmed:true,confirmedAt:Date.now()});
  allocations.put(updated);
  const incomeTx=await reqP(transactions.get(allocation.incomeTxId));
  if(incomeTx)transactions.put(scoped({...incomeTx,allocationStatus:"confirmed",updatedAt:Date.now()}));
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

export async function updateExpenseAtomic({txId,amount,category,note}){
  const db=await openDB(),tx=db.transaction(["accounts","transactions"],"readwrite");
  const accounts=tx.objectStore("accounts"),transactions=tx.objectStore("transactions");
  const record=await reqP(transactions.get(txId));
  if(!record||record.type!=="expense")throw new Error("هزینه پیدا نشد.");
  const accountId=record.accountId||"current",account=await reqP(accounts.get(accountId));
  if(!account)throw new Error("حساب مربوط به هزینه پیدا نشد.");
  const nextAmount=Math.round(valueOf(amount));if(nextAmount<=0)throw new Error("مبلغ هزینه معتبر نیست.");
  const nextBalance=valueOf(account.balance)+valueOf(record.amount)-nextAmount;
  if(nextBalance<0)throw new Error("موجودی حساب برای این ویرایش کافی نیست.");
  accounts.put(scoped({...account,balance:nextBalance}));
  transactions.put(scoped({...record,amount:nextAmount,category,note:String(note||"").trim(),updatedAt:Date.now()}));
  await txP(tx);notifyDataChanged({store:"finance",operation:"edit-expense",key:txId});
  return true
}

export async function updateIncomeAtomic({txId,amount,source,note,parts}){
  const db=await openDB(),tx=db.transaction(["accounts","transactions","incomeAllocations"],"readwrite");
  const accounts=tx.objectStore("accounts"),transactions=tx.objectStore("transactions"),allocations=tx.objectStore("incomeAllocations");
  const record=await reqP(transactions.get(txId));
  if(!record||record.type!=="income")throw new Error("درآمد پیدا نشد.");
  const nextAmount=Math.round(valueOf(amount));if(nextAmount<=0)throw new Error("مبلغ درآمد معتبر نیست.");
  const oldAllocation=await allocationForIncome(allocations,txId);
  const rows=await readAccounts(accounts);

  if(oldAllocation?.confirmed){
    const oldAmounts=allocationAmounts(oldAllocation.parts);
    ensureCanSubtract(rows,oldAmounts,"به‌دلیل مصرف شدن بخشی از موجودی، ابتدا موجودی حساب‌ها را اصلاح کن و بعد مبلغ این درآمد را ویرایش کن.");
    putBalances(accounts,rows,Object.fromEntries(ACCOUNT_IDS.map(id=>[id,valueOf(rows[id].balance)-oldAmounts[id]])))
  }else if(oldAllocation && oldAllocation.accountingMode!=="manual-allocation"){
    // Legacy v1.1.x unconfirmed income had already been added to current.
    if(valueOf(rows.current.balance)<valueOf(record.amount))throw new Error("به‌دلیل مصرف شدن بخشی از درآمد قبلی، امکان ویرایش مبلغ فعلاً وجود ندارد.");
    accounts.put(scoped({...rows.current,balance:valueOf(rows.current.balance)-valueOf(record.amount)}))
  }

  transactions.put(scoped({...record,amount:nextAmount,source,note:String(note||"").trim(),accountId:null,allocationStatus:"pending",updatedAt:Date.now()}));
  const allocation=scoped({
    ...(oldAllocation||{}),
    id:oldAllocation?.id||newId("allocation"),
    at:oldAllocation?.at||Date.now(),
    incomeTxId:txId,
    source,
    amount:nextAmount,
    parts,
    confirmed:false,
    confirmedAt:null,
    accountingMode:"manual-allocation",
    updatedAt:Date.now()
  });
  allocations.put(allocation);
  await txP(tx);notifyDataChanged({store:"finance",operation:"edit-income",key:txId});
  return allocation
}

export async function updateTransactionNoteAtomic({txId,note,source=null,category=null}){
  const db=await openDB(),tx=db.transaction(["transactions","incomeAllocations"],"readwrite");
  const transactions=tx.objectStore("transactions"),allocations=tx.objectStore("incomeAllocations");
  const record=await reqP(transactions.get(txId));
  if(!record)throw new Error("تراکنش پیدا نشد.");
  const updated=scoped({...record,note:String(note||"").trim(),updatedAt:Date.now()});
  if(source!==null)updated.source=source;
  if(category!==null)updated.category=category;
  transactions.put(updated);
  if(record.type==="income"&&source!==null){
    const allocation=await allocationForIncome(allocations,txId);
    if(allocation)allocations.put(scoped({...allocation,source,updatedAt:Date.now()}))
  }
  await txP(tx);notifyDataChanged({store:"finance",operation:"edit-transaction",key:txId});
  return true
}

export async function deleteFinancialTransactionAtomic(txId){
  const db=await openDB(),tx=db.transaction(["accounts","transactions","incomeAllocations"],"readwrite");
  const accounts=tx.objectStore("accounts"),transactions=tx.objectStore("transactions"),allocations=tx.objectStore("incomeAllocations");
  const record=await reqP(transactions.get(txId));
  if(!record)throw new Error("تراکنش پیدا نشد.");

  if(record.type==="expense"){
    const account=await reqP(accounts.get(record.accountId||"current"));
    if(!account)throw new Error("حساب مربوط به هزینه پیدا نشد.");
    accounts.put(scoped({...account,balance:valueOf(account.balance)+valueOf(record.amount)}))
  }else if(record.type==="income"){
    const allocation=await allocationForIncome(allocations,txId);
    const rows=await readAccounts(accounts);
    if(allocation?.confirmed){
      const amounts=allocationAmounts(allocation.parts);
      ensureCanSubtract(rows,amounts,"به‌دلیل خرج شدن بخشی از این درآمد، حذف آن موجودی یک حساب را منفی می‌کند.");
      putBalances(accounts,rows,Object.fromEntries(ACCOUNT_IDS.map(id=>[id,valueOf(rows[id].balance)-amounts[id]])))
    }else if(allocation && allocation.accountingMode!=="manual-allocation"){
      // Legacy unconfirmed income was already placed in current.
      if(valueOf(rows.current.balance)<valueOf(record.amount))throw new Error("به‌دلیل خرج شدن بخشی از این درآمد، حذف آن ممکن نیست.");
      accounts.put(scoped({...rows.current,balance:valueOf(rows.current.balance)-valueOf(record.amount)}))
    }
    if(allocation)allocations.delete(allocation.id)
  }else{
    throw new Error("ویرایش و حذف مستقیم فقط برای واریز و برداشت‌های درآمد/هزینه فعال است.")
  }

  transactions.delete(txId);
  await txP(tx);notifyDataChanged({store:"finance",operation:"delete-transaction",key:txId});
  return true
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
