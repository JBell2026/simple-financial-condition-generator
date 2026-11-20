import {isBalanceSheetTitle,isOtherStatementTitle} from './balance-source.mjs';
import {definitionIssues} from './fv7.mjs';
import {fcSchema} from './fc-schema.mjs';
export const fields = {
 A060:['Mortgage loans held for sale, lower of cost or market','Assets'],A062:['Mortgage loans held for sale, fair value','Assets'],
 A010:['Cash and cash equivalents','Assets'],A020:['Restricted cash','Assets'],A050:['Receivables from unrelated parties','Assets'],A190:['Receivables from related parties','Assets'],A230C:['Accounts receivable','Assets'],A180:['Property and equipment, net','Assets'],A210:['Goodwill and intangible assets','Assets'],A230H:['Other assets','Assets'],
 B009:['Warehouse lines of credit','Liabilities'],B010:['Debt facilities','Liabilities'],B080:['Short-term payables to related parties','Liabilities'],B090:['Short-term notes to unrelated parties','Liabilities'],B100:['Accrued expenses','Liabilities'],B120:['Other current liabilities','Liabilities'],B130:['Long-term liabilities to related parties','Liabilities'],B140:['Other long-term liabilities','Liabilities'],B190:['Income taxes payable','Liabilities'],
 B250:['Preferred stock','Equity'],B260:['Common stock','Equity'],B270:['Additional paid-in capital','Equity'],B280:['Retained earnings','Equity'],B290:['Treasury stock','Equity'],B300:['Other comprehensive income','Equity'],B310:['Noncontrolling interest','Equity'],B320:['General partners’ capital','Equity'],B330:['Limited partners’ capital','Equity'],B340:['Members’ capital','Equity']
};
export function amount(v){
 if(typeof v==='number')return Number.isFinite(v)?Math.round(v*100):null;
 if(typeof v!=='string'||!v.trim())return null;
 let s=v.trim().replace(/\$/g,'').replace(/,/g,'').replace(/\s/g,'').replace(/−/g,'-');
 if(/^\(.*\)$/.test(s))s='-'+s.slice(1,-1);
 if(/^-?\d+(\.\d{1,2})?-$/.test(s))s='-'+s.slice(0,-1);
 return /^[-+]?\d+(\.\d{1,2})?$/.test(s)?Math.round(Number(s)*100):null;
}
export function rounded(cents){return Math.sign(cents)*Math.round(Math.abs(cents)/100);}
export function needsOcr(lines){
 const text=lines.join(' ');const compact=text.replace(/\s/g,'');
 const corrupt=(text.match(/[\u0000-\u0008\u000b\u000e-\u001f\ufffd]/g)||[]).length;
 return compact.length<40||corrupt>Math.max(2,compact.length*.01)||((text.match(/[A-Za-z]/g)||[]).length<compact.length*.12);
}
export function moneyMatches(text){
 const tokens=[...text.matchAll(/(?<![\w.])(?:\(\s*\$?\s*[-−]?\d[\d,]*(?:\.\d{2})?\s*\)|\$\s*[-−]?\d[\d,]*(?:\.\d{2})?|[-−]?\d[\d,]*(?:\.\d{2})?)(?![\w.])/g)];
 return tokens.filter(m=>text[m.index+m[0].length]!=='%'&&( /[.$,()]/.test(m[0])||/\s{2}$/.test(text.slice(0,m.index))||(/\s$/.test(text.slice(0,m.index))&&m.index+m[0].length===text.trimEnd().length)));
}
export function selectTotalAmountLine(line){
 const ms=moneyMatches(line.text);
 if(ms.length<2)return line;
 return {...line,text:line.text.slice(0,ms[0].index)+' '+ms[ms.length-1][0],source:line.source+' / total column'};
}
export function reportingDate(year,period){
 const ends={MCRQ1:'03-31',MCRQ2:'06-30',MCRQ3:'09-30',MCRQ4:'12-31',MCRANNUAL:'12-31'};
 return /^\d{4}$/.test(String(year))&&Number(year)>=2026&&ends[period]?String(year)+'-'+ends[period]:'';
}
export function exportXml(result,meta){
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(meta.date||'');
 if(!match)throw Error('Enter the balance sheet reporting date.');
 const year=Number(match[1]),month=Number(match[2]);
 const period=meta.period;
 if(year<2026||year>9999)throw Error('FV7 export supports reporting years 2026 and later.');
 if(!/^MCRQ[1-4]$|^MCRANNUAL$/.test(period))throw Error('Select the reporting period.');
 const ends={MCRQ1:'03-31',MCRQ2:'06-30',MCRQ3:'09-30',MCRQ4:'12-31',MCRANNUAL:'12-31'};
 if(meta.date.slice(5)!==ends[period])throw Error('The balance sheet date must match the selected reporting period end.');
 if(result.issues.length||result.roundingDifference)throw Error('Resolve balance, source-total and whole-dollar rounding differences before XML export.');
 if(!Object.keys(result.groups).length)throw Error('Include at least one mapped NMLS field.');
 const guidanceIssues=definitionIssues(result.groups,meta);if(guidanceIssues.length)throw Error(guidanceIssues.join(' '));
 const sections=Object.fromEntries(Object.keys(fcSchema).map(name=>[name,[]]));
 for(const [code,cents]of Object.entries(result.groups).sort()){
  if(['A060','A062'].includes(code)){if(cents!==0)throw Error(code+' is a review balance. Complete the detailed mortgage-loans-held-for-sale schedule in NMLS before filing; the XML schema does not accept this summary field directly.');continue;}
  const tag=code+'_1',section=Object.keys(fcSchema).find(name=>fcSchema[name][tag]);
  const type=section&&fcSchema[section][tag];
  if(!type)throw Error('Unsupported NMLS XML field: '+code);
  const n=rounded(cents);
  if(!Number.isSafeInteger(cents)||!Number.isSafeInteger(n)||Math.abs(n)>9999999999999)throw Error('Invalid XML amount for '+code);
  if(['PositiveDollar','Count'].includes(type)&&n<0)throw Error(code+' cannot be negative.');
  sections[section].push(`      <${tag}>${n}</${tag}>`);
 }
 if(String(meta.otherAssetsExplanation||'').trim()){const text=String(meta.otherAssetsExplanation).trim().replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&apos;'}[c]));sections.ScheduleASection.push('      <A230J_1>'+text+'</A230J_1>');}
 const body=Object.entries(sections).filter(([,rows])=>rows.length).map(([name,rows])=>`    <${name}>\n${rows.join('\n')}\n    </${name}>`).join('\n');
 return `<?xml version="1.0" encoding="utf-8"?>\n<Mcr formVersion="v7" type="E" year="${year}" periodType="${period}">\n  <Fc>\n${body}\n  </Fc>\n</Mcr>\n`;
}
export function exportCsvText(result,meta){
 const quote=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
 const headers=['Company Name','NMLS ID','As Of Date','NMLS Field','Description','Amount','Original Amount','Balance Difference','Rounding Difference'];
 const data=Object.entries(result.groups).sort().map(([code,cents])=>[
  meta.company,meta.nmls,meta.date,code,fields[code][0],rounded(cents),(cents/100).toFixed(2),(result.difference/100).toFixed(2),result.roundingDifference
 ]);
 return [headers,...data].map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n';
}
export function suggest(label,section){
 const s=label.toLowerCase();let code='';
 if(section==='Assets'){
  if(/loans? held for sale|\bhfs\b/.test(s))code=/fair value|\bfv\b/.test(s)?'A062':'A060';
  else if(/checking|saving|bank account|cash/.test(s))code=/restricted/.test(s)&&!/unrestricted/.test(s)?'A020':'A010';
  else if(/equipment|depreciation|furniture|leasehold/.test(s))code='A180';
  else if(/goodwill|intangible/.test(s))code='A210';
  else if(/due from.*(?:member|owner|officer|related|shareholder)/.test(s))code='A190';
  else if(/receivable/.test(s))code=/shareholder|owner|officer|related/.test(s)?'A190':/accounts|trade/.test(s)?'A230C':'A050';
  else if(/prepaid|deposit|^other assets$/.test(s))code='A230H';
 } else if(section==='Liabilities'){
  if(/shareholder|owner|officer|related/.test(s)||(/due\s+(?:to|from)(?:\s*\/\s*(?:to|from))?/.test(s)&&/holdings?|parent|affiliate|subsidiar|member|partner/.test(s)))code=/long.term/.test(s)?'B130':'B080';
  else if(/warehouse/.test(s))code='B009';
  else if(/line of credit|credit facility/.test(s))code='B010';
  else if(/income tax/.test(s))code='B190';
  else if(/accrued|payroll|tax(?:es)? payable|commissions? payable|compensation payable|bonuses? payable/.test(s))code='B100';
  else if(/credit card|accounts payable|unearned|deferred revenue|unidentified receipts|^other current liabilities$/.test(s))code='B120';
  else if(/loan|note|mortgage/.test(s))code=/long.term/.test(s)?'B140':'B090';
 } else if(section==='Equity'){
  if(/common stock/.test(s))code='B260';else if(/preferred stock/.test(s))code='B250';
  else if(/paid.in|owner.*investment|capital contribution/.test(s))code='B270';
  else if(/net income|net profit|current.*earning|other comprehensive|\boci\b/.test(s))code='B300';
  else if(/retained|accumulated deficit/.test(s))code='B280';
  else if(/treasury/.test(s))code='B290';else if(/member/.test(s))code='B340';
 }
 return code;
}
function currentAssetBreakdown(supplements, expected){
 const candidates=[];
 for(const page of supplements){
  let details=null;
  for(const line of page){
   const text=line.text.trim();
   if(/^accounts receivable$/i.test(text)){details=[];continue;}
   if(!details||!text)continue;
   const matches=moneyMatches(text);
   if(matches.length!==1){details=null;continue;}
   const label=text.slice(0,matches[0].index).trim();
   const cents=amount(matches[0][0]);
   if(/^total(?: accounts receivable)?$/i.test(label)){
    if(cents===expected&&details.length&&details.every(row=>row.code)&&details.reduce((sum,row)=>sum+row.cents,0)===expected)candidates.push(details);
    details=null;
   }else if(label&&cents!==null){
    details.push({label,cents,section:'Assets',code:suggest(label,'Assets'),include:true,source:label+' ('+line.source+')'});
   }else details=null;
  }
 }
 return candidates.length===1?candidates[0]:null;
}
export function parseLines(lines,{supplements=[]}={}){
 let section='',active=true,cashCode='',otherAssets=false;const rows=[],controls={},notes=[];let skipped=0;
 for(let i=0;i<lines.length;i++){
  let {text,source}=typeof lines[i]==='string'?{text:lines[i],source:'Line '+(i+1)}:lines[i];
  text=text.trim(); if(!text)continue;
  const heading=text.replace(/[:\s]+$/,'');
  if(isOtherStatementTitle(text)){active=false;cashCode='';skipped++;continue;}
  if(isBalanceSheetTitle(text)){active=true;section='';cashCode='';otherAssets=false;continue;}
  if(!active){skipped++;continue;}
  const matches=moneyMatches(text);
  if(!matches.length){
   cashCode=section==='Assets'&&/^(?:restricted |unrestricted )?cash\s*(?:and|&)\s*(?:cash\s+)?equivalents(?:,?\s*(?:unrestricted|restricted))?$/i.test(text)?(/restricted/i.test(text)&&!/unrestricted/i.test(text)?'A020':'A010'):'';
   otherAssets=section==='Assets'&&/^other assets$/i.test(heading);
   if(/^(total\s+)?assets$/i.test(heading))section='Assets';
   else if(/^(current |long.term |other current )?liabilities(?: (?:and|&) equity)?$/i.test(heading))section='Liabilities';
   else if(/^(?:(?:members?|owners?|stockholders?|shareholders?)[’'s\s]*)?equity$/i.test(heading))section='Equity';
   continue;
  }
  const first=matches[0],label=text.slice(0,first.index).trim().replace(/\s+/g,' ');
  if(!label||!section)continue;
  if(matches.length>1){notes.push(source+': multiple amounts. Choose the amount column before importing.');continue;}
  const cents=amount(first[0]);if(cents===null)continue;
  const total=/^(total\b|net (?:assets|other assets|fixed assets)\b)/i.test(label);
  if(total){
   if(/^total assets$/i.test(label))controls.assets=cents;
   if(/^total liabilities$/i.test(label))controls.liabilities=cents;
   if(/^total current liabilities$/i.test(label))controls.currentLiabilities=cents;
   if(/^total (?:(?:members?|owners?|stockholders?|shareholders?)[’'s\s]*)?equity$/i.test(label))controls.equity=cents;
   if(/^total liabilities (and|&) (?:(?:members?|owners?|stockholders?|shareholders?)[’'s\s]*)?equity$/i.test(label)){controls.combined=cents;active=false;section='';}
  }
  if(total&&/^total\s+(?:restricted |unrestricted )?cash\s*(?:and|&)\s*(?:cash\s+)?equivalents/i.test(label)){const c=cashCode||(/restricted/i.test(label)&&!/unrestricted/i.test(label)?'A020':'A010');controls[c]=cents;cashCode='';}
  const fixedTotal=section==='Assets'&&/^total\s+fixed\s+assets$/i.test(label);
  if(fixedTotal){
   for(let j=rows.length-1;j>=0;j--){
    if(rows[j].fixedTotal)break;
    if(rows[j].code==='A180')rows[j].include=false;
   }
  }
  const contraOtherAsset=otherAssets&&/^accumulated amorti[sz]ation$/i.test(label);
  const code=fixedTotal?'A180':total?'':contraOtherAsset?'A230H':cashCode||suggest(label,section);
  const needsReview=section==='Assets'&&/^other current assets$/i.test(label);
  const breakdown=needsReview?currentAssetBreakdown(supplements,cents):null;
  if(breakdown){
   for(const row of breakdown)rows.push({...row,id:rows.length+1});
   continue;
  }
  rows.push({id:rows.length+1,label,cents,section,code,include:needsReview||!!code&&(!total||fixedTotal),source:label+' $'+(cents/100).toFixed(2)+' ('+source+')',total:false,fixedTotal});
 }
 const grouped=new Map();
 for(const row of rows.filter(r=>r.include&&r.code)){
  const previous=grouped.get(row.code);
  if(previous){previous.cents+=row.cents;previous.label=fields[row.code][0];previous.source+='; '+row.source;}
  else grouped.set(row.code,{...row});
 }
 return {rows:[...grouped.values(),...rows.filter(r=>r.include&&!r.code)],controls,notes,skipped};
}
export function reconcile(rows,controls={}){
 const selected=rows.filter(r=>r.include);const totals={Assets:0,Liabilities:0,Equity:0},groups={};const issues=[];
 for(const r of selected){
  if(!Number.isSafeInteger(r.cents)){issues.push('Invalid amount: '+r.label);continue;}
  if(!(r.section in totals)){issues.push('Select a section: '+r.label);continue;}
  totals[r.section]+=r.cents;
  if(!r.code||!fields[r.code]||fields[r.code][1]!==r.section)issues.push('Review the NMLS classification: '+r.label);
  else groups[r.code]=(groups[r.code]||0)+r.cents;
 }
 if(controls.currentLiabilities!==undefined){
  const currentCodes=['B009','B010','B080','B090','B100','B120'];
  const actual=currentCodes.reduce((sum,code)=>sum+(groups[code]||0),0);
  if(actual!==controls.currentLiabilities)issues.push('Source current liabilities subtotal differs by '+((actual-controls.currentLiabilities)/100).toFixed(2));
 }
 for(const c of ['A010','A020'])if(controls[c]!==undefined&&(groups[c]||0)!==controls[c])issues.push('Source '+c+' cash subtotal differs by '+(((groups[c]||0)-controls[c])/100).toFixed(2));
 const difference=totals.Assets-totals.Liabilities-totals.Equity;
 if(difference!==0)issues.push('Balance sheet difference: '+(difference/100).toFixed(2));
 for(const [key,actual] of Object.entries({assets:totals.Assets,liabilities:totals.Liabilities,equity:totals.Equity,combined:totals.Liabilities+totals.Equity})){
  if(controls[key]!==undefined&&controls[key]!==actual)issues.push('Source '+key+' total differs by '+((actual-controls[key])/100).toFixed(2));
 }
 const whole={Assets:0,Liabilities:0,Equity:0};
 for(const [code,cents]of Object.entries(groups))whole[fields[code][1]]+=rounded(cents);
 const roundingDifference=whole.Assets-whole.Liabilities-whole.Equity;
 return {totals,groups,whole,difference,roundingDifference,issues,count:selected.length};
}
