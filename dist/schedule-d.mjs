import {amount,rounded,moneyMatches,selectTotalAmountLine} from './engine.mjs';
export const dFields=[
 ['D010','Loan production officers / sales','B','Personnel'],['D020','Loan origination / non-sales staff','B','Personnel'],['D030','Warehousing / secondary marketing staff','B','Personnel'],['D040','Post-close / production support staff','B','Personnel'],['D050','Origination management and directors','A','Personnel'],['D060','Other origination personnel','B','Personnel'],['D080','Servicing management and directors','B','Personnel'],['D090','Other servicing personnel','B','Personnel'],['D110','Investment portfolio personnel','B','Personnel'],['D120','Contra: personnel expenses reclassified / deferred','B','Personnel'],
 ['D150','Benefits, training and payroll taxes','C','Personnel'],['D160','Other personnel expenses','D','Personnel'],
 ['D200','Occupancy and equipment','E','Operating expenses'],['D210','Technology expenses','F','Operating expenses'],['D220','Outsourcing fees','G','Operating expenses'],['D230','Professional fees','H','Operating expenses'],['D240','Subservicing fees','I','Operating expenses'],['D250','Unreimbursed foreclosure / REO servicing','I','Operating expenses'],['D260','Change in REO valuation allowance','I','Operating expenses'],['D270','Provision for other losses','I','Operating expenses'],['D280','Other non-interest expenses','I','Operating expenses'],['D290','Contra: operating expenses reclassified','I','Operating expenses'],
 ['D400','Corporate personnel allocations','I','Corporate allocations'],['D410','Corporate technology allocations','I','Corporate allocations'],['D420','Goodwill impairment','I','Corporate allocations'],['D430','Other corporate allocations','I','Corporate allocations'],
 ['D520','Income taxes / tax benefit','I','Taxes and adjustments'],['D540','After-tax extraordinary items','I','Taxes and adjustments'],['D560','After-tax noncontrolling interest','I','Taxes and adjustments'],
 ['C100','Warehousing interest expense','J','Interest expense'],['C110','Income property interest expense','J','Interest expense'],['C120','MBS pools / prepayment interest shortfall','J','Interest expense'],['C130','Interest on residential MSR asset','J','Interest expense'],['C140','Debt issuance interest','J','Interest expense'],['C150','Other interest expense','J','Interest expense']
].map(([code,label,category,section])=>({code,label,category,section})).sort((a,b)=>a.code.localeCompare(b.code));
export const dFieldMap=Object.fromEntries(dFields.map(r=>[r.code,r]));
const adjustmentCodes=['D520','D540','D560'];
const defs=[
 ['D070','Total origination compensation','D010 D020 D030 D040 D050 D060'],['D100','Total servicing compensation','D080 D090'],['D129','Total other personnel compensation','D110 D120'],['D130','Total non-corporate personnel compensation','D070 D110'],['D170','Total other personnel expenses','D150 D160'],['D180','Total personnel expenses','D130 D170'],['D300','Total other non-interest expenses','D200 D210 D220 D230 D240 D250 D260 D270 D280 D290'],['D440','Total corporate allocations','D400 D410 D420 D430'],['C160','Total interest expense','C100 C110 C120 C130 C140 C150'],['D310','Total gross expenses','C160 D180 D300 D440'],['D510','Pre-tax net operating income','C800 -D310'],['D530','Net income before extraordinary items / noncontrolling interest','D510 -D520'],['D550','Net income before noncontrolling interest','D530 D540'],['D600','Net income','D550 D560']
].map(([code,label,deps])=>({code,label,deps:deps.split(' ')}));
export function suggestD(label,category){
 const s=label.toLowerCase();
 if(/income tax|corporate tax|federal tax|state income tax/.test(s))return 'D520';
 if(/noncontrolling|minority interest/.test(s))return 'D560';
 if(/extraordinary/.test(s))return 'D540';
 if(/loan officer|\bmlo\b|sales commission/.test(s))return 'D010';
 if(/underwrit|closer|processor salar|processing staff/.test(s))return 'D020';
 if(/salar|wages/.test(s)&&/payroll tax/.test(s))return ''; // Combined pay and payroll tax: split or choose in review.
 if(/payroll tax|fica|futa|suta|unemployment/.test(s))return 'D150';
 if(/subservicing/.test(s))return 'D240';
 if(/warehouse.*interest|interest.*warehouse/.test(s))return 'C100';
 if(category==='B')return ''; // Staff function must be reviewed instead of guessed.
 return {A:'D050',C:'D150',D:'D160',E:'D200',F:'D210',G:'D220',H:'D230',I:'D280',J:'C150'}[category]||'';
}
export function splitExpense(rows,id,part,field){
 const original=rows.find(r=>r.id===id);if(!original||!Number.isSafeInteger(part)||!part||!dFieldMap[field])throw Error('Enter a valid split amount and NMLS field.');
 if(Math.sign(part)!==Math.sign(original.cents)||Math.abs(part)>=Math.abs(original.cents))throw Error('Split amount must have the same sign and be smaller than the original amount.');
 const next={...original,id:Math.max(0,...rows.map(r=>r.id))+1,cents:part,field,category:dFieldMap[field].category,source:original.source+' / split',label:original.label+' (split)'};
 original.cents-=part;rows.splice(rows.indexOf(original)+1,0,next);return next;
}
export function extractPLFigures(lines){
 const result={};let revenue,otherIncome,otherIncomeTotal,inOtherIncome=false,revenueExpenseStatement=false,inRevenue=false,revenueSum=0,revenueCount=0,finished=false;
 for(const line of lines){
  const raw=(typeof line==='string'?line:line.text).trim();
  if(/^statement of revenues? (?:and|&) expenses?$/i.test(raw))revenueExpenseStatement=true;
  if(/^other income$/i.test(raw)){inOtherIncome=true;continue;}
  // A revenue section with no total line: its detail lines are summed for gross income.
  if(!moneyMatches(raw).length&&raw){inRevenue=!finished&&/^(?:(?:operating|trading)\s+)?(?:revenues?|income|sales)$/i.test(raw.replace(/[:\s]+$/,''));}
  const text=selectTotalAmountLine(typeof line==='string'?{text:line,source:''}:line).text;
  const ms=moneyMatches(text);if(!ms.length)continue;
  const label=text.slice(0,ms[0].index).trim(),value=amount(ms[0][0]);if(value===null)continue;
  if(inRevenue){if(/^(?:total|gross|net)\b/i.test(label))inRevenue=false;else if(label){revenueSum+=value;revenueCount++;}}
  if(/^net\s+(?:income|profit|loss|earnings)(?:\s*\(loss\))?$/i.test(label))finished=true;
  if(/^total\s+(?:(?:trading|operating|ordinary|gross)\s+)?(?:revenues?|income|sales)$|^gross income$/i.test(label)&&result.gross===undefined)result.gross=value;
  // Other income reported below operating income is part of total gross income (C800).
  if(/^total\s+other\s+income$/i.test(label)&&otherIncomeTotal===undefined)otherIncomeTotal=value;
  if(/^(?:bank\s+)?interest\s+(?:income|earned)$/i.test(label)&&result.interest===undefined)result.interest=value;
  if(/^net\s+(?:income(?:\s*\(loss\))?|profit|loss)$/i.test(label)&&result.reportedNet===undefined)result.reportedNet=/^net loss$/i.test(label)&&value>0?-value:value;
  if(!revenueExpenseStatement)continue;
  if(/^net revenues?$/i.test(label)&&revenue===undefined)revenue=value;
  if(/^other income$/i.test(label)&&otherIncome===undefined)otherIncome=value;
  if(inOtherIncome&&/^interest income$/i.test(label)&&result.interest===undefined)result.interest=value;
  if(/^total$/i.test(label))inOtherIncome=false;
 }
 if(revenue!==undefined&&result.gross===undefined)result.gross=revenue+(otherIncome??0);
 else{if(result.gross===undefined&&revenueCount)result.gross=revenueSum;if(result.gross!==undefined&&otherIncomeTotal!==undefined)result.gross+=otherIncomeTotal;}
 return result;
}
export function buildScheduleD(rows,options={}){
 const active=rows.filter(r=>r.include!==false),groups={},issues=[],warnings=[];
 if(!active.length)issues.push('Add or import expense lines for Schedule D.');if(active.length>75)issues.push('Include no more than 75 expense lines.');
 for(const r of active){if(!dFieldMap[r.field]){issues.push('Choose a Schedule D field: '+r.label);continue;}if(!Number.isSafeInteger(r.cents)){issues.push('Invalid expense amount: '+r.label);continue;}groups[r.field]=(groups[r.field]||0)+r.cents;}
 for(const [c,v]of Object.entries(groups)){if((c==='D120'||c==='D290')&&v>0)issues.push(c+' must be zero or negative.');if(/^C1[0-5]0$/.test(c)&&v<0)issues.push(c+' interest expense must be zero or positive.');}
 if(['D080','D090','D120'].some(c=>groups[c]))issues.push('FV7 published D130 instructions exclude servicing compensation and personnel contra amounts. Verify the NMLS calculation for D080/D090/D120 before exporting this allocation.');
 if(groups.D260)warnings.push('D260 must also match Schedule O120 in NMLS.');if(groups.D270)warnings.push('D270 must also match Schedule O220 in NMLS.');
 const gross=options.gross,interest=options.interest===undefined?0:options.interest,reportedNet=options.reportedNet;
 if(!Number.isSafeInteger(gross))issues.push('Enter total gross income, before expenses.');if(!Number.isSafeInteger(interest))issues.push('Enter a valid interest income amount.');if(!Number.isSafeInteger(reportedNet))issues.push('Enter the P&L final net income or loss.');
 const incomeField=options.incomeField||'C210';if(!['C210','C220','C230','C240','C770'].includes(incomeField))issues.push('Choose a supported income field.');
 groups[incomeField]=(gross||0)-(interest||0);groups.C060=interest||0;
 const values={...groups,C800:gross||0},whole=Object.fromEntries(Object.entries(groups).map(([c,v])=>[c,rounded(v)]));whole.C800=rounded(groups[incomeField])+rounded(groups.C060);
 const present=Object.fromEntries(Object.keys(groups).map(c=>[c,true]));present.C800=Number.isSafeInteger(gross);
 const calculated=defs.map(def=>{present[def.code]=def.deps.some(c=>present[c.replace(/^-/,'')]);const sum=data=>def.deps.reduce((s,c)=>s+(c[0]==='-'?-1:1)*(data[c.replace(/^-/,'')]||0),0);values[def.code]=sum(values);whole[def.code]=sum(whole);return {...def,hasInformation:!!present[def.code],cents:values[def.code],whole:whole[def.code],formula:def.deps.map((c,i)=>c.startsWith('-')?'− '+c.slice(1):(i?'+ ':'')+c).join(' ')};});
 const expenses=values.D310,net=values.D600;
 if(Number.isSafeInteger(reportedNet)&&Number.isSafeInteger(gross)){
  if(net!==reportedNet)issues.push('Calculated D600 differs from P&L net income by $'+((net-reportedNet)/100).toFixed(2)+'.');
  if(whole.D600!==rounded(reportedNet))issues.push('Whole-dollar D600 differs from rounded P&L net income by $'+(whole.D600-rounded(reportedNet))+'.');
 }
 if(rounded(expenses)!==whole.D310)issues.push('Expense fields have a whole-dollar rounding difference of $'+(whole.D310-rounded(expenses))+'.');
 if(Number.isSafeInteger(gross)&&whole.C800!==rounded(gross))issues.push('Gross income fields have a whole-dollar rounding difference.');
 if(options.sourceExpenses!==null&&options.sourceExpenses!==undefined&&!Number.isSafeInteger(options.sourceExpenses))issues.push('Enter a valid gross expense control total.');
 if(rounded(values.D510)!==whole.D510)issues.push('Pre-tax D510 has a whole-dollar rounding difference of $'+(whole.D510-rounded(values.D510))+'.');
 if(Number.isSafeInteger(options.sourceExpenses)&&options.sourceExpenses!==expenses)issues.push('Schedule D gross expenses differ from your expense control total by $'+((expenses-options.sourceExpenses)/100).toFixed(2)+'.');
 groups.D310=expenses;groups.D510=values.D510;
 return {groups,issues:[...new Set(issues)],warnings,calculated,gross:gross||0,interest:interest||0,expenses,net,reportedNet,entryCount:active.length,grossSource:options.grossSource||'Schedules C & D review',meta:options.meta||{},options};
}
export function addScheduleWorkbook(wb,rows,report,meta){
 const data=wb.addWorksheet('Schedule D Lines');data.columns=[{width:16},{width:46},{width:20},{width:65},{width:12}];data.addRow(['NMLS field','Description','Amount','Source','Include']);for(const r of rows)data.addRow([r.field,r.label,r.cents/100,r.source,r.include===false?'No':'Yes']);data.getColumn(3).numFmt='#,##0.00;(#,##0.00)';data.views=[{state:'frozen',ySplit:1}];data.getRow(1).font={bold:true};
 const setup=wb.addWorksheet('Schedule D Setup');setup.addRows([['Version','Simple Schedule D v1'],['Company',meta.company],['NMLS ID',meta.nmls],['As of',meta.date],['Gross income',Number.isSafeInteger(report.options.gross)?report.gross/100:''],['Other interest income',report.interest/100],['P&L final net income',Number.isSafeInteger(report.options.reportedNet)?report.reportedNet/100:''],['Non-interest income field',report.options.incomeField||'C210'],['Gross expense control total',Number.isSafeInteger(report.options.sourceExpenses)?report.options.sourceExpenses/100:''],['Instructions','Edit Schedule D Lines and Setup for Schedule D. SFC worksheet is a category reference; changes there do not replace field allocations. A numeric B36/B43 gross override, including an explicit zero, still applies; leave it blank to use the Setup or L26/L33 gross income.']]);setup.columns=[{width:32},{width:110}];
 const review=wb.addWorksheet('Schedule D Review');review.columns=[{width:15},{width:48},{width:20},{width:22},{width:65}];review.addRow(['Field','Description','Original dollars','NMLS whole dollars','Calculation']);
 review.addRow(['C800','Total gross income',{formula:"'Schedule D Setup'!B5",result:report.gross/100},{formula:'ROUND(C2,0)',result:rounded(report.gross)},'Schedule D Setup']);
 const entries=dReviewRows(report),lookup={C800:2};entries.forEach((r,i)=>lookup[r.code]=i+3);
 for(const r of entries){const row=review.addRow([r.code,r.label,r.cents/100,r.whole,r.formula||'Input']);
 if(r.deps){for(const col of ['C','D']){const formula=r.deps.map(c=>(c.startsWith('-')?'-':'+')+(lookup[c.replace(/^-/,'')]?col+lookup[c.replace(/^-/,'')]:'0')).join('').replace(/^\+/,'');review.getCell(col+row.number).value={formula,result:col==='C'?r.cents/100:r.whole};}row.font={bold:true};}
 else {review.getCell('C'+row.number).value={formula:`SUMIFS('Schedule D Lines'!C2:C1000,'Schedule D Lines'!A2:A1000,A${row.number},'Schedule D Lines'!E2:E1000,"Yes")`,result:r.cents/100};review.getCell('D'+row.number).value={formula:'ROUND(C'+row.number+',0)',result:r.whole};}}
 review.getColumn(3).numFmt='#,##0.00;(#,##0.00)';review.getColumn(4).numFmt='#,##0;(#,##0)';review.views=[{state:'frozen',ySplit:1}];

}
export function readScheduleWorkbook(book){
 const setup=book.Sheets['Schedule D Setup'],sheet=book.Sheets['Schedule D Lines'];if(!setup||!sheet||setup.B1?.v!=='Simple Schedule D v1')throw Error('Unrecognized Schedule D workbook.');
 const val=(cell,required=false,strict=true)=>{if(cell?.t==='e')throw Error('Resolve Excel errors in Schedule D Setup.');const n=amount(cell?.v);if(strict&&cell?.v!==undefined&&String(cell.v).trim()!==''&&n===null)throw Error('Invalid amount in the completed Schedule D workbook.');if(required&&n===null)throw Error('Complete the gross income and final net income in Schedule D Setup.');return n;};
 const rows=[];for(let i=2;i<=1000;i++){const field=String(sheet['A'+i]?.v||'').trim().toUpperCase(),label=String(sheet['B'+i]?.v||'').trim(),cell=sheet['C'+i];if(!field&&!label&&(cell?.v===undefined||cell.v===''))continue;if(cell?.t==='e')throw Error('Excel error in Schedule D Lines row '+i);const include=String(sheet['E'+i]?.v??'Yes').trim();if(!/^(yes|no)$/i.test(include))throw Error('Use Yes or No in Schedule D Lines Include column, row '+i);rows.push({field,label:label||field,cents:amount(cell?.v),source:sheet['D'+i]?.v||'Excel row '+i,include:!/^no|false|0$/i.test(include)});}
 if(Object.entries(sheet).some(([key,cell])=>/^[A-E](\d+)$/.test(key)&&Number(key.match(/\d+/)[0])>1000&&cell?.v!==undefined&&cell.v!==''))throw Error('Schedule D Lines exceeds 999 worksheet rows.');
 let gross=val(setup.B5),reportedNet=val(setup.B7),grossSource='Schedule D Setup!B5';
 for(const [name,s]of Object.entries(book.Sheets)){const map=Object.entries(s).find(([key,c])=>/^A\d+$/.test(key)&&String(c.v).trim().toUpperCase()==='D050');if(map){const shift=Number(map[0].slice(1))-22,address='B'+(36+shift),override=val(s[address],false,false);if(override!==null){gross=override;grossSource=name+'!'+address;}else if(gross===null){gross=val(s['L'+(26+shift)]);grossSource=name+'!L'+(26+shift);}if(reportedNet===null)reportedNet=val(s['L'+(28+shift)]);break;}}
 return buildScheduleD(rows,{gross,interest:val(setup.B6)||0,reportedNet,incomeField:String(setup.B8?.v||'C210'),sourceExpenses:val(setup.B9),grossSource,meta:{company:setup.B2?.v,nmls:setup.B3?.v,date:setup.B4?.v}});
}

export function dReviewRows(report){const input=Object.entries(report.groups).filter(([c])=>dFieldMap[c]).map(([code,cents])=>({code,label:dFieldMap[code].label,cents,whole:rounded(cents)}));const rows=[...input,...report.calculated.filter(r=>r.hasInformation)];const order='C100 C110 C120 C130 C140 C150 C160 D010 D020 D030 D040 D050 D060 D070 D080 D090 D100 D110 D120 D129 D130 D150 D160 D170 D180 D200 D210 D220 D230 D240 D250 D260 D270 D280 D290 D300 D400 D410 D420 D430 D440 D310 D510 D520 D530 D540 D550 D560 D600'.split(' ');return rows.sort((a,b)=>order.indexOf(a.code)-order.indexOf(b.code));}
