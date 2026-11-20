# Simple Balance Sheet Converter

Standalone browser-local balance sheet importer and PDF workpaper generator. Independent of the MCR and financial condition XML generators. No uploaded financials or client data are included in the deployment. Saved client names and NMLS identifiers use local browser storage only; statement rows remain in memory.

Imports PDF text, scanned PDFs through bundled local Tesseract OCR, XLSX, XLS and CSV. Multi-page balance sheets are kept together; P&L content is excluded after its heading. Users select a worksheet and amount column, review source totals and excluded subtotal rows, edit classifications and amounts, and confirm review before export. Unclassified or invalid amounts block PDF export. Reconciliation and grouped whole-dollar rounding differences trigger an explicit alert; users can return to review or export a workpaper that documents the differences. No balancing adjustments are made automatically.

The current classification list covers common assets, liabilities and equity fields. NMLS FV7 XML export includes only reviewed Schedule A and B input fields; it is a partial FC upload, not a complete Financial Condition filing. Complete P&L, equity rollforward and other required schedules separately. It does not zero-fill omitted fields or include calculated NMLS totals. The root uses formVersion v7, type E, and the selected reporting year/period. Export blocks unresolved source-control, balance and rounding differences. Both sample and all-supported-field exports were validated against the official NMLS XSD. Live NMLS acceptance has not been tested. The app can also import its Excel-compatible CSV field/amount output for XML conversion. Suggested equity and related-party classifications require review based on entity type and maturity. The report retains account details and source references, plus grouped whole-dollar NMLS workpaper figures. The downloadable PDF uses high-resolution page images to preserve the approved fonts and artwork.

NMLS reference: https://mortgage.nationwidelicensingsystem.org/Ad%20Hoc%20Document%20Library/MCR%20Definitions%20FV7.pdf

Run `node tests.mjs`. Serve `dist` using a static server. No build required. Deployment is owner-private by default.

Dependencies bundled locally: SheetJS 0.20.3 (Apache-2.0), PDF.js (Apache-2.0), pdf-lib (MIT), Tesseract.js (Apache-2.0), Tesseract.js-core (Apache-2.0), English language data (Apache-2.0). Montserrat and League Spartan from the official Google Fonts repository (SIL OFL). Logo is the original approved Simple asset; do not redraw or recolor.

## Integrated expense allocation

Step 4 is a native section of the balance sheet app, with shared client and reporting details. It reuses the uploaded financial statement or accepts a separate P&L PDF/Excel file. Expense categories, OCR, 75-expense and 25-entry-per-category limits are retained. Review and edit allocations inline; download the completed original SFC worksheet from Step 5. No iframe or separate app navigation is used. ExcelJS 4.4.0 (MIT) writes the original template with expanded entry rows and retained calculation blocks. Balance-sheet XML still includes Schedules A and B only.

Run `node expenses.test.mjs` for expense extraction, category and capacity checks.

## Completed worksheet reupload

Download the SFC workbook in Step 4; download the balance sheet field/amount CSV in Step 5. Step 6 accepts a completed original or expanded SFC worksheet and a balance sheet CSV/XLSX, validates the selected client and reporting period, reconciles income/expenses/net income and balance sheet amounts, and exports one FV7 FC XML containing supported Schedule A/B/C/D input fields. SFC categories are summed from input rows, avoiding stale total formulas. A valid numeric B36, including an explicit zero, overrides L26 gross income, with the corresponding seven-row shift (B43/L33) in expanded templates; a blank or non-numeric B36 falls back to L26. Payroll column B requires an underlying input-field selection when nonzero; D070 and C800 are calculated fields and are not serialized. Original cents and whole-dollar differences block export. Equity rollforward and other required schedules remain separate.

Run `node combined.test.mjs`. Combined sample exports and the browser download were validated against the official XSD; live NMLS acceptance has not been tested.

## Current streamlined downloads

Separate balance sheet download controls have been removed. Step 4 downloads the SFC worksheet. Step 5 accepts only the completed SFC workbook and combines it with the current reviewed Section 3 balance sheet. Changes to financial data clear the combined review and disable download until re-reviewed.

### FV7 definitions integration (November 17, 2026)
Uses the user-specified 39-page NMLS MCR FV7 Field Definitions & Instructions:
https://mortgage.nationwidelicensingsystem.org/knowledge/Products/nmls/stateresourcecenter/Shared%20Documents/MCR_FV7Definitions.pdf

Applicable field guidance is linked to PDF pages in balance-sheet totals, Section 4 classification help, and combined review. Sample-filing B300 net-income treatment remains explicitly flagged as an exception to the OCI definition. Equipment memo amounts and remaining schedules are not inferred.

