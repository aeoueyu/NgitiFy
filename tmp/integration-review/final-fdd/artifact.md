# Template execution contract

## Reference

- Retained reference: `C:\Users\Administrator\Desktop\NGITIFY DENTIME\output\Ngitify_Integration_Testing_Valid_Inputs_Sample_Wording.docx`
- SHA-256: `7cf13b50f7c595867d6f80200e248c0bebb1135992e2e6869cfae9ad54912c40`
- Size: 50,047 bytes
- Page count in Microsoft Word: 64
- Sections: 1
- Tables: 7 role-specific integration-test tables
- Evidence: `template-style-evidence.json`; canonical renderer attempted at `template-reference-render` but unavailable because LibreOffice is not installed.

## Page system

- US Letter portrait, 8.5 x 11 inches.
- Margins: 1 inch on all sides.
- Header/footer distance: 0.5 inch.
- One continuous document section; role tables paginate naturally.
- No distinct first/even/odd page treatment.

## Typography and recurring components

- Preserve the reference's direct Aptos formatting, sizes, colors, alignments, spacing, borders, and row behavior.
- Each role uses the same six-row metadata/header block followed by test rows.
- Visible test columns: Modules; Action Description; Expected Results; Actual Results; Remarks.
- The Action Description header and body span two internal Word grid columns.
- Table style: Table Grid. Internal grid widths in twips: 2058, 1375, 2232, 1350, 1170, 1165.
- Preserve all metadata labels, the application name, test cycle/date fields, preconditions, verification steps, fills, borders, and font treatment.
- Test rows must expand naturally and must not split across pages.

## Content flow and slot map

- Table 1: Patient / Mobile Application.
- Table 2: Admin / Web Application.
- Table 3: Owner / Web Application.
- Table 4: Branch Manager / Web Application.
- Table 5: Dentist / Web Application.
- Table 6: Secretary / Web Application.
- Table 7: Patient / Web Application.
- Editable slots are only test rows below row 6 in each table: Module, Action Description, Expected Results, Actual Results, Remarks.
- Replace the existing test rows with rows derived from the seven final FDD diagrams.
- Actual Results and Remarks must remain blank.
- Preserve the six-row metadata/header block and every other package component.

## Content rules

- Action Description begins with `Input` or `Click`.
- Every `Input` action also includes a click action.
- Valid inputs only; no invalid-input tests.
- Expected Results begins with `System`, `Displays`, or `Removes`.
- Expand confirmation, success, OK, and Cancel interactions where the FDD action invokes a modal workflow.
- Use the sample document's sentence construction consistently.

## Package preservation

- Preserve all 12 original package parts and relationships except `word/document.xml`, which changes to replace and extend role test rows; `docProps` may update only if the authoring library changes metadata.
- Preserve styles, theme, font table, settings, web settings, relationships, content types, and custom properties.

## Fidelity gates

- Retained reference SHA-256 remains unchanged.
- Seven tables and one section remain present.
- Page geometry, metadata blocks, five visible test columns, colors, borders, and typography remain source-derived.
- All final rows pass the wording rules and have blank execution columns.
- Render every final page through Microsoft Word and inspect page images/contact sheets for clipping, overlap, broken rows, or missing text.
