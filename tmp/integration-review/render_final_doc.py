from pathlib import Path

import pymupdf
from PIL import Image, ImageDraw, ImageOps


source = Path("tmp/integration-review/final-render/final4.pdf")
output = source.parent / "pages4"
output.mkdir(exist_ok=True)

document = pymupdf.open(source)
page_paths = []
for index, page in enumerate(document):
    pixmap = page.get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5), alpha=False)
    page_path = output / f"page-{index + 1:02d}.png"
    pixmap.save(page_path)
    page_paths.append(page_path)

thumb_width = 400
for start in range(0, len(page_paths), 9):
    selected = page_paths[start:start + 9]
    thumbs = []
    for page_path in selected:
        page_image = Image.open(page_path).convert("RGB")
        height = round(page_image.height * thumb_width / page_image.width)
        page_image = page_image.resize((thumb_width, height))
        page_image = ImageOps.expand(page_image, border=1, fill="gray")
        thumbs.append((page_path.stem, page_image))
    cell_width = thumb_width + 26
    cell_height = max(image.height for _, image in thumbs) + 32
    sheet = Image.new("RGB", (cell_width * 3, cell_height * 3), "white")
    draw = ImageDraw.Draw(sheet)
    for offset, (label, page_image) in enumerate(thumbs):
        col = offset % 3
        row = offset // 3
        x = col * cell_width + 13
        y = row * cell_height + 20
        draw.text((x, row * cell_height + 3), label, fill="black")
        sheet.paste(page_image, (x, y))
    sheet.save(output / f"contact-{start // 9 + 1:02d}.jpg", quality=90)

print(f"Rendered {len(page_paths)} pages")