A230H at or above 5% of rounded total assets requires an A230J explanation in Section 3 before XML generation. Text is escaped, limited to 4,000 characters, and rejects the XSD-prohibited characters <, > and %. The explanation exports in ScheduleASection. The threshold uses >= because the A230J instruction includes equality (the preceding A230I wording says greater than). The existing original-cent balance and whole-dollar reconciliation blocks remain in place. Negative C150 interest expense is blocked. Payroll tax suggestions now use worksheet category C / D150, consistent with FV7; payroll processing fees remain category D / D160.

The supported SFC workflow still assumes that worksheet net income supplies pre-tax D510. Help now calls out taxes, extraordinary items and noncontrolling interests for review in NMLS when deriving D600; equity rollforward B350B must match D600. No unsupported schedules are silently generated. Existing gross-income override/fallback and sample classification preferences are retained.

Validation: node tests.mjs, expenses.test.mjs, combined.test.mjs, fv7.test.mjs; official XSD validation of combined and A230J XML fixtures; browser check of threshold warning, explanation resolution, retained B300 exception and field guidance.

### Balance-sheet source isolation (November 17, 2026)
Section 3 now accepts only PDF pages explicitly titled Balance Sheet, or Excel/CSV sheets named Balance Sheet or containing that heading. Each PDF page is checked independently; unlabelled pages do not inherit an Equity section from an earlier page. Other statement headings and the final liabilities/equity total stop parsing. This applies after automatic extraction or OCR; the P&L allocator retains access to the full statement. Manual text import also requires a Balance Sheet heading. Excluded sources are reported in the import notice.

Regression: balance-source.test.mjs checks mixed statements, unlabeled pages, named and titled worksheets, cash-flow net income, and stopping at the balance-sheet closing total. An optional local text fixture checks the uploaded three-page financials without bundling the source document. Correct net income is 176,589.77 from page 2; page 3's -5,253.47 is excluded. This source-isolation change does not replace account classifications with those from a different client's filing or claim that every classification already matches the reference filing.

### Cash subsection recognition
Cash & Equivalents subsection context now maps all account lines to A010 (or A020 for explicitly restricted cash), including bank/treasury accounts without the words cash/checking. The context ends at another heading or the cash subtotal. Cash detail sums are checked against the source cash subtotal without counting the subtotal twice. Grouped review sources now include each original account label, amount and line reference. Regression against the uploaded financials confirms cash of $1,539,373.66 from all four accounts; the earlier $877,286.92 represented only the two checking accounts.

### Calculated balance-sheet review rows and section styling
Section 3 now groups editable inputs under distinct Assets (navy), Liabilities (terracotta), and Equity (graphite) headers. Shaded, read-only calculation rows include A039, A063, A237, A033, A067, A230 subtotal, A239, A240, B217, B219, B220, B319, B349, B350 and B360. Formulas follow the user-provided FV7 definitions. Calculations use assigned inputs only; unassigned inputs are treated as zero and this limitation is visible. Original cents and sums of rounded NMLS inputs are calculated independently. These rows never enter the XML input groups or get counted twice in reconciliation.

The combined review also shows calculated balance-sheet checks. The SFC Excel download adds a Balance Sheet Review tab with section headings, source accounts, original amounts, rounded inputs and cached live Excel formulas. Client and Sources metadata and the original SFC template remain unchanged. The reupload workflow continues to use the reviewed balance sheet in the app, as requested.

Validation: calculated.test.mjs verifies A039 dependencies, aggregate chains, rounding order, XLSX round trip/live formulas and exclusion from XML. Existing parser, source-isolation, expense, combined XML and FV7 tests pass. Browser checks confirm read-only A039/B360 values update when an input changes and that the three section headers are rendered.

### Filing-order review
Inputs and calculated rows are interleaved in Schedule A/B filing order in Section 3, field totals, combined balance-sheet review and the Excel Balance Sheet Review tab. Supporting Other Assets fields follow main Schedule A, matching their location in the filing. Calculations now propagate an information flag: totals without any included contributing input are hidden/omitted, while explicit zero input or offsetting values remain valid information. Excel references use the final ordered row positions. Regression tests cover order, missing inputs, zeros, offsetting values and formula round trip. Browser verification was blocked by the browser URL policy on this turn; programmatic checks passed.

### A063 input availability
Added A060 and A062 to editable balance-sheet classifications so the existing A063 = A060 + A062 review formula can receive balances and appear in filing order. Explicit held-for-sale labels suggest A060 or A062 according to valuation wording; generic loans receivable retains its reviewable classification. A063 is displayed whenever either input is included, including explicit zero. The Excel review and aggregate A237/A240 formulas use the same inputs. Nonzero A060/A062 summary balances block XML with an explanation that the schema requires the detailed mortgage loan schedule; no invalid A060_1/A062_1 elements are emitted. Existing XML schema supports detailed A060A etc., not these summary tags.

