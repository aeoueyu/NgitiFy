import base64
import json
import sys
import urllib.request
from pathlib import Path

import cv2
import numpy as np


ROOT_DIR = Path(__file__).resolve().parent
WEIGHTS_DIR = ROOT_DIR / "weights"
REALESRGAN_X4_URL = (
    "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/"
    "RealESRGAN_x4plus.pth"
)
_REALESRGAN_UPSAMPLER = None


def decode_base64_image(image_base64):
    raw_bytes = base64.b64decode(image_base64)
    image_array = np.frombuffer(raw_bytes, dtype=np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise ValueError("Could not decode the radiograph image.")
    return image


def to_float32(image):
    return image.astype(np.float32) / 255.0


def percentile_rescale(image, low=0.8, high=99.2):
    low_value, high_value = np.percentile(image, [low, high])
    if high_value - low_value < 1e-6:
        return np.clip(image, 0.0, 1.0)
    scaled = (image - low_value) / (high_value - low_value)
    return np.clip(scaled, 0.0, 1.0)


def float_to_uint8(image):
    return np.clip(image * 255.0, 0, 255).astype(np.uint8)


def apply_multi_scale_clahe(image):
    image_u8 = float_to_uint8(image)
    fine = cv2.createCLAHE(clipLimit=1.4, tileGridSize=(8, 8)).apply(image_u8)
    medium = cv2.createCLAHE(clipLimit=1.2, tileGridSize=(16, 16)).apply(image_u8)
    coarse = cv2.createCLAHE(clipLimit=1.1, tileGridSize=(24, 24)).apply(image_u8)

    fine_f = to_float32(fine)
    medium_f = to_float32(medium)
    coarse_f = to_float32(coarse)
    return np.clip((0.5 * fine_f) + (0.3 * medium_f) + (0.2 * coarse_f), 0.0, 1.0)


def unsharp_mask(image, sigma, amount, clip_limit=0.075):
    blurred = cv2.GaussianBlur(image, (0, 0), sigmaX=sigma, sigmaY=sigma)
    detail = np.clip(image - blurred, -clip_limit, clip_limit)
    return np.clip(image + (amount * detail), 0.0, 1.0)


def enhance_radiograph_basic(image):
    base = percentile_rescale(to_float32(image), 0.6, 99.4)

    denoised = cv2.fastNlMeansDenoising(
        float_to_uint8(base),
        None,
        h=11,
        templateWindowSize=7,
        searchWindowSize=31,
    )
    denoised = to_float32(denoised)

    bilateral = cv2.bilateralFilter(
        float_to_uint8(denoised),
        d=7,
        sigmaColor=22,
        sigmaSpace=7,
    )
    bilateral = to_float32(bilateral)

    background = cv2.GaussianBlur(bilateral, (0, 0), sigmaX=14, sigmaY=14)
    flattened = np.clip(
        bilateral - (0.22 * (background - float(np.mean(background)))),
        0.0,
        1.0,
    )

    local_contrast = apply_multi_scale_clahe(flattened)
    detailed = unsharp_mask(local_contrast, sigma=0.9, amount=0.9, clip_limit=0.055)
    detailed = unsharp_mask(detailed, sigma=2.1, amount=0.55, clip_limit=0.045)
    blended = np.clip((0.58 * detailed) + (0.27 * flattened) + (0.15 * base), 0.0, 1.0)
    tone_mapped = np.power(blended, 1.08)
    final_float = percentile_rescale(tone_mapped, 0.9, 99.1)
    micro_blur = cv2.GaussianBlur(final_float, (0, 0), sigmaX=0.8, sigmaY=0.8)
    micro_detail = np.clip(final_float - micro_blur, -0.03, 0.03)
    final_float = np.clip(final_float + (0.28 * micro_detail), 0.0, 1.0)

    return float_to_uint8(final_float)


def ensure_realesrgan_weights():
    weights_path = WEIGHTS_DIR / "RealESRGAN_x4plus.pth"
    if weights_path.exists():
        return weights_path

    WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(REALESRGAN_X4_URL, weights_path)
    return weights_path


def get_realesrgan_upsampler():
    global _REALESRGAN_UPSAMPLER
    if _REALESRGAN_UPSAMPLER is not None:
        return _REALESRGAN_UPSAMPLER

    from basicsr.archs.rrdbnet_arch import RRDBNet
    from realesrgan import RealESRGANer

    model = RRDBNet(
        num_in_ch=3,
        num_out_ch=3,
        num_feat=64,
        num_block=23,
        num_grow_ch=32,
        scale=4,
    )
    weights_path = ensure_realesrgan_weights()
    _REALESRGAN_UPSAMPLER = RealESRGANer(
        scale=4,
        model_path=str(weights_path),
        model=model,
        tile=0,
        tile_pad=10,
        pre_pad=0,
        half=False,
        gpu_id=None,
    )
    return _REALESRGAN_UPSAMPLER


def postprocess_superres_result(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    normalized = percentile_rescale(to_float32(gray), 0.5, 99.5)
    contrast = apply_multi_scale_clahe(normalized)
    refined = unsharp_mask(contrast, sigma=1.0, amount=0.6, clip_limit=0.04)
    return float_to_uint8(refined)


def enhance_radiograph_realesrgan(image, upscale=2):
    upsampler = get_realesrgan_upsampler()
    bgr_input = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    result, _ = upsampler.enhance(bgr_input, outscale=max(1, float(upscale or 2)))
    return postprocess_superres_result(result)


def enhance_radiograph(image, engine="basic", upscale=2):
    normalized_engine = str(engine or "basic").strip().lower()
    if normalized_engine == "realesrgan":
        return enhance_radiograph_realesrgan(image, upscale=upscale)
    return enhance_radiograph_basic(image)


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
    enhanced_image = enhance_radiograph(
        source_image,
        engine=payload.get("engine") or "basic",
        upscale=payload.get("upscale") or 2,
    )
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
