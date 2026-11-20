// Applicable FC guidance from the user-provided NMLS FV7 definitions, reviewed 2026-11-17.
export const definitionsUrl='https://mortgage.nationwidelicensingsystem.org/knowledge/Products/nmls/stateresourcecenter/Shared%20Documents/MCR_FV7Definitions.pdf';
export const guidance={
 A060:[22,'Held-for-sale loans at lower of cost or market. XML requires detailed loan schedule inputs.'],A062:[22,'Held-for-sale loans at fair value. XML requires detailed loan schedule inputs.'],
 A010:[22,'Unrestricted company cash; exclude fiduciary funds.'],A020:[22,'Restricted company cash; exclude fiduciary funds.'],
 A180:[23,'Fixed assets after depreciation. Review equipment memo fields in NMLS.'],
 A230H:[29,'Residual tangible assets. Explanation required at 5% of assets.'],
 B280:[30,'Retained earnings.'],B300:[31,'OCI, including unrealized gains; ordinary net income differs.'],
 C060:[32,'Interest income not reported elsewhere.'],C210:[32,'Retail/direct origination fees.'],C220:[32,'Fees on loans acquired from correspondents/brokers.'],C230:[32,'Fees on loans brokered out.'],C240:[32,'Other origination income.'],C770:[35,'Other non-interest income.'],
 C150:[35,'Other interest expense; enter positive.'],D010:[36,'Sales compensation.'],D020:[36,'Non-sales origination compensation.'],D030:[36,'Warehousing/secondary-marketing compensation.'],D040:[36,'Post-close/production support compensation.'],D050:[36,'Origination management compensation.'],D060:[36,'Other origination compensation.'],D110:[36,'Investment-portfolio personnel compensation.'],
 D150:[36,'Benefits, training and payroll taxes.'],D160:[36,'Other personnel costs.'],D200:[36,'Occupancy/equipment expenses.'],D210:[37,'Non-personnel technology expenses.'],D220:[37,'Outsourcing; exclude technology and transaction fees.'],D230:[37,'Legal/accounting/advisory fees.'],D280:[37,'Residual non-interest expenses.'],D310:[37,'Gross expenses = C160 + D180 + D300 + D440.'],D510:[37,'Pre-tax income = C800 − D310.']
};
export function guide(code){return guidance[code]?.[1]||'';}
export function sourceLink(code){return definitionsUrl+'#page='+(guidance[code]?.[0]||22);}
export function requiresOtherAssetsExplanation(groups){
 const assets=Object.entries(groups).filter(([c])=>/^A/.test(c)).reduce((s,[,v])=>s+Math.sign(v)*Math.round(Math.abs(v)/100),0);
 const other=Math.round((groups.A230H||0)/100);
 return other>0&&(assets<=0||other*100>=assets*5);
}
export function definitionIssues(groups,meta={}){
 const issues=[];
 if((groups.C150||0)<0)issues.push('FV7: C150 interest expense must be positive or zero.');
 if(requiresOtherAssetsExplanation(groups)&&!String(meta.otherAssetsExplanation||'').trim())issues.push('FV7: complete the A230J explanation in the Schedules A & B review because Other Assets is at least 5% of total assets.');
 if(/[<>%]/.test(String(meta.otherAssetsExplanation||'')))issues.push('A230J cannot contain <, > or % under the NMLS XML schema. Write out percent.');
 if(String(meta.otherAssetsExplanation||'').length>4000)issues.push('A230J explanation must be 4,000 characters or fewer.');
 return issues;
}
export function definitionWarnings(groups){
 const out=[];
 if(groups.A060||groups.A062)out.push('A063 = A060 + A062. These held-for-sale review balances require the detailed loan schedule in NMLS; summary balances cannot be sent directly in XML.');
 if(groups.B300)out.push('B300 is OCI under FV7. Your sample-filing net-income treatment is retained; review this exception before filing.');
 if(groups.A180)out.push('Review applicable A260–A266 equipment memo amounts in NMLS; these are not inferred from Total Fixed Assets.');
 return out;
}