### Moving balance-sheet review lines
Editable Section 3 rows now have accessible Move up / Move down controls next to Remove. They move a line one visible position at a time within its section, including past displayed calculated rows. Hidden calculated rows are skipped. The Section selector moves a line between Assets, Liabilities, and Equity. Default order remains NMLS filing order until manually moved; manual positions survive field/amount edits during the current review and reset on a fresh import. Reordering changes only the review layout; field mapping, totals, XML and the NMLS-ordered Excel review are unchanged.

Browser verification: added a manual line, moved it upward, changed its classification and confirmed the position remained and totals stayed unchanged.

### Visible movement controls on every line
Moved controls into a sticky left-hand Move / Include column so they remain visible when the wide table scrolls horizontally. Every input and displayed calculated row has labeled Up / Down buttons and a Drag handle. Pointer-based drag/drop supports dropping before/after another row within the same section, highlights the target, and preserves mappings/amounts/calculations. A Restore NMLS order button resets layout. Section changes remain explicit through the Section selector; dragging across section boundaries does not silently change accounting classifications. Keyboard buttons remain available as an alternative to dragging. Updated app/CSS asset URLs to load the new controls.

Browser verified calculated-row arrow movement, Restore NMLS order, and dragging Checking below Equipment (status: Line moved). Existing calculation and XML regression tests pass.

### Review table fit
Balance-sheet and combined review tables now use fixed table layouts with proportional columns. Formula text and source details wrap within their cells; old minimum column widths and forced nowrap rules are overridden. Inputs and dropdowns shrink with their columns, and smaller screens use compact spacing. Drag handles remain on the left. Browser visual verification was unavailable because the browser URL policy blocked the preview tab; static formatting changes and syntax checks completed.

### Compact source details
Removed the always-visible Source column from the balance-sheet review. Each editable description now has a closed Source disclosure showing its original account/amount/line references only when expanded. Calculated rows use the same compact pattern with a closed Calculation disclosure. Sources and formulas remain intact in exported workpapers. Shortened the section instructions and reassigned table widths to descriptions, classifications and amounts. No calculation, parsing or XML logic changed.

### Flexible balance-sheet recognition and whole-dollar inputs
Updated source recognition to support consolidated/comparative/unaudited titles, date suffixes, hyphenated and split headings, spaced OCR headings, and Statement of Financial Position/Condition. A page without a formal title can qualify through the combination of Assets, Liabilities and Equity headings. Adjacent balance-sheet continuation pages qualify with a relevant financial section heading; an income/cash-flow heading ends continuation. Statement of Operations and Management P&L are explicitly excluded. Excel recognition scans the worksheet rather than only its first 25 cell values.

Monetary extraction now accepts whole dollars, commas, currencies and parenthesized negatives as well as cents, preserving total-column selection while ignoring account numbers embedded in labels. Added Members' / Shareholders' Equity section and source-total variants, accumulated deficit and due-from-member recognition. An uploaded client statement uses whole-dollar figures and Members' equity; regression confirms only page 2 is imported, cash 140,945, restricted cash 20,000, total source assets 326,063, liabilities 7,526, equity 318,537 and accumulated deficit -168,545. This improves extraction/detection; unrecognized classifications still require review and existing reconciliation blocks remain active.

Validation: format-detection.test.mjs includes the actual locally extracted PDF text plus synthetic alternate-title, split-title, structural, continuation, account-number and total-column cases. Existing parser, source, expenses, calculated, FV7 and combined tests pass.

### Larger, clearer review layout
Increased general text, form controls, table text, amounts, buttons and totals. Expanded the available desktop workspace while retaining fixed-width, wrapped review tables. Assets, Liabilities and Equity headers are larger and show Schedule A/B labels; input rows have matching section-colored edges. Row padding and control heights are more consistent. Source/calculation disclosures remain collapsed by default and drag-only controls remain intact. Browser verified 14px balance input text and page width within the 1363px viewport (no horizontal overflow in the checked review).

### Editable row alignment
Top-aligned editable row cells and standardized account title, section, classification, amount, drag and remove controls to 44px. Expanding Source no longer vertically centers the other controls against the taller description cell. Browser measurements confirmed identical top coordinates and heights for all four financial controls across Assets, Liabilities and Equity, including after expanding Source.

