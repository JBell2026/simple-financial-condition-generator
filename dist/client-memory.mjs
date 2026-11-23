// Per-client memory of the user's own choices, kept in this browser only. It stores
// account and expense names with the NMLS field or category chosen for them, plus a few
// settings. It never stores amounts.
const STORE='simple-fc-client-memory';
export const memoryKey=label=>String(label||'').toLowerCase().replace(/\(split\)/g,'').replace(/[^a-z0-9]+/g,' ').trim();
function all(){try{const v=JSON.parse(localStorage.getItem(STORE)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}catch{return {};}}
const keysFor=(company,nmls)=>[String(company||'').trim().toLowerCase(),String(nmls||'').trim()].filter(Boolean);
// Choices saved under the company name and under the NMLS ID are combined; the NMLS ID wins.
export function recall(company,nmls){
 const store=all(),out={bs:{},pl:{},settings:{}};
 for(const key of keysFor(company,nmls)){const m=store[key];if(!m)continue;Object.assign(out.bs,m.bs||{});Object.assign(out.pl,m.pl||{});Object.assign(out.settings,m.settings||{});}
 return out;
}
function update(company,nmls,change){
 const keys=keysFor(company,nmls);if(!keys.length)return false;
 try{const store=all(),key=keys.at(-1),m=store[key]||{};m.bs=m.bs||{};m.pl=m.pl||{};m.settings=m.settings||{};change(m);store[key]=m;localStorage.setItem(STORE,JSON.stringify(store));return true;}catch{return false;}
}
export const rememberAccount=(company,nmls,label,section,code)=>update(company,nmls,m=>{const k=memoryKey(label);if(!k)return;if(code)m.bs[k]={section,code};else delete m.bs[k];});
export const rememberExpense=(company,nmls,label,category)=>/\(split\)/i.test(label)?false:update(company,nmls,m=>{const k=memoryKey(label);if(k&&category)m.pl[k]=category;});
export const rememberSetting=(company,nmls,name,value)=>update(company,nmls,m=>{m.settings[name]=value;});
export function forget(company,nmls){try{const store=all();for(const key of keysFor(company,nmls))delete store[key];localStorage.setItem(STORE,JSON.stringify(store));return true;}catch{return false;}}
export const savedCount=(company,nmls)=>{const m=recall(company,nmls);return Object.keys(m.bs).length+Object.keys(m.pl).length;};
