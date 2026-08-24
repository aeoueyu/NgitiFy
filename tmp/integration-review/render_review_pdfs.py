from pathlib import Path
import pymupdf
from PIL import Image, ImageOps, ImageDraw

inputs = [
    Path("tmp/integration-review/mobile/unit-testing-mobile.pdf"),
    Path("tmp/integration-review/web/unit-testing-web.pdf"),
]

for source in inputs:
    output = source.parent / "pages"
    output.mkdir(exist_ok=True)
    doc = pymupdf.open(source)
    print(f"{source}: {len(doc)} pages")
    thumbs = []
    for index, page in enumerate(doc):
        pixmap = page.get_pixmap(matrix=pymupdf.Matrix(0.55, 0.55), alpha=False)
        image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
        image = ImageOps.expand(image, border=1, fill="gray")
        thumbs.append((index + 1, image))
    for start in range(0, len(thumbs), 12):
        selected = thumbs[start:start + 12]
        cell_width = max(image.width for _, image in selected) + 20
        cell_height = max(image.height for _, image in selected) + 24
        sheet = Image.new("RGB", (cell_width * 4, cell_height * 3), "white")
        draw = ImageDraw.Draw(sheet)
        for offset, (page_number, image) in enumerate(selected):
            x = (offset % 4) * cell_width + 10
            y = (offset // 4) * cell_height + 18
            draw.text((x, y - 15), f"page-{page_number}", fill="black")
            sheet.paste(image, (x, y))
        sheet.save(output / f"contact-{start // 12 + 1:02d}.jpg", quality=85)
