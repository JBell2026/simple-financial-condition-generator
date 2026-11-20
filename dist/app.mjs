import {calculatedReview,calculations,filingCompare,orderedReview} from './calculated.mjs';
import {balanceSheetSource,isBalanceSheetName,pageChecks,chosenPages,onlyPages,pagePhrase} from './balance-source.mjs';
import {guide,sourceLink,definitionWarnings,definitionIssues,requiresOtherAssetsExplanation} from './fv7.mjs';
import {mountCombined} from './combined.mjs';
import {mountAllocator} from './expenses.mjs';
import {fields,amount,rounded,parseLines,reconcile,reportingDate,needsOcr,amountColumns,selectAmountsByPage,tidyLabel,plural} from './engine.mjs';
import * as pdfjs from './vendor/pdf.mjs';
pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.mjs',import.meta.url).href;
const $=id=>document.getElementById(id),money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(v/100),escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let rows=[],controls={},rawLines=[],workbook=null,fileName='',busy=false,importNotes=[];
let profiles=[];try{profiles=JSON.parse(localStorage.getItem('simple-balance-clients')||'[]');if(!Array.isArray(profiles))profiles=[];}catch{}
function showClients(){ $('clients').innerHTML='<option value="">Select a client</option>'+profiles.slice().sort((a,b)=>a.company.localeCompare(b.company)).map(p=>`<option value="${escape(p.key)}">${escape(p.company)}</option>`).join('');}
showClients();
$('addClient').onclick=()=>{$('clients').value='';$('company').value='';$('nmls').value='';$('clientStatus').textContent=' Enter the new company name and NMLS ID, then select Save client. Saved clients are stored on this device.';resetReview();$('company').focus();};
$('clients').onchange=()=>{const p=profiles.find(p=>p.key===$('clients').value);if(p){$('company').value=p.company;$('nmls').value=p.nmls;resetReview();}};
$('saveClient').onclick=()=>{const company=$('company').value.trim(),nmls=$('nmls').value.trim();if(!company){$('clientStatus').textContent=' Enter a company name first.';return;}const key=nmls||company.toLowerCase();profiles=profiles.filter(p=>p.key!==key);profiles.push({key,company,nmls});try{localStorage.setItem('simple-balance-clients',JSON.stringify(profiles));showClients();$('clients').value=key;$('clientStatus').textContent=' Saved on this device.';}catch{$('clientStatus').textContent=' Browser storage is unavailable.';}};
function resetReview(){document.dispatchEvent(new Event('financialDataChanged'));}
['company','nmls','date','xmlPeriod','reportYear'].forEach(id=>$(id).addEventListener('input',resetReview));
function status(s){$('progress').textContent=s;}
function setBusy(v){busy=v;['file','sheet','parse'].forEach(id=>$(id).disabled=v);}
let sectionOrder={};
const rowKey=r=>r.deps?'calc:'+r.code:'row:'+r.id;
function sectionLayout(section){
 const items=[...rows.filter(r=>r.section===section),...calculations.filter(r=>r.section===section)].sort(filingCompare);
 const order=sectionOrder[section];if(!order)return items;
 const fallback=new Map(items.map((r,i)=>[rowKey(r),i]));
 return items.sort((a,b)=>{const rank=r=>{const i=order.indexOf(rowKey(r));return i<0?order.length+fallback.get(rowKey(r)):i;};return rank(a)-rank(b);});
}
function findLayoutRow(key){return rows.find(r=>rowKey(r)===key)||calculations.find(r=>rowKey(r)===key);}
function placeBalanceRow(key,targetKey,after=false){
 const row=findLayoutRow(key),target=findLayoutRow(targetKey);if(!row||!target||key===targetKey)return;
 if(row.section!==target.section){$('moveStatus').textContent='Move lines within the same section. To change a line’s section, open Source on that line and choose a section.';return;}
 const order=sectionLayout(row.section).map(rowKey).filter(k=>k!==key),index=order.indexOf(targetKey);order.splice(index+(after?1:0),0,key);sectionOrder[row.section]=order;table();$('moveStatus').textContent='Line moved.';
}
const sectionTotals=['A240','B220','B350','B360'];
function moveControls(r){return '<button type="button" class="drag-handle" draggable="false" data-drag-key="'+rowKey(r)+'" aria-label="Drag '+escape(r.label)+' to move" title="Drag to reorder">⠿</button>';}

