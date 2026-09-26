from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


OUT = r"C:\Users\Administrator\Desktop\NGITIFY DENTIME\Compact_3_Column_Table.docx"


def set_cell_margins(cell, top=0, start=90, bottom=0, end=90):
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for side, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{side}"))
        if node is None:
            node = OxmlElement(f"w:{side}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_width(cell, width_dxa):
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_w = tc_pr.find(qn("w:tcW"))
    if tc_w is None:
        tc_w = OxmlElement("w:tcW")
        tc_pr.append(tc_w)
    tc_w.set(qn("w:w"), str(width_dxa))
    tc_w.set(qn("w:type"), "dxa")


def set_table_geometry(table, widths):
    table.autofit = False
    tbl_pr = table._tbl.tblPr

    tbl_w = tbl_pr.find(qn("w:tblW"))
    if tbl_w is None:
        tbl_w = OxmlElement("w:tblW")
        tbl_pr.append(tbl_w)
    tbl_w.set(qn("w:w"), str(sum(widths)))
    tbl_w.set(qn("w:type"), "dxa")

    tbl_ind = tbl_pr.find(qn("w:tblInd"))
    if tbl_ind is None:
        tbl_ind = OxmlElement("w:tblInd")
        tbl_pr.append(tbl_ind)
    tbl_ind.set(qn("w:w"), "0")
    tbl_ind.set(qn("w:type"), "dxa")

    grid = table._tbl.tblGrid
    for child in list(grid):
        grid.remove(child)
    for width in widths:
        col = OxmlElement("w:gridCol")
        col.set(qn("w:w"), str(width))
        grid.append(col)

    for row in table.rows:
        for idx, cell in enumerate(row.cells):
            set_cell_width(cell, widths[idx])


def style_paragraph(paragraph, bold=False, white=False):
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    fmt = paragraph.paragraph_format
    fmt.space_before = Pt(0)
    fmt.space_after = Pt(0)
    fmt.line_spacing = 1.0
    fmt.keep_together = True

    for run in paragraph.runs:
        run.font.name = "Arial"
        run._element.get_or_add_rPr().get_or_add_rFonts().set(qn("w:ascii"), "Arial")
        run._element.get_or_add_rPr().get_or_add_rFonts().set(qn("w:hAnsi"), "Arial")
        run.font.size = Pt(10)
        run.font.bold = bold
        run.font.color.rgb = RGBColor(255, 255, 255) if white else RGBColor(0, 0, 0)


doc = Document()
section = doc.sections[0]
section.page_width = Inches(8.5)
section.page_height = Inches(11)
section.top_margin = Inches(1)
section.bottom_margin = Inches(1)
section.left_margin = Inches(1)
section.right_margin = Inches(1)
section.header_distance = Inches(0.492)
section.footer_distance = Inches(0.492)

normal = doc.styles["Normal"]
normal.font.name = "Arial"
normal._element.rPr.rFonts.set(qn("w:ascii"), "Arial")
normal._element.rPr.rFonts.set(qn("w:hAnsi"), "Arial")
normal.font.size = Pt(10)
normal.paragraph_format.space_before = Pt(0)
normal.paragraph_format.space_after = Pt(0)
normal.paragraph_format.line_spacing = 1.0

headers = ["Test Cycle", "Component Name", "Remarks"]
rows = [
    ["01", "Landing Page", "PASSED"],
    ["01", "Sign In", "PASSED"],
    ["01", "Sign In - OTP", "PASSED"],
    ["01", "Forgot Password", "PASSED"],
    ["01", "Reset Password", "PASSED"],
    ["01", "Set Password", "PASSED"],
    ["01", "Session Timeout", "PASSED"],
    ["01", "Edit Profile", "PASSED"],
    ["01", "Change Password", "PASSED"],
    ["01", "Daily Oral Health Log", "PASSED"],
]

table = doc.add_table(rows=1, cols=3)
table.style = "Table Grid"
table.alignment = WD_TABLE_ALIGNMENT.LEFT
table.rows[0]._tr.get_or_add_trPr().append(OxmlElement("w:tblHeader"))

for idx, value in enumerate(headers):
    cell = table.rows[0].cells[idx]
    cell.text = value
    cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    set_cell_margins(cell)
    set_cell_shading(cell, "344955")
    style_paragraph(cell.paragraphs[0], bold=True, white=True)

for values in rows:
    cells = table.add_row().cells
    for idx, value in enumerate(values):
        cells[idx].text = value
        cells[idx].vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        set_cell_margins(cells[idx])
        style_paragraph(cells[idx].paragraphs[0])

set_table_geometry(table, [2160, 4320, 2880])

# Word compatibility setting: do not add automatic extra spacing to table paragraphs.
settings = doc.settings._element
compat = settings.find(qn("w:compat"))
if compat is None:
    compat = OxmlElement("w:compat")
    settings.append(compat)
setting = OxmlElement("w:compatSetting")
setting.set(qn("w:name"), "doNotUseHTMLParagraphAutoSpacing")
setting.set(qn("w:uri"), "http://schemas.microsoft.com/office/word")
setting.set(qn("w:val"), "1")
compat.append(setting)

doc.save(OUT)
print(OUT)
