from __future__ import annotations

import json
import re
from difflib import SequenceMatcher
from pathlib import Path


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]


def normalize(value: str) -> str:
    return " ".join((value or "").replace("\\n", " ").replace("\\'", "'").replace('\\"', '"').split()).casefold()


def main() -> None:
    records = [json.loads(line) for line in (ROOT / "expected_string_audit.jsonl").read_text(encoding="utf-8").splitlines()]
    candidates: list[tuple[str, str]] = []
    for base in (REPO / "ngitify-web" / "src", REPO / "ngitify-mobile" / "src", REPO / "backend"):
        for path in base.rglob("*"):
            if not path.is_file() or path.suffix.lower() not in {".js", ".jsx", ".mjs"} or "node_modules" in path.parts:
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            for match in re.finditer(r"(?s)(?P<q>['\"`])(?P<s>(?:\\.|(?!\1).){4,220}?)(?P=q)", text):
                value = match.group("s")
                if "${" in value or "<" in value or "{" in value or "}" in value:
                    continue
                value = " ".join(value.replace("\\n", " ").split())
                if len(value) >= 4 and any(ch.isalpha() for ch in value):
                    candidates.append((value, str(path.relative_to(REPO))))

    output = []
    for record in records:
        if record["exact_match"]:
            continue
        target = normalize(record["phrase"])
        scored = []
        for value, path in candidates:
            ratio = SequenceMatcher(None, target, normalize(value)).ratio()
            if ratio >= 0.38:
                scored.append((ratio, value, path))
        scored.sort(reverse=True)
        output.append({
            "phrase": record["phrase"],
            "candidates": [
                {"score": round(score, 3), "value": value, "path": path}
                for score, value, path in scored[:5]
            ],
        })
    (ROOT / "expected_string_candidates.json").write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