function table(){
 const subtotals=$('showSubtotals').checked;
 const renderRow=r=>`<tr data-section="${r.section}" data-layout-key="${rowKey(r)}" data-id="${r.id}" class="input-row${r.code?'':' unclassified'}${r.include?'':' excluded'}"><td class="move-cell">${moveControls(r)}<input aria-label="Include ${escape(r.label)}" title="Include this line" type="checkbox" data-key="include" ${r.include?'checked':''}></td><td><input aria-label="Description" data-key="label" value="${escape(r.label)}"><details class="row-detail"><summary aria-label="Source for ${escape(r.label)}">Source</summary><div>${escape(r.source)}<label class="section-move">Section<select aria-label="Section" data-key="section">${['Assets','Liabilities','Equity'].map(s=>`<option ${r.section===s?'selected':''}>${s}</option>`).join('')}</select></label></div></details></td><td><select aria-label="NMLS field" data-key="code"><option value="">Choose a field…</option>${Object.entries(fields).filter(([k,f])=>f[1]===r.section).sort(([a],[b])=>filingCompare({code:a},{code:b})).map(([k,f])=>`<option value="${k}" ${k===r.code?'selected':''}>${k} — ${escape(f[0])}</option>`).join('')}</select></td><td><input aria-label="Amount in dollars" data-key="cents" inputmode="decimal" value="${r.cents===null?'':(r.cents/100).toFixed(2)}"></td><td class="row-actions"><button type="button" aria-label="Remove row" title="Remove line" data-remove="${r.id}">×</button></td></tr>`;
 const renderCalc=r=>'<tr data-layout-key="'+rowKey(r)+'" class="calculated-row'+(sectionTotals.includes(r.code)?' section-total':'')+'" title="'+escape(r.code+' = '+r.deps.join(' + '))+'"><td></td><td>'+escape(r.label)+'</td><td>'+r.code+' <small>calculated</small></td><td data-calc="'+r.code+'"></td><td></td></tr>';
 // With subtotals hidden, each section lists its accounts and ends with its totals.
 // A field fed by several statement lines (for example fixed asset cost and accumulated
 // depreciation) gets a net line after its last account, showing what NMLS receives.
 const withNets=items=>{const counts={};for(const r of items)if(!r.deps&&r.include&&r.code)counts[r.code]=(counts[r.code]||0)+1;const last={};items.forEach((r,i)=>{if(!r.deps&&r.include&&counts[r.code]>1)last[r.code]=i;});return items.flatMap((r,i)=>last[r.code]===i&&!r.deps?[r,{net:r.code,contra:items.some(x=>!x.deps&&x.include&&x.code===r.code&&x.cents<0)&&items.some(x=>!x.deps&&x.include&&x.code===r.code&&x.cents>0)}]:[r]);};
 const renderNet=(code,contra)=>'<tr class="calculated-row field-net"><td></td><td>'+(contra?'Net ':'Total ')+escape(fields[code][0].replace(/,?\s*net$/i,'').toLowerCase())+'</td><td>'+code+' <small>sent to NMLS</small></td><td data-net="'+code+'"></td><td></td></tr>';
 const layout=section=>{const items=sectionLayout(section);return withNets(subtotals?items:[...items.filter(r=>!r.deps),...items.filter(r=>r.deps)]);};
 $('rows').innerHTML=['Assets','Liabilities','Equity'].map(section=>'<tr class="section-divider '+section.toLowerCase()+'"><th colspan="5" scope="rowgroup">'+section+' <span>Schedule '+(section==='Assets'?'A':'B')+'</span></th></tr>'+layout(section).map(r=>r.net?renderNet(r.net,r.contra):r.deps?renderCalc(r):renderRow(r)).join('')).join('');
 $('empty').hidden=rows.length>0;$('restoreOrder').hidden=!Object.keys(sectionOrder).length;checks();
}
$('showSubtotals').onchange=table;
let explanationEdited=false;
function otherAssetTitles(list){
 const titles=[];for(const r of list){if(!r.include||r.code!=='A230H')continue;const title=String(r.label||'').replace(/%/g,' percent').replace(/[<>]/g,'').replace(/\s+/g,' ').trim();if(title&&!titles.some(t=>t.toLowerCase()===title.toLowerCase()))titles.push(title);}
 return titles.join(', ').slice(0,4000);
}
function checks(){
 const r=reconcile(rows,controls);
 const calculated=calculatedReview(r.groups);
 for(const row of calculated)document.querySelectorAll('[data-calc="'+row.code+'"]').forEach(el=>{el.closest('tr').hidden=!row.hasInformation||(!$('showSubtotals').checked&&!sectionTotals.includes(row.code));el.innerHTML=money(row.cents)+(row.whole*100!==row.cents?'<br><small>NMLS: '+money(row.whole*100)+'</small>':'');});
 document.querySelectorAll('[data-net]').forEach(el=>{const c=r.groups[el.dataset.net]||0;el.innerHTML=money(c)+(rounded(c)*100!==c?'<br><small>NMLS: '+money(rounded(c)*100)+'</small>':'');});
 $('assetTotal').textContent=money(r.totals.Assets);$('liabilityTotal').textContent=money(r.totals.Liabilities);$('equityTotal').textContent=money(r.totals.Equity);$('difference').textContent=money(r.difference);
 const unclassified=rows.filter(x=>x.include&&!x.code).length;
 // The Other Assets explanation (A230J) is filled in from the titles of the accounts
 // assigned to A230H, without amounts. It follows those accounts until the user edits it.
 const otherTitles=otherAssetTitles(rows),box=$('otherAssetsExplanation');
 if(!explanationEdited&&box.value!==otherTitles)box.value=otherTitles;
 $('otherAssetsBox').hidden=!rows.some(x=>x.include&&x.code==='A230H')&&!box.value.trim();
 $('otherAssetsReset').hidden=!explanationEdited||!otherTitles;
 $('differenceBox').className=r.count?(r.difference===0?'in-balance':'out-of-balance'):'';
 const messages=[...r.issues.filter(s=>!s.startsWith('Review the NMLS classification')),...(unclassified?[unclassified+' account'+(unclassified===1?' needs':'s need')+' an NMLS field. '+(unclassified===1?'It is':'They are')+' highlighted below.']:[]),...definitionIssues(r.groups,{otherAssetsExplanation:$('otherAssetsExplanation').value}).map(s=>s.startsWith('FV7: complete the A230J')?'Enter the explanation of Other Assets (A230J) in the box below. NMLS requires it when Other Assets is 5% or more of total assets.':s)];
 const rounding=r.warnings.filter(s=>s.includes('rounding in a whole-dollar statement')),notes=[...r.warnings.filter(s=>!rounding.includes(s)),...(rounding.length?['The statement’s printed totals are off by a dollar or two from the sum of its own lines (rounding in the source). The detail lines are used.']:[])];if(r.roundingDifference)messages.push('Whole-dollar rounding difference: '+money(r.roundingDifference*100)+'. Review the grouped NMLS field amounts below.');
 $('checks').innerHTML=r.count?`<div class="notice ${messages.length?'':'success'}"><strong>${messages.length?'Review needed':'Balance checks passed'}</strong>${messages.length?'<ul>'+messages.map(s=>'<li>'+escape(s)+'</li>').join('')+'</ul>':'<p>Original amounts and rounded NMLS field totals balance.</p>'}${notes.length?'<p class="small">Note: '+notes.map(escape).join(' ')+'</p>':''}</div>`:'';
 $('definitionWarnings').textContent=definitionWarnings(r.groups).join(' ');
 $('mapping').innerHTML='<table><thead><tr><th>NMLS field</th><th>Description</th><th>Original</th><th>NMLS whole dollars</th></tr></thead><tbody>'+['Assets','Liabilities','Equity'].map(section=>'<tr class="section-divider '+section.toLowerCase()+'"><th colspan="4">'+section+' <span>Schedule '+(section==='Assets'?'A':'B')+'</span></th></tr>'+orderedReview(r.groups).filter(row=>row.section===section).map(row=>`<tr class="${row.deps?'calculated-row':''}"><td>${row.code}</td><td>${escape(row.label)}${row.deps?' <small>Calculated</small><br><small>'+escape(row.formula)+'</small>':''}</td><td>${money(row.cents)}</td><td>${money(row.whole*100)}</td></tr>`).join('')).join('')+'</tbody></table>';
 return r;
}
function updateRow(e){const tr=e.target.closest('tr'),r=rows.find(r=>r.id===Number(tr?.dataset.id));if(!r)return;const k=e.target.dataset.key;if(!k)return;r[k]=k==='include'?e.target.checked:k==='cents'?amount(e.target.value):e.target.value;resetReview();if(k==='section'){r.code='';table();}else if(k==='code'||k==='include')table();else checks();}
// Editing an amount keeps focus in the field; net lines refresh through checks().
$('rows').addEventListener('change',updateRow);
$('rows').addEventListener('input',e=>{if(e.target.tagName==='INPUT'&&e.target.type!=='checkbox')updateRow(e);});
$('rows').addEventListener('click',e=>{const button=e.target.closest('button');if(e.target.dataset.remove){rows=rows.filter(r=>r.id!==Number(e.target.dataset.remove));resetReview();table();}});
let dragState=null;
function clearDrag(){dragState=null;document.querySelectorAll('#rows .drop-target,#rows .dragging').forEach(el=>el.classList.remove('drop-target','dragging'));}
$('rows').addEventListener('pointerdown',e=>{const handle=e.target.closest('[data-drag-key]');if(!handle||e.button!==0)return;e.preventDefault();handle.focus();dragState={key:handle.dataset.dragKey,x:e.clientX,y:e.clientY,active:false};handle.setPointerCapture(e.pointerId);});
$('rows').addEventListener('pointermove',e=>{if(!dragState)return;if(Math.hypot(e.clientX-dragState.x,e.clientY-dragState.y)<5&&!dragState.active)return;dragState.active=true;e.preventDefault();document.querySelector('[data-layout-key="'+dragState.key+'"]')?.classList.add('dragging');document.querySelectorAll('#rows .drop-target').forEach(el=>el.classList.remove('drop-target'));const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('#rows tr[data-layout-key]');target?.classList.add('drop-target');if(e.clientY<80)window.scrollBy(0,-25);else if(e.clientY>window.innerHeight-80)window.scrollBy(0,25);});
$('rows').addEventListener('pointerup',e=>{if(!dragState)return;const state=dragState,target=document.elementFromPoint(e.clientX,e.clientY)?.closest('#rows tr[data-layout-key]');clearDrag();if(state.active&&target){const rect=target.getBoundingClientRect();placeBalanceRow(state.key,target.dataset.layoutKey,e.clientY>rect.top+rect.height/2);}});
$('rows').addEventListener('pointercancel',clearDrag);
$('rows').addEventListener('keydown',e=>{if(e.key==='Escape')clearDrag();});
$('restoreOrder').onclick=()=>{sectionOrder={};table();$('moveStatus').textContent='NMLS filing order restored.';};
$('add').onclick=()=>{rows.push({id:Math.max(0,...rows.map(r=>r.id))+1,label:'New account',cents:0,section:'Assets',code:'',include:true,source:'Manual'});resetReview();table();};
function loadLines(lines,sheetName='',{forced=false}={}){
 let source=balanceSheetSource(lines,{sheetName});
 // A page the user picked is read even when it carries no recognizable balance sheet title.
 if(forced&&!source.matched)source={lines:[{text:'Balance Sheet',source:'Selected page'},...lines],excluded:[],supplements:[],matched:1};
 sectionOrder={};
 const result=parseLines(source.lines,{supplements:source.supplements.map(selectAmounts)});rows=result.rows;controls=result.controls;importNotes=result.notes;
 if(source.excluded.length)importNotes.push(source.excluded.length===1?'One page or section that is not a balance sheet was left out.':source.excluded.length+' pages or sections that are not a balance sheet were left out.');
 if(!source.matched)importNotes.push('No balance sheet section was identified. Check the extracted headings and account lines below.');
 if(!rows.length)importNotes.push('No eligible balance sheet account amounts were found. Review the extracted text, select the correct worksheet, or add lines manually.');
 $('importNotes').hidden=!importNotes.length;$('importNotes').textContent=importNotes.join(' ');resetReview();table();
}
$('parse').onclick=()=>{rawLines=$('raw').value.split('\n').map((text,i)=>({text,source:'Edited line '+(i+1)}));loadLines(rawLines);};
function selectAmounts(lines){const v=$('amountColumn').value;return selectAmountsByPage(lines,v==='auto'?undefined:Number(v));}
// Offer a column choice when the balance sheet shows more than one amount per account.
// The worksheet and amount-column choices appear only when there is a real choice:
// an Excel file with several sheets, or a statement with several amount columns.
function showImportChoices(){$('bsPageBox').hidden=!!workbook||$('bsPage').querySelectorAll('input').length<2;$('sheet').closest('label').hidden=!workbook||$('sheet').options.length<2;$('amountColumn').closest('label').hidden=$('amountColumn').disabled;}
function showAmountColumns(lines){
 const source=balanceSheetSource(lines).lines,info=amountColumns(source.length?source:lines);
 $('amountColumn').innerHTML='<option value="auto">Automatic — '+(info.count>1?(info.index>=0?'latest period ('+escape(info.labels[info.index])+')':'Total / rightmost column'):'single amount column')+'</option>'+(info.count>1?Array.from({length:info.count},(_,i)=>'<option value="'+i+'">Column '+(i+1)+(info.labels[i]?' — '+escape(info.labels[i]):'')+'</option>').join(''):'');
 $('amountColumn').disabled=info.count<2;showImportChoices();
}
$('amountColumn').onchange=()=>{try{if(workbook)loadLines(selectAmounts(rawLines),$('sheet').value);else if(rawLines.length)importPdfLines();}catch(e){status(e.message);}};

