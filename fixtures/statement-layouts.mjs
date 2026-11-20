// Synthetic statements in common small-business accounting layouts. No client data.
export const corpus={
qbo:{bs:`Acme Mortgage LLC
Balance Sheet
As of September 30, 2026
ASSETS
Current Assets
Bank Accounts
Operating Checking  45,200.10
Savings  10,000.00
Total Bank Accounts  $55,200.10
Accounts Receivable
Accounts Receivable (A/R)  12,500.00
Total Accounts Receivable  $12,500.00
Other Current Assets
Prepaid Expenses  2,400.00
Security Deposit  3,000.00
Total Other Current Assets  $5,400.00
Total Current Assets  $73,100.10
Fixed Assets
Furniture and Equipment  18,000.00
Accumulated Depreciation  -6,000.00
Total Fixed Assets  $12,000.00
TOTAL ASSETS  $85,100.10
LIABILITIES AND EQUITY
Liabilities
Current Liabilities
Accounts Payable
Accounts Payable (A/P)  4,100.00
Total Accounts Payable  $4,100.00
Credit Cards
Chase Ink  2,250.50
Total Credit Cards  $2,250.50
Other Current Liabilities
Payroll Liabilities  3,300.00
Total Other Current Liabilities  $3,300.00
Total Current Liabilities  $9,650.50
Long-Term Liabilities
SBA Loan  20,000.00
Total Long-Term Liabilities  $20,000.00
Total Liabilities  $29,650.50
Equity
Owner's Investment  10,000.00
Retained Earnings  20,449.60
Net Income  25,000.00
Total Equity  $55,449.60
TOTAL LIABILITIES AND EQUITY  $85,100.10`,
pl:`Acme Mortgage LLC
Profit and Loss
January - September, 2026
Income
Broker Fee Income  300,000.00
Processing Fee Income  20,000.00
Total Income  $320,000.00
Cost of Goods Sold
Loan Officer Commissions  150,000.00
Credit Reports  5,000.00
Total Cost of Goods Sold  $155,000.00
GROSS PROFIT  $165,000.00
Expenses
Advertising & Marketing  12,000.00
Payroll Expenses
Salaries & Wages  80,000.00
Payroll Taxes  7,000.00
Total Payroll Expenses  $87,000.00
Rent & Lease  18,000.00
Software Subscriptions  6,000.00
Legal & Professional Services  4,000.00
Insurance  3,500.00
Office Supplies  1,200.00
Meals & Entertainment  800.00
Total Expenses  $132,500.00
NET OPERATING INCOME  $32,500.00
Other Income
Interest Income  500.00
Total Other Income  $500.00
Other Expenses
Depreciation  8,000.00
Total Other Expenses  $8,000.00
NET OTHER INCOME  $ -7,500.00
NET INCOME  $25,000.00`,expect:{assets:8510010,net:2500000,expenses:29550000,gross:32050000}},
qbd:{bs:`Balance Sheet
As of December 31, 2026
ASSETS
Current Assets
Checking/Savings
1000 · Business Checking  30,000.00
Total Checking/Savings  30,000.00
Other Current Assets
1300 · Due from Shareholder  5,000.00
Total Other Current Assets  5,000.00
Total Current Assets  35,000.00
TOTAL ASSETS  35,000.00
LIABILITIES & EQUITY
Liabilities
Current Liabilities
Other Current Liabilities
2100 · Accrued Commissions  6,000.00
2200 · Payroll Tax Payable  1,000.00
Total Other Current Liabilities  7,000.00
Total Current Liabilities  7,000.00
Total Liabilities  7,000.00
Equity
3000 · Capital Stock  1,000.00
3200 · Retained Earnings  17,000.00
Net Income  10,000.00
Total Equity  28,000.00
TOTAL LIABILITIES & EQUITY  35,000.00`,
pl:`Profit & Loss
January through December 2026
Ordinary Income/Expense
Income
4000 · Origination Fees  200,000.00
Total Income  200,000.00
Expense
6000 · Commissions  120,000.00
6100 · Officer Salary  40,000.00
6200 · Rent  12,000.00
6300 · Telephone  2,000.00
6400 · Licenses and Permits  1,500.00
6500 · Bank Service Charges  500.00
6600 · Interest Expense  4,000.00
Total Expense  180,000.00
Net Ordinary Income  20,000.00
Other Income/Expense
Other Expense
8000 · Income Tax Expense  10,000.00
Total Other Expense  10,000.00
Net Other Income  -10,000.00
Net Income  10,000.00`,expect:{assets:3500000,net:1000000,expenses:19000000,gross:20000000}},
xero:{bs:`Balance Sheet
Beta Home Loans Inc
As at 30 June 2026
Assets
Bank
Business Bank Account  22,000.00
Total Bank  22,000.00
Current Assets
Accounts Receivable  8,000.00
Total Current Assets  8,000.00
Fixed Assets
Computer Equipment  5,000.00
Less Accumulated Depreciation on Computer Equipment  (1,000.00)
Total Fixed Assets  4,000.00
Total Assets  34,000.00
Liabilities
Current Liabilities
Accounts Payable  3,000.00
Sales Tax  500.00
Total Current Liabilities  3,500.00
Total Liabilities  3,500.00
Net Assets  30,500.00
Equity
Current Year Earnings  12,500.00
Retained Earnings  18,000.00
Total Equity  30,500.00`,
pl:`Profit and Loss
Beta Home Loans Inc
For the 6 months ended 30 June 2026
Trading Income
Brokerage Revenue  90,000.00
Total Trading Income  90,000.00
Cost of Sales
Processing Costs  10,000.00
Total Cost of Sales  10,000.00
Gross Profit  80,000.00
Operating Expenses
Wages and Salaries  45,000.00
Rent  9,000.00
Subscriptions  3,000.00
Consulting & Accounting  2,500.00
General Expenses  8,000.00
Total Operating Expenses  67,500.00
Net Profit  12,500.00`,expect:{assets:3400000,net:1250000,expenses:7750000,gross:9000000}},
cpa:{bs:`GAMMA LENDING CORP
STATEMENT OF FINANCIAL CONDITION
DECEMBER 31, 2026
ASSETS
Cash and cash equivalents  $ 150,000
Mortgage loans held for sale, at fair value  900,000
Accounts receivable  25,000
Property and equipment, net  40,000
Prepaid expenses and other assets  15,000
Total assets  $ 1,130,000
LIABILITIES AND STOCKHOLDERS' EQUITY
Liabilities
Warehouse line of credit  $ 850,000
Accounts payable and accrued expenses  60,000
Total liabilities  910,000
Stockholders' equity
Common stock, no par value  10,000
Additional paid-in capital  90,000
Retained earnings  120,000
Total stockholders' equity  220,000
Total liabilities and stockholders' equity  $ 1,130,000
STATEMENT OF OPERATIONS
YEAR ENDED DECEMBER 31, 2026
Revenues
Gain on sale of mortgage loans  $ 2,000,000
Loan origination fees  300,000
Interest income  50,000
Total revenues  2,350,000
Expenses
Salaries, commissions and benefits  1,500,000
Occupancy and equipment  120,000
Interest expense  45,000
Professional fees  60,000
Advertising and promotion  80,000
Other general and administrative  145,000
Total expenses  1,950,000
Income before income taxes  400,000
Provision for income taxes  84,000
Net income  $ 316,000`,pl:null,expect:{assets:113000000,net:31600000,expenses:203400000,gross:235000000}},
comparative:{bs:`Balance Sheet
As of September 30, 2026
  Sep 30, 2026  Dec 31, 2025
ASSETS
Checking  12,000.00  9,000.00
Total Assets  12,000.00  9,000.00
LIABILITIES AND EQUITY
Liabilities
Credit Card  2,000.00  1,000.00
Total Liabilities  2,000.00  1,000.00
Equity
Members Capital  10,000.00  8,000.00
Total Equity  10,000.00  8,000.00
TOTAL LIABILITIES AND EQUITY  12,000.00  9,000.00`,
pl:`Income Statement
For the Nine Months Ended September 30, 2026
Revenue
Commission Income  50,000.00
Total Revenue  50,000.00
Operating Expenses
Contract Labor  20,000.00
Dues and Subscriptions  1,000.00
Utilities  2,000.00
Travel  3,000.00
Total Operating Expenses  26,000.00
Net Income (Loss)  24,000.00`,expect:{assets:1200000,net:2400000,expenses:2600000,gross:5000000}},
// CFO-prepared management package: monthly columns with a year-to-date total, revenue
// with no total line, start-up cost section, zero-dash lines, and a second (non-GAAP)
// presentation of the same period that must not be imported again.
package:{bs:`Delta Mortgage LLC
Balance Sheet: as of September 30, 2026
Accrual basis, unaudited. Amounts in USD.
USD  Sep 30, 2026
Assets
Cash  50,000
Restricted cash: warehouse line  10,000
Due from member (J. Doe)  (300)
Prepaid expenses  5,300
Total current assets  65,000
Computer equipment  3,000
Intangible asset: acquired loan book, net  22,000
Total noncurrent assets  25,000
Total assets  90,000
Liabilities
Accounts payable  12,000
Commissions payable  4,000
Due to/from Parent Holdings, Inc.  (15,000)
Total liabilities  1,000
Members' equity
Member contributions: Parent Holdings, Inc.  100,000
Member contributions: founders  -
Accumulated deficit (net loss since inception)  (11,000)
Total members' equity  89,000
Total liabilities and members' equity  90,000`,
pl:`Delta Mortgage LLC
Statement of Operations (GAAP basis): July 1 to September 30, 2026
USD  Jul 2026  Aug 2026  Sep 2026  Jul 1 to Sep 30
Revenue
Loan origination income  -  40,000  60,000  100,000
Cost of revenue
Loan officer commissions  -  28,000  42,000  70,000
Gross profit  -  12,000  18,000  30,000
Gross margin %  -  30.0%  30.0%  30.0%
Operating expenses
Salaries, wages and payroll taxes  -  4,000  6,000  10,000
Rent  3,000  3,500  (500)  6,000
Software and loan origination system  -  2,000  2,000  4,000
Total operating expenses (before start-up)  3,000  9,500  7,500  20,000
Start-up and launch costs
Start-up licensing fees  10,000  5,000  -  15,000
Launch marketing  -  -  5,000  5,000
Total start-up and launch costs  10,000  5,000  5,000  20,000
Amortization of acquired loan book  -  -  1,000  1,000
Total expenses  13,000  14,500  13,500  41,000
Net loss  (13,000)  (2,500)  4,500  (11,000)
\fDelta Mortgage LLC
Management P&L and Adjusted EBITDA (non-GAAP): July 1 to September 30, 2026
Revenue
Origination revenue  -  40,000  60,000  100,000
Direct origination costs
LO compensation  -  28,000  42,000  70,000
Total direct origination costs  -  28,000  42,000  70,000
Operating expenses
Salaries and benefits (non-LO)  -  4,000  6,000  10,000
Occupancy and office  3,000  3,500  (500)  6,000
Technology and LOS  -  2,000  2,000  4,000
Total operating expenses  3,000  9,500  7,500  20,000
Adjusted EBITDA  (3,000)  2,500  10,500  10,000
Less: start-up and launch costs  10,000  5,000  5,000  20,000
Less: amortization  -  -  1,000  1,000
Net loss (GAAP)  (13,000)  (2,500)  4,500  (11,000)`,expect:{assets:9000000,net:-1100000,expenses:11100000,gross:10000000}}
};
