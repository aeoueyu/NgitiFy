from docx import Document

paths = [
    r"C:/Users/Administrator/Documents/unit testing mobile.docx",
    r"C:/Users/Administrator/Documents/unit testing web.docx",
]

for path in paths:
    doc = Document(path)
    print(f"\n### {path}")
    for index, table in enumerate(doc.tables):
        rows = [
            [cell.text.replace("\n", " / ").strip() for cell in row.cells]
            for row in table.rows
        ]

        def value(label):
            for row in rows:
                if label in row:
                    column = row.index(label)
                    return row[column + 1] if column + 1 < len(row) else ""
            return ""

        fields = [
            f"{index:02d}",
            value("Module Name"),
            value("Component Name"),
            value("Action Description"),
            value("Verification Steps"),
            value("Pre-conditions"),
        ]
        print("\t".join(fields))
