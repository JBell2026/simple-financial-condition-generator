import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {buildScheduleD,splitExpense,suggestD,addScheduleWorkbook,readScheduleWorkbook,dReviewRows} from './dist/schedule-d.mjs';
import {readSfc,combineReports} from './dist/combined.mjs';
import {reconcile} from './dist/engine.mjs';
const rows=[['D010',10000],['D020',5000],['D150',2000],['D200',3000],['C150',1000],['D520',2000],['D540',1000],['D560',-500]].map(([field,cents],i)=>({id:i+1,field,cents,label:field,source:'Test P&L',include:true}));
const options={gross:50000,interest:500,reportedNet:27500,incomeField:'C210',meta:{company:'Test',date:'2026-09-30'}};
const report=buildScheduleD(rows,options);assert.deepEqual(report.issues,[]);assert.equal(report.groups.D310,21000);assert.equal(report.groups.D510,29000);assert.equal(report.net,27500);assert.equal(report.groups.D520,2000);assert.equal(report.groups.D540,1000);assert.equal(report.groups.D560,-500);assert.equal(report.groups.C210,49500);assert(!Object.hasOwn(report.groups,'D600'));
assert.equal(report.calculated.find(r=>r.code==='D070').cents,15000);assert.equal(report.calculated.find(r=>r.code==='D530').cents,27000);
assert.equal(suggestD('Loan officer commissions','A'),'D010');assert.equal(suggestD('Salaries','B'),'');assert.equal(suggestD('Income taxes','H'),'D520');
const split=[{id:1,field:'D010',cents:10000,source:'Payroll',label:'Payroll',include:true}];splitExpense(split,1,3000,'D020');assert.equal(split.length,2);assert.equal(split[0].cents,7000);assert.equal(split.reduce((s,r)=>s+r.cents,0),10000);assert.throws(()=>splitExpense(split,1,8000,'D020'));
const credits=[{...split[0],cents:-1000}];splitExpense(credits,1,-200,'D200');assert.equal(credits.reduce((s,r)=>s+r.cents,0),-1000);
assert(buildScheduleD([{...rows[0],field:'D070'}],options).issues.some(s=>s.includes('Choose')));
assert(buildScheduleD([{...rows[0],field:'C100',cents:-100}],options).issues.some(s=>s.includes('positive')));
assert(buildScheduleD([{...rows[0],field:'D120'}],options).issues.some(s=>s.includes('zero or negative')));
assert(buildScheduleD(rows,{...options,reportedNet:28000}).issues.some(s=>s.includes('D600 differs')));
assert(buildScheduleD([{...rows[0],cents:49},{...rows[1],cents:49}],{gross:200,reportedNet:102}).issues.some(s=>s.includes('rounding')));
assert(buildScheduleD(rows,{...options,sourceExpenses:22000}).issues.some(s=>s.includes('control total')));
assert(buildScheduleD(rows,{...options,interest:null}).issues.some(s=>s.includes('valid interest')));
assert(buildScheduleD(rows,{...options,sourceExpenses:NaN}).issues.some(s=>s.includes('valid gross expense')));
assert(dReviewRows(report).findIndex(r=>r.code==='D070')>dReviewRows(report).findIndex(r=>r.code==='D020'));
const require=createRequire(import.meta.url),ExcelJS=require('./dist/vendor/exceljs.js'),XLSX=require('./dist/vendor/xlsx.js');const wb=new ExcelJS.Workbook();addScheduleWorkbook(wb,rows,report,options.meta);const bytes=await wb.xlsx.writeBuffer();const book=XLSX.read(bytes,{type:'buffer'});const imported=readScheduleWorkbook(book);assert.deepEqual(imported.issues,[]);assert.equal(imported.net,27500);assert.deepEqual(imported.groups,report.groups);assert.equal(readSfc(book).groups.D520,2000);
const review=wb.getWorksheet('Schedule D Review');assert(review.getColumn(1).values.indexOf('D070')<review.getColumn(1).values.indexOf('D150'));
book.Sheets['Schedule D Lines'].E2.v='No';assert(readScheduleWorkbook(book).issues.some(s=>s.includes('D600 differs')));book.Sheets['Schedule D Lines'].E2.v='Yes';
book.Sheets.Reference={A22:{v:'D050'},B36:{v:800}};assert.equal(readScheduleWorkbook(book).gross,80000);assert.equal(readScheduleWorkbook(book).grossSource,'Reference!B36');
// Explicit numeric zero is a deliberate override; blank or invalid cells fall back.
book.Sheets.Reference.B36.v=0;assert.equal(readScheduleWorkbook(book).gross,0);assert.equal(readScheduleWorkbook(book).grossSource,'Reference!B36');
for(const blank of [{v:''},{v:'n/a'},{t:'z'},undefined]){book.Sheets.Reference.B36=blank;assert.equal(readScheduleWorkbook(book).gross,50000);assert.equal(readScheduleWorkbook(book).grossSource,'Schedule D Setup!B5');}
book.Sheets['Schedule D Setup'].B5.v='';book.Sheets.Reference.L26={v:500};assert.equal(readScheduleWorkbook(book).gross,50000);assert.equal(readScheduleWorkbook(book).grossSource,'Reference!L26');
// Expanded template: mapping row and source cells shift seven rows (B43 / L33).
book.Sheets.Reference={A29:{v:'D050'},B43:{v:0},L33:{v:500}};assert.equal(readScheduleWorkbook(book).gross,0);assert.equal(readScheduleWorkbook(book).grossSource,'Reference!B43');
book.Sheets.Reference.B43.v=800;assert.equal(readScheduleWorkbook(book).gross,80000);
delete book.Sheets.Reference.B43;assert.equal(readScheduleWorkbook(book).gross,50000);assert.equal(readScheduleWorkbook(book).grossSource,'Reference!L33');
const balance=reconcile([{code:'A010',section:'Assets',cents:100000,include:true,label:'Cash'},{code:'B280',section:'Equity',cents:100000,include:true,label:'Equity'}]);const combined=combineReports(balance,report,{company:'Test',date:'2026-09-30',period:'MCRQ3'});assert(combined.xml.includes('<D520_1>20</D520_1>'));assert(combined.xml.includes('<D510_1>290</D510_1>'));assert(!combined.xml.includes('<D600_1>'));fs.writeFileSync('/tmp/schedule-d-test.xml',combined.xml);
console.log('Schedule D classifications, splits, taxes, adjustments, rounding blocks, canonical/legacy Excel, metadata and combined XML tests passed.');

const {extractPLFigures}=await import('./dist/schedule-d.mjs');
assert.deepEqual(extractPLFigures([
 'Statement of Revenues and Expenses','Net Revenues $1000.00','Other Income $25.00',
 'Net Income (Loss) ($20.00)','Statement of Revenues and Expenses',
 'Other Income','Interest Income $5.00','Total $25.00'
]),{gross:102500,reportedNet:-2000,interest:500});
