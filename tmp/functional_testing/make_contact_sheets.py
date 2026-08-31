from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent
SRC = ROOT / "renders" / "functional_sample"
OUT = ROOT / "renders" / "functional_sample_contacts"
OUT.mkdir(parents=True, exist_ok=True)

files = sorted(SRC.glob("page-*.png"), key=lambda p: int(p.stem.split("-")[-1]))
thumb_w, thumb_h = 230, 300
cols, rows = 4, 4
for group_index in range(0, len(files), cols * rows):
    group = files[group_index : group_index + cols * rows]
    sheet = Image.new("RGB", (cols * thumb_w, rows * (thumb_h + 24)), "white")
    draw = ImageDraw.Draw(sheet)
    for slot, path in enumerate(group):
        image = Image.open(path).convert("RGB")
        image.thumbnail((thumb_w - 8, thumb_h - 8))
        x = (slot % cols) * thumb_w + (thumb_w - image.width) // 2
        y = (slot // cols) * (thumb_h + 24) + 20
        sheet.paste(image, (x, y))
        draw.text((slot % cols * thumb_w + 8, slot // cols * (thumb_h + 24) + 2), path.stem, fill="black")
    start = group_index + 1
    end = group_index + len(group)
    sheet.save(OUT / f"pages-{start:03d}-{end:03d}.png")
