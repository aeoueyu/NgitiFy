from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def clean(value: str) -> str:
    return (
        (value or "")
        .replace("\u00a0", " ")
        .replace("â€œ", '"')
        .replace("â€", '"')
        .replace("â€™", "'")
        .replace("â€“", "-")
        .strip()
    )


def first_distinct(row: list[str], start: int) -> str:
    for value in row[start:]:
        value = clean(value)
        if value:
            return value
    return ""


def normalize(filename: str) -> list[dict]:
    src = json.loads((ROOT / filename).read_text(encoding="utf-8"))
    cases = []
    for block in src["blocks"]:
        if block["type"] != "table":
            continue
        rows = block["rows"]
        scenarios = []
        for row in rows[7:]:
            if len(row) < 3:
                continue
            scenario_no = clean(row[0])
            data = clean(row[1])
            expected = clean(row[2])
            if data or expected:
                scenarios.append({"number": scenario_no, "input": data, "expected": expected})
        cases.append({
            "module": first_distinct(rows[0], 3),
            "function": first_distinct(rows[1], 3),
            "system": first_distinct(rows[2], 3),
            "preconditions": first_distinct(rows[3], 1),
            "action": first_distinct(rows[4], 1),
            "verification": first_distinct(rows[5], 1),
            "scenarios": scenarios,
        })
    return cases


def main() -> None:
    combined = {
        "web": normalize("unit testing web.json"),
        "mobile": normalize("unit testing mobile.json"),
    }
    (ROOT / "normalized_unit_cases.json").write_text(
        json.dumps(combined, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    lines = []
    for system, cases in combined.items():
        lines.append(f"# {system.upper()}")
        for i, case in enumerate(cases, 1):
            lines.extend([
                "",
                f"## {i}. {case['module']} / {case['function']}",
                f"Preconditions: {case['preconditions']}",
                f"Action: {case['action']}",
                f"Verification: {case['verification']}",
            ])
            for scenario in case["scenarios"]:
                lines.append(
                    f"- {scenario['number'] or '-'} | {scenario['input']} => {scenario['expected']}"
                )
    (ROOT / "normalized_unit_cases.md").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    main()
