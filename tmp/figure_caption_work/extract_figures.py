from pathlib import Path
from io import BytesIO
from docx import Document
from docx.oxml.ns import qn
from PIL import Image, ImageOps, ImageDraw, ImageFont

DOCX = Path(r"C:\Users\Administrator\Documents\4.4 DESCRIPTION OF THE SYSTEM.docx")
OUT = Path(r"C:\Users\Administrator\Desktop\NGITIFY DENTIME\tmp\figure_caption_work")
FIGS = OUT / "figures"
SHEETS = OUT / "sheets"
FIGS.mkdir(parents=True, exist_ok=True)
SHEETS.mkdir(parents=True, exist_ok=True)

doc = Document(DOCX)
figures = []
pending = []
for idx, p in enumerate(doc.paragraphs):
    embeds = p._p.xpath('.//a:blip/@r:embed')
    for rid in embeds:
        part = doc.part.related_parts[rid]
        pending.append((idx, part.blob, part.content_type))
    text = p.text.strip().replace('FIGURE', 'Figure').replace('Figure18', 'Figure 18').replace('Figure30', 'Figure 30')
    if text.lower().startswith('figure') and pending:
        # The source uses one caption after each image paragraph; where two images
        # share a paragraph, retain both under that single figure position.
        figures.append((len(figures)+1, text, pending))
        pending = []

font = ImageFont.truetype(r"C:\Windows\Fonts\arialbd.ttf", 26)
meta = []
for seq, old_label, items in figures:
    # Most entries contain one image. If the paragraph contains more, combine them.
    ims = []
    for j, (_, blob, ctype) in enumerate(items, 1):
        im = Image.open(BytesIO(blob)).convert('RGB')
        ims.append(im)
    if len(ims) == 1:
        combined = ims[0]
    else:
        h = max(im.height for im in ims)
        resized = []
        for im in ims:
            nh = h
            nw = round(im.width * nh / im.height)
            resized.append(im.resize((nw, nh)))
        combined = Image.new('RGB', (sum(i.width for i in resized), h), 'white')
        x = 0
        for im in resized:
            combined.paste(im, (x, 0)); x += im.width
    fig_path = FIGS / f"figure-{seq:03d}.png"
    combined.save(fig_path)
    meta.append(f"{seq}\t{old_label}\t{combined.width}x{combined.height}\t{fig_path.name}")

(OUT / 'figure_inventory.tsv').write_text('\n'.join(meta), encoding='utf-8')

per_sheet = 12
cell_w, cell_h = 460, 330
for start in range(0, len(figures), per_sheet):
    subset = figures[start:start+per_sheet]
    sheet = Image.new('RGB', (cell_w*3, cell_h*4), 'white')
    draw = ImageDraw.Draw(sheet)
    for pos, (seq, _, _) in enumerate(subset):
        im = Image.open(FIGS / f"figure-{seq:03d}.png").convert('RGB')
        box = (cell_w-20, cell_h-55)
        im.thumbnail(box, Image.Resampling.LANCZOS)
        x0 = (pos % 3)*cell_w + (cell_w-im.width)//2
        y0 = (pos // 3)*cell_h + 42 + (cell_h-55-im.height)//2
        sheet.paste(im, (x0, y0))
        draw.text(((pos%3)*cell_w+10, (pos//3)*cell_h+8), f"Figure {seq}", fill='black', font=font)
        draw.rectangle(((pos%3)*cell_w+3, (pos//3)*cell_h+3, (pos%3+1)*cell_w-3, (pos//3+1)*cell_h-3), outline='#777777', width=2)
    sheet.save(SHEETS / f"figures-{start+1:03d}-{start+len(subset):03d}.jpg", quality=90)

print(f"Extracted {len(figures)} labeled figure entries and created {(len(figures)+per_sheet-1)//per_sheet} contact sheets")
