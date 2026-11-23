# Simple Financial Condition Generator — working brief

Browser-local tool from Simple Licensing + Compliance that prepares the Financial Condition (FC) component of the NMLS Mortgage Call Report: import a financial statement, review Schedule A/B (balance sheet) and C/D (income and expenses), and export one combined FV7 FC XML. It is separate from the Simple MCR XML Generator.

## Hard rules

- **This repository is public.** Never commit real client financial statements, client names tied to figures, or expected-value tables taken from a client file. Real test files go in `private-fixtures/` (git-ignored). Regression tests use synthetic data.
- `main` deploys to Vercel production automatically (team `getsimple`, project `simple-financial-condition-generator`). Work on a branch, report verified results, and merge to `main` only when Jim approves.
- No live NMLS filing or upload without Jim's explicit authorization. Jim uploaded an XML from this app to NMLS himself on 2026-11-23 and reported that the upload worked; which values and completeness checks NMLS showed afterwards has not been confirmed.
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

- **Five steps.** The page is worked through a sticky step bar: 1 Client, 2 Balance sheet, 3 Profit and loss, 4 Checks and equity, 5 Enter in NMLS. Each card carries `data-step`; only the current step's cards show. Each step shows Done, Needs attention or Not started (`stepStates`). Browser tests must move to a step before using its controls.
- **XML download is never silently locked.** Opening step 5 runs the combined review automatically. A line beside the download button always says why it is locked (review not run, items to fix, confirmation box not ticked) or that it is ready, and blocking items are shown as a list.
- **Enter in NMLS sheet** (step 5): one table of every NMLS line with an amount in screen order (Schedule A, A230J text, Schedule B, B-350R rollforward, Schedule C, Schedule D, Schedule O zeros), each marked Enter or Calculated by NMLS, with a company and period heading, a notice when earlier steps are unfinished, and a Print or save as PDF button that prints only the sheet.

