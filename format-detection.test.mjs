import assert from 'node:assert/strict';
import fs from 'node:fs';
import {balanceSheetSource,isBalanceSheetTitle,isOtherStatementTitle} from './dist/balance-source.mjs';
import {parseLines,selectTotalAmountLine} from './dist/engine.mjs';
for(const title of ['Balance Sheet: as of September 30, 2026','CONSOLIDATED BALANCE SHEETS (Unaudited)','Balance-Sheet','Statement of Financial Position','B A L A N C E S H E E T'])assert(isBalanceSheetTitle(title),title);
for(const title of ['Statement of Operations (GAAP basis): March 1 to September 30, 2026','Management P&L and Adjusted EBITDA','Cash Flow Statement'])assert(isOtherStatementTitle(title),title);
assert(!isBalanceSheetTitle('See Balance Sheet for details'));
const split=balanceSheetSource(['Balance','Sheet: September 30, 2026','Assets','Cash  1,000','Liabilities','Accounts payable  200',"Members’ equity",'Member contributions  800']);
const parsed=parseLines(split.lines);assert.equal(parsed.rows.find(r=>r.code==='A010').cents,100000);assert.equal(parsed.rows.find(r=>r.code==='B340').cents,80000);
assert.equal(selectTotalAmountLine({text:'Cash  5,000  10,000',source:'Page 1'}).text.trim(),'Cash   10,000');
assert.equal(selectTotalAmountLine({text:'Mercury Checking - 5892  $151,200.17',source:'Page 1'}).text,'Mercury Checking - 5892  $151,200.17');
const structure=balanceSheetSource(['Assets','Cash  1,000','Liabilities','Accounts payable  200','Equity','Retained earnings  800']);assert.equal(structure.matched,1);
if(process.argv[2]){
 const pages=fs.readFileSync(process.argv[2],'utf8').split('\f').filter(p=>p.trim());
 const lines=pages.flatMap((p,i)=>p.split('\n').map((text,j)=>({text,page:i+1,source:`Page ${i+1}, line ${j+1}`})));
 const source=balanceSheetSource(lines);assert.equal(source.matched,1);assert(source.lines.every(l=>l.page===2));
 const result=parseLines(source.lines.map(selectTotalAmountLine));assert.equal(result.controls.assets,32606300);assert.equal(result.controls.liabilities,752600);assert.equal(result.controls.equity,31853700);assert.equal(result.rows.find(r=>r.code==='A010').cents,14094500);assert.equal(result.rows.find(r=>r.code==='A020').cents,2000000);assert.equal(result.rows.find(r=>r.code==='B280').cents,-16854500);assert(result.rows.length>0);
 console.log('Uploaded Elio financials: Balance Sheet page 2 recognized; whole dollars, restricted cash, negative deficit and members equity read. Other statements excluded.');
}
console.log('Varied titles, split/OCR headings, structural detection, whole dollars, total column and account-number handling passed.');
const continued=balanceSheetSource([{page:1,text:'Balance Sheet'},{page:1,text:'Assets'},{page:1,text:'Cash  100'},{page:2,text:'Liabilities'},{page:2,text:'Accounts payable  20'},{page:2,text:'Equity'},{page:2,text:'Retained earnings  80'},{page:3,text:'Cash Flow Statement'},{page:3,text:'Net Income  500'}]);assert.equal(continued.matched,2);assert(!continued.lines.some(l=>l.page===3));
const {reconcile,suggest}=await import('./dist/engine.mjs');
assert.equal(suggest('Due to/from Elio Holdings, Inc.','Liabilities'),'B080');
assert.equal(suggest('Long-term due to parent company','Liabilities'),'B130');
const due=parseLines(['Balance Sheet','Liabilities','Due to/from Elio Holdings, Inc.  (76,325)']);assert.equal(due.rows[0].code,'B080');assert.equal(due.rows[0].cents,-7632500);assert(due.rows[0].source.includes('Elio Holdings'));
if(process.argv[2]){
 const pages=fs.readFileSync(process.argv[2],'utf8').split('\f').filter(p=>p.trim());const lines=pages.flatMap((p,i)=>p.split('\n').map((text,j)=>({text,page:i+1,source:`Page ${i+1}, line ${j+1}`})));const parsed=parseLines(balanceSheetSource(lines).lines.map(selectTotalAmountLine));
 const result=reconcile(parsed.rows,parsed.controls);assert.equal(result.groups.B080,-7632500);assert.equal(result.totals.Liabilities,752700);assert(result.issues.some(s=>s==='Source liabilities total differs by 1.00'));
 console.log('Elio liabilities include the negative holding-company balance; the statement’s $1 source-total mismatch is flagged.');
}