function importPdfLines(){const pages=chosenPages($('bsPage')),selected=selectAmounts(onlyPages(rawLines,pages));$('raw').value=selected.map(l=>l.text).join('\n');loadLines(selected,'',{forced:pages!==null});if(pages!==null)status(pages.length?`${plural(rows.filter(r=>r.include).length,'detail line')} read from ${pagePhrase(pages)} of ${fileName} only.`:'Tick at least one page to read.');}
$('bsPage').onchange=()=>{try{showAmountColumns(onlyPages(rawLines,chosenPages($('bsPage'))));importPdfLines();if(chosenPages($('bsPage'))===null)status(`${plural(rows.filter(r=>r.include).length,'detail line')} extracted from ${fileName}. Review every extracted line.`);}catch(e){status(e.message);}};
async function pdfLines(file,progress=status,options={}){
 const doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;
 let lines=[],worker;
 try{
 for(let p=1;p<=doc.numPages;p++){
  progress(`Reading PDF page ${p} of ${doc.numPages}…`);const page=await doc.getPage(p),content=await page.getTextContent();let pageLines=[];
  const entries=content.items.filter(i=>i.str?.trim()).map(i=>({text:i.str,x:i.transform[4],y:i.transform[5],width:i.width||0})).sort((a,b)=>b.y-a.y||a.x-b.x);const groups=[];
  for(const item of entries){let g=groups.find(g=>Math.abs(g.y-item.y)<3);if(!g){g={y:item.y,items:[]};groups.push(g);}g.items.push(item);}
  const totalHeader=entries.find(i=>/^(grand\s+)?total$/i.test(i.text.trim()))||(options.mode==='expenses'?entries.find(i=>i.x>page.view[2]*.45&&/^(?:expenses?|amount)$/i.test(i.text.trim())):null);
  const percentHeader=entries.find(i=>/^(?:percent|%)$/i.test(i.text.trim())&&i.x>page.view[2]*.5);
  pageLines=groups.sort((a,b)=>b.y-a.y).map(g=>{
   const items=g.items.sort((a,b)=>a.x-b.x);
   if(percentHeader&&items.some(i=>amount(i.text)!==null&&i.x+i.width<percentHeader.x+percentHeader.width-10)){
    return items.filter(i=>i.x+i.width<percentHeader.x+percentHeader.width-10).map(i=>i.text).join('  ');
   }
   if(options.mode==='expenses'&&items.some(i=>i.x>page.view[2]*.45&&/^expenses?$/i.test(i.text.trim())))return 'Expenses';
   const numeric=items.filter(i=>amount(i.text)!==null);
   if(totalHeader&&numeric.length>1){const anchor=totalHeader.x+totalHeader.width;const selected=numeric.reduce((best,i)=>Math.abs(i.x+i.width-anchor)<Math.abs(best.x+best.width-anchor)?i:best);return items.filter(i=>i.x<numeric[0].x).map(i=>i.text).join('  ')+'  '+selected.text;}
   return items.map(i=>i.text).join('  ');
  });
  if(needsOcr(pageLines)){
   progress(`Recognizing scanned text on page ${p} of ${doc.numPages}…`);
   if(!worker)worker=await Tesseract.createWorker('eng',1,{workerPath:new URL('./vendor/worker.min.js',import.meta.url).href,corePath:new URL('./vendor/ocr-core',import.meta.url).href,langPath:new URL('./vendor',import.meta.url).href,gzip:false,logger:m=>{if(m.status==='recognizing text')progress(`OCR page ${p}: ${Math.round(m.progress*100)}%`);}});
   const viewport=page.getViewport({scale:2}),canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
   const {data}=await worker.recognize(canvas);pageLines=data.text.split('\n');
  }
  pageLines.forEach((text,i)=>lines.push({text,source:`Page ${p}, line ${i+1}`,page:p}));
  page.cleanup();
 }
 }finally{if(worker)await worker.terminate();await doc.destroy();}
 return lines;
}
function excelLines(){
 if(!workbook)return;const sheet=workbook.Sheets[$('sheet').value];if(!sheet)return;
 const titleCells=XLSX.utils.sheet_to_json(sheet,{header:1,defval:''}).flat().map(v=>({text:String(v)}));
 if(!balanceSheetSource(titleCells,{sheetName:$('sheet').value}).matched){rows=[];controls={};rawLines=[];$('raw').value='';resetReview();table();throw Error('Select a worksheet that contains a balance sheet heading or Assets, Liabilities and Equity sections.');}
 const data=XLSX.utils.sheet_to_json(sheet,{defval:''});
 if(data.length&&Object.hasOwn(data[0],'NMLS Field')&&Object.hasOwn(data[0],'Amount')){
  sectionOrder={};rows=data.map((r,i)=>({id:i+1,code:String(r['NMLS Field']).trim(),label:String(r.Description||r['NMLS Field']),cents:amount(r.Amount),section:fields[String(r['NMLS Field']).trim()]?.[1]||'',include:true,source:$('sheet').value+' row '+(i+2)}));
  controls={};const first=data[0];if(first['Company Name'])$('company').value=String(first['Company Name']);if(first['NMLS ID'])$('nmls').value=String(first['NMLS ID']);if(/^\d{4}-\d{2}-\d{2}$/.test(String(first['As Of Date']))){$('date').value=first['As Of Date'];$('reportYear').value=String(first['As Of Date']).slice(0,4);$('xmlPeriod').value='MCRQ'+Math.ceil(Number(String(first['As Of Date']).slice(5,7))/3);}
  $('raw').value='';rawLines=[];resetReview();table();return;
 }
 const range=XLSX.utils.decode_range(sheet['!ref']||'A1');if(range.e.r>100000||range.e.c>1000)throw Error('Worksheet range is too large. Use a balance-sheet-only worksheet.');
 let totalColumn=null;
 for(let r=range.s.r;r<=Math.min(range.e.r,range.s.r+20);r++)for(let c=range.s.c;c<=range.e.c;c++){const cell=sheet[XLSX.utils.encode_cell({r,c})];if(typeof cell?.v==='string'&&/^(grand\s+)?total$/i.test(cell.v.trim())){totalColumn=c;break;}if(totalColumn!==null)break;}
 rawLines=[];
 for(let r=range.s.r;r<=range.e.r;r++){
  const cells=[];for(let c=range.s.c;c<=range.e.c;c++){const cell=sheet[XLSX.utils.encode_cell({r,c})];if(cell&&cell.v!==undefined)cells.push({v:cell.v,c});}
  const values=cells.filter(c=>typeof c.v==='number'),labels=cells.filter(c=>typeof c.v!=='number').map(c=>String(c.v));
  let text=labels.join('  ');if(totalColumn!==null){const n=amount(sheet[XLSX.utils.encode_cell({r,c:totalColumn})]?.v);if(n!==null)text+='  $'+(n/100).toFixed(2);}else text+=values.map(v=>'  $'+v.v.toFixed(2)).join('');
  if(text)rawLines.push({text,source:$('sheet').value+' row '+(r+1)});
 }
 showAmountColumns(rawLines);const chosen=selectAmounts(rawLines);$('raw').value=chosen.map(l=>l.text).join('\n');loadLines(chosen,$('sheet').value);
}
$('sheet').onchange=()=>{try{excelLines();}catch(e){status(e.message);}};