- **Gross income override:** in SFC workbooks a valid numeric B36 (B43 in expanded, seven-row-shifted templates) overrides gross income, **including an explicit zero**. Blank or non-numeric falls back to L26/L33 (or Schedule D Setup B5 in the newer workbook). Both readers (`readSfc`, `readScheduleWorkbook`) must agree.
- Non-interest income sent to NMLS = total gross income − other interest income (C060). The Section 4 preview shows source and amount. It goes to one income field, or is split between two (`incomeSplit`: the entered amount goes to the second field, the remainder stays in the first); the split is saved in Schedule D Setup B10/B11.
- **The importer must stay general.** `format-corpus.test.mjs` runs synthetic QuickBooks Online, QuickBooks Desktop, Xero, CPA-prepared, comparative and spreadsheet-prepared ("Net Assets represented by") statements (`fixtures/statement-layouts.mjs`) through the import path; each must foot and reconcile. Add a synthetic layout there whenever a client statement exposes a new format. Do not add client-specific special cases.
- **Business type drives equity.** Client & reporting details has a Business type (corporation or LLC), saved with the client. LLC: every equity line goes to B340. Corporation: equity goes to B250, B260, B270, B280, B290, B300, B310 or B240 (subordinated debt), suggested from the account name, and anything unclear is left for review. The equity dropdown offers only that type's lines, an equity line outside them blocks export, and so does a missing business type. Changing the type re-assigns the equity lines. When no type is chosen, an uploaded statement's company name sets it if the name contains LLC, Inc. or Corp., and the import status says so.
- The "Rounding checks" card shows the three ties from the SFC worksheet that NMLS flags: (1) D310 = C160 + D180 + D300 + D440, (2) D510 = C800 − D310 against the P&L's net income, (3) A240 = B220 + B350. For a difference of $10 or less it recommends one line and amount (an Other expenses D280 line for the P&L; for the balance sheet, a line in the section whose rows no longer add to the statement's printed total, else the main equity line) with a "Make this change" button. Larger differences are reported as not rounding. The app changes an amount only on that click.
- The "Schedule B-350R — Equity rollforward" card shows what to enter on B350A (typed: prior period's Total Equity), B350B (net income from Schedules C & D, must equal D600), B350N (ending equity − B350A − B350B) and calculated B350T (ending equity). B350A, B350B and B350N are written to the XML's Schedule B section; the beginning balance is therefore required before export (0 for a first period), and changing it clears the combined review. B350C–B350M are left to NMLS.
- A balance sheet account with no recognized NMLS field is kept in the review as unclassified (it blocks export until classified). Never drop a detail line. Group headings ("Credit Cards", "Long-Term Liabilities") supply a suggestion when the account name does not.
- In the balance sheet review, NMLS subtotal lines show by default and a button removes or restores them. The Other Assets explanation box sits directly under the balance sheet table.
- Every balance sheet account stays on its own row, as on the statement (for example other assets and accumulated amortization, or fixed asset cost and accumulated depreciation). Accounts sharing an NMLS field are combined only in the field totals, and the review shows a net line for that field. The statement's total or net fixed assets line is a control only, unless it is the only fixed asset line.
- In every ordered view (review, by-field table, combined review, Excel Balance Sheet Review tab) Other Assets (A230H and the other A230 detail fields) come before the Other Assets subtotal and Total Assets.
- The Other Assets explanation (A230J) appears whenever an account is assigned to A230H and is filled in automatically with those accounts' titles, comma-separated, without amounts. It follows the accounts until the user edits it; "Use the account titles again" restores it. It is exported whenever it has text.
- **Whole dollars everywhere.** Amounts are rounded to the nearest dollar when read from a statement or workbook or typed in (`wholeCents`), and shown without cents (`usd`). Jim adjusts a line by a dollar himself when rounding leaves the balance sheet or P&L a dollar off; the app never does. Only the Source detail keeps the statement's exact cents (`usdExact`).
- Account and expense names printed in ALL CAPS on a statement are shown in normal capitalization (`tidyLabel`: words capitalized, joining words lowercase, known abbreviations kept). The Source detail keeps the statement's exact text. App text uses sentence case, `CODE — Description` in dropdowns, full sentences with periods in messages, and whole-dollar `$1,234` amounts.
- Multi-page PDFs offer a page picker in each section ("Pages to read" for the balance sheet, "P&L pages to read" for expenses): one checkbox per page, all ticked by default. All ticked means automatic detection across every page; a subset means only those pages are read, and chosen balance sheet pages are read even without a recognized title. The two pickers are independent.
- Statements with several amount columns: per page, dated column headers select the latest period, otherwise the rightmost (Total) column. The Amount column control overrides this for the balance sheet.
- **Client memory** (`dist/client-memory.mjs`, browser storage only): when Jim picks an NMLS field for a balance sheet account or a category for an expense, the choice is saved under the client (company name, or NMLS ID when present) by account name, with no amounts. The next import for that client applies it and tags the row "Remembered". It also remembers the cost-of-revenue tick and the revenue type. "Forget them" in Client & reporting details clears it. Jim does not want a manual line-by-line mapping mode.
- **Reading report**: a notice under each upload that appears only when the app had trouble or sees a way to read the file better: nothing found, income or net income not found, a gap larger than $10, printed totals that do not match, several unclassified accounts, lines with amounts that were not read (listed), a repeated income statement, or a scanned file. A cleanly read statement shows no report; `format-corpus.test.mjs` asserts the synthetic layouts produce no unread lines.
- **Expense categories drive Schedule D.** Section 4's "Expense totals by category" chart replaces the SFC worksheet download and the old detailed NMLS filing review (both hidden, not deleted, so uploaded legacy workbooks still work). Each category has one NMLS line (`categoryField`: A→D050, C→D150, D→D160, E→D200, F→D210, G→D220, H→D230, I→D280, J→C150, K income taxes→D520). Payroll (B) is split by an amount the user can edit: loan officers to D010, the rest to D020; the starting amount is the payroll lines that mention loan officers or commissions. The XML fields are built from these category totals (`fieldRows`), not from a per-expense field. A row's Split button moves part of its amount to another category.
- Section 4 shows "Schedule C — what to enter and where": one row per Schedule C line that carries an amount (the chosen income field, the split field if any, C060, calculated C800, and any C100–C150 interest expense with calculated C160), each with a plain note on where its amount comes from.
- Revenue rows are never expenses. Cost-of-revenue / COGS rows stay out of the expense list unless the user ticks "Include cost of revenue lines"; the amount is always tracked (`rows.costOfRevenue`) and shown beside the P&L reconciliation.
- The Section 4 "Does this P&L add up?" check (total income − included expenses ± taxes and adjustments versus the net income printed on the P&L) uses every included line, assigned or not. Each row says in plain words where its number comes from; keep it that way. It shows whole dollars: each amount is rounded to the nearest dollar and the arithmetic uses the rounded amounts.
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
5. After the first successful NMLS upload (2026-11-23): confirm that the amounts, the Schedule O zeros and the equity rollforward appear correctly in NMLS and note any completeness check warnings.
