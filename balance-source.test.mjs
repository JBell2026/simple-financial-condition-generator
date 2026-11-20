import assert from 'node:assert/strict';
import fs from 'node:fs';
import {balanceSheetSource} from './dist/balance-source.mjs';
import {parseLines} from './dist/engine.mjs';
const page=(page,lines)=>lines.map((text,i)=>({text,page,source:`Page ${page}, line ${i+1}`}));
const mixed=[...page(1,['Income Statement','Assets','Checking $999.00']),...page(2,['Balance Sheet','Assets','Checking $100.00','Equity','Net Income $100.00']),...page(3,['Cash Flow Statement','Net Income ($5.00)']),...page(4,['Net Income $900.00'])];
const result=balanceSheetSource(mixed);assert.equal(result.matched,1);assert.equal(result.excluded.length,3);
assert.equal(parseLines(result.lines).rows.find(r=>r.code==='B300').cents,10000);
assert.equal(balanceSheetSource(['Assets','Checking $100.00']).lines.length,0);
assert.equal(balanceSheetSource(['Assets','Checking $100.00'],{sheetName:'2026 Balance Sheet'}).matched,1);
assert.equal(balanceSheetSource(['Income Statement','Assets','Checking $100.00'],{sheetName:'Balance Sheet'}).matched,0);
assert.equal(balanceSheetSource(['Balance Sheet','Assets','Checking $100.00'],{sheetName:'Sheet1'}).matched,1);
assert.equal(parseLines(balanceSheetSource(['Balance Sheet','Assets','Checking $100.00','Equity','Net Income $100.00','Cash Flow Statement','Net Income ($5.00)']).lines).rows.find(r=>r.code==='B300').cents,10000);
assert.equal(parseLines(['Balance Sheet','Assets','Checking $100.00','Equity','Net Income $100.00','Total Liabilities & Equity $100.00','Net Income ($5.00)']).rows.find(r=>r.code==='B300').cents,10000);
// Optional local regression against the user's combined 3-page statement; not committed.
if(process.argv[2]){
 const pages=fs.readFileSync(process.argv[2],'utf8').split('\f').filter(s=>s.trim());
 const lines=pages.flatMap((s,i)=>page(i+1,s.split('\n').map(s=>s.trim())));
 const filtered=balanceSheetSource(lines);assert.equal(filtered.matched,1);assert.equal(filtered.lines.every(l=>l.page===2),true);
 const parsed=parseLines(filtered.lines);assert.equal(parsed.rows.find(r=>r.code==='B300').cents,17658977);
 assert.equal(parsed.rows.find(r=>r.code==='A010').cents,153937366);assert.equal(parsed.controls.A010,153937366);assert.equal(parsed.controls.assets,443188757);assert.equal(parsed.controls.liabilities,256010048);assert.equal(parsed.controls.equity,187178709);
 console.log('Actual financials: only page 2 imported; net income $176,589.77; source assets $4,431,887.57; liabilities $2,560,100.48; equity $1,871,787.09.');
}
console.log('Balance Sheet title, page boundaries, worksheet titles and cash-flow isolation checks passed.');
const cash=parseLines(['Balance Sheet','Assets','Cash & Equivalents','SVB MCM Checking $726,086.75','Mercury MCM Checking - 5892 $151,200.17','Mercury MCM Treasury $523,657.54','First Bank $138,429.20','Total Cash & Equivalents $1,539,373.66','Other Current Assets','Unmapped $1.00']);
assert.equal(cash.rows.find(r=>r.code==='A010').cents,153937366);
assert.equal(cash.controls.A010,153937366);
assert(cash.rows.find(r=>r.code==='A010').source.includes('First Bank $138,429.20'));
const {reconcile}=await import('./dist/engine.mjs');
assert(reconcile(cash.rows,{A010:153937367}).issues.some(s=>s.includes('cash subtotal')));
console.log('Cash subsection includes all four accounts, excludes subtotal duplication, and validates source subtotal.');

const alternateStatementPages=[
 ['Statement of Assets, Liabilities, & Equity','Assets','Other Assets',
  'Other Assets $100.00','Accumulated Amortization ($20.00)','Net Other Assets $80.00',
  'Other Current Assets $30.00','Total Assets $110.00','Liabilities & Equity','Current Liabilities',
  'Taxes Payable $25.00','Other Current Liabilities $15.00','Total Current Liabilities $40.00',
  'Equity','Retained Earnings $70.00','Total Liabilities & Equity $110.00'],
 ['Statement of Assets, Liabilities, and Equity','Supplementary Schedule',
  'Other Assets','Other Assets $100.00','Accumulated Amortization ($20.00)']
];
const alternateLines=alternateStatementPages.flatMap((page,i)=>page.map(text=>({text,page:i+1})));
const alternateSource=balanceSheetSource(alternateLines);
assert.deepEqual(alternateSource.excluded,[2]);
const alternateBalance=parseLines(alternateSource.lines);
assert.equal(alternateBalance.rows.find(row=>row.code==='A230H').cents,8000);
assert.equal(alternateBalance.rows.find(row=>row.code==='B100').cents,2500);
assert.equal(alternateBalance.rows.find(row=>row.code==='B120').cents,1500);
assert.equal(alternateBalance.rows.find(row=>row.label==='Other Current Assets').code,'');

const withDetail=balanceSheetSource([...alternateLines,
 {page:3,text:'Statement of Assets, Liabilities, and Equity'},
 {page:3,text:'Supplementary Schedule'},
 {page:3,text:'Accounts Receivable'},
 {page:3,text:'Accounts Receivable-Officer $25.00'},
 {page:3,text:'Deposit - Rent $5.00'},
 {page:3,text:'Total $30.00'},
 {page:4,text:'Statement of Revenues and Expenses'},
 {page:4,text:'Expenses'},
]);
const detailed=parseLines(withDetail.lines,{supplements:withDetail.supplements});
assert.deepEqual(reconcile(detailed.rows,detailed.controls).issues,[]);
assert.equal(detailed.rows.find(row=>row.code==='A190').cents,2500);
assert.equal(detailed.rows.find(row=>row.code==='A230H').cents,8500);
assert.equal(detailed.controls.currentLiabilities,4000);
