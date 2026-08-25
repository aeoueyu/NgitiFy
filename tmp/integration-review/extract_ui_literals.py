import re
from pathlib import Path


ROOTS = [Path("ngitify-web/src"), Path("ngitify-mobile/src")]
interesting = re.compile(
    r"<button\b|<TouchableOpacity\b|<Pressable\b|<ConfirmModal\b|<LifecycleActionModal\b|"
    r"<CustomModal\b|<Modal\b|onClick\s*=|onPress\s*=|aria-label\s*=|accessibilityLabel\s*=|"
    r"confirmText\s*=|cancelText\s*=|placeholder\s*=|<h[1-4]\b",
    re.I,
)


def clean(value):
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\{[^{}]*\}", " ", value)
    value = value.replace("&times;", "Close").replace("&nbsp;", " ")
    return re.sub(r"\s+", " ", value).strip()


for root in ROOTS:
    for path in sorted(root.rglob("*.js")):
        source = path.read_text(encoding="utf-8", errors="replace")
        if not interesting.search(source):
            continue
        found = []
        for pattern, label in [
            (r"<button\b[^>]*>(.*?)</button>", "BUTTON"),
            (r"<(?:TouchableOpacity|Pressable)\b[^>]*>(.*?)</(?:TouchableOpacity|Pressable)>", "TOUCH"),
            (r"<(h[1-4])\b[^>]*>(.*?)</\1>", "HEADING"),
        ]:
            for match in re.finditer(pattern, source, re.I | re.S):
                raw = match.group(match.lastindex)
                text = clean(raw)
                if text and len(text) <= 160:
                    found.append(f"{label}: {text}")
        for attr in ("aria-label", "accessibilityLabel", "placeholder", "confirmText", "cancelText", "title"):
            for match in re.finditer(rf"\b{attr}\s*=\s*[\"']([^\"']+)[\"']", source):
                found.append(f"{attr}: {match.group(1).strip()}")
        if found:
            print(f"\n### {path.as_posix()}")
            seen = set()
            for item in found:
                if item not in seen:
                    print(item)
                    seen.add(item)