$('file').onchange=async()=>{
 const file=$('file').files[0];if(!file)return;if(file.size>40*1024*1024){status('Please upload a file under 40 MB.');return;}
 setBusy(true);resetReview();sectionOrder={};rows=[];controls={};explanationEdited=false;table();workbook=null;fileName=file.name;$('bsPage').innerHTML='';status('Reading '+file.name+'…');
 try{
  if(/\.pdf$/i.test(file.name)){rawLines=await pdfLines(file);$('bsPage').innerHTML=pageChecks(rawLines,escape,tidyLabel).html;showAmountColumns(rawLines);importPdfLines();$('sheet').innerHTML='<option>PDF document</option>';}
  else if(/\.(xlsx|xls|csv)$/i.test(file.name)){workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false,raw:/\.csv$/i.test(file.name)});$('sheet').innerHTML=workbook.SheetNames.map(s=>`<option>${escape(s)}</option>`).join('');const match=workbook.SheetNames.find(s=>isBalanceSheetName(s));if(match)$('sheet').value=match;excelLines();}
  else throw Error('Choose PDF, XLSX, XLS, or CSV.');
  if(!$('company').value){const first=rawLines.find(l=>l.text.trim());if(first&&!/assets|balance sheet/i.test(first.text)&&first.text.length<130)$('company').value=tidyLabel(first.text.trim());}
  status(`${plural(rows.filter(r=>r.include).length,'detail line')} extracted from ${file.name}. Review every extracted line.`);
 }catch(e){status('Unable to import: '+String(e.message).replace(/\.$/,'')+'. You can paste text or add lines manually.');}
 finally{setBusy(false);showImportChoices();}
};
table();
function updateReportingDate(){$('date').value=reportingDate($('reportYear').value,$('xmlPeriod').value);resetReview();}
$('xmlPeriod').addEventListener('change',updateReportingDate);
$('reportYear').addEventListener('input',updateReportingDate);
updateReportingDate();

