from pathlib import Path
import base64
import glob
import json
import re

session_files = sorted(
    glob.glob(r"C:\Users\Administrator\.codex\sessions\2026\09\07\rollout-2026-09-07T00-38-28*.jsonl")
)
if not session_files:
    raise FileNotFoundError("Current Codex session log was not found")

last_images = None
with open(session_files[-1], encoding="utf-8") as stream:
    for line in stream:
        item = json.loads(line)
        payload = item.get("payload", {})
        if payload.get("type") != "message" or payload.get("role") != "user":
            continue
        images = [part.get("image_url") for part in payload.get("content", []) if part.get("type") == "input_image"]
        if images:
            last_images = images

if not last_images or len(last_images) != 11:
    raise RuntimeError(f"Expected 11 images in the latest image-bearing user message, found {0 if not last_images else len(last_images)}")

out = Path(r"C:\Users\Administrator\Desktop\NGITIFY DENTIME\tmp\figure_caption_work\role_dashboards")
out.mkdir(parents=True, exist_ok=True)
for index, data_url in enumerate(last_images, 1):
    match = re.fullmatch(r"data:image/([^;]+);base64,(.+)", data_url, flags=re.DOTALL)
    if not match:
        raise ValueError(f"Image {index} was not a base64 data URL")
    ext = "jpg" if match.group(1) in {"jpeg", "jpg"} else match.group(1)
    path = out / f"role-dashboard-{index:02d}.{ext}"
    path.write_bytes(base64.b64decode(match.group(2)))
    print(path)
