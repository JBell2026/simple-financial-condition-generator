import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readSfc,combineReports} from './dist/combined.mjs';
import {parseLines,reconcile} from './dist/engine.mjs';
function fixture(shift=0){return {Sheets:{SFC:{A2:{v:'Payroll Director'},A3:{v:100},['A'+(22+shift)]:{v:'D050'},['L'+(26+shift)]:{v:200},['L'+(28+shift)]:{v:100},['B'+(36+shift)]:{v:0}}}};}
const s=readSfc(fixture());assert.equal(s.gross,20000);assert.equal(s.grossSource,'SFC!L26');assert.equal(s.groups.D050,10000);assert.equal(s.groups.D310,10000);assert.equal(s.groups.D510,10000);assert.deepEqual(s.issues,[]);
const expanded=readSfc(fixture(7));assert.equal(expanded.grossSource,'SFC!L33');
const override=fixture();override.Sheets.SFC.B36.v=250;override.Sheets.SFC.L28.v=150;assert.equal(readSfc(override).gross,25000);assert.equal(readSfc(override).grossSource,'SFC!B36');
const payroll=fixture();payroll.Sheets.SFC.B3={v:10};assert(readSfc(payroll).issues.some(s=>s.includes('payroll')));
const balance=reconcile(parseLines(['Assets','Checking $100.00','Equity','Net Income $100.00']).rows);balance.meta={};
const result=combineReports(balance,s,{company:'Test',date:'2026-09-30',period:'MCRQ3'});assert(result.xml.includes('ScheduleCSection'));assert(result.xml.includes('<C210_1>200</C210_1>'));assert(result.xml.includes('<D310_1>100</D310_1>'));assert(result.xml.includes('<B300_1>100</B300_1>'));fs.writeFileSync('/tmp/combined-test.xml',result.xml);
assert.equal(combineReports({...balance,meta:{company:'Wrong'}},s,{company:'Test',date:'2026-09-30',period:'MCRQ3'}).xml,null);
console.log('Combined SFC mapping, original/expanded layouts, gross-income fallback, payroll review, client matching and XML checks passed.');
