const FA_TO_EN={"۰":"0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9","٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9"};
const EN_TO_FA={"0":"۰","1":"۱","2":"۲","3":"۳","4":"۴","5":"۵","6":"۶","7":"۷","8":"۸","9":"۹"};

function toEnglishDigits(value){
  return String(value??"").replace(/[۰-۹٠-٩]/g,ch=>FA_TO_EN[ch]||ch)
}

export function normalizeMoneyText(value){
  return toEnglishDigits(value)
    .replace(/[٬,\s]/g,"")
    .replace(/[^\d.-]/g,"")
}

export function formatMoneyInteger(value,{persianDigits=true}={}){
  const n=Math.round(Number(value)||0);
  const negative=n<0;
  const digits=Math.abs(n).toString();
  const grouped=digits.replace(/\B(?=(\d{3})+(?!\d))/g,"٬");
  const out=(negative?"-":"")+grouped;
  return persianDigits ? out.replace(/\d/g,d=>EN_TO_FA[d]) : out.replace(/٬/g,",")
}

export function formatMoneyInputValue(value){
  const raw=toEnglishDigits(value).replace(/[٬,\s]/g,"").replace(/[^\d]/g,"");
  if(!raw)return "";
  const normalized=raw.replace(/^0+(?=\d)/,"");
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g,",")
}

export function parseFormattedMoney(value){
  const raw=normalizeMoneyText(value);
  const n=Number(raw);
  return Number.isFinite(n)?n:0
}

function caretFromDigitCount(input,digitCount){
  const value=input.value;
  let seen=0;
  for(let i=0;i<value.length;i++){
    if(/\d/.test(value[i]))seen++;
    if(seen>=digitCount)return i+1;
  }
  return value.length
}

export function bindMoneyInputs(root=document){
  const selector='input[data-money-input="true"]';
  root.querySelectorAll(selector).forEach(input=>{
    if(input.dataset.moneyBound==="1")return;
    input.dataset.moneyBound="1";
    input.setAttribute("inputmode","numeric");
    input.setAttribute("autocomplete","off");

    input.addEventListener("input",()=>{
      const old=input.value;
      const caret=input.selectionStart??old.length;
      const before=old.slice(0,caret);
      const digitsBefore=(toEnglishDigits(before).match(/\d/g)||[]).length;
      const formatted=formatMoneyInputValue(old);
      if(formatted===old)return;
      input.value=formatted;
      const nextCaret=caretFromDigitCount(input,digitsBefore);
      try{input.setSelectionRange(nextCaret,nextCaret)}catch(_){}
    });

    input.addEventListener("focus",()=>{
      if(input.value)input.value=formatMoneyInputValue(input.value)
    });
  })
}

export function formatMoneyTextNodes(root=document){
  root.querySelectorAll("[data-money-value]").forEach(el=>{
    const n=Number(el.dataset.moneyValue||0);
    el.textContent=`${formatMoneyInteger(n)} تومان`
  })
}
