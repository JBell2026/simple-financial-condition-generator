import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readSfc,combineReports} from './dist/combined.mjs';
import {parseLines,reconcile,exportXml} from './dist/engine.mjs';
function fixture(shift=0){return {Sheets:{SFC:{A2:{v:'Payroll Director'},A3:{v:100},['A'+(22+shift)]:{v:'D050'},['L'+(26+shift)]:{v:200},['L'+(28+shift)]:{v:100}}}};}
const s=readSfc(fixture());assert.equal(s.gross,20000);assert.equal(s.grossSource,'SFC!L26');assert.equal(s.groups.D050,10000);assert.equal(s.groups.D310,10000);assert.equal(s.groups.D510,10000);assert.deepEqual(s.issues,[]);
const expanded=readSfc(fixture(7));assert.equal(expanded.grossSource,'SFC!L33');
const override=fixture();override.Sheets.SFC.B36={v:250};override.Sheets.SFC.L28.v=150;assert.equal(readSfc(override).gross,25000);assert.equal(readSfc(override).grossSource,'SFC!B36');
// Explicit numeric zero overrides the reference gross; blank or invalid cells fall back.
const zero=fixture();zero.Sheets.SFC.B36={v:0};zero.Sheets.SFC.L28.v=-100;assert.equal(readSfc(zero).gross,0);assert.equal(readSfc(zero).grossSource,'SFC!B36');assert.deepEqual(readSfc(zero).issues,[]);
for(const blank of [{v:''},{v:'n/a'},{t:'z'}]){const f=fixture();f.Sheets.SFC.B36=blank;assert.equal(readSfc(f).gross,20000);assert.equal(readSfc(f).grossSource,'SFC!L26');}
const zeroExpanded=fixture(7);zeroExpanded.Sheets.SFC.B43={v:0};assert.equal(readSfc(zeroExpanded).gross,0);assert.equal(readSfc(zeroExpanded).grossSource,'SFC!B43');
const overrideExpanded=fixture(7);overrideExpanded.Sheets.SFC.B43={v:250};assert.equal(readSfc(overrideExpanded).gross,25000);
const payroll=fixture();payroll.Sheets.SFC.B3={v:10};assert(readSfc(payroll).issues.some(s=>s.includes('payroll')));
const balance=reconcile(parseLines(['Assets','Checking $100.00','Equity','Net Income $100.00']).rows);balance.meta={};
const result=combineReports(balance,s,{company:'Test',date:'2026-09-30',period:'MCRQ3'});assert(result.xml.includes('ScheduleCSection'));assert(result.xml.includes('<C210_1>200</C210_1>'));assert(result.xml.includes('<D310_1>100</D310_1>'));assert(result.xml.includes('<B300_1>100</B300_1>'));
// Schedule O is always reported, with all 22 schema fields set to zero.
const oSection=result.xml.match(/<ScheduleOSection>([\s\S]*?)<\/ScheduleOSection>/)[1],oTags=[...oSection.matchAll(/<(O\d{3}_1)>(-?\d+)<\/\1>/g)];assert.equal(oTags.length,22);assert(oTags.every(m=>m[2]==='0'));assert(oSection.includes('<O010_1>0</O010_1>')&&oSection.includes('<O370_1>0</O370_1>')&&oSection.includes('<O384_1>0</O384_1>'));
assert.throws(()=>exportXml({...balance,groups:{...balance.groups,D260:500}},{company:'Test',date:'2026-09-30',period:'MCRQ3'}),/Schedule O/);fs.writeFileSync('/tmp/combined-test.xml',result.xml);
assert.equal(combineReports({...balance,meta:{company:'Wrong'}},s,{company:'Test',date:'2026-09-30',period:'MCRQ3'}).xml,null);
console.log('Combined SFC mapping, original/expanded layouts, gross-income override (zero, nonzero, blank, invalid, expanded) and fallback, payroll review, client matching, zero Schedule O and XML checks passed.');
