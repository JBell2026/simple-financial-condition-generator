import assert from 'node:assert/strict';
import {parseExpenses,classifyExpense} from './dist/expenses.mjs';
for(const label of ['Salaries','Wages','Payroll','Salaries, wages, and payroll'])assert.equal(classifyExpense(label),'B');
const rows=parseExpenses(['Profit and Loss','Expenses','Salaries 100.00','Rent 50.00','Total Expenses 150.00','Unrelated note 987.00','Statement of Cash Flows','Expenses','Operating adjustment 456.00']);
assert.deepEqual(rows.map(r=>[r.label,r.cents,r.category]),[['Salaries',10000,'B'],['Rent',5000,'E']]);
const cost=parseExpenses(['Profit and Loss','Cost of Revenue 30.00','Gross Profit 70.00']);assert.equal(cost.length,0);
assert.deepEqual(parseExpenses(['Profit and Loss','Revenue','Broker revenue 1000.00','Cost of Revenue','Direct processing 200.00','Gross Profit 800.00','Expenses','Rent 50.00','Revenue adjustment 25.00']).map(r=>r.label),['Rent']);
console.log('Payroll categories, expense boundaries, cash-flow exclusion and source titles passed.');

assert.deepEqual(parseExpenses(['Cost of Revenue','Processing 100.00','Total Cost of Revenue 100.00','Expenses','Rent 50.00'],true).map(r=>[r.label,r.group||'']),[['Processing','Cost of revenue'],['Rent','']]);
const paged=[{page:1,text:'Profit and Loss'},{page:1,text:'Expenses'},{page:1,text:'Rent 50.00'},{page:2,text:'Cash 999.00'},{page:2,text:'Assets'},{page:2,text:'Liabilities'},{page:3,text:'Notes 300.00'},{page:3,text:'Unrelated 400.00'}];
const scoped=parseExpenses(paged);assert.deepEqual(scoped.map(r=>r.label),['Rent']);assert(scoped[0].source.includes('Original P&L line: Rent 50.00'));
assert.deepEqual(parseExpenses(['Income taxes 20.00','Random figure 888.00']).map(r=>r.label),['Income taxes']);
