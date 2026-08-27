from pathlib import Path

import pymupdf
from PIL import Image, ImageDraw, ImageOps


SOURCE = Path(r"C:\Users\Administrator\Desktop\NGITIFY DENTIME\tmp\integration-review\fdd\render-chunks")
PAGES = SOURCE / "pages"
CONTACTS = SOURCE / "contacts"


def main():
    PAGES.mkdir(exist_ok=True)
    CONTACTS.mkdir(exist_ok=True)
    rendered = []
    summary = []
    for pdf_path in sorted(SOURCE.glob("*.pdf")):
        document = pymupdf.open(pdf_path)
        summary.append(f"{pdf_path.name}: {len(document)} pages")
        for page_index, page in enumerate(document):
            pixmap = page.get_pixmap(matrix=pymupdf.Matrix(0.55, 0.55), alpha=False)
            image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
            image = ImageOps.expand(image, border=1, fill="gray")
            label = f"{pdf_path.stem} / p{page_index + 1}"
            output = PAGES / f"{pdf_path.stem}-p{page_index + 1:02d}.png"
            image.save(output)
            rendered.append((label, image))

            page_rect = page.rect
            outside = []
            for block in page.get_text("blocks"):
                rect = pymupdf.Rect(block[:4])
                if rect.x0 < -1 or rect.y0 < -1 or rect.x1 > page_rect.x1 + 1 or rect.y1 > page_rect.y1 + 1:
                    outside.append(rect)
            text_length = len(page.get_text().strip())
            if outside or text_length < 25:
                summary.append(f"  page {page_index + 1}: outside={len(outside)}, text_length={text_length}")

    columns, rows = 4, 3
    per_sheet = columns * rows
    for start in range(0, len(rendered), per_sheet):
        selected = rendered[start:start + per_sheet]
        cell_width = max(image.width for _, image in selected) + 28
        cell_height = max(image.height for _, image in selected) + 32
        sheet = Image.new("RGB", (cell_width * columns, cell_height * rows), "white")
        draw = ImageDraw.Draw(sheet)
        for offset, (label, page_image) in enumerate(selected):
            col = offset % columns
            row = offset // columns
            x = col * cell_width + 14
            y = row * cell_height + 20
            draw.text((x, row * cell_height + 3), label, fill="black")
            sheet.paste(page_image, (x, y))
        sheet.save(CONTACTS / f"contact-{start // per_sheet + 1:02d}.jpg", quality=92)

    summary.append(f"TOTAL RENDERED PAGES: {len(rendered)}")
    (SOURCE / "qa-summary.txt").write_text("\n".join(summary), encoding="utf-8")
    print("\n".join(summary))
    print(f"CONTACT SHEETS: {(len(rendered) + per_sheet - 1) // per_sheet}")


if __name__ == "__main__":
    main()
