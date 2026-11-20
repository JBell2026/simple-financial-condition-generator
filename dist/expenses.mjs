import {dFields,dFieldMap,suggestD,splitExpense,extractPLFigures,buildScheduleD,addScheduleWorkbook,dReviewRows} from './schedule-d.mjs';
import {addBalanceReview} from './calculated.mjs';
import {amount,moneyMatches,selectTotalAmountLine,selectAmountsByPage} from './engine.mjs';
import {isBalanceSheetTitle,isOtherStatementTitle} from './balance-source.mjs';
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
 const push=(label,cents,source,category,group)=>out.push({id:out.length+1,label,cents,source,category:category||classifyExpense(label),include:true,...(group?{group}:{})});
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
 finishCogs();out.costOfRevenue=costOfRevenue;out.repeatedLines=repeated;return out;
}
export function expenseSummary(rows){
 const active=rows.filter(r=>r.include),counts={},totals={};const issues=[];
 for(const r of active){if(!Number.isSafeInteger(r.cents))issues.push('Invalid amount: '+r.label);if(!categories.some(([c])=>c===r.category))issues.push('Choose a category: '+r.label);counts[r.category]=(counts[r.category]||0)+1;totals[r.category]=(totals[r.category]||0)+(r.cents||0);}
 if(active.length>75)issues.push('Include no more than 75 expenses.');
 for(const [c,n]of Object.entries(counts))if(n>25)issues.push((categories.find(([v])=>v===c)?.[1]||c)+' exceeds 25 entries.');
 return {active,counts,totals,issues,total:active.reduce((s,r)=>s+(r.cents||0),0)};
}
export function mountAllocator({readPdf,getSource,getMeta,onChange,getBalance}){
 const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),money=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100);
 let rows=[],file=null,book=null,lastLines=[],sourceName='',busy=false,cost={total:0,count:0};
 function message(s){$('expenseStatus').textContent=s;}
 function render(){
  $('expenseRows').innerHTML=rows.map(r=>`<tr data-id="${r.id}"><td><input type="checkbox" data-key="include" aria-label="Include expense ${esc(r.label)}" ${r.include?'checked':''}></td><td><input data-key="label" aria-label="Expense description" value="${esc(r.label)}"></td><td><input data-key="cents" aria-label="Expense amount" value="${r.cents===null?'':(r.cents/100).toFixed(2)}" inputmode="decimal"></td><td><select data-key="category" aria-label="Expense category">${categories.map(([c,n])=>`<option value="${c}" ${r.category===c?'selected':''}>${c} - ${n}</option>`).join('')}</select></td><td data-confidence="${r.id}"></td><td><details class="row-detail"><summary>Source</summary>${esc(r.source)}</details></td><td><button data-remove="${r.id}" aria-label="Remove expense">×</button></td></tr>`).join('');
  $('scheduleAllocationRows').innerHTML=rows.map(r=>`<tr data-id="${r.id}"><td>${esc(r.label)}</td><td>${money(r.cents||0)}</td><td><select data-key="field" aria-label="Schedule D field"><option value="">Select NMLS field</option>${['Interest expense','Personnel','Operating expenses','Corporate allocations','Taxes and adjustments'].map(section=>`<optgroup label="${section==='Interest expense'?'Schedule C — Interest expense':'Schedule D — '+section}">${dFields.filter(f=>f.section===section).map(f=>`<option value="${f.code}" ${r.field===f.code?'selected':''}>${f.code} — ${esc(f.label)}</option>`).join('')}</optgroup>`).join('')}</select></td><td><button type="button" class="secondary" data-split="${r.id}">Split</button></td></tr>`).join('');
  $('expenseEmpty').hidden=rows.length>0;summary();
 }
 function getReport(){return buildScheduleD(rows,{gross:amount($('scheduleGross').value),interest:$('scheduleInterest').value.trim()?amount($('scheduleInterest').value):0,reportedNet:amount($('scheduleNet').value),sourceExpenses:$('scheduleExpenseControl').value.trim()?(amount($('scheduleExpenseControl').value)??NaN):null,incomeField:$('incomeField').value,meta:getMeta()});}
 function summary(){const s=expenseSummary(rows),report=getReport();for(const r of rows){const cell=$('expenseRows').querySelector('[data-confidence="'+r.id+'"]');if(cell){const confidence=expenseConfidence(r);cell.innerHTML='<span class="expense-confidence '+confidence.level+'" title="'+esc(confidence.reason)+'">'+confidence.label+'</span>';}}$('expenseCount').textContent=s.active.length+' / 75';$('expenseTotal').textContent=money(s.total);$('expenseBottomTotal').textContent=money(s.total);const grossValue=amount($('scheduleGross').value),interestValue=$('scheduleInterest').value.trim()?amount($('scheduleInterest').value):0;$('incomeAmountPreview').textContent=Number.isSafeInteger(grossValue)&&Number.isSafeInteger(interestValue)?money(grossValue)+' gross income − '+money(interestValue)+' interest income = '+money(grossValue-interestValue)+' to '+$('incomeField').selectedOptions[0].textContent:'Enter valid gross income and interest income to see the amount sent to NMLS.';const issues=s.active.length?[...s.issues,...report.issues,...report.warnings]:s.issues;$('expenseChecks').textContent=issues.join(' ');$('expenseChecks').hidden=!issues.length;$('downloadExpenses').disabled=!s.active.length||busy;
 // Reconciliation of the imported P&L to its own net income, in plain steps.
 // It uses every included line, whether or not an NMLS field has been chosen yet,
 // so an unassigned line shows as its own to-do instead of as an unexplained gap.
 {const adj=['D520','D540','D560'],valid=s.active.filter(r=>Number.isSafeInteger(r.cents)),sumOf=list=>list.reduce((t,r)=>t+r.cents,0),listExpenses=sumOf(valid.filter(r=>!adj.includes(r.field))),adjustments=-sumOf(valid.filter(r=>r.field==='D520'))+sumOf(valid.filter(r=>r.field==='D540'||r.field==='D560')),unassigned=valid.filter(r=>!r.field),hasGross=Number.isSafeInteger(grossValue),d510=(hasGross?grossValue:0)-listExpenses,calcNet=d510+adjustments,hasNet=Number.isSafeInteger(report.reportedNet)&&hasGross,diff=hasNet?calcNet-report.reportedNet:null,line=(label,value,cls='')=>'<tr class="'+cls+'"><td>'+label+'</td><td>'+(value===null?'—':money(value))+'</td></tr>';
 $('plReconcile').hidden=!s.active.length&&!Number.isSafeInteger(grossValue);
 $('plReconcile').innerHTML='<table><thead><tr><th>P&amp;L reconciliation</th><th>Amount</th></tr></thead><tbody>'+line('Total gross income (C800)',Number.isSafeInteger(grossValue)?report.gross:null)+line('Less: included expenses in the list below (D310)',listExpenses)+(unassigned.length?line('&nbsp;&nbsp;of which not yet assigned to an NMLS field ('+unassigned.length+' line'+(unassigned.length===1?'':'s')+')',sumOf(unassigned)):'')+line('Pre-tax income (D510)',hasGross?d510:null,'calculated-row')+line('Taxes and adjustments (D520, D540, D560)',hasGross?adjustments:null)+line('Calculated net income (D600)',hasGross?calcNet:null,'calculated-row')+line('Net income on the P&amp;L',Number.isSafeInteger(report.reportedNet)?report.reportedNet:null)+'<tr class="'+(diff===0?'reconciled':'unreconciled')+'"><th>'+(diff===null?'Enter gross income and P&amp;L net income to reconcile':diff===0?'Reconciled — no difference':'Difference to resolve')+'</th><th>'+(diff===null?'—':money(diff))+'</th></tr></tbody></table>'+(diff&&Math.abs(diff)<=500&&valid.every(r=>r.cents%100===0)?'<p class="small">This statement is in whole dollars and its lines do not add exactly to its own net income. A difference this small is rounding in the source. Adjust one expense line by the difference, or change the net income, so the filing ties; no adjustment is made for you.</p>':'');
 const excluded=cost.total&&!$('includeCogs').checked;$('costNotice').hidden=!cost.total;
 $('costNotice').textContent=cost.total?(excluded?'This P&L reports '+money(cost.total)+' of cost of revenue / cost of goods sold ('+cost.count+' line'+(cost.count===1?'':'s')+') that is not in the expense list.'+(diff!==null&&Math.abs(diff-cost.total)<=500?(diff===cost.total?' That amount equals the reconciliation difference.':' That accounts for the reconciliation difference, apart from rounding.'):'')+' Tick “Include cost of revenue lines” if those costs, such as loan officer commissions, belong in Schedule D.':money(cost.total)+' of cost of revenue ('+cost.count+' line'+(cost.count===1?'':'s')+') is included in the expense list. Review each category.'):'';}
 $('scheduleDPreview').innerHTML='<table><thead><tr><th>NMLS field</th><th>Description</th><th>Original</th><th>NMLS whole dollars</th></tr></thead><tbody>'+dReviewRows(report).map(r=>'<tr class="'+(r.deps?'calculated-row':'')+'"><td>'+r.code+'</td><td>'+esc(r.label)+(r.formula?'<details class="row-detail"><summary>Calculation</summary>'+esc(r.formula)+'</details>':'')+'</td><td>'+money(r.cents)+'</td><td>'+money(r.whole*100)+'</td></tr>').join('')+'</tbody></table>';return s;}
 ['scheduleGross','scheduleInterest','scheduleNet','scheduleExpenseControl','incomeField'].forEach(id=>$(id).addEventListener('input',()=>{onChange();summary();}));
 function setBusy(v){busy=v;['expenseFile','useStatement','analyzeExpenses','downloadExpenses','expenseSheet','expenseColumn','includeCogs'].forEach(id=>$(id).disabled=v);summary();}
 function load(lines,name){lastLines=lines;sourceName=name;const parsed=parseExpenses(lines,$('includeCogs').checked);cost=parsed.costOfRevenue;const repeatedLines=parsed.repeatedLines;rows=parsed.map(r=>{const field=suggestD(r.label,r.category);return {...r,field,category:r.category};});const figures=extractPLFigures(lines);if(figures.gross!==undefined)$('scheduleGross').value=(figures.gross/100).toFixed(2);$('scheduleInterest').value=figures.interest===undefined?'':(figures.interest/100).toFixed(2);if(figures.reportedNet!==undefined)$('scheduleNet').value=(figures.reportedNet/100).toFixed(2);onChange();render();message(rows.length?`${rows.length} expense lines from ${name}. Review each allocation.`+(repeatedLines>2?` The first income statement, through its net income line, was imported; ${repeatedLines} amount lines after it (a second presentation or supporting schedule) were left out so nothing is counted twice.`:''):'No expense lines were recognized. Check that the PDF includes an Expenses or Cost of Revenue section. If this continues, share the PDF so we can check its layout.');}
 function workbookLines(){
  const sheet=book.Sheets[$('expenseSheet').value],range=XLSX.utils.decode_range(sheet['!ref']||'A1');if(range.e.r>5000||range.e.c>1000)throw Error('Choose a P&L worksheet with no more than 5,000 rows.');const col=XLSX.utils.decode_col($('expenseColumn').value.toUpperCase());const lines=[];
  for(let r=range.s.r;r<=range.e.r;r++){const label=String(sheet[XLSX.utils.encode_cell({r,c:0})]?.v||'');const cell=sheet[XLSX.utils.encode_cell({r,c:col})];const cents=amount(cell?.v);lines.push({text:label+(cents===null?'':'  $'+(cents/100).toFixed(2)),source:$('expenseSheet').value+'!'+$('expenseColumn').value+(r+1)});}
  return lines;
 }
 async function analyze(){if(!file)return;setBusy(true);try{message('Reading P&L…');if(/\.pdf$/i.test(file.name)){const lines=await readPdf(file,message,{mode:'expenses'});load(selectAmountsByPage(lines),file.name);}else load(workbookLines(),file.name);}catch(e){message('Unable to read P&L: '+e.message);}finally{setBusy(false);}}
 $('useStatement').onclick=()=>{const src=getSource();if(!src.lines.length){message('Upload a financial statement in the Schedules A & B upload first.');return;}file=null;book=null;$('expenseFile').value='';load(src.lines,src.name||'Uploaded statement');};
 $('expenseFile').onchange=async()=>{file=$('expenseFile').files[0];if(!file)return;['scheduleGross','scheduleInterest','scheduleNet','scheduleExpenseControl'].forEach(id=>$(id).value='');rows=[];book=null;lastLines=[];sourceName='';cost={total:0,count:0};render();onChange();if(file.size>40*1024*1024){message('Choose a P&L file under 40 MB.');return;}if(!/\.(pdf|xlsx|xlsm|xls|csv)$/i.test(file.name)){message('Choose PDF or Excel.');return;}if(!/\.pdf$/i.test(file.name)){try{book=XLSX.read(await file.arrayBuffer(),{type:'array',raw:/\.csv$/i.test(file.name)});$('expenseSheet').innerHTML=book.SheetNames.map(n=>`<option>${esc(n)}</option>`).join('');const name=book.SheetNames.find(n=>/profit|p.?l|income/i.test(n));if(name)$('expenseSheet').value=name;}catch(e){message(e.message);return;}}await analyze();};
 $('analyzeExpenses').onclick=()=>{if(file)analyze();else if(lastLines.length)load(lastLines,sourceName);else message('Use the uploaded statement or choose a P&L file first.');};
 $('expenseSheet').onchange=analyze;
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
 render();return {getReport};
}
