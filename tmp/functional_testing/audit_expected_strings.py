from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]


def fix_text(text: str) -> str:
    current = text or ""
    for _ in range(2):
        if any(token in current for token in ("â€", "Â", "Ã")):
            try:
                current = current.encode("cp1252").decode("utf-8")
            except (UnicodeEncodeError, UnicodeDecodeError):
                break
        else:
            break
    return current.replace("\u00a0", " ").strip()


def main() -> None:
    data = json.loads((ROOT / "normalized_unit_cases.json").read_text(encoding="utf-8"))
    code_files = [
        p for base in (REPO / "ngitify-web" / "src", REPO / "ngitify-mobile" / "src", REPO / "backend")
        for p in base.rglob("*")
        if p.is_file() and p.suffix.lower() in {".js", ".jsx", ".mjs", ".json", ".md"}
        and "node_modules" not in p.parts
    ]
    corpus_parts = []
    for path in code_files:
        try:
            corpus_parts.append((path, path.read_text(encoding="utf-8", errors="ignore")))
        except OSError:
            pass

    phrases = {}
    for system, cases in data.items():
        for case in cases:
            for scenario in case["scenarios"]:
                expected = fix_text(scenario["expected"])
                quoted = re.findall(r'["“](.*?)["”]', expected, flags=re.S)
                for phrase in quoted:
                    phrase = " ".join(phrase.split()).strip(" .")
                    if len(phrase) >= 4:
                        phrases.setdefault(phrase, []).append(
                            f"{system}: {case['module']} / {case['function']}"
                        )

    lines = []
    for phrase in sorted(phrases, key=str.lower):
        matches = []
        needle = phrase.casefold()
        for path, text in corpus_parts:
            if needle in " ".join(text.split()).casefold():
                matches.append(str(path.relative_to(REPO)))
        lines.append(json.dumps({
            "phrase": phrase,
            "exact_match": bool(matches),
            "files": matches[:8],
            "cases": sorted(set(phrases[phrase])),
        }, ensure_ascii=False))
    (ROOT / "expected_string_audit.jsonl").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    main()
