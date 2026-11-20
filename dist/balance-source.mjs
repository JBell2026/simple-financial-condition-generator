// Normalize PDF/OCR title variants without mixing unrelated statements into Section 3.
const normalized=value=>String(value).normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
const compact=value=>normalized(value).replace(/[^a-z]/gi,'').toLowerCase();
export function isBalanceSheetTitle(value){
 const s=normalized(value);
 if(/^(?:see|refer|note|notes|attached|included)\b/i.test(s))return false;
 return /^(?:(?:consolidated|consolidating|combined|comparative|condensed|unaudited|audited)\s+)*(?:balance[\s_-]*sheets?|statements?\s+of\s+financial\s+(?:position|condition)|statements?\s+of\s+assets,?\s+liabilities,?\s+(?:and|&)\s+equity)\b/i.test(s)||/^(?:consolidated|comparative|unaudited)?balancesheets?(?:asof|continued|september|december|march|june|$)/.test(compact(s));
}
export const isBalanceSheetName=value=>/\bbalance[\s_-]*sheets?\b/i.test(normalized(value))||isBalanceSheetTitle(value);
export const isOtherStatementTitle=value=>/^(?:(?:consolidated|comparative|combined|management|adjusted|condensed|unaudited)\s+)*(?:cash\s*flow(?:\s+statement)?|statements?\s+of\s+cash\s*flows?|income\s*statement|statements?\s+of\s+(?:income|operations|earnings|revenues?\s+(?:and|&)\s+expenses?)|profit\s*(?:and|&)\s*loss|p\s*&\s*l)(?:\b|\s|:|$)/i.test(normalized(value));
const sectionTitle=value=>normalized(value).replace(/[:\s]+$/,'');
function balanceStructure(items){
 const texts=items.map(l=>sectionTitle(l.text));
 return texts.some(s=>/^(?:total |current |non.current )?assets$/i.test(s))&&texts.some(s=>/^(?:total |current |non.current )?liabilities(?:\s*(?:and|&)\s*.*equity)?$/i.test(s))&&texts.some(s=>/^(?:(?:members?|owners?|stockholders?|shareholders?)[’'s\s]*)?equity$/i.test(s));
}
export function balanceSheetSource(lines,{sheetName=''}={}){
 const normalizedLines=lines.map((line,i)=>typeof line==='string'?{text:line,source:'Line '+(i+1)}:line);
 const pages=new Map();
 for(const line of normalizedLines){const page=line.page??String(line.source||'').match(/^Page (\d+),/)?.[1]??'text';if(!pages.has(page))pages.set(page,[]);pages.get(page).push(line);}
 const selected=[],excluded=[],supplements=[];let previousBalance=false;
 for(const [page,items]of pages){
  // Combine adjacent short lines to handle titles split across PDF text objects/OCR lines.
  const titleAt=i=>isBalanceSheetTitle(items[i].text)||(String(items[i].text).trim().length<35&&String(items[i+1]?.text||'').trim().length<80&&isBalanceSheetTitle(items[i].text+' '+(items[i+1]?.text||'')));
  const headerIndex=items.findIndex((l,i)=>titleAt(i)||isOtherStatementTitle(l.text));
  const header=headerIndex>=0?items[headerIndex]:null;
  const supplementary=items.slice(0,8).some(l=>/^supplement(?:ary|al) schedules?$/i.test(sectionTitle(l.text)));
  if(supplementary){if(header&&titleAt(headerIndex))supplements.push(items);excluded.push(page);previousBalance=false;continue;}
  const structural=!header&&balanceStructure(items);
  const continuation=!header&&previousBalance&&items.some(l=>/^(?:(?:total |current |non.current |long.term )?(?:assets|liabilities)|(?:(?:members?|owners?|stockholders?|shareholders?)[’'s\s]*)?equity)(?:\s*\(continued\))?$/i.test(sectionTitle(l.text)));
  const eligible=header?titleAt(headerIndex):structural||continuation||(page==='text'&&isBalanceSheetName(sheetName));
  previousBalance=!!eligible;
  if(!eligible){excluded.push(page);continue;}
  let active=!header;
  for(let i=0;i<items.length;i++){
   const line=items[i];
   if(isOtherStatementTitle(line.text)){active=false;continue;}
   if(titleAt(i)){active=!items.slice(i+1,i+4).some(l=>/^supplement(?:ary|al) schedules?$/i.test(sectionTitle(l.text)));if(!active)continue;selected.push({...line,text:'Balance Sheet'});continue;}
   if(active)selected.push(line);
  }
 }
 return {lines:selected,excluded,supplements,matched:pages.size-excluded.length};
}

// Pages of an uploaded PDF, each with a short label taken from its statement title
// (or its first line of text), for the "pages to read" pickers.
export function pageList(lines){
 const pages=new Map();for(const l of lines){if(l?.page==null)continue;if(!pages.has(l.page))pages.set(l.page,[]);pages.get(l.page).push(String(l.text||'').trim());}
 return [...pages].map(([page,texts])=>{const named=texts.filter(t=>/[a-z]{3}/i.test(t)),title=named.find(t=>isBalanceSheetTitle(t)||isOtherStatementTitle(t))||named.slice(0,6).find(t=>/balance sheet|statement|profit|income|p\s*&\s*l|schedule/i.test(t))||named[0]||'';return {page,label:title.replace(/\s+/g,' ').slice(0,60)};});
}
export const pageOptions=(lines,escape,tidy=s=>s)=>{const pages=pageList(lines).map(p=>({...p,label:tidy(p.label)}));return {count:pages.length,html:'<option value="all">All pages (automatic)</option>'+pages.map(p=>'<option value="'+p.page+'">Only page '+p.page+(p.label?' — '+escape(p.label):'')+'</option>').join('')};};
export const onlyPage=(lines,value)=>value==='all'||value===undefined?lines:lines.filter(l=>String(l.page)===String(value));
