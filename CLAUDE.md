# Simple Financial Condition Generator — working brief

Browser-local tool from Simple Licensing + Compliance that prepares the Financial Condition (FC) component of the NMLS Mortgage Call Report: import a financial statement, review Schedule A/B (balance sheet) and C/D (income and expenses), and export one combined FV7 FC XML. It is separate from the Simple MCR XML Generator.

## Hard rules

- **This repository is public.** Never commit real client financial statements, client names tied to figures, or expected-value tables taken from a client file. Real test files go in `private-fixtures/` (git-ignored). Regression tests use synthetic data.
- `main` deploys to Vercel production automatically (team `getsimple`, project `simple-financial-condition-generator`). Work on a branch, report verified results, and merge to `main` only when Jim approves.
- No live NMLS filing or upload without Jim's explicit authorization. No live NMLS acceptance has been confirmed yet.
- Never invent a balancing entry. Source totals are reviewed, not counted as detail. Count each source amount once.
- Preserve existing client, review, workbook and export behavior unless a change is requested.

## Layout

No build step. `dist/` is the deployed static site (`vercel.json` → `outputDirectory: dist`).

| Area | Files |
| --- | --- |
| Browser workflow | `dist/index.html`, `dist/app.mjs`, `dist/style.css` |
| Balance sheet source isolation and mapping | `dist/balance-source.mjs`, `dist/engine.mjs`, `dist/calculated.mjs` |
| Expenses, Schedule C/D, workbook | `dist/expenses.mjs`, `dist/schedule-d.mjs`, `dist/combined.mjs`, `dist/sfc-template.xlsx` |
| FV7 rules and schema | `dist/fv7.mjs`, `dist/fc-schema.mjs`, `schemas/MCRBatchFileSchemaV7.xsd` |

README.md is a historical changelog (it still opens under the old "Simple Balance Sheet Converter" name). Where it disagrees with code and tests, the code and tests win.

## Checks

```bash
for test in tests.mjs *.test.mjs; do node "$test" || exit 1; done
xmllint --noout --schema schemas/MCRBatchFileSchemaV7.xsd /tmp/combined-test.xml /tmp/schedule-d-test.xml
```

Serve `dist/` with any static server for browser checks (`python3 -m http.server -d dist 8080`).

## Product rules that are easy to break

- **Gross income override:** in SFC workbooks a valid numeric B36 (B43 in expanded, seven-row-shifted templates) overrides gross income, **including an explicit zero**. Blank or non-numeric falls back to L26/L33 (or Schedule D Setup B5 in the newer workbook). Both readers (`readSfc`, `readScheduleWorkbook`) must agree.
- Non-interest income sent to NMLS = total gross income − other interest income (C060). The Section 4 preview shows source and amount.
- **The importer must stay general.** `format-corpus.test.mjs` runs synthetic QuickBooks Online, QuickBooks Desktop, Xero, CPA-prepared and comparative statements (`fixtures/statement-layouts.mjs`) through the import path; each must foot and reconcile. Add a synthetic layout there whenever a client statement exposes a new format. Do not add client-specific special cases.
- A balance sheet account with no recognized NMLS field is kept in the review as unclassified (it blocks export until classified). Never drop a detail line. Group headings ("Credit Cards", "Long-Term Liabilities") supply a suggestion when the account name does not.
- Statements with several amount columns: per page, dated column headers select the latest period, otherwise the rightmost (Total) column. The Amount column control overrides this for the balance sheet.
- Revenue rows are never expenses. Cost-of-revenue / COGS rows stay out of the expense list unless the user ticks "Include cost of revenue lines"; the amount is always tracked (`rows.costOfRevenue`) and shown beside the P&L reconciliation.
- The Section 4 P&L reconciliation panel (gross income − included expenses ± taxes and adjustments versus the P&L's net income) uses every included line, assigned or not.
- Expense confidence (High / Medium / Needs review / Reviewed) describes the suggested category only; source references stay attached.
- Limits: 75 expenses overall, 25 per SFC workbook category. Legacy SFC-only workbooks must keep working alongside the newer Schedule D Lines / Setup / Review format.
- Any change to financial inputs invalidates the combined review. Original-cent and whole-dollar differences block export. Calculated-only fields are never serialized.
- Every exported XML includes `ScheduleOSection` with all 22 schema fields set to 0 (Jim's requirement). A nonzero D260 or D270, which NMLS ties to Schedule O, blocks export.
- Only the FV7 expanded form (`type="E"`) is implemented. Standard is not.
- Supplementary balance sheet schedules (detail pages supporting a subtotal on the main statement) and repeated P&L presentations must not change totals.

## Brand

Simple Licensing + Compliance · "Keep it Simple." · getsimple.co. Deep Ink Navy `#20354D` and Warm Ivory `#F7F4EC` lead; Rich Terracotta `#985448` for emphasis; Mist Blue `#B3C2CA` as support. League Spartan Bold headlines, Montserrat body. Use the approved logo in `dist/logo.png` unaltered; ask for the original if an asset is missing.

## Open items

1. Reproduce the real statement import (PDF with a "Statement of Assets, Liabilities, & Equity" page, two supplementary balance sheet schedule pages, and a "Statement of Revenues and Expenses" with an adjacent Percent column) through the browser upload, using the file in `private-fixtures/`. Confirm net Other Assets and Current Liabilities populate and each amount counts once.
2. Decide the A230H aggregation when a rent deposit and net other assets both map there, and the mapping of payroll/tax accruals versus credit-card liabilities.
3. Cost of revenue: the include control is off by default. Confirm whether it should default on.
4. Standard (non-expanded) FC form: confirm whether it is still required.
5. Browser check on the Vercel build and a first live NMLS acceptance test.
