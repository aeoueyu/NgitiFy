from pathlib import Path

from docx import Document


SOURCE = Path(r"C:\Users\Administrator\Downloads\integration testing.docx")


def clean(value):
    return " / ".join(part.strip() for part in value.splitlines() if part.strip())


def main():
    document = Document(SOURCE)
    for table_index, table in enumerate(document.tables):
        role = clean(table.rows[1].cells[3].text)
        platform = clean(table.rows[2].cells[3].text)
        print(f"\n### TABLE {table_index + 1}: {role} / {platform}")
        for case_index, row in enumerate(table.rows[6:], 1):
            module = clean(row.cells[0].text)
            action = clean(row.cells[1].text)
            expected = clean(row.cells[3].text)
            screenshot_count = len(row.cells[4]._tc.xpath(".//w:drawing")) + len(row.cells[4]._tc.xpath(".//w:pict"))
            remark = clean(row.cells[5].text)
            print(f"{case_index:03d}\t{module}\t{action}\t{expected}\tshots={screenshot_count}\t{remark}")


if __name__ == "__main__":
    main()
