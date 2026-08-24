from pathlib import Path
import pymupdf
from PIL import Image, ImageOps, ImageDraw

source = Path(r"C:/Users/Administrator/Downloads/integration testing sample.pdf")
output = Path(r"tmp/integration-review/pdf")
output.mkdir(parents=True, exist_ok=True)
doc = pymupdf.open(source)
page_paths = []
for index, page in enumerate(doc):
    pixmap = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), alpha=False)
    page_path = output / f"page-{index + 1:02d}.png"
    pixmap.save(page_path)
    page_paths.append(page_path)

thumb_width = 480
for sheet_index in range(0, len(page_paths), 6):
    selected = page_paths[sheet_index:sheet_index + 6]
    thumbs = []
    for page_path in selected:
        image = Image.open(page_path).convert("RGB")
        height = round(image.height * thumb_width / image.width)
        image = image.resize((thumb_width, height))
        image = ImageOps.expand(image, border=2, fill="gray")
        thumbs.append((page_path.stem, image))
    cell_width = thumb_width + 34
    cell_height = max(image.height for _, image in thumbs) + 44
    sheet = Image.new("RGB", (cell_width * 3, cell_height * 2), "white")
    draw = ImageDraw.Draw(sheet)
    for offset, (label, image) in enumerate(thumbs):
        x = (offset % 3) * cell_width + 17
        y = (offset // 3) * cell_height + 25
        draw.text((x, 5 + (offset // 3) * cell_height), label, fill="black")
        sheet.paste(image, (x, y))
    sheet.save(output / f"contact-{sheet_index // 6 + 1:02d}.jpg", quality=88)
