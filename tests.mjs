import assert from 'node:assert/strict';
import {amount,rounded,parseLines,reconcile,exportXml} from './dist/engine.mjs';
// Accounts are no longer merged per NMLS field, so field amounts are summed here.
const fieldSum=(result,code)=>result.rows.filter(r=>r.code===code).reduce((total,r)=>total+r.cents,0);
assert.equal(amount('$-1,019.00'),-101900);
assert.equal(amount('(1,019.00)'),-101900);
assert.equal(amount('NA'),null);
assert.equal(rounded(-150),-2);
const parsed=parseLines(['Assets','Checking $1,000.00','Total Assets $1,000.00','Liabilities','Accounts payable $200.00','Total Liabilities $200.00','Equity','Retained earnings $800.00','Total Equity $800.00','Total Liabilities and Equity $1,000.00','Profit and Loss','Income $500.00']);
const r=reconcile(parsed.rows,parsed.controls);
assert.equal(r.count,3);assert.equal(r.difference,0);assert.equal(r.roundingDifference,0);assert.deepEqual(r.issues,[]);
assert(!parsed.rows.some(r=>r.label==='Income'));
const round=reconcile([{include:true,label:'Cash',section:'Assets',code:'A010',cents:100},{include:true,label:'Payable',section:'Liabilities',code:'B120',cents:50},{include:true,label:'Equity',section:'Equity',code:'B280',cents:50}]);
assert.equal(round.difference,0);assert.equal(round.roundingDifference,-1);
const invalid=reconcile([{include:true,label:'Bad',section:'Assets',code:'',cents:null}]);assert(invalid.issues.length);
const wrongSection=reconcile([{include:true,label:'Bad',section:'Assets',code:'B280',cents:0}]);assert(wrongSection.issues.some(s=>s.includes('classification')));
console.log('Parser, P&L exclusion, source controls, negative values, rounding and invalid input checks passed.');
const mapped=parseLines(['Assets','Equipment $200.00','Accumulated Depreciation $-50.00','Total Fixed Assets $150.00','Checking $10.00','Savings $20.00','Unmapped account $40.00']);
// Fixed assets keep the statement's breakdown; the total line is a control.
{const fixed=mapped.rows.filter(r=>r.code==='A180');assert.deepEqual(fixed.map(r=>[r.label,r.cents]),[['Equipment',20000],['Accumulated Depreciation',-5000]]);assert.equal(mapped.controls.fixedAssets,15000);assert.equal(reconcile(mapped.rows.filter(r=>r.code),mapped.controls).groups.A180,15000);
 const zero=parseLines(['Balance Sheet','Assets','Checking $100.00','Fixed Assets','Property and Equipment $29,000.00','Accumulated Depreciation ($29,000.00)','Net Fixed Assets $0.00','Total Assets $100.00','Equity','Retained Earnings $100.00']);assert.deepEqual(zero.rows.filter(r=>r.code==='A180').map(r=>r.cents),[2900000,-2900000]);const zr=reconcile(zero.rows,zero.controls);assert.deepEqual(zr.issues,[]);assert.equal(zr.groups.A180,0);
 const wrong=parseLines(['Assets','Equipment $200.00','Accumulated Depreciation $-50.00','Total Fixed Assets $175.00']);assert(reconcile(wrong.rows,wrong.controls).issues.some(s=>s.includes('net fixed assets')));
 const only=parseLines(['Assets','Net fixed assets $120.00']);assert.deepEqual(only.rows.map(r=>[r.code,r.cents]),[['A180',12000]]);assert.equal(only.controls.fixedAssets,undefined);}
assert.equal(fieldSum(mapped,'A010'),3000);
// An unrecognized account stays in the review, unclassified, instead of being dropped.
assert.equal(mapped.rows.length,5);assert.deepEqual(mapped.rows.filter(r=>r.code==='A010').map(r=>r.label),['Checking','Savings']);const unmapped=mapped.rows.find(r=>r.label==='Unmapped account');assert.equal(unmapped.code,'');assert.equal(unmapped.include,true);assert.equal(unmapped.cents,4000);assert(reconcile(mapped.rows).issues.some(s=>s.includes('Review the NMLS classification: Unmapped account')));

const equity=parseLines(['Equity','Retained Earnings $100.00','Net Income $26,995.82','Net Profit $4.18']);
assert.equal(fieldSum(equity,'B280'),10000);
assert.equal(fieldSum(equity,'B300'),2700000);
const xml=exportXml(r,{date:'2026-09-30',period:'MCRQ3'});
assert(xml.includes('<Mcr formVersion="v7" type="E" year="2026" periodType="MCRQ3">'));
assert(xml.includes('<A010_1>1000</A010_1>'));
assert(!xml.includes('ScheduleCSection'));
assert.throws(()=>exportXml(r,{date:'2026-09-30',period:'MCRQ2'}));
assert.throws(()=>exportXml({...r,roundingDifference:1},{date:'2026-09-30',period:'MCRQ3'}));
