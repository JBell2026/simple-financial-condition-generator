import {readScheduleWorkbook,dReviewRows,incomeSplit} from './schedule-d.mjs';
import {calculatedReview,orderedReview} from './calculated.mjs';
import {guide,sourceLink,definitionIssues,definitionWarnings} from './fv7.mjs';
import {amount,rounded,fields,reconcile,exportXml,scheduleOFields,usd} from './engine.mjs';
import {fcSchema} from './fc-schema.mjs';
const columnCodes=['D050',null,'D150','D160','D200','D210','D220','D230','D280','C150'];
export function readSfc(book,options={}){
 if(book.Sheets['Schedule D Lines']||book.Sheets['Schedule D Setup'])return readScheduleWorkbook(book);
 const sheets=Object.entries(book.Sheets);const match=sheets.find(([,s])=>Object.entries(s).some(([key,c])=>/^A\d+$/.test(key)&&String(c.v).trim().toUpperCase()==='D050'));
 if(!match)throw Error('The SFC worksheet mapping row (D050 through C150) was not found. Upload the completed SFC template.');
 const [name,s]=match;const mapping=Object.entries(s).find(([key,c])=>/^A\d+$/.test(key)&&String(c.v).trim().toUpperCase()==='D050');const mapRow=Number(mapping[0].slice(1)),totalRow=mapRow-1,shift=totalRow-21;
 if(totalRow<4||totalRow>100)throw Error('Unrecognized SFC worksheet layout.');
 function value(address,required=false){const c=s[address];if(c?.t==='e')throw Error('Excel error in '+name+'!'+address+'.');const n=amount(c?.v);if(required&&n===null)throw Error('Complete '+name+'!'+address+' before generating XML.');return n;}
 const groups={},issues=[],categoryTotals=[];let entries=0;
 for(let col=0;col<10;col++){
  const letter=String.fromCharCode(65+col);let sum=0,count=0;
  for(let row=3;row<totalRow;row++){const c=s[letter+row];if(c?.v===undefined||c.v==='')continue;const n=value(letter+row,true);sum+=n;if(n!==0){count++;entries++;}}
  if(count>25)issues.push('Column '+letter+' has more than 25 expense entries.');
  const code=col===1?options.payrollField:columnCodes[col];if(!code&&sum!==0)issues.push('Select the underlying payroll field for column B. D070 is a calculated total, not an XML input.');
  if(code){if(!fcSchema.ScheduleCSection[code+'_1']&&!fcSchema.ScheduleDSection[code+'_1'])throw Error('Unsupported expense field '+code+'.');groups[code]=(groups[code]||0)+sum;}
  categoryTotals.push(sum);
 }
 if(entries>75)issues.push('The worksheet contains more than 75 nonzero expense entries.');
 const overrideAddress='B'+(36+shift),grossAddress='L'+(26+shift),interestAddress='L'+(27+shift),netAddress='L'+(28+shift);
 const override=value(overrideAddress);const gross=override!==null?override:value(grossAddress,true);
 const interest=value(interestAddress)||0,net=value(netAddress,true),expenses=categoryTotals.reduce((a,b)=>a+b,0);
 const incomeField=options.incomeField||'C210';if(!['C210','C220','C230','C240','C770'].includes(incomeField))throw Error('Select a supported income field.');
 const split=incomeSplit(options.incomeSplit,incomeField,gross-interest,issues);
 groups[incomeField]=gross-interest-split.cents;if(split.field)groups[split.field]=split.cents;groups.C060=interest;
 groups.D310=expenses;groups.D510=net;
 const originalDifference=gross-expenses-net;
 if(originalDifference!==0)issues.push('SFC gross income less expenses differs from net income by '+usd(originalDifference)+'. Correct the completed worksheet.');
 const categoryRounded=Object.entries(groups).filter(([c])=>columnCodes.includes(c)||c===options.payrollField).reduce((sum,[,v])=>sum+rounded(v),0);
 const roundingExpenseDifference=categoryRounded-rounded(expenses);
 const roundingNetDifference=rounded(gross)-rounded(expenses)-rounded(net);
 const roundingGrossDifference=rounded(gross-interest-split.cents)+rounded(split.cents)+rounded(interest)-rounded(gross);
 if(roundingExpenseDifference)issues.push('SFC expense fields have a whole-dollar rounding difference of '+usd(roundingExpenseDifference*100)+'.');
 if(roundingNetDifference)issues.push('SFC whole-dollar income / expense / net income difference is '+usd(roundingNetDifference*100)+'.');
 if(roundingGrossDifference)issues.push('SFC gross income fields have a whole-dollar rounding difference of '+usd(roundingGrossDifference*100)+'.');
 const metadata=book.Sheets['Client and Sources'];const meta={company:metadata?.B1?.v,nmls:metadata?.B2?.v,date:metadata?.B3?.v};
 return {groups,issues,meta,gross,expenses,net,name,payrollTotal:categoryTotals[1],grossSource:name+'!'+(override!==null?overrideAddress:grossAddress),entryCount:entries};
}
export function readBalance(book){
 for(const [name,s]of Object.entries(book.Sheets)){
  const data=XLSX.utils.sheet_to_json(s,{defval:''});if(!data.length||!Object.hasOwn(data[0],'NMLS Field')||!Object.hasOwn(data[0],'Amount'))continue;
  const rows=data.map((r,i)=>{const code=String(r['NMLS Field']).trim();if(!fields[code])throw Error('Unrecognized balance sheet field '+code+' on row '+(i+2)+'.');const cents=amount(r.Amount);if(cents===null)throw Error('Invalid balance sheet amount on row '+(i+2)+'.');return {include:true,code,cents,label:r.Description||code,section:fields[code][1]};});
  const result=reconcile(rows);if(!rows.length)throw Error('The balance sheet contains no fields.');const first=data[0];
  if(data.some(r=>amount(r['Balance Difference'])!==null&&amount(r['Balance Difference'])!==0))result.issues.push('The uploaded balance sheet records an unresolved original balance difference.');
  if(data.some(r=>amount(r['Rounding Difference'])!==null&&amount(r['Rounding Difference'])!==0))result.issues.push('The uploaded balance sheet records an unresolved rounding difference.');
  for(const row of data)for(const key of ['Company Name','NMLS ID','As Of Date'])if(String(row[key]??'')!==String(first[key]??''))throw Error('The balance sheet includes mixed client or reporting details.');
  return {...result,meta:{company:first['Company Name'],nmls:first['NMLS ID'],date:first['As Of Date']},name};
 }
 throw Error('Use the balance sheet CSV from this app, or save that CSV as Excel. It must contain NMLS Field and Amount columns.');
}
export function combineReports(balance,sfc,meta){
 const issues=[...balance.issues,...sfc.issues,...definitionIssues({...balance.groups,...sfc.groups},meta)];
 for(const report of [balance,sfc])for(const key of ['company','nmls','date']){
  const actual=String(report.meta?.[key]??'').trim(),expected=String(meta[key]??'').trim();
  if(actual&&expected&&actual.toLowerCase()!==expected.toLowerCase())issues.push('The uploaded '+({company:'company name',nmls:'NMLS ID',date:'reporting date'}[key])+' does not match the selected client and reporting details.');
 }
 if(balance.groups.B300!==undefined&&rounded(balance.groups.B300)!==rounded(sfc.net))issues.push('Balance sheet B300 does not match SFC net income under your selected filing treatment.');
 const result={...balance,groups:{...balance.groups,...sfc.groups},issues};
 if(issues.length||balance.roundingDifference)return {result,issues,xml:null};
 return {result,issues,xml:exportXml(result,meta)};
}
export function mountCombined(getMeta,getBalance,getSchedule){
 const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let reviewed=null;
 function reset(){reviewed=null;$('combinedConfirm').checked=false;$('combinedXml').disabled=true;$('combinedPreview').innerHTML='';$('combinedStatus').textContent='';}
 $('fcInputSource').addEventListener('change',()=>{$('completedSfcPanel').hidden=$('fcInputSource').value!=='excel';reset();});
 ['fcInputSource','completedSfc','payrollField','incomeField','incomeField2','splitRevenue','incomeSplitAmount','company','nmls','date','xmlPeriod','reportYear'].forEach(id=>$(id).addEventListener('change',reset));
 ['company','nmls','date'].forEach(id=>$(id).addEventListener('input',reset));
 document.addEventListener('financialDataChanged',reset);
 let payrollPreviewSequence=0;
 async function payrollPreview(){const sequence=++payrollPreviewSequence,file=$('completedSfc').files[0];if(!file){$('payrollAmountPreview').textContent='Upload a completed workbook to see its payroll total.';return;}if(file.size>40*1024*1024){$('payrollAmountPreview').textContent='Choose a workbook under 40 MB.';return;}try{const report=readSfc(XLSX.read(await file.arrayBuffer(),{type:'array'}),{payrollField:$('payrollField').value,incomeField:$('incomeField').value});if(sequence!==payrollPreviewSequence)return;const legacy=Number.isSafeInteger(report.payrollTotal);$('payrollField').disabled=!legacy;$('payrollAmountPreview').textContent=legacy?'Payroll amount from this workbook: '+new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(report.payrollTotal/100)+'. '+(report.payrollTotal===0?'No payroll amount will be sent.':$('payrollField').value?'Destination: '+$('payrollField').selectedOptions[0].textContent:'Choose a staff role below.'):'This workbook already has individual NMLS field assignments. No payroll-total selection is needed.';}catch(e){if(sequence===payrollPreviewSequence)$('payrollAmountPreview').textContent='Cannot read the payroll amount: '+e.message;}}
 ['completedSfc','payrollField'].forEach(id=>$(id).addEventListener('change',payrollPreview));
 $('combinedConfirm').onchange=()=>{$('combinedXml').disabled=!reviewed?.xml||!$('combinedConfirm').checked;};
 $('reviewCombined').onclick=async()=>{
  reset();const sf=$('completedSfc').files[0],meta=getMeta();const direct=$('fcInputSource').value==='app';if(!direct&&!sf){$('combinedStatus').textContent='Upload the completed workbook first.';return;}if(!meta.company||!meta.date){$('combinedStatus').textContent='Enter the company name and select the reporting year and period in Client & reporting details.';return;}if(sf&&sf.size>40*1024*1024){$('combinedStatus').textContent='Choose files under 40 MB.';return;}
  $('reviewCombined').disabled=true;try{
   const sfc=direct?getSchedule():readSfc(XLSX.read(await sf.arrayBuffer(),{type:'array'}),{payrollField:$('payrollField').value,incomeField:$('incomeField').value,incomeSplit:$('splitRevenue').checked?{field:$('incomeField2').value,cents:amount($('incomeSplitAmount').value)}:null});const balance=getBalance();reviewed=combineReports(balance,sfc,meta);
   reviewed.metadata=JSON.stringify(meta);
   const headers='<table><thead><tr><th>NMLS field</th><th>Original amount</th><th>XML amount</th></tr></thead><tbody>';
   $('combinedPreview').innerHTML='<p>'+esc(definitionWarnings(balance.groups).join(' '))+'</p><p>Gross income source: '+esc(sfc.grossSource)+'</p>'+headers+Object.entries(reviewed.result.groups).filter(([c])=>!fields[c]).sort().map(([c,v])=>'<tr><td>'+c+'<br><small>'+esc(guide(c))+' <a href="'+sourceLink(c)+'" target="_blank" rel="noopener">FV7</a></small></td><td>$'+(v/100).toFixed(2)+'</td><td>'+rounded(v)+'</td></tr>').join('')+'</tbody></table>';
   $('combinedPreview').innerHTML+='<h3>Balance sheet in NMLS filing order</h3>'+headers+['Assets','Liabilities','Equity'].map(section=>'<tr class="section-divider '+section.toLowerCase()+'"><th colspan="3">'+section+'</th></tr>'+orderedReview(balance.groups).filter(r=>r.section===section).map(r=>'<tr class="calculated-row"><td>'+r.code+' — '+esc(r.label)+'<br><small>'+esc(r.formula||'Input')+'</small></td><td>'+usd(r.cents)+'</td><td>'+r.whole+'</td></tr>').join('')).join('')+'</tbody></table><p class="small">Calculated checks are review only; unassigned inputs count as zero.</p>';
   if(sfc.calculated)$('combinedPreview').innerHTML+='<h3>Schedules C & D filing review</h3>'+headers+dReviewRows(sfc).map(r=>'<tr class="'+(r.deps?'calculated-row':'')+'"><td>'+r.code+' — '+esc(r.label)+'</td><td>'+usd(r.cents)+'</td><td>'+r.whole+'</td></tr>').join('')+'</tbody></table>';
   $('combinedPreview').innerHTML+='<h3>Schedule O</h3><p>All '+scheduleOFields.length+' Schedule O fields ('+scheduleOFields[0].replace('_1','')+' through '+scheduleOFields.at(-1).replace('_1','')+') are included in the XML as 0.</p>';
   if(sfc.warnings?.length)$('combinedPreview').innerHTML+='<p>'+esc(sfc.warnings.join(' '))+'</p>';
   $('combinedStatus').textContent=reviewed.issues.length?reviewed.issues.join(' '):'Combined balance sheet and income statement checks passed. Confirm your review to download.';
  }catch(e){reviewed=null;$('combinedStatus').textContent=e.message;}finally{$('reviewCombined').disabled=false;}
 };
 $('combinedXml').onclick=()=>{
  if(!reviewed?.xml||!$('combinedConfirm').checked)return;
  try{const meta=getMeta();if(JSON.stringify(meta)!==reviewed.metadata){reset();$('combinedStatus').textContent='Client or reporting details changed. Review the completed worksheets again.';return;}const xml=exportXml(reviewed.result,meta);const url=URL.createObjectURL(new Blob([xml],{type:'application/xml'}));const a=document.createElement('a');a.href=url;a.download=meta.company.replace(/[^a-z0-9]+/gi,'-')+'-Combined-FC-'+meta.date+'.xml';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);$('combinedStatus').textContent='Combined Financial Condition XML downloaded. Complete remaining required schedules and completeness checks in NMLS.';}catch(e){$('combinedStatus').textContent=e.message;}
 };
}
