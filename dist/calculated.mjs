import {rounded,fields} from './engine.mjs';
// Review-only FV7 balance-sheet aggregates. Never merge these into XML inputs.
export const calculations=[
 ['A039','Total Cash and Current Securities','Assets','A010 A034 A036 A038'],
 ['A063','Total Mortgage Loans Held for Sale','Assets','A060 A062'],
 ['A237','Total Current Assets','Assets','A039 A063 A230C A190 A050 A040'],
 ['A033','Total Cash and Long-Term Securities','Assets','A020 A030 A032'],
 ['A067','Total Mortgage Loans Held for Investment','Assets','A064 A066'],
 ['A230','Other Assets subtotal','Assets','A230A A230B A230E A230G A230H'],
 ['A239','Total Long-Term Assets','Assets','A033 A067 A160 A080 A070 A090 A100 A110 A170 A180 A210 A220 A200 A230D A230F A230'],
 ['A240','Total Assets','Assets','A237 A239'],
 ['B217','Total Current Liabilities','Liabilities','B009 B010 B070 B080 B090 B100 B120'],
 ['B219','Total Long-Term Liabilities','Liabilities','B020 B030 B040 B050 B060 B110 B130 B140 B150 B160 B170 B180 B190 B200 B210'],
 ['B220','Total Liabilities','Liabilities','B217 B219'],
 ['B319','Total Corporate Equity','Equity','B250 B260 B270 B280 B290 B300 B310 B240'],
 ['B349','Total Limited Partnership and Members Capital','Equity','B330 B340'],
 ['B350','Total Equity','Equity','B319 B320 B349'],
 ['B360','Total Liabilities and Equity','Equity','B220 B350']
].map(([code,label,section,deps])=>({code,label,section,deps:deps.split(' ')}));
// Schedule A/B order. Other Assets fields sit before their subtotal and before Total Assets.
export const filingOrder='A010 A034 A036 A038 A039 A060 A062 A063 A230B A230C A190 A050 A040 A237 A020 A030 A032 A033 A064 A066 A067 A160 A080 A070 A090 A100 A110 A170 A180 A210 A220 A200 A230D A230F A230A A230E A230G A230H A230 A239 A240 A250 A260 A262 A264 A266 B009 B010 B070 B080 B090 B100 B120 B217 B020 B030 B040 B050 B060 B110 B130 B140 B150 B160 B170 B180 B190 B200 B210 B219 B220 B250 B260 B270 B280 B290 B300 B310 B240 B319 B320 B330 B340 B349 B350 B360'.split(' ');
export function filingCompare(a,b){const rank=c=>filingOrder.includes(c)?filingOrder.indexOf(c):999;return rank(a.code)-rank(b.code)||String(a.code||'').localeCompare(String(b.code||''));}
export function orderedReview(groups){return [...Object.entries(groups).filter(([c])=>fields[c]).map(([code,cents])=>({code,cents,whole:rounded(cents),label:fields[code][0],section:fields[code][1]})),...calculatedReview(groups).filter(r=>r.hasInformation)].sort(filingCompare);}
export function calculatedReview(groups){
 const information=Object.fromEntries(Object.keys(groups).map(c=>[c,true]));
 const cents={...groups},whole=Object.fromEntries(Object.entries(groups).map(([c,v])=>[c,rounded(v)]));
 return calculations.map(row=>{information[row.code]=row.deps.some(c=>information[c]);cents[row.code]=row.deps.reduce((s,c)=>s+(cents[c]||0),0);whole[row.code]=row.deps.reduce((s,c)=>s+(whole[c]||0),0);return {...row,hasInformation:!!information[row.code],cents:cents[row.code],whole:whole[row.code],formula:row.deps.join(' + ')};});
}
export function addBalanceReview(wb,balance){
 const ws=wb.addWorksheet('Balance Sheet Review');
 ws.columns=[{width:15},{width:53},{width:20},{width:23},{width:18},{width:65},{width:85}];
 ws.addRow(['NMLS balance sheet review']);ws.addRow(['Calculated rows are review only. Unassigned inputs count as zero; verify completeness.']);
 ws.addRow(['Field','Description','Original dollars','NMLS whole dollars','Type','Calculation','Source accounts']);
 const map={},entries=[];
 for(const section of ['Assets','Liabilities','Equity']){
  const sectionRows=orderedReview(balance.groups).filter(r=>r.section===section);
  if(!sectionRows.length)continue;
  entries.push({section,heading:true},...sectionRows.map(r=>({...r,source:r.deps?'':balance.sources?.[r.code]||''})));
 }
 entries.forEach((r,i)=>{if(r.code)map[r.code]=i+4;});
 entries.forEach(r=>{
  const row=ws.addRow(r.heading?[r.section,'','','','','','']:[r.code,r.label,r.cents/100,r.whole,r.deps?'Calculated':'Input',r.formula||'',r.source||'']);
  const color=r.section==='Assets'?'20354D':r.section==='Liabilities'?'985448':'42505A';
  if(r.heading){row.eachCell({includeEmpty:true},c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+color}};c.font={bold:true,color:{argb:'FFF7F4EC'}};});}
  else {
   if(r.deps)for(const [col,value]of [['C',r.cents/100],['D',r.whole]]){const refs=r.deps.filter(c=>map[c]).map(c=>col+map[c]);ws.getCell(col+row.number).value={formula:refs.length?'SUM('+refs.join(',')+')':'0',result:value};}
   else ws.getCell('D'+row.number).value={formula:'ROUND(C'+row.number+',0)',result:r.whole};
   ws.getCell('C'+row.number).numFmt='#,##0.00;(#,##0.00)';ws.getCell('D'+row.number).numFmt='#,##0;(#,##0)';
   if(r.deps)row.eachCell(c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF7F4EC'}};c.font={bold:true,color:{argb:'FF20354D'}};});
  }
 });
 ws.views=[{state:'frozen',ySplit:3}];
 return ws;
}
