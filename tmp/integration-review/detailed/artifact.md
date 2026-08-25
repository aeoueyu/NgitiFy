# Ngitify integration-test template contract

- Reference: `C:\Users\Administrator\Documents\integration testing.docx`
- SHA-256: `cb272bef1cc6d401d9bc690d8c8b8b3d8bcf607a785eeb7611df88d581edfc6a`
- Size at distillation: 31,957 bytes
- Sections: 1. Page count is established from the reference render for this task.
- Evidence: `section_audit.py`, `style_lint.py`, direct DOCX table/package inspection, and `tmp/integration-review/detailed/reference-render/`.

## Page system

- US Letter portrait: 8.5 x 11 inches.
- Margins: 1 inch on every side.
- One continuous section; no distinct first/even-page header behavior.
- No authored header/footer content or page-number fields.
- Seven sequential role tables separated by empty body paragraphs.

## Typography and table system

- Source typography is Aptos with direct run formatting.
- Title: 20 pt, bold, centered in the merged upper-left title cell.
- Metadata labels: bold; source uses 11 pt generally and 14 pt for `Test Cycle No.`.
- Metadata values and table headings: 11 pt.
- Table style: `Table Grid`; fixed layout; no fixed row heights.
- Underlying six-column grid: 2058, 1375, 2232, 1350, 1170, 1165 DXA (9350 DXA total).
- The two action-description grid columns are merged for visible five-field data rows.
- Repeated visible fields: Modules; Action Description; Expected Results; Actual Results; Remarks.
- Cells are vertically centered. Source borders, gray header fills, alignment, and padding are authoritative.

## Content flow and slot map

The seven tables are ordered and identified by `User/Access Type` plus `Type of System`:

1. Patient - Mobile Application
2. Admin - Web Application
3. Owner - Web Application
4. Branch Manager - Web Application
5. Dentist - Web Application
6. Secretary - Web Application
7. Patient - Web Application

For each table:

- Rows 0-5 form the title, metadata, preconditions, verification steps, and column-header block. Preserve their structure and styling.
- Rows 6 onward are the editable integration-test slots.
- Existing authored web rows are user content and must remain represented; text may be normalized only to remove encoding artifacts or align labels with the implemented UI.
- Additional cases may be created by cloning the source data-row pattern.
- Every populated test row must contain Module, Action Description, and Expected Results.
- Actual Results and Remarks remain blank for test execution.
- The source allows the table to split naturally across pages. Rows must not use fixed heights and should not split across pages.

## Package preservation

- Preserve standard package relationships, theme, styles, settings, web settings, font table, and document properties unless a generated copy requires updated core title/subject metadata.
- No drawings, images, comments, tracked changes, content controls, footnotes, numbering, or custom XML are present.
- The only intentional content-structure change is adding/cloning table data rows and updating their text.

## Fidelity gates

- The reference remains unchanged and must match the recorded SHA-256 before delivery.
- Preserve the seven-table order, title/metadata layout, five visible test columns, borders, gray table headings, and role/system metadata.
- All visible screens and important controls for each role must have corresponding rows, including confirmation/modal Confirm/OK and Cancel/Close outcomes.
- Render every final page and check for clipped text, split rows, missing borders, unexpected blank pages, broken merged cells, and unreadable type.
- Actual Results and Remarks must remain blank in every generated test row.
