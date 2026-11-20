import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseExpenses,expenseSummary} from './dist/expenses.mjs';
const whole=parseExpenses(['Profit and Loss','6000 Operating Expenses:','6100 Rent  1,250','6200 Software  400','6300 Refund  (25)','Total Expenses  1,625','Net Loss  (1,625)','Balance Sheet','Assets','Cash  50']);
assert.equal(whole.length,3);assert.equal(expenseSummary(whole).total,162500);
const costs=parseExpenses(['Cost of Revenue','Loan officer commissions  1,000','Processing fees  200','Total Cost of Revenue  1,200','Gross Profit  100','Operating Expenses','Rent  50','Total Expenses  50','Net Income  50']);
// Cost-of-revenue detail and subtotal stay out of the operating expense list.
assert.equal(costs.length,1);assert.equal(costs[0].label,'Rent');assert.equal(expenseSummary(costs).total,5000);
assert.equal(expenseSummary(parseExpenses(['Cost of Goods Sold  1,000','Gross Profit  100','Expenses','Rent  25','Net Income  75'])).total,2500);
assert.equal(expenseSummary(parseExpenses(['Expenses','Rent  100  200  300','Software  10  20  30','Net Profit  100'])).total,33000);
assert.equal(parseExpenses(['Expenses Amount','Insurance  $1,234.50','Net Loss  (1,234.50)']).length,1);
assert.equal(parseExpenses(['Cost of Revenue','Commissions  1,000','Total Cost of Revenue  1,000','Gross Profit  100','Expenses','Rent  50','Net Income  50'],false).length,1);
console.log('Whole dollars, account codes, alternate headings, credits, cost-of-revenue exclusion and total-column expense tests passed.');
