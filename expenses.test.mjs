import assert from 'node:assert/strict';
import {parseExpenses,expenseSummary} from './dist/expenses.mjs';
const lines=['Balance Sheet','Assets','Checking $200.00','Profit and Loss','Cost of Goods Sold $100.00','Gross Profit $200.00','Expenses','Rent $20.00','Health Care $10.00','NMLS Licensing $5.00','Total Expenses $35.00','Net Income $165.00'];
const rows=parseExpenses(lines);assert.equal(rows.length,4);assert.equal(expenseSummary(rows).total,13500);assert.equal(rows.find(r=>r.label==='Rent').category,'E');assert.equal(rows.find(r=>r.label==='Health Care').category,'C');assert.equal(rows.find(r=>r.label==='NMLS Licensing').category,'H');assert.equal(parseExpenses(lines,false).length,3);
assert.equal(expenseSummary(Array.from({length:26},()=>({...rows[0],category:'I'}))).issues.length,1);
const details=parseExpenses(['Cost of Goods Sold $100.00','Contractor $100.00','Gross Profit $200.00']);assert.equal(details.length,1);assert.equal(details[0].label,'Contractor');
console.log('Expense parsing, COGS deduplication, category mapping and capacity checks passed.');
