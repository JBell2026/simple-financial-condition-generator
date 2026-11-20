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
// Names printed in ALL CAPS on a statement are shown in normal capitalization:
// each word capitalized, short joining words lowercase, known abbreviations kept.
const smallWords=new Set(['a','an','and','as','at','but','by','for','from','in','of','on','or','per','the','to','vs','with']);
const abbreviations=new Set(['LLC','LLP','LP','PLLC','PC','INC','MLO','MLOS','NMLS','AMEX','SBA','IRS','FICA','FUTA','SUTA','SUI','LOS','CPA','PPP','EIDL','USA','US','HOA','IT','HR','ADP','HELOC','FHA','VA','USDA','UPS','USPS','AP','AR','CC','LOC','PTO','HSA','FSA','IRA','SEP','ACH','ATM','MSR','REO','MBS','CEO','CFO','COO','DBA','FKA','II','III','IV','YTD','QBO','GAAP','EBITDA','P&L','A/R','A/P','R&D','G&A','T&E','AT&T']);
export function tidyLabel(label){
 const text=String(label??'');if(!/[A-Z]{2}/.test(text)||/[a-z]/.test(text))return text;
 let first=true;
 return text.replace(/[A-Z0-9][A-Z0-9&/'’.]*/g,word=>{
  const bare=word.replace(/[.'’]+$/,''),start=first;first=false;
  if(/^401\(?K\)?$/i.test(word))return word.toLowerCase();
  if(bare==='INC')return 'Inc'+word.slice(3);
  if(abbreviations.has(bare)||/\d/.test(bare)&&!/[A-Z]{3}/.test(bare)||/^[B-DF-HJ-NP-TV-XZ]{2,5}$/.test(bare))return word; // listed abbreviations, codes, vowel-less initials
  const lower=word.toLowerCase();
  if(!start&&smallWords.has(lower))return lower;
  return lower.replace(/(^|[/&])([a-z])/g,(m,p,c)=>p+c.toUpperCase());
 }).replace(/\(K\)/g,'(k)');
}
// Dollar amounts in messages: $1,234.56, with a leading minus when negative.
export const usd=cents=>(cents<0?'-':'')+'$'+(Math.abs(cents)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const plural=(n,word,many=word+'s')=>n+' '+(n===1?word:many);
export {plural};
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
export const scheduleOFields=Object.keys(fcSchema.ScheduleOSection);
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
  if(!type)throw Error('Unsupported NMLS XML field: '+code+'.');
  const n=rounded(cents);
  if(!Number.isSafeInteger(cents)||!Number.isSafeInteger(n)||Math.abs(n)>9999999999999)throw Error('Invalid XML amount for '+code+'.');
  if(['PositiveDollar','Count'].includes(type)&&n<0)throw Error(code+' cannot be negative.');
  sections[section].push(`      <${tag}>${n}</${tag}>`);
 }
 // Schedule O (loan loss reserves and related activity) is always reported, with every
 // field the schema accepts set to zero, so NMLS shows it as completed rather than blank.
 if(result.groups.D260||result.groups.D270)throw Error('Schedule O is reported with all zeros, but '+(result.groups.D260?'D260':'D270')+' has an amount that NMLS requires to match Schedule O. Remove that amount or complete Schedule O in NMLS.');
 sections.ScheduleOSection=scheduleOFields.map(tag=>`      <${tag}>0</${tag}>`);
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
  else if(/checking|saving|bank account|cash|money market|undeposited funds|operating account|payroll account|trust account|escrow account/.test(s))code=/restricted/.test(s)&&!/unrestricted/.test(s)?'A020':'A010';
  else if(/(?:loans?|notes?|advances?)\s+(?:to|receivable\W+(?:from\s+)?)\s*(?:officer|shareholder|stockholder|member|owner|partner|related|affiliate|employee)|(?:officer|shareholder|stockholder|member|owner|partner|employee)s?['’]?s?\s+(?:loans?|advances?|receivables?)/.test(s))code='A190';
  else if(/equipment|depreciation|furniture|leasehold|vehicle|automobile|computer|building|\bland\b|improvements?/.test(s))code='A180';
  else if(/goodwill|intangible/.test(s))code='A210';
  else if(/due from.*(?:member|owner|officer|related|shareholder)/.test(s))code='A190';
  else if(/receivable/.test(s))code=/shareholder|owner|officer|related/.test(s)?'A190':/accounts|trade/.test(s)?'A230C':'A050';
  else if(/prepaid|deposit|other (?:non.?current |long.term )?assets?$|organization(?:al)? costs?|start.?up costs?|accumulated amorti[sz]ation/.test(s))code='A230H';
 } else if(section==='Liabilities'){
  if(/shareholder|owner|officer|related/.test(s)||(/due\s+(?:to|from)(?:\s*\/\s*(?:to|from))?/.test(s)&&/holdings?|parent|affiliate|subsidiar|member|partner/.test(s)))code=/long.term/.test(s)?'B130':'B080';
  else if(/warehouse/.test(s))code='B009';
  else if(/line of credit|credit facility/.test(s))code='B010';
  else if(/income tax/.test(s))code='B190';
  else if(/accrued|payroll|tax(?:es)? payable|sales tax|withholding|garnish|401\s?\(?k|commissions? payable|compensation payable|bonuses? payable|wages payable|salaries payable/.test(s))code='B100';
  else if(/credit card|accounts payable|unearned|deferred revenue|customer deposits?|unidentified receipts|^other current liabilities$/.test(s))code='B120';
  else if(/lease liabilit|deferred rent/.test(s))code=/current/.test(s)&&!/non.?current/.test(s)?'B120':'B140';
  else if(/loan|note|mortgage/.test(s))code=/long.term/.test(s)?'B140':'B090';
 } else if(section==='Equity'){
  if(/common stock|capital stock/.test(s))code='B260';else if(/preferred stock/.test(s))code='B250';
  else if(/paid.in|owner.*investment|capital contribution/.test(s))code='B270';
  else if(/net income|net profit|current.*earning|other comprehensive|\boci\b/.test(s))code='B300';
  else if(/retained|accumulated deficit|dividends? paid|(?:shareholder|stockholder)s?['’]?s?\s+distributions?/.test(s))code='B280';
  else if(/treasury/.test(s))code='B290';else if(/member/.test(s))code='B340';
 }
 return code;
}
// When an account name alone is not recognizable, the group heading it sits under
// (for example "Credit Cards" or "Bank Accounts") supplies a reviewable suggestion.
export function suggestFromHeading(heading,section){
 const s=String(heading||'').toLowerCase();if(!s)return '';
 if(section==='Assets'){
  if(/bank|checking|savings|cash/.test(s))return 'A010';
  if(/fixed assets|property|equipment/.test(s))return 'A180';
  if(/accounts receivable/.test(s))return 'A230C';
  if(/other (?:current |non.?current |long.term )?assets|prepaid/.test(s))return 'A230H';
 }else if(section==='Liabilities'){
  if(/long.term|non.?current/.test(s))return 'B140';
  if(/credit cards?|accounts payable|current liabilities/.test(s))return 'B120';
 }
 return '';
}
const accountNumber=/^(?:\d{4,8}(?:[.-]\d+)?\s*[-–—:·]?\s+|\d{1,3}(?:[.-]\d+)?\s*[-–—:·]\s+)/;
// Statements with more than one amount column (comparative periods, monthly columns).
// Returns the column count, any header labels, and the default column to import.
export function amountColumns(lines){
 const texts=lines.map(l=>typeof l==='string'?l:l.text||'');const counts={};
 for(const t of texts){const n=moneyMatches(t).length,label=n?t.slice(0,moneyMatches(t)[0].index).trim():'';if(n>1&&label&&!/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b/i.test(t))counts[n]=(counts[n]||0)+1;}
 const best=Object.entries(counts).filter(([,lines])=>lines>1).sort((a,b)=>b[1]-a[1])[0];if(!best)return {count:1,labels:[],index:-1};
 const count=Number(best[0]);let labels=[],index=-1;
 if(!texts.slice(0,40).some(t=>/(?:^|\s{2})(?:grand\s+)?total\s*$/i.test(t)))for(const t of texts.slice(0,40)){
  const parts=t.trim().split(/\s{2,}|\t/).map(p=>p.trim()).filter(Boolean),dates=parts.map(p=>/\d{4}|\d{1,2}\/\d{1,2}\/\d{2}/.test(p)?Date.parse(p.replace(/^(?:as of|as at|at)\s+/i,'')):NaN);
  if(parts.length===count&&dates.every(Number.isFinite)){labels=parts;index=dates.indexOf(Math.max(...dates));break;}
 }
 return {count,labels,index};
}
export function selectAmountColumn(line,index){
 if(index===undefined||index===null||index<0)return selectTotalAmountLine(line);
 const ms=moneyMatches(line.text);if(ms.length<2)return line;
 const pick=ms[Math.min(index,ms.length-1)];
 return {...line,text:line.text.slice(0,ms[0].index)+' '+pick[0],source:line.source+' / amount column '+(Math.min(index,ms.length-1)+1)};
}
// Default column choice is made page by page: a page with dated column headers uses
// its latest period; otherwise the rightmost (Total) column. A chosen index overrides.
export function selectAmountsByPage(lines,override){
 if(Number.isInteger(override)&&override>=0)return lines.map(l=>selectAmountColumn(l,override));
 const pages=new Map();for(const l of lines){const p=l.page??'text';if(!pages.has(p))pages.set(p,[]);pages.get(p).push(l);}
 const index=new Map([...pages].map(([p,items])=>[p,amountColumns(items).index]));
 return lines.map(l=>selectAmountColumn(l,index.get(l.page??'text')));
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
    details.push({label:tidyLabel(label),cents,section:'Assets',code:suggest(label,'Assets'),include:true,source:label+' ('+line.source+')'});
   }else details=null;
  }
 }
 return candidates.length===1?candidates[0]:null;
}
export function parseLines(lines,{supplements=[]}={}){
 let section='',active=true,cashCode='',otherAssets=false,group='',fixedStart=0;const rows=[],controls={},notes=[];let skipped=0;
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
   otherAssets=section==='Assets'&&/^other assets$/i.test(heading);group=heading;
   if(/^(total\s+)?assets$/i.test(heading))section='Assets';
   else if(/^(current |long.term |other current )?liabilities(?: (?:and|&) equity)?$/i.test(heading))section='Liabilities';
   else if(/^(?:(?:members?|owners?|stockholders?|shareholders?)[’'s\s]*)?equity$/i.test(heading))section='Equity';
   continue;
  }
  const first=matches[0],label=text.slice(0,first.index).trim().replace(/\s+/g,' ').replace(accountNumber,'').replace(/^[·•\-–—]\s*/,'');const shown=tidyLabel(label);
  if(!label||!section)continue;
  if(matches.length>1){notes.push(source+': multiple amounts. Choose the amount column before importing.');continue;}
  const cents=amount(first[0]);if(cents===null)continue;
  const total=/^(total\b|net (?:assets|other assets|fixed assets|property)\b)/i.test(label);
  if(total){
   if(/^total assets$/i.test(label))controls.assets=cents;
   if(/^total liabilities$/i.test(label))controls.liabilities=cents;
   if(/^total current liabilities$/i.test(label))controls.currentLiabilities=cents;
   if(/^total (?:(?:members?|owners?|stockholders?|shareholders?)[’'s\s]*)?equity$/i.test(label))controls.equity=cents;
   if(/^total liabilities (and|&) (?:(?:members?|owners?|stockholders?|shareholders?)[’'s\s]*)?equity$/i.test(label)){controls.combined=cents;active=false;section='';}
  }
  if(total&&/^total\s+(?:restricted |unrestricted )?cash\s*(?:and|&)\s*(?:cash\s+)?equivalents/i.test(label)){const c=cashCode||(/restricted/i.test(label)&&!/unrestricted/i.test(label)?'A020':'A010');controls[c]=cents;cashCode='';}
  // Fixed assets keep the statement's own breakdown (cost lines and accumulated
  // depreciation). Their total or net line is a control, not a second amount. When a
  // statement shows only the net line, that line is the amount.
  const fixedLine=section==='Assets'&&/^(?:total|net)\s+(?:fixed\s+assets|property(?:,\s*plant,?)?\s*(?:and|&)\s*equipment)(?:,?\s*net)?$/i.test(label);
  const fixedDetail=fixedLine?rows.slice(fixedStart).filter(r=>r.code==='A180'&&r.include):[];
  if(fixedLine&&fixedDetail.length){for(const r of fixedDetail)r.fixedDetail=true;controls.fixedAssets=(controls.fixedAssets||0)+cents;}
  const fixedTotal=fixedLine&&!fixedDetail.length;
  if(fixedLine)fixedStart=rows.length;
  const contraOtherAsset=otherAssets&&/^accumulated amorti[sz]ation$/i.test(label);
  let code=fixedTotal?'A180':total?'':contraOtherAsset?'A230H':cashCode||suggest(label,section),basis=code?'account name':'';
  if(!total&&!code){code=suggestFromHeading(group,section);if(code)basis='group heading “'+tidyLabel(group)+'”';}
  if(!total&&/long.term|non.?current/i.test(group)&&(code==='B090'||code==='B080')){code=code==='B090'?'B140':'B130';basis='group heading “'+tidyLabel(group)+'”';}
  if(total)group='';
  const needsReview=section==='Assets'&&/^other current assets$/i.test(label);
  const breakdown=needsReview?currentAssetBreakdown(supplements,cents):null;
  if(breakdown){
   for(const row of breakdown)rows.push({...row,id:rows.length+1});
   continue;
  }
  // Every detail account is kept. An account without a recognized NMLS field stays in
  // the review as unclassified instead of being dropped, so the statement still foots.
  rows.push({id:rows.length+1,label:shown,cents,section,code,basis,include:fixedTotal||!total,source:label+' '+usd(cents)+' ('+source+')'+(basis.startsWith('group')?' — suggested from '+basis:''),total:false,fixedTotal});
 }
 const grouped=new Map();
 for(const row of rows.filter(r=>r.include&&r.code)){
  const previous=grouped.get(row.code);
  if(row.code==='A180'){grouped.set('A180:'+row.id,{...row});continue;}
  if(previous){previous.cents+=row.cents;previous.label=fields[row.code][0];previous.source+='; '+row.source;}
  else grouped.set(row.code,{...row});
 }
 return {rows:[...grouped.values(),...rows.filter(r=>r.include&&!r.code)],controls,notes,skipped};
}
export function reconcile(rows,controls={}){
 const selected=rows.filter(r=>r.include);const totals={Assets:0,Liabilities:0,Equity:0},groups={};const issues=[],warnings=[];
 // A whole-dollar statement whose own totals are a few dollars off the sum of its lines
 // is source rounding: reported as a warning, not as a blocking difference.
 const wholeDollars=selected.length>0&&selected.every(r=>Number.isSafeInteger(r.cents)&&r.cents%100===0),sourceDiff=(text,delta)=>{if(wholeDollars&&Math.abs(delta)<=300)warnings.push(text+' by '+usd(delta)+' — rounding in a whole-dollar statement; the detail lines are used.');else issues.push(text+' by '+usd(delta)+'.');};
 for(const r of selected){
  if(!Number.isSafeInteger(r.cents)){issues.push('Invalid amount: '+r.label+'.');continue;}
  if(!(r.section in totals)){issues.push('Select a section: '+r.label+'.');continue;}
  totals[r.section]+=r.cents;
  if(!r.code||!fields[r.code]||fields[r.code][1]!==r.section)issues.push('Review the NMLS classification: '+r.label+'.');
  else groups[r.code]=(groups[r.code]||0)+r.cents;
 }
 if(controls.currentLiabilities!==undefined){
  const currentCodes=['B009','B010','B080','B090','B100','B120'];
  const actual=currentCodes.reduce((sum,code)=>sum+(groups[code]||0),0);
  if(actual!==controls.currentLiabilities)sourceDiff('Source current liabilities subtotal differs',actual-controls.currentLiabilities);
 }
 if(controls.fixedAssets!==undefined){const detail=selected.filter(r=>r.fixedDetail&&Number.isSafeInteger(r.cents)).reduce((t,r)=>t+r.cents,0);if(detail!==controls.fixedAssets)sourceDiff('Source net fixed assets differs',detail-controls.fixedAssets);}
 for(const c of ['A010','A020'])if(controls[c]!==undefined&&(groups[c]||0)!==controls[c])sourceDiff('Source '+c+' cash subtotal differs',(groups[c]||0)-controls[c]);
 const difference=totals.Assets-totals.Liabilities-totals.Equity;
 if(difference!==0)issues.push('Balance sheet difference: '+usd(difference)+'.');
 for(const [key,actual] of Object.entries({assets:totals.Assets,liabilities:totals.Liabilities,equity:totals.Equity,combined:totals.Liabilities+totals.Equity})){
  if(controls[key]!==undefined&&controls[key]!==actual)sourceDiff('Source '+key+' total differs',actual-controls[key]);
 }
 const whole={Assets:0,Liabilities:0,Equity:0};
 for(const [code,cents]of Object.entries(groups))whole[fields[code][1]]+=rounded(cents);
 const roundingDifference=whole.Assets-whole.Liabilities-whole.Equity;
 return {totals,groups,whole,difference,roundingDifference,issues,warnings,count:selected.length};
}
