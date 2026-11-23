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
{const {pageList,onlyPages,pagePhrase,chosenPages}=await import('./dist/balance-source.mjs');const lines=[{text:'Acme LLC',page:1},{text:'Statement of Operations',page:1},{text:'Rent  5.00',page:1},{text:'Acme LLC',page:2},{text:'Balance Sheet: as of September 30, 2026',page:2},{text:'12/31',page:3},{text:'Notes to management',page:3}];
 assert.deepEqual(pageList(lines).map(p=>[p.page,p.label]),[[1,'Statement of Operations'],[2,'Balance Sheet: as of September 30, 2026'],[3,'Notes to management']]);assert.equal(onlyPages(lines,['2']).length,2);assert.equal(onlyPages(lines,['1','3']).length,5);assert.equal(onlyPages(lines,null).length,7);assert.equal(onlyPages(lines,[]).length,0);assert.equal(pagePhrase(['2']),'page 2');assert.equal(pagePhrase(['1','3']),'pages 1 and 3');assert.equal(pagePhrase(['1','2','4']),'pages 1, 2 and 4');
 const boxes=checked=>({querySelectorAll:()=>checked.map((c,i)=>({checked:c,value:String(i+1)}))});assert.equal(chosenPages(boxes([true,true,true])),null);assert.deepEqual(chosenPages(boxes([true,false,true])),['1','3']);assert.deepEqual(chosenPages(boxes([false,false])),[]);assert.deepEqual(pageList([{text:'x'}]),[]);}
console.log('Page picker helpers passed.');
// Names printed in all caps are shown in normal capitalization; mixed-case names are untouched.
{const {tidyLabel,usd}=await import('./dist/engine.mjs');
 for(const [input,expected] of [['CASH IN BANK','Cash in Bank'],['ACCUMULATED DEPRECIATION','Accumulated Depreciation'],['DUE FROM OFFICER','Due from Officer'],['AMEX','AMEX'],['CAPITAL ONE','Capital One'],['401(K) PAYABLE','401(k) Payable'],['NMLS LICENSING AND FEES','NMLS Licensing and Fees'],['SAMPLE FUNDING LLC','Sample Funding LLC'],['OFFICE/POSTAGE','Office/Postage'],['PAYROLL TAXES - FICA','Payroll Taxes - FICA'],['THE HOME TEAM, INC.','The Home Team, Inc.'],['Cash in bank','Cash in bank'],['Due to/from Parent Holdings, Inc.','Due to/from Parent Holdings, Inc.'],['QB','QB'],['',''] ])assert.equal(tidyLabel(input),expected,input);
 const caps=parseLines(['BALANCE SHEET','ASSETS','CASH IN BANK  $100.00','DUE FROM OFFICER  $50.00','TOTAL ASSETS  $150.00','LIABILITIES','AMEX  $30.00','EQUITY','RETAINED EARNINGS  $120.00']);
 assert.deepEqual(caps.rows.map(r=>[r.label,r.code]),[['Cash in Bank','A010'],['Due from Officer','A190'],['Retained Earnings','B280'],['AMEX','']]);assert(!caps.rows.some(r=>/[A-Z]{5}/.test(r.label)));assert(caps.rows[0].source.includes('CASH IN BANK $100.00'));
 assert.deepEqual(parseExpenses(['PROFIT AND LOSS','EXPENSES','RENT  $50.00','OFFICER SALARY  $90.00','TOTAL EXPENSES  $140.00']).map(r=>r.label),['Rent','Officer Salary']);
 assert.equal(usd(123456),'$1,235');assert.equal(usd(-100),'-$1');}
console.log('Capitalization and amount formatting passed.');
// Accounts sharing an NMLS field stay on separate lines; only the field total combines them.
{const oa=parseLines(['Balance Sheet','Assets','Cash  $100.00','Other Assets','Other Assets  $53.00','Accumulated Amortization  ($20.00)','Net Other Assets  $33.00','Rent Deposit  $10.00','Total Assets  $143.00','Equity','Retained Earnings  $143.00']);
 assert.deepEqual(oa.rows.filter(r=>r.code==='A230H').map(r=>[r.label,r.cents]),[['Other Assets',5300],['Accumulated Amortization',-2000],['Rent Deposit',1000]]);const r=reconcile(oa.rows,oa.controls);assert.deepEqual(r.issues,[]);assert.equal(r.groups.A230H,4300);}
