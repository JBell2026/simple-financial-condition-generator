import {dFields,dFieldMap,suggestD,splitExpense,extractPLFigures,buildScheduleD,addScheduleWorkbook,dReviewRows} from './schedule-d.mjs';
import {addBalanceReview} from './calculated.mjs';
import {amount as exactAmount,moneyMatches,selectTotalAmountLine,selectAmountsByPage,tidyLabel,plural,wholeCents,usd} from './engine.mjs';
// Amounts typed or read in this section are whole dollars.
const amount=value=>wholeCents(exactAmount(value));
import {isBalanceSheetTitle,isOtherStatementTitle,pageChecks,chosenPages,onlyPages,pagePhrase} from './balance-source.mjs';
export const categories=[['A','Payroll Director'],['B','Payroll'],['C','Benefits'],['D','Payroll Expenses'],['E','Occupancy and Equipment'],['F','Technology Related'],['G','Outsourcing'],['H','Professional'],['I','Other'],['J','Interest Paid']];
export function classifyExpense(label){
 const s=label.toLowerCase();if(/loan officer|\bmlo\b|sales commission|^commissions?(?: expense| paid)?$/.test(s))return 'B';const rules=[['A',/owner|officer|director|executive compensation/],['B',/mlo commission|loan officer|salary|salaries|wages|payroll(?! tax| fee| processing)/],['C',/payroll tax|fica|futa|suta|unemployment|health|medical|dental|\bvision\b|benefit|education|training|401|retirement/],['D',/payroll fee|payroll processing/],['E',/rent|lease|utilit|phone|telephone|equipment|repair|maintenance|auto|vehicle|car\b|property tax|computer purchase/],['F',/software|technology|internet|tech support|\blos\b|dialer|hosting|quickbooks|godaddy|docusign/],['G',/processing.*fulfillment|processor commission|contract labor|contractor|outsourc|third.party processor/],['H',/advertis|marketing|lead|accounting|legal|compliance|licen[sc]|permit|professional|consult|recruit/],['J',/interest expense|interest paid|credit card interest/]];
 return rules.find(([,rx])=>rx.test(s))?.[0]||'I';
}
export function expenseConfidence(row){
 if(row.categoryReviewed)return {level:'reviewed',label:'Reviewed',reason:'You selected this SFC category. This does not verify the source amount.'};
 if(!Number.isSafeInteger(row.cents)||!String(row.label||'').trim())return {level:'low',label:'Needs review',reason:'The description or amount is incomplete.'};
 if(row.source==='Manual'||/\/ split/.test(row.source||''))return {level:'low',label:'Needs review',reason:'This line was entered or split manually; confirm its category.'};
 const suggested=classifyExpense(row.label);
 if(suggested!==row.category||suggested==='I')return {level:'low',label:'Needs review',reason:'No clear category match, or the current category differs from the suggested match.'};
 const specific={A:/\b(?:director|executive compensation)\b/i,B:/\b(?:salaries|salary|wages|payroll|loan officer|mlo)\b/i,C:/\b(?:health insurance|dental|vision|fica|futa|suta|payroll tax|retirement|401k)\b/i,D:/payroll (?:fee|processing)/i,E:/\b(?:rent|utilities|equipment lease)\b/i,F:/\b(?:software|hosting|quickbooks|docusign)\b/i,G:/\b(?:outsourcing|contract labor|third.party processor)\b/i,H:/\b(?:legal|accounting|compliance|advertising)\b/i,J:/interest (?:expense|paid)/i};
 if(specific[suggested]?.test(row.label))return {level:'high',label:'High',reason:'The expense description directly matches a category rule. Confirm the amount against the source.'};
 return {level:'medium',label:'Medium',reason:'The description matches a broader category rule; confirm the classification.'};
}
export function parseExpenses(lines,includeCogs=false){
 let active=false,cogs=false,costHeader=null,cogsCount=0,blocked=false,finished=false,repeated=0;const out=[],costOfRevenue={total:0,count:0};
 const pages=new Map();for(const entry of lines){if(entry?.page!=null){if(!pages.has(entry.page))pages.set(entry.page,[]);pages.get(entry.page).push(entry.text||'');}}
 const excludedPages=new Set([...pages].filter(([,texts])=>(!texts.some(t=>isOtherStatementTitle(t))&&texts.some(t=>isBalanceSheetTitle(t)||/^(?:(?:consolidated|comparative|combined|condensed|unaudited)\s+)*(?:statements?\s+of\s+)?cash\s*flows?/i.test(t.trim())))||(!texts.some(t=>isOtherStatementTitle(t))&&texts.some(t=>/^assets\s*$/i.test(t.trim()))&&texts.some(t=>/^(?:total\s+)?liabilities\b/i.test(t.trim())))).map(([page])=>page));
 let lastPage;
 const push=(label,cents,source,category,group)=>out.push({id:out.length+1,label:tidyLabel(label),cents,source,category:category||classifyExpense(label),include:true,...(group?{group}:{})});
 // Cost of revenue is tracked separately. Its lines join the expense list only when
 // includeCogs is on; a heading or total amount is used only when no detail lines exist.
 const costLine=(label,cents,source)=>{costOfRevenue.total+=cents;costOfRevenue.count++;if(includeCogs)push(label,cents,source,undefined,'Cost of revenue');};
 function finishCogs(){if(cogs&&!cogsCount&&costHeader&&costHeader.cents)costLine(costHeader.label,costHeader.cents,costHeader.source);cogs=false;costHeader=null;cogsCount=0;}
 const cost=/^(?:cost\s+of\s+(?:goods\s+sold|sales|revenue)|direct\s+costs)\b/i;
 for(const entry of lines){
  if(entry?.page!=null){if(excludedPages.has(entry.page)){active=false;blocked=true;continue;}if(lastPage!==undefined&&lastPage!==entry.page){active=false;blocked=false;}lastPage=entry.page;}
  const raw=(typeof entry==='string'?entry:entry.text).replace(/[\u00a0\u202f]/g,' ').trim(),source=entry.source||'Statement';
  if(!raw)continue;
  // Account codes identify the expense, rather than representing an amount.
  const cleaned=raw.replace(/^\d{3,8}(?:[.-]\d+)?\s*[-–—:·]?\s+/,'').replace(/^[·•]\s*/,'');
  const text=selectTotalAmountLine({text:cleaned,source}).text;
  if(isBalanceSheetTitle(text)||/^(?:(?:consolidated|comparative|combined|condensed|unaudited)\s+)*(?:statements?\s+of\s+)?cash\s*flows?/i.test(text)){finishCogs();active=false;blocked=true;continue;}
  if(isOtherStatementTitle(text)){finishCogs();active=false;blocked=false;continue;}
  if(blocked)continue;
  const matches=moneyMatches(text),first=matches[0],label=(first?text.slice(0,first.index):text).trim().replace(/(?:\s+[-–—])+\s*$/,'').replace(/\s+/g,' ').replace(/[:\s]+$/,'');
  const cents=first?amount(first[0]):null;
  if(/^total\s+/i.test(label)&&cost.test(label.replace(/^total\s+/i,''))){if(cogs){if(costHeader&&!costHeader.cents&&cents)costHeader.cents=cents;finishCogs();active=false;}continue;}
  if(cost.test(label)){finishCogs();cogs=true;costHeader={label,cents,source:source+' | Original P&L line: '+raw};active=false;continue;}
  if(/^gross\s+(?:profit|loss|margin)/i.test(label)){finishCogs();active=false;continue;}
  // The first complete income statement ends at its net income line. A later
  // presentation of the same period (management or non-GAAP view) is not imported again.
  if(finished){if(cents!==null&&label&&!/^(?:total|subtotal|net)\b/i.test(label))repeated++;continue;}
  if(/^net\s+(?:income|profit|loss|earnings)(?:\s*\(loss\))?$/i.test(label)&&cents!==null&&(out.length||costOfRevenue.count)){finishCogs();active=false;finished=true;continue;}
  if(/^(?:(?:total|net)\s+)?(?:net\s+(?:income|profit|loss|earnings)|operating\s+(?:income|profit|loss)|other\s+income|earnings\s+before|ebitda)/i.test(label)){finishCogs();active=false;continue;}
  // A heading such as "General Expenses" that carries its own amount inside an expense
  // section is an expense line, not a new heading.
  const expenseHeading=/^(?:(?:ordinary|operating|other|administrative|business|general(?:\s*(?:and|&)\s*administrative)?)\s+)?expenses?(?:\s*\([^)]*\))?$/i.test(label);
  if((expenseHeading&&!(cents&&(active||/^other\s/i.test(label))&&!/^(?:operating\s+)?expenses?$/i.test(label)))||/^(?:expense|expenses)\s*[-:]?\s*(?:amount|total)$/i.test(label)){finishCogs();active=true;continue;}
  if(/^(?:total\s+)?(?:(?:trading|operating|ordinary|gross)\s+)?(?:income|revenues?|sales)(?:\s+income)?$/i.test(label)){finishCogs();active=false;continue;}
  if(/\brevenues?\b/i.test(label))continue;
  if(cogs){if(label&&cents&&!/^(?:total|subtotal)\b/i.test(label)){cogsCount++;costLine(label,cents,source+' | Original P&L line: '+raw);}continue;}
  const standaloneAdjustment=/^(?:interest expenses?|(?:provision for |total )?income tax(?:es)?(?: expense| provision)?|provision for (?:income )?taxes|extraordinary items?|noncontrolling interest)$/i.test(label)&&cents!==null;
  if(!active&&!standaloneAdjustment)continue;
  if(/^total\s+(?:(?:operating|other|ordinary|administrative|business)\s+)?expenses?$/i.test(label)){finishCogs();active=false;continue;}
  if((!active&&!standaloneAdjustment)||/^(?:total|subtotal)\b/i.test(label))continue;
  if(!label||cents===null||cents===0)continue;
  if(/^(?:page\b|for the\b|as of\b|accrual basis\b|cash basis\b|notes?\b|schedule [a-z]\b)/i.test(label))continue;
  push(label,cents,source+' | Original P&L line: '+raw);
 }
 finishCogs();for(const r of out)r.cents=wholeCents(r.cents);costOfRevenue.total=wholeCents(costOfRevenue.total);out.costOfRevenue=costOfRevenue;out.repeatedLines=repeated;return out;
}
export function expenseSummary(rows){
 const active=rows.filter(r=>r.include),counts={},totals={};const issues=[];
 for(const r of active){if(!Number.isSafeInteger(r.cents))issues.push('Invalid amount: '+r.label+'.');if(!categories.some(([c])=>c===r.category))issues.push('Choose a category: '+r.label+'.');counts[r.category]=(counts[r.category]||0)+1;totals[r.category]=(totals[r.category]||0)+(r.cents||0);}
 if(active.length>75)issues.push('Include no more than 75 expenses.');
 for(const [c,n]of Object.entries(counts))if(n>25)issues.push((categories.find(([v])=>v===c)?.[1]||c)+' exceeds 25 entries.');
 return {active,counts,totals,issues,total:active.reduce((s,r)=>s+(r.cents||0),0)};
}
export function mountAllocator({readPdf,getSource,getMeta,onChange,getBalance}){
 const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),money=c=>usd(c);
 let rows=[],file=null,book=null,lastLines=[],sourceName='',busy=false,cost={total:0,count:0};
 function message(s){$('expenseStatus').textContent=s;}
 function render(){
  $('expenseRows').innerHTML=rows.map(r=>`<tr data-id="${r.id}"><td><input type="checkbox" data-key="include" aria-label="Include expense ${esc(r.label)}" ${r.include?'checked':''}></td><td><input data-key="label" aria-label="Expense description" value="${esc(r.label)}"></td><td><input data-key="cents" aria-label="Expense amount" value="${r.cents===null?'':(r.cents/100).toFixed(0)}" inputmode="numeric"></td><td><select data-key="category" aria-label="Expense category">${categories.map(([c,n])=>`<option value="${c}" ${r.category===c?'selected':''}>${c} — ${n}</option>`).join('')}</select></td><td data-confidence="${r.id}"></td><td><details class="row-detail"><summary>Source</summary>${esc(r.source)}</details></td><td><button data-remove="${r.id}" aria-label="Remove expense">×</button></td></tr>`).join('');
  $('scheduleAllocationRows').innerHTML=rows.map(r=>`<tr data-id="${r.id}"><td>${esc(r.label)}</td><td>${money(r.cents||0)}</td><td><select data-key="field" aria-label="Schedule D field"><option value="">Select NMLS field</option>${['Interest expense','Personnel','Operating expenses','Corporate allocations','Taxes and adjustments'].map(section=>`<optgroup label="${section==='Interest expense'?'Schedule C — Interest expense':'Schedule D — '+section}">${dFields.filter(f=>f.section===section).map(f=>`<option value="${f.code}" ${r.field===f.code?'selected':''}>${f.code} — ${esc(f.label)}</option>`).join('')}</optgroup>`).join('')}</select></td><td><button type="button" class="secondary" data-split="${r.id}">Split</button></td></tr>`).join('');
  $('expenseEmpty').hidden=rows.length>0;summary();
 }
 function getReport(){return buildScheduleD(rows,{gross:amount($('scheduleGross').value),interest:$('scheduleInterest').value.trim()?amount($('scheduleInterest').value):0,reportedNet:amount($('scheduleNet').value),sourceExpenses:$('scheduleExpenseControl').value.trim()?(amount($('scheduleExpenseControl').value)??NaN):null,incomeField:$('incomeField').value,incomeSplit:$('splitRevenue').checked?{field:$('incomeField2').value,cents:amount($('incomeSplitAmount').value)}:null,meta:getMeta()});}
 function summary(){const s=expenseSummary(rows),report=getReport();for(const r of rows){const cell=$('expenseRows').querySelector('[data-confidence="'+r.id+'"]');if(cell){const confidence=expenseConfidence(r);cell.innerHTML='<span class="expense-confidence '+confidence.level+'" title="'+esc(confidence.reason)+'">'+confidence.label+'</span>';}}$('expenseCount').textContent=s.active.length+' / 75';$('expenseTotal').textContent=money(s.total);$('expenseBottomTotal').textContent=money(s.total);const grossValue=amount($('scheduleGross').value),interestValue=$('scheduleInterest').value.trim()?amount($('scheduleInterest').value):0;{const ok=Number.isSafeInteger(grossValue)&&Number.isSafeInteger(interestValue),name=id=>$(id).selectedOptions[0].textContent,sp=ok&&$('splitRevenue').checked?report.groups[$('incomeField2').value]:undefined,splitOk=$('splitRevenue').checked&&$('incomeField2').value!==$('incomeField').value&&Number.isSafeInteger(sp)&&sp>0;
 $('incomeAmountPreview').innerHTML=!ok?'Enter valid gross income and interest income to see the amount sent to NMLS.':esc(money(grossValue)+' gross income − '+money(interestValue)+' interest income = '+money(grossValue-interestValue))+(splitOk?':<br>'+esc(money(grossValue-interestValue-sp)+' to '+name('incomeField'))+'<br>'+esc(money(sp)+' to '+name('incomeField2')):esc(' to '+name('incomeField'))+($('splitRevenue').checked?'<br>Enter the amount for the second field to split it.':''));}const issues=s.active.length?[...s.issues,...report.issues,...report.warnings]:s.issues;$('expenseChecks').textContent=issues.join(' ');$('expenseChecks').hidden=!issues.length;$('downloadExpenses').disabled=!s.active.length||busy;
 // Reconciliation of the imported P&L to its own net income, in plain steps.
 // It uses every included line, whether or not an NMLS field has been chosen yet,
 // so an unassigned line shows as its own to-do instead of as an unexplained gap.
 {const adj=['D520','D540','D560'],valid=s.active.filter(r=>Number.isSafeInteger(r.cents)),sumOf=list=>list.reduce((t,r)=>t+r.cents,0),listExpenses=sumOf(valid.filter(r=>!adj.includes(r.field))),adjustments=-sumOf(valid.filter(r=>r.field==='D520'))+sumOf(valid.filter(r=>r.field==='D540'||r.field==='D560')),unassigned=valid.filter(r=>!r.field),hasGross=Number.isSafeInteger(grossValue),whole=c=>Math.sign(c)*Math.round(Math.abs(c)/100)*100,dollars=c=>(c<0?'-':'')+'$'+(Math.abs(c)/100).toLocaleString('en-US',{maximumFractionDigits:0}),incomeShown=hasGross?whole(grossValue):0,expensesShown=whole(listExpenses),adjustmentsShown=whole(adjustments),calcNet=incomeShown-expensesShown+adjustmentsShown,hasNet=Number.isSafeInteger(report.reportedNet)&&hasGross,reportedShown=hasNet?whole(report.reportedNet):null,diff=hasNet?calcNet-reportedShown:null,line=(label,hint,value,cls='')=>'<tr class="'+cls+'"><td>'+label+(hint?'<br><small>'+hint+'</small>':'')+'</td><td>'+(value===null?'—':dollars(value))+'</td></tr>';
 $('plReconcile').hidden=!s.active.length&&!Number.isSafeInteger(grossValue);$('plReconcileIntro').hidden=$('plReconcile').hidden;
 $('plReconcile').innerHTML='<table><thead><tr><th>Does this P&amp;L add up?</th><th>Amount</th></tr></thead><tbody>'
  +line('Total income','The “Total gross income” box above, read from the P&amp;L’s revenue. Sent to NMLS as C800.',hasGross?incomeShown:null)
  +line('Minus the expenses listed above','The total of every ticked line in the expense table. Sent to NMLS as D310.'+(unassigned.length?' Includes '+dollars(whole(sumOf(unassigned)))+' on '+unassigned.length+' line'+(unassigned.length===1?'':'s')+' that still '+(unassigned.length===1?'needs':'need')+' an NMLS field.':''),expensesShown)
  +(adjustments?line('Income taxes and adjustments','Expense lines assigned to D520, D540 or D560.',hasGross?adjustmentsShown:null):'')
  +line('Net income from these numbers','Total income minus the expenses'+(adjustments?' and taxes':'')+' above. This is what NMLS will calculate as D600.',hasGross?calcNet:null,'calculated-row')
  +line('Net income printed on the P&amp;L','Read from the statement’s own net income or net loss line.',Number.isSafeInteger(report.reportedNet)?whole(report.reportedNet):null)
  +'<tr class="'+(diff===0?'reconciled':'unreconciled')+'"><th>'+(diff===null?'Enter total income and the P&amp;L’s net income to compare':diff===0?'They match':'They do not match — difference')+'</th><th>'+(diff===null?'—':dollars(diff))+'</th></tr></tbody></table>'+(diff&&Math.abs(diff)<=500&&valid.every(r=>r.cents%100===0)?'<p class="small">A difference this small is rounding to whole dollars. Change one expense line, or the net income, by that amount so the figures tie. The app does not adjust anything for you.</p>':'');
 const excluded=cost.total&&!$('includeCogs').checked;$('costNotice').hidden=!cost.total;
 $('costNotice').textContent=cost.total?(excluded?'This P&L reports '+money(cost.total)+' of cost of revenue / cost of goods sold ('+cost.count+' line'+(cost.count===1?'':'s')+') that is not in the expense list.'+(diff!==null&&Math.abs(diff-cost.total)<=500?(diff===cost.total?' That amount equals the reconciliation difference.':' That accounts for the reconciliation difference, apart from rounding.'):'')+' Tick “Include cost of revenue lines” if those costs, such as loan officer commissions, belong in Schedule D.':money(cost.total)+' of cost of revenue ('+cost.count+' line'+(cost.count===1?'':'s')+') is included in the expense list. Review each category.'):'';}
 // Schedule C at a glance: every Schedule C line that will carry an amount, the amount,
 // and where on this page that amount comes from.
 {const incomeNames={C210:'Origination fees',C220:'Fees from correspondents and brokers',C230:'Broker fees',C240:'Other origination income',C770:'Other non-interest income'},g=report.groups,ok=Number.isSafeInteger(grossValue)&&Number.isSafeInteger(interestValue);
 const first=$('incomeField').value,second=$('splitRevenue').checked&&Number.isSafeInteger(g[$('incomeField2').value])&&$('incomeField2').value!==first?$('incomeField2').value:'';
 const row=(code,name,value,from,cls='')=>'<tr class="'+cls+'"><td>'+code+'</td><td>'+esc(name)+'<br><small>'+from+'</small></td><td>'+(value===null?'—':money(value))+'</td></tr>';
 const interestLines=s.active.filter(r=>/^C1[0-5]0$/.test(r.field||'')&&Number.isSafeInteger(r.cents)),interestCodes=[...new Set(interestLines.map(r=>r.field))].sort();
 const names=list=>list.map(r=>esc(r.label)).join(', ');
 $('scheduleCBreakdown').innerHTML='<table><thead><tr><th>NMLS line</th><th>What goes there</th><th>Amount</th></tr></thead><tbody>'
  +'<tr class="group-row"><th colspan="3">Income</th></tr>'
  +row(first,incomeNames[first],ok?g[first]:null,second?'Total gross income, minus other interest income, minus the amount split to '+second+'. Set in “What type of revenue is this?” above.':'Total gross income minus other interest income. Set in “What type of revenue is this?” above.')
  +(second?row(second,incomeNames[second],ok?g[second]:null,'The “Amount for the second type” you entered in the revenue split above.'):'')
  +row('C060','Other interest income',ok?g.C060:null,'The “Other interest income” box above. Enter 0 if the company earned none.')
  +row('C800','Total gross income',ok?report.gross:null,'NMLS adds this up itself from the income lines above. It should equal the “Total gross income” box.','calculated-row')
  +'<tr class="group-row"><th colspan="3">Interest expense</th></tr>'
  +(interestCodes.length?interestCodes.map(code=>row(code,dFieldMap[code].label,g[code]??0,'Expense lines assigned to '+code+': '+names(interestLines.filter(r=>r.field===code))+'.')).join('')+row('C160','Total interest expense',interestCodes.reduce((t,c)=>t+(g[c]||0),0),'NMLS adds this up itself from the interest expense lines above.','calculated-row')
   :'<tr><td>C100–C150</td><td>No interest expense<br><small>None of the expense lines is assigned to an interest expense line. To add one, set an expense’s SFC category to J — Interest Paid, or choose a C100–C150 field for it in the detailed review.</small></td><td>'+money(0)+'</td></tr>')
  +'</tbody></table>';
 $('scheduleCBox').hidden=!s.active.length&&!Number.isSafeInteger(grossValue);}
 $('scheduleDPreview').innerHTML='<table><thead><tr><th>NMLS field</th><th>Description</th><th>Original</th><th>NMLS whole dollars</th></tr></thead><tbody>'+dReviewRows(report).map(r=>'<tr class="'+(r.deps?'calculated-row':'')+'"><td>'+r.code+'</td><td>'+esc(r.label)+(r.formula?'<details class="row-detail"><summary>Calculation</summary>'+esc(r.formula)+'</details>':'')+'</td><td>'+money(r.cents)+'</td><td>'+money(r.whole*100)+'</td></tr>').join('')+'</tbody></table>';return s;}
 ['scheduleGross','scheduleInterest','scheduleNet','scheduleExpenseControl','incomeField','incomeField2','incomeSplitAmount'].forEach(id=>$(id).addEventListener('input',()=>{onChange();summary();}));
 // Splitting revenue: the second field defaults to one different from the first.
 $('splitRevenue').addEventListener('change',()=>{const on=$('splitRevenue').checked;$('splitRevenueFields').hidden=!on;if(on&&$('incomeField2').value===$('incomeField').value)$('incomeField2').value=[...$('incomeField2').options].find(o=>o.value!==$('incomeField').value).value;if(!on)$('incomeSplitAmount').value='';onChange();summary();});
 // Worksheet and column pickers apply to Excel P&Ls only.
 // A new source resets the page picker; picking a page re-reads only that page.
 let sourceLines=[];
 function setSource(lines,name){sourceLines=lines;const pages=pageChecks(lines,esc,tidyLabel);$('plPage').innerHTML=pages.html;$('plPageBox').hidden=pages.count<2;load(lines,name);}
 $('plPage').onchange=()=>{const pages=chosenPages($('plPage'));load(onlyPages(sourceLines,pages),sourceName);if(pages!==null)message(!pages.length?'Tick at least one page to read.':rows.length?`${plural(rows.length,'expense line')} read from ${pagePhrase(pages)} of ${sourceName} only. Review each allocation.`:`No expense lines were found on ${pagePhrase(pages)}.`);};
 function showChoices(){$('expenseSheet').closest('label').hidden=!book||$('expenseSheet').options.length<2;$('expenseColumn').closest('label').hidden=!book;}
 function setBusy(v){if(!v)showChoices();busy=v;['expenseFile','useStatement','analyzeExpenses','downloadExpenses','expenseSheet','expenseColumn','includeCogs'].forEach(id=>$(id).disabled=v);$('plPage').querySelectorAll('input').forEach(b=>b.disabled=v);summary();}
 function load(lines,name){lastLines=lines;sourceName=name;const parsed=parseExpenses(lines,$('includeCogs').checked);cost=parsed.costOfRevenue;const repeatedLines=parsed.repeatedLines;rows=parsed.map(r=>{const field=suggestD(r.label,r.category);return {...r,field,category:r.category};});const figures=extractPLFigures(lines);if(figures.gross!==undefined)$('scheduleGross').value=(figures.gross/100).toFixed(0);$('scheduleInterest').value=figures.interest===undefined?'':(figures.interest/100).toFixed(0);if(figures.reportedNet!==undefined)$('scheduleNet').value=(figures.reportedNet/100).toFixed(0);onChange();render();message(rows.length?`${plural(rows.length,'expense line')} from ${name}. Review each allocation.`+(repeatedLines>2?` The first income statement, through its net income line, was imported; ${repeatedLines} amount lines after it (a second presentation or a supporting schedule) were left out so nothing is counted twice.`:''):'No expense lines were recognized. Check that the PDF includes an Expenses or Cost of Revenue section. If this continues, share the PDF so we can check its layout.');}
 // Pick the amount column of an Excel P&L: a column headed Total if there is one,
 // otherwise the rightmost column among those holding the most numbers.
 function detectColumn(){
  const sheet=book?.Sheets[$('expenseSheet').value];if(!sheet||!sheet['!ref'])return;const range=XLSX.utils.decode_range(sheet['!ref']),counts={};let total=null;
  for(let r=range.s.r;r<=Math.min(range.e.r,5000);r++)for(let c=range.s.c;c<=Math.min(range.e.c,200);c++){const cell=sheet[XLSX.utils.encode_cell({r,c})];if(!cell)continue;if(typeof cell.v==='number'&&c>range.s.c)counts[c]=(counts[c]||0)+1;else if(r<range.s.r+20&&typeof cell.v==='string'&&/^(?:grand\s+)?total$/i.test(cell.v.trim()))total=c;}
  const most=Math.max(0,...Object.values(counts));if(!most)return;
  const best=total!==null&&counts[total]?total:Math.max(...Object.keys(counts).filter(c=>counts[c]>=most*.8).map(Number));
  $('expenseColumn').value=XLSX.utils.encode_col(best);
 }
 function workbookLines(){
  const sheet=book.Sheets[$('expenseSheet').value],range=XLSX.utils.decode_range(sheet['!ref']||'A1');if(range.e.r>5000||range.e.c>1000)throw Error('Choose a P&L worksheet with no more than 5,000 rows.');const col=XLSX.utils.decode_col($('expenseColumn').value.toUpperCase());const lines=[];
  for(let r=range.s.r;r<=range.e.r;r++){const label=String(sheet[XLSX.utils.encode_cell({r,c:0})]?.v||'');const cell=sheet[XLSX.utils.encode_cell({r,c:col})];const cents=amount(cell?.v);lines.push({text:label+(cents===null?'':'  $'+(cents/100).toFixed(2)),source:$('expenseSheet').value+'!'+$('expenseColumn').value+(r+1)});}
  return lines;
 }
 async function analyze(){if(!file)return;setBusy(true);try{message('Reading P&L…');if(/\.pdf$/i.test(file.name)){const lines=await readPdf(file,message,{mode:'expenses'});setSource(selectAmountsByPage(lines),file.name);}else setSource(workbookLines(),file.name);}catch(e){message('Unable to read P&L: '+e.message);}finally{setBusy(false);}}
 $('useStatement').onclick=()=>{const src=getSource();if(!src.lines.length){message('Upload a financial statement in the Schedules A & B upload first.');return;}file=null;book=null;$('expenseFile').value='';showChoices();setSource(src.lines,src.name||'Uploaded statement');};
 $('expenseFile').onchange=async()=>{file=$('expenseFile').files[0];if(!file)return;['scheduleGross','scheduleInterest','scheduleNet','scheduleExpenseControl'].forEach(id=>$(id).value='');rows=[];book=null;lastLines=[];sourceName='';cost={total:0,count:0};render();onChange();if(file.size>40*1024*1024){message('Choose a P&L file under 40 MB.');return;}if(!/\.(pdf|xlsx|xlsm|xls|csv)$/i.test(file.name)){message('Choose PDF or Excel.');return;}if(!/\.pdf$/i.test(file.name)){try{book=XLSX.read(await file.arrayBuffer(),{type:'array',raw:/\.csv$/i.test(file.name)});$('expenseSheet').innerHTML=book.SheetNames.map(n=>`<option>${esc(n)}</option>`).join('');const name=book.SheetNames.find(n=>/profit|p.?l|income/i.test(n));if(name)$('expenseSheet').value=name;detectColumn();}catch(e){message(e.message);return;}}await analyze();};
 $('analyzeExpenses').onclick=()=>{if(file)analyze();else if(lastLines.length)load(lastLines,sourceName);else message('Use the uploaded statement or choose a P&L file first.');};
 $('expenseSheet').onchange=()=>{detectColumn();analyze();};
 $('expenseColumn').onchange=()=>{if(file&&book)analyze();};
 $('includeCogs').onchange=()=>{if(lastLines.length)load(lastLines,sourceName);};
 $('addExpense').onclick=()=>{rows.push({id:Math.max(0,...rows.map(r=>r.id))+1,label:'New expense',cents:0,category:'I',field:'D280',include:true,source:'Manual'});onChange();render();};
 $('expenseRows').addEventListener('input',e=>{const r=rows.find(r=>r.id===Number(e.target.closest('tr')?.dataset.id));const k=e.target.dataset.key;if(!r||!k)return;r[k]=k==='include'?e.target.checked:k==='cents'?amount(e.target.value):e.target.value;if(k==='category'){r.field=suggestD('',r.category);r.categoryReviewed=true;}if(k==='label')r.categoryReviewed=false;if(k==='category'||k==='field'){onChange();render();return;}onChange();summary();});
 $('scheduleAllocationRows').addEventListener('input',e=>{const r=rows.find(r=>r.id===Number(e.target.closest('tr')?.dataset.id));const k=e.target.dataset.key;if(!r||!k)return;r[k]=k==='include'?e.target.checked:k==='cents'?amount(e.target.value):e.target.value;if(k==='category'){r.field=suggestD('',r.category);r.categoryReviewed=true;}if(k==='label')r.categoryReviewed=false;if(k==='category'||k==='field'){onChange();render();return;}onChange();summary();});
 $('expenseRows').addEventListener('change',e=>{if(e.target.tagName==='SELECT'||e.target.type==='checkbox'){const r=rows.find(r=>r.id===Number(e.target.closest('tr')?.dataset.id)),k=e.target.dataset.key;if(!r||!k)return;r[k]=k==='include'?e.target.checked:e.target.value;if(k==='category'){r.field=suggestD('',r.category);r.categoryReviewed=true;}if(k==='label')r.categoryReviewed=false;if(k==='category'||k==='field'){onChange();render();return;}onChange();summary();}});
 $('scheduleAllocationRows').addEventListener('change',e=>{if(e.target.tagName==='SELECT'||e.target.type==='checkbox'){const r=rows.find(r=>r.id===Number(e.target.closest('tr')?.dataset.id)),k=e.target.dataset.key;if(!r||!k)return;r[k]=k==='include'?e.target.checked:e.target.value;if(k==='category'){r.field=suggestD('',r.category);r.categoryReviewed=true;}if(k==='label')r.categoryReviewed=false;if(k==='category'||k==='field'){onChange();render();return;}onChange();summary();}});
 let splitId=null;
 $('splitField').innerHTML=dFields.map(f=>'<option value="'+f.code+'">'+f.code+' — '+esc(f.label)+'</option>').join('');
 $('cancelSplit').onclick=()=>$('splitExpenseDialog').close();
 $('applySplit').onclick=()=>{try{splitExpense(rows,splitId,amount($('splitAmount').value),$('splitField').value);onChange();render();$('splitExpenseDialog').close();}catch(e){$('splitError').textContent=e.message;}};
 $('expenseRows').addEventListener('click',e=>{if(e.target.dataset.split){const row=rows.find(r=>r.id===Number(e.target.dataset.split));splitId=row.id;$('splitOriginal').textContent=row.label+' — '+money(row.cents);$('splitAmount').value='';$('splitError').textContent='';$('splitField').value=row.field||'D280';$('splitExpenseDialog').showModal();return;}if(e.target.dataset.remove){rows=rows.filter(r=>r.id!==Number(e.target.dataset.remove));onChange();render();}});
 $('scheduleAllocationRows').addEventListener('click',e=>{if(e.target.dataset.split){const row=rows.find(r=>r.id===Number(e.target.dataset.split));splitId=row.id;$('splitOriginal').textContent=row.label+' — '+money(row.cents);$('splitAmount').value='';$('splitError').textContent='';$('splitField').value=row.field||'D280';$('splitExpenseDialog').showModal();return;}if(e.target.dataset.remove){rows=rows.filter(r=>r.id!==Number(e.target.dataset.remove));onChange();render();}});
 $('downloadExpenses').onclick=async()=>{
  const s=summary(),meta=getMeta();if(!s.active.length||s.issues.length){message(s.issues.join(' ')||'Include at least one expense.');return;}if(!meta.company){message('Enter the company name in Client & reporting details first.');return;}
  setBusy(true);try{
   const res=await fetch('sfc-template.xlsx');if(!res.ok)throw Error('SFC template could not be loaded.');const wb=new ExcelJS.Workbook();await wb.xlsx.load(await res.arrayBuffer());const ws=wb.getWorksheet('Sheet1 (2)')||wb.worksheets[0];ws.insertRows(21,Array.from({length:7},()=>[]),'i');
   for(let r=3;r<=27;r++)for(let c=1;c<=10;c++)ws.getCell(r,c).value=null;
   const pos={};for(const r of s.active){pos[r.category]=(pos[r.category]||0)+1;const cell=ws.getCell(pos[r.category]+2,r.category.charCodeAt(0)-64);cell.value=r.cents/100;cell.note=r.label+' | '+sourceName+' | '+r.source;}
   for(let c=1;c<=10;c++){const l=String.fromCharCode(64+c);ws.getCell(28,c).value={formula:`SUM(${l}3:${l}27)`,result:(s.totals[l]||0)/100};}ws.getCell('K28').value={formula:'SUM(A28:J28)',result:s.total/100};
   // ExcelJS row insertion moves cells but not formula references. Shift the
   // original calculation block references together with the seven new rows.
   for(let r=29;r<=ws.rowCount;r++)for(let c=1;c<=ws.columnCount;c++){const cell=ws.getCell(r,c);if(cell.value?.formula){const value=cell.value;cell.value={formula:value.formula.replace(/(\$?[A-Z]{1,3}\$?)(\d+)/g,(m,col,row)=>col+(Number(row)>=21?Number(row)+7:row))};}}
   wb.calcProperties.fullCalcOnLoad=true;const info=wb.addWorksheet('Client and Sources');info.addRow(['Company',meta.company]);info.addRow(['NMLS ID',meta.nmls]);info.addRow(['As of',meta.date]);info.addRow(['Source',sourceName]);info.addRow(['Expense','Amount','Category','Source']);for(const r of s.active)info.addRow([r.label,r.cents/100,r.category,r.source]);
   if(getBalance)addBalanceReview(wb,getBalance());
   addScheduleWorkbook(wb,rows,getReport(),meta);
   const bytes=await wb.xlsx.writeBuffer(),url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const a=document.createElement('a');a.href=url;a.download=meta.company.replace(/[^a-z0-9]+/gi,'-')+'-SFC-Worksheet.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);message('SFC worksheet downloaded.');
  }catch(e){message('Unable to export: '+e.message);}finally{setBusy(false);}
 };
 // Net income from every included line, assigned to a field or not: the same figure the
 // “Does this P&L add up?” check shows. Null until gross income and expenses are in.
 function getNet(){const list=expenseSummary(rows).active.filter(r=>Number.isSafeInteger(r.cents)),gross=amount($('scheduleGross').value);if(!Number.isSafeInteger(gross)||!list.length)return null;const adj=['D520','D540','D560'],sum=l=>l.reduce((t,r)=>t+r.cents,0);return gross-sum(list.filter(r=>!adj.includes(r.field)))-sum(list.filter(r=>r.field==='D520'))+sum(list.filter(r=>r.field==='D540'||r.field==='D560'));}
 render();return {getReport,getNet};
}
