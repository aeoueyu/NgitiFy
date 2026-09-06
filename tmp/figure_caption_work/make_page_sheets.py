from pathlib import Path
import sys
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"C:\Users\Administrator\Desktop\NGITIFY DENTIME\tmp\figure_caption_work\rendered")
PAGES = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "pages_v2"
OUT = Path(sys.argv[3]) if len(sys.argv) > 3 else ROOT / "page_sheets_v2"
OUT.mkdir(parents=True, exist_ok=True)
files = sorted(PAGES.glob("page-*.png"), key=lambda p: int(p.stem.split('-')[-1]))
font = ImageFont.truetype(r"C:\Windows\Fonts\arialbd.ttf", 26)
for start in range(0, len(files), 9):
    subset = files[start:start+9]
    # Retain each rendered page at its full raster size; the contact sheet only
    # arranges the pages and adds a narrow numbered header.
    sample = Image.open(subset[0])
    pw, ph = sample.size
    head = 38
    sheet = Image.new("RGB", (pw*3, (ph+head)*3), "#cfcfcf")
    draw = ImageDraw.Draw(sheet)
    for i, path in enumerate(subset):
        page_num = int(path.stem.split('-')[-1])
        im = Image.open(path).convert("RGB")
        col, row = i % 3, i // 3
        x, y = col*pw, row*(ph+head)
        sheet.paste(im, (x, y+head))
        draw.text((x+10, y+4), f"Page {page_num}", fill="black", font=font)
    end = int(subset[-1].stem.split('-')[-1])
    sheet.save(OUT / f"pages-{start+1:03d}-{end:03d}.jpg", quality=92)
print(f"Created {(len(files)+8)//9} page review sheets")