console.log('Separate account lines per NMLS field passed.');
// Whole dollars: amounts are rounded when read, half away from zero, and the statement's
// cents survive only in the Source detail.
{const {wholeCents,usdExact}=await import('./dist/engine.mjs');assert.equal(wholeCents(12349),12300);assert.equal(wholeCents(12350),12400);assert.equal(wholeCents(-12350),-12400);assert.equal(wholeCents(null),null);assert.equal(usdExact(123456),'$1,234.56');
 const c=parseLines(['Balance Sheet','Assets','Cash  $1,000.49','Deposits  $10.50','Total Assets  $1,010.99','Equity','Retained Earnings  $1,010.99']);
 assert.deepEqual(c.rows.map(r=>r.cents),[100000,1100,101100]);assert(c.rows[0].source.includes('$1,000.49'));assert.equal(c.controls.assets,101100);assert(c.rows.every(r=>r.cents%100===0));
 const e=parseExpenses(['Profit and Loss','Cost of Revenue','Commissions  $500.60','Expenses','Rent  $1,200.49','Software  $99.50','Net Income  $10.00'],true);assert.deepEqual(e.map(r=>r.cents),[50100,120000,10000]);assert.equal(e.costOfRevenue.total,50100);
 assert.deepEqual(extractPLFigures(['Profit and Loss','Total Income  $5,000.55','Interest Income  $10.49','Net Income  $2,999.50']),{gross:500100,interest:1000,reportedNet:300000});}
console.log('Whole-dollar rounding passed.');
// Business type decides where equity goes.
{const {suggestEquity,equityFields}=await import('./dist/engine.mjs');
 const eq=['Balance Sheet','Assets','Cash  $300.00','Equity','Common Stock  $10.00','Additional Paid-In Capital  $40.00','Retained Earnings  $150.00','Net Income  $100.00'];
 const llc=parseLines(eq,{entity:'llc'});assert(llc.rows.filter(r=>r.section==='Equity').every(r=>r.code==='B340'));assert.equal(reconcile(llc.rows,llc.controls).groups.B340,30000);
 const corp=parseLines(eq,{entity:'corporation'});assert.deepEqual(corp.rows.filter(r=>r.section==='Equity').map(r=>r.code),['B260','B270','B280','B300']);assert(corp.rows.filter(r=>r.section==='Equity').every(r=>equityFields.corporation.includes(r.code)));
 assert.equal(suggestEquity("Members' Capital",'llc'),'B340');assert.equal(suggestEquity("Members' Capital",'corporation'),'');assert.equal(suggestEquity('Treasury Stock','corporation'),'B290');assert.equal(suggestEquity('Member contributions','llc'),'B340');
 assert.deepEqual(parseLines(eq).rows.map(r=>r.code),parseLines(eq,{entity:''}).rows.map(r=>r.code));
 assert.deepEqual(equityFields,{corporation:['B250','B260','B270','B280','B290','B300','B310','B240'],llc:['B340']});}
console.log('Business type equity mapping passed.');
// Categories map to one NMLS line each; income taxes have their own category.
{const {categoryField,classifyExpense,isLoanOfficerPay,categories}=await import('./dist/expenses.mjs');
 assert.deepEqual(categoryField,{A:'D050',C:'D150',D:'D160',E:'D200',F:'D210',G:'D220',H:'D230',I:'D280',J:'C150',K:'D520'});assert.deepEqual(categories.map(([c])=>c).join(''),'ABCDEFGHIJK');
 assert.equal(classifyExpense('Provision for income taxes'),'K');assert.equal(classifyExpense('Income Tax Expense'),'K');assert.equal(classifyExpense('Payroll taxes'),'C');assert.equal(classifyExpense('Property tax'),'E');assert.equal(classifyExpense('Loan officer commissions'),'B');
 assert(isLoanOfficerPay('Loan officer signing bonuses'));assert(isLoanOfficerPay('MLO compensation'));assert(!isLoanOfficerPay('Salaries and wages'));}
console.log('Category to NMLS line mapping passed.');
