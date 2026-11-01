"""
YOLOv8 object detector.

COCO (what YOLOv8n is trained on) has no class for ID cards, wallets, keys or
chargers, so detection is used for two things only:
  1. drawing bounding boxes so the user sees what the model found, and
  2. cropping to a relevant object before the CLIP embedding is computed.
Category recognition is done by CLIP (see embedder.py).
"""

import base64
import logging
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from PIL import Image
from ultralytics import YOLO

from categories import YOLO_TO_CATEGORY

logger = logging.getLogger("findit-ai.detector")

MODELS_DIR = Path(__file__).parent / "models"
BOX_COLOR = (208, 91, 109)  # BGR of the UI violet #6d5bd0


class YOLODetector:
    def __init__(self, model_name: str = "yolov8n.pt"):
        MODELS_DIR.mkdir(exist_ok=True)
        self.model_name = model_name
        weights = MODELS_DIR / model_name
        logger.info(f"Loading YOLO model: {weights}")
        # Ultralytics downloads the weights to this path on first use.
        self.model = YOLO(str(weights))
        logger.info("YOLO model loaded.")

    def detect(self, image: Image.Image, confidence_threshold: float = 0.3) -> dict[str, Any]:
        rgb = np.array(image)
        results = self.model(rgb, conf=confidence_threshold, verbose=False)

        objects = []
        for result in results:
            for box in result.boxes:
                label = self.model.names[int(box.cls[0])]
                x1, y1, x2, y2 = [int(v) for v in box.xyxy[0]]
                objects.append({
                    "label": label,
                    "confidence": round(float(box.conf[0]), 3),
                    "bbox": [x1, y1, x2, y2],
                    "category": YOLO_TO_CATEGORY.get(label),
                })
        objects.sort(key=lambda o: o["confidence"], reverse=True)

        return {
            "objects": objects,
            "primary_label": objects[0]["label"] if objects else None,
            "annotated_image": self._annotate(rgb, objects) if objects else None,
        }

    @staticmethod
    def _annotate(rgb: np.ndarray, objects: list[dict]) -> str:
        bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
        thickness = max(2, round(max(bgr.shape[:2]) / 320))
        for obj in objects:
            x1, y1, x2, y2 = obj["bbox"]
            cv2.rectangle(bgr, (x1, y1), (x2, y2), BOX_COLOR, thickness)
            text = f'{obj["label"]} {obj["confidence"]:.0%}'
            scale = thickness * 0.3
            (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, scale, 1)
            ty = max(y1, th + 8)
            cv2.rectangle(bgr, (x1, ty - th - 8), (x1 + tw + 8, ty), BOX_COLOR, -1)
            cv2.putText(bgr, text, (x1 + 4, ty - 4), cv2.FONT_HERSHEY_SIMPLEX, scale,
                        (255, 255, 255), 1, cv2.LINE_AA)
        _, buf = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, 85])
        return "data:image/jpeg;base64," + base64.b64encode(buf).decode("ascii")


def pick_crop(objects: list[dict], size: tuple[int, int], category: str) -> list[int] | None:
    """
    Return a padded bounding box to crop to, or None to use the whole image.
    Only crops to a confident detection whose COCO class maps to the same
    category CLIP recognised, and that covers a sensible share of the frame.
    """
    width, height = size
    for obj in objects:
        if obj["category"] != category or obj["confidence"] < 0.4:
            continue
        x1, y1, x2, y2 = obj["bbox"]
        area = (x2 - x1) * (y2 - y1) / float(width * height)
        if area < 0.04 or area > 0.9:
            continue
        pad_x, pad_y = int((x2 - x1) * 0.1), int((y2 - y1) * 0.1)
        return [max(0, x1 - pad_x), max(0, y1 - pad_y),
                min(width, x2 + pad_x), min(height, y2 + pad_y)]
    return None
