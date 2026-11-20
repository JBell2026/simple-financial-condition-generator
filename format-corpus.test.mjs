// Runs synthetic statements in common accounting-software and CPA layouts through the
// same import path as the browser. Each must foot and reconcile with no dropped lines.
import assert from 'node:assert/strict';
import {corpus} from './fixtures/statement-layouts.mjs';
import {parseLines,reconcile,amountColumns,selectAmountColumn,selectAmountsByPage} from './dist/engine.mjs';
import {balanceSheetSource} from './dist/balance-source.mjs';
import {parseExpenses,expenseSummary} from './dist/expenses.mjs';
import {extractPLFigures,suggestD,buildScheduleD} from './dist/schedule-d.mjs';
for(const [name,c] of Object.entries(corpus)){
 const raw=(c.bs+(c.pl?'\f'+c.pl:'')).split('\f').flatMap((p,pi)=>p.split('\n').map((text,i)=>({text,page:pi+1,source:`Page ${pi+1}, line ${i+1}`})));
 const columns=amountColumns(raw.filter(l=>l.page===1)),all=raw.map(l=>selectAmountColumn(l,columns.index));
 const src=balanceSheetSource(all),parsed=parseLines(src.lines,{supplements:src.supplements}),rec=reconcile(parsed.rows,parsed.controls);
 assert.equal(rec.totals.Assets,c.expect.assets,name+': total assets');
 assert.equal(rec.difference,0,name+': balance sheet foots');
 assert.deepEqual(rec.issues,[],name+': no balance sheet issues');
 const ex=parseExpenses(all,true),fig=extractPLFigures(all);
 assert.equal(expenseSummary(ex).total,c.expect.expenses,name+': expenses incl. cost of revenue');
 assert.equal(fig.gross,c.expect.gross,name+': gross income');assert.equal(fig.reportedNet,c.expect.net,name+': net income');
 // Gross income less every imported expense equals the statement's net income.
 assert.equal(fig.gross-expenseSummary(ex).total,c.expect.net,name+': P&L reconciles');
 const report=buildScheduleD(ex.map(r=>({...r,field:suggestD(r.label,r.category)||'D060'})),{gross:fig.gross,interest:fig.interest||0,reportedNet:fig.reportedNet});
 assert.equal(report.net,c.expect.net,name+': D600 equals net income');
 // Without cost of revenue the gap is exactly the tracked cost-of-revenue total.
 const without=parseExpenses(all,false);assert.equal(expenseSummary(ex).total-expenseSummary(without).total,without.costOfRevenue.total,name+': cost of revenue tracked');
}
// The second presentation in the management package is reported, not imported.
{const lines=corpus.package.pl.split('\f').flatMap((p,pi)=>p.split('\n').map(text=>({text,page:pi+1})));const rows=parseExpenses(lines,true);assert.equal(rows.length,7);assert(rows.repeatedLines>0);assert(!rows.some(r=>/occupancy and office|technology and los/i.test(r.label)));assert.equal(suggestD('Salaries, wages and payroll taxes','B'),'');}
// Whole-dollar statements whose own totals are a dollar off are a warning, not a block.
{const off=parseLines(['Balance Sheet','Assets','Cash  100','Prepaid expenses  51','Total assets  150','Liabilities','Accounts payable  50','Total liabilities  50','Equity','Retained earnings  101','Total equity  101','Total liabilities and equity  150']);const r=reconcile(off.rows,off.controls);assert.deepEqual(r.issues,[]);assert.equal(r.warnings.length,2);assert.equal(r.difference,0);
 const cents=parseLines(['Balance Sheet','Assets','Cash  100.00','Prepaid expenses  51.00','Total assets  950.00','Equity','Retained earnings  151.00']);assert(reconcile(cents.rows,cents.controls).issues.some(s=>s.includes('Source assets total differs')));}
const cmp=amountColumns(corpus.comparative.bs.split('\n'));assert.equal(cmp.count,2);assert.deepEqual(cmp.labels,['Sep 30, 2026','Dec 31, 2025']);assert.equal(cmp.index,0);
assert.equal(amountColumns(['  Total','Rent  10.00  20.00  30.00','Phone  1.00  2.00  3.00']).index,-1);
// Dates in a statement heading are not amount columns.
assert.equal(amountColumns(corpus.qbo.bs.split('\n')).count,1);assert.equal(amountColumns(corpus.cpa.bs.split('\n')).count,1);
assert.match(selectAmountColumn({text:'Checking  12,000.00  9,000.00',source:'x'},1).text,/^Checking\s+9,000\.00$/);assert.match(selectAmountColumn({text:'Checking  12,000.00  9,000.00',source:'x'},0).text,/^Checking\s+12,000\.00$/);
const paged=selectAmountsByPage([{text:'  Sep 30, 2026  Dec 31, 2025',page:1},{text:'Checking  5.00  4.00',page:1},{text:'Savings  2.00  1.00',page:1},{text:'  Jan  Feb  Total',page:2},{text:'Rent  1.00  2.00  3.00',page:2},{text:'Phone  1.00  2.00  3.00',page:2}]);assert.match(paged[1].text,/5\.00$/);assert.match(paged[4].text,/3\.00$/);
console.log('QuickBooks Online/Desktop, Xero, CPA-prepared, comparative and management-package layouts import, foot and reconcile.');
// Page picker helpers: labels come from statement titles; one page can be read alone.
{const {pageList,onlyPage}=await import('./dist/balance-source.mjs');const lines=[{text:'Acme LLC',page:1},{text:'Statement of Operations',page:1},{text:'Rent  5.00',page:1},{text:'Acme LLC',page:2},{text:'Balance Sheet: as of September 30, 2026',page:2},{text:'12/31',page:3},{text:'Notes to management',page:3}];
 assert.deepEqual(pageList(lines).map(p=>[p.page,p.label]),[[1,'Statement of Operations'],[2,'Balance Sheet: as of September 30, 2026'],[3,'Notes to management']]);assert.equal(onlyPage(lines,'2').length,2);assert.equal(onlyPage(lines,'all').length,7);assert.deepEqual(pageList([{text:'x'}]),[]);}
console.log('Page picker helpers passed.');
