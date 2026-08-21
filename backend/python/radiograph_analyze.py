#!/usr/bin/env python3
"""Deterministic radiograph review measurements and experimental tooth regions.

Input and output are JSON over stdin/stdout. The detector is deliberately labelled
experimental: it is an OpenCV contour baseline, not a disease model or diagnosis.
"""
import base64
import json
import sys

import cv2
import numpy as np


MODEL_VERSION = "opencv-tooth-region-baseline-v1.0.0"


def decode_image(data_url):
    encoded = data_url.split(",", 1)[1]
    image = cv2.imdecode(np.frombuffer(base64.b64decode(encoded), np.uint8), cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise ValueError("The radiograph image could not be decoded.")
    return image


def quality_metrics(image):
    pixels = image.astype(np.float32)
    return {
        "brightness": round(float(np.mean(pixels)), 2),
        "contrast": round(float(np.std(pixels)), 2),
        "sharpness": round(float(cv2.Laplacian(image, cv2.CV_64F).var()), 2),
        "clippedDarkRatio": round(float(np.mean(pixels <= 5)), 4),
        "clippedBrightRatio": round(float(np.mean(pixels >= 250)), 4),
    }


def fdi_sequence(is_upper, count):
    full = (list(range(18, 10, -1)) + list(range(21, 29))) if is_upper else (list(range(48, 40, -1)) + list(range(31, 39)))
    if count <= 0:
        return []
    indices = np.linspace(0, len(full) - 1, count).round().astype(int)
    return [str(full[index]) for index in indices]


def detect_regions(image):
    height, width = image.shape
    scale = min(1.0, 1400.0 / max(height, width))
    work = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA) if scale < 1 else image.copy()
    h, w = work.shape
    enhanced = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(work)
    _, mask = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 9))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidates = []
    image_area = float(w * h)
    for contour in contours:
        x, y, bw, bh = cv2.boundingRect(contour)
        area_ratio = (bw * bh) / image_area
        aspect = bh / max(bw, 1)
        if not (0.001 <= area_ratio <= 0.06 and 0.65 <= aspect <= 4.8 and bh >= h * 0.07):
            continue
        contour_area = cv2.contourArea(contour)
        solidity = contour_area / max(float(bw * bh), 1.0)
        confidence = max(0.25, min(0.82, 0.38 + solidity * 0.38 + min(area_ratio / 0.02, 1) * 0.06))
        candidates.append({"x": x, "y": y, "width": bw, "height": bh, "centerY": y + bh / 2, "confidence": confidence})
    candidates = sorted(candidates, key=lambda item: item["confidence"], reverse=True)[:32]
    midline = float(np.median([item["centerY"] for item in candidates])) if candidates else h / 2
    output = []
    for is_upper, group in ((True, [c for c in candidates if c["centerY"] <= midline]), (False, [c for c in candidates if c["centerY"] > midline])):
        ordered = sorted(group, key=lambda item: item["x"])
        for item, tooth in zip(ordered, fdi_sequence(is_upper, len(ordered))):
            output.append({
                "predictedToothNumber": tooth,
                "confidence": round(item["confidence"], 4),
                "geometry": {
                    "type": "rectangle",
                    "x": round(item["x"] / w, 5), "y": round(item["y"] / h, 5),
                    "width": round(item["width"] / w, 5), "height": round(item["height"] / h, 5),
                },
            })
    return output


def main():
    payload = json.load(sys.stdin)
    image = decode_image(payload.get("imageDataUrl", ""))
    print(json.dumps({
        "modelVersion": MODEL_VERSION,
        "predictionType": "experimental-tooth-region-and-fdi-suggestion",
        "qualityMetrics": quality_metrics(image),
        "detections": detect_regions(image),
        "limitations": "Unvalidated OpenCV contour baseline. Supports review assistance only; every region and tooth number requires dentist verification.",
    }))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        sys.exit(1)
