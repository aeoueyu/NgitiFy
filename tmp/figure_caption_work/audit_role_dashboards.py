import os
import re
import zipfile

from docx import Document


path = r"C:\Users\Administrator\Documents\4.4 DESCRIPTION OF THE SYSTEM - Captioned with Role Dashboards.docx"
doc = Document(path)
captions = []

for paragraph in doc.paragraphs:
    text = paragraph.text.strip()
    match = re.fullmatch(r"Figure (\d+)\. .+", text)
    if match:
        captions.append((int(match.group(1)), text))

print("captions", len(captions))
print("range", captions[0][0], captions[-1][0])
print("sequential", [number for number, _ in captions] == list(range(1, len(captions) + 1)))
print("images", len(doc.inline_shapes))
print("size", os.path.getsize(path))
print("zip_ok", zipfile.ZipFile(path).testzip() is None)

for number, text in captions:
    if 11 <= number <= 27:
        print(text)
