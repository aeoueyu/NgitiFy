import base64
import json
import sys

import cv2
import numpy as np


def decode_base64_image(image_base64):
    raw_bytes = base64.b64decode(image_base64)
    image_array = np.frombuffer(raw_bytes, dtype=np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise ValueError("Could not decode the radiograph image.")
    return image


def enhance_radiograph(image):
    denoised = cv2.fastNlMeansDenoising(image, None, 7, 7, 21)
    normalized = cv2.normalize(denoised, None, 0, 255, cv2.NORM_MINMAX)

    clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8))
    contrast = clahe.apply(normalized)

    blur = cv2.GaussianBlur(contrast, (0, 0), 1.1)
    sharpened = cv2.addWeighted(contrast, 1.35, blur, -0.35, 0)

    final_image = cv2.normalize(sharpened, None, 0, 255, cv2.NORM_MINMAX)
    return final_image.astype(np.uint8)


def encode_png_base64(image):
    ok, encoded = cv2.imencode(".png", image)
    if not ok:
        raise ValueError("Could not encode the enhanced radiograph image.")
    return base64.b64encode(encoded.tobytes()).decode("utf-8")


def main():
    payload = json.loads(sys.stdin.read() or "{}")
    image_base64 = payload.get("imageBase64")
    if not image_base64:
        raise ValueError("imageBase64 is required.")

    source_image = decode_base64_image(image_base64)
    enhanced_image = enhance_radiograph(source_image)
    enhanced_base64 = encode_png_base64(enhanced_image)

    print(json.dumps({
        "mediaType": "image/png",
        "imageBase64": enhanced_base64,
    }))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