### Holding-company liabilities
Liability classifications now recognize due-to/from balances explicitly naming holding companies, parents, affiliates, subsidiaries, members or partners, suggesting B080 for current and B130 for explicitly long-term balances. Signed amounts are preserved. Commissions/compensation/bonuses payable map to accrued expenses B100; unidentified receipts map to other current liabilities B120. Regression against an uploaded client statement includes a negative due to/from parent balance. The individual liability lines sum to 7,527 versus the printed 7,526 total; the existing source-total check flags the $1 difference rather than altering source figures. All regression suites pass.

### Section 4 PDF expense formats
Expense parsing now reuses whole-dollar/cents monetary extraction and total-column selection from the balance-sheet reader. Supports numbered account headings, Operating/Other/Administrative Expenses, Expense/Amount headers, Cost of Revenue/Sales/Direct Costs, credits and Net Loss stops. COGS subtotal handling no longer risks counting a total again after its detail lines. Monthly zero-dash placeholders are removed from extracted labels. In expense mode, PDF extraction recognizes a right-side Expense/Expenses/Amount column header and selects the aligned amount; whole-dollar PDF text items are eligible. Balance-sheet Total-column behavior is preserved. Improved the no-lines message for PDFs.

Validation: expense-formats.test.mjs covers whole dollars, account codes, different headings, negative credits, COGS exclusion/deduplication and rightmost totals; an actual client first-page P&L was read with totals and net loss excluded. Existing parser, source, expense, FV7, calculated and combined regression checks pass. No new PDF was attached to the latest error report, so that exact failing file has not been verified.


### Integrated Schedule D workflow
Section 4 now assigns each expense to an NMLS field, supports signed splits without changing the source total, and previews relevant inputs and calculated lines in filing order. Gross income, interest income, final P&L net income and an optional gross-expense control total are reviewable. D520 taxes, D540 extraordinary items and D560 noncontrolling interest distinguish pre-tax D510 from final D600. Source and calculation details remain collapsible. Changes invalidate the combined XML review.

Section 5 defaults to the in-app figures; the completed-workbook option remains available. The downloaded workbook retains the SFC and balance-sheet workpapers and adds Schedule D Lines, Setup and Review tabs. Edit Lines and Setup for field-level allocations, then reupload. The SFC category tab is a reference in this new format; legacy SFC-only workbooks remain supported. A valid numeric B36/B43 gross-income override, including an explicit zero, retains precedence; blank or non-numeric cells fall back.

XML exports company-total input fields and supported D310/D510 totals, excluding NMLS-calculated-only tags. Reconciliation, invalid amounts and whole-dollar rounding discrepancies block export. The current limits remain 75 expense entries overall and 25 per SFC category in the workbook. Functional business-line allocations are completed in NMLS. Nonzero D080, D090 or D120 allocations block XML pending verification because published FV7 D130 instructions exclude those inputs; cross-schedule D260/D270 dependencies are flagged for review.

Validation: Schedule D tests cover field suggestions, exact signed splits, taxes and adjustments, invalid input, rounding, canonical/legacy Excel routing, overrides and combined XML. Existing regression suites passed. Generated XML validated against the official FV7 XSD. Browser checks confirmed splitting, tax calculations, review invalidation and the optional workbook path. A live NMLS upload has not been tested.

### General statement import (November 20, 2026)
The importer is no longer tuned to individual statement layouts. Balance sheet accounts without a recognized NMLS field stay in the review as unclassified instead of being dropped; group headings supply suggestions; account-number prefixes are removed; comparative statements default to the latest dated column with an Amount column override. The P&L reader handles a balance sheet and income statement on one page, Trading Income / Revenues headings, income tax provision lines, other income below operating income and expense lines that look like headings. Cost of revenue is tracked and can be included with a visible control. Section 4 adds a P&L reconciliation panel. The page is titled Financial Condition Generator.

A revenue section without a total line is summed for gross income. Only the first complete income statement in a document is imported; a later management or non-GAAP presentation of the same period is reported and left out. Whole-dollar statements whose own totals are a few dollars off the sum of their lines produce a rounding note instead of a blocking difference on the balance sheet, and a rounding explanation on the P&L reconciliation.

Validation: `format-corpus.test.mjs` imports six synthetic layouts (QuickBooks Online, QuickBooks Desktop, Xero, CPA-prepared, comparative, CFO management package); all foot and reconcile to net income. The first five were uploaded as PDFs in Chrome; one combined XML was downloaded and validated against the FV7 XSD. Two real client files (a three-page management package and a one-page year-to-date P&L) were uploaded in Chrome from the git-ignored private fixtures folder and matched their source figures.

### Schedule O reported as zeros (November 20, 2026)
Every combined XML now includes ScheduleOSection with all 22 fields the FV7 schema accepts (O010 through O384) set to 0. Export is blocked if D260 or D270 carries an amount, because NMLS requires those to match Schedule O. Validated against the bundled XSD; live NMLS acceptance has not been tested.