const allocator=mountAllocator({getBalance:()=>({...reconcile(rows,controls),sources:rows.filter(r=>r.include).reduce((m,r)=>{m[r.code]=m[r.code]?m[r.code]+'; '+r.source:r.source;return m;},{})}),readPdf:pdfLines,getSource:()=>({lines:selectAmounts(rawLines),name:fileName}),getMeta:()=>({company:$('company').value.trim(),nmls:$('nmls').value.trim(),date:$('date').value}),onChange:resetReview});

$('otherAssetsExplanation').addEventListener('input',()=>{explanationEdited=true;resetReview();checks();});
$('otherAssetsReset').onclick=()=>{explanationEdited=false;resetReview();checks();};
mountCombined(()=>({otherAssetsExplanation:$('otherAssetsExplanation').value.trim(),company:$('company').value.trim(),nmls:$('nmls').value.trim(),date:$('date').value,period:$('xmlPeriod').value}),()=>{const result=checks();if(!result.count)throw Error('Review and include the balance sheet accounts in the Schedules A & B review first.');return {...result,meta:{company:$('company').value.trim(),nmls:$('nmls').value.trim(),date:$('date').value}};},()=>allocator.getReport());

$('expenseGuidance').innerHTML='<ul>'+['C210','C220','C230','C240','C770','D010','D020','D030','D040','D050','D060','D110','D150','D160','D200','D210','D220','D230','D280','C150','D310','D510'].map(c=>'<li><a target="_blank" rel="noopener" href="'+sourceLink(c)+'">'+c+'</a> — '+escape(guide(c))+'</li>').join('')+'</ul>';
