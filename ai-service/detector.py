"""
YOLO-based object detector using Ultralytics YOLOv8.
Handles image bytes, draws bounding boxes, and returns structured results.
"""

import io
import base64
import logging
from typing import Any

import cv2
import numpy as np
from PIL import Image
from ultralytics import YOLO

logger = logging.getLogger("findit-ai.detector")

# Map YOLO class names to FindIt categories
YOLO_TO_CATEGORY = {
    "backpack": "Bag/Backpack",
    "handbag": "Bag/Backpack",
    "suitcase": "Bag/Backpack",
    "cell phone": "Phone",
    "laptop": "Laptop",
    "keyboard": "Laptop",
    "book": "Books/Notes",
    "umbrella": "Umbrella",
    "bottle": "Water Bottle",
    "cup": "Water Bottle",
    "glasses": "Glasses",
    "tie": "Clothing",
    "clock": "Watch",
    "scissors": "Other",
    "remote": "Other",
    "mouse": "Other",
    "tv": "Other",
    "sports ball": "Other",
    "frisbee": "Other",
    "skis": "Other",
    "snowboard": "Other",
    "kite": "Other",
    "baseball bat": "Other",
    "baseball glove": "Other",
    "skateboard": "Other",
    "surfboard": "Other",
    "tennis racket": "Other",
}


class YOLODetector:
    def __init__(self, model_name: str = "yolov8n.pt"):
        self.model_name = model_name
        logger.info(f"Loading YOLO model: {model_name}")
        self.model = YOLO(model_name)
        logger.info("YOLO model loaded.")

    def detect(self, image_bytes: bytes, confidence_threshold: float = 0.3) -> dict[str, Any]:
        """Run YOLO inference and return structured detections."""
        # Decode image
        nparr = np.frombuffer(image_bytes, np.uint8)
        img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img_bgr is None:
            raise ValueError("Could not decode image")

        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

        # Run inference
        results = self.model(img_rgb, conf=confidence_threshold, verbose=False)

        objects = []
        annotated = img_bgr.copy()

        for result in results:
            for box in result.boxes:
                conf = float(box.conf[0])
                cls_id = int(box.cls[0])
                label = self.model.names[cls_id]
                x1, y1, x2, y2 = [int(v) for v in box.xyxy[0]]

                objects.append({
                    "label": label,
                    "confidence": round(conf, 3),
                    "bbox": [x1, y1, x2, y2],
                    "suggested_category": YOLO_TO_CATEGORY.get(label, "Other"),
                })

                # Draw bounding box
                color = (99, 102, 241)  # Indigo
                cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
                cv2.putText(
                    annotated,
                    f"{label} {conf:.0%}",
                    (x1, max(y1 - 8, 16)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.55,
                    color,
                    2,
                    cv2.LINE_AA,
                )

        # Sort by confidence
        objects.sort(key=lambda o: o["confidence"], reverse=True)
        primary_label = objects[0]["label"] if objects else None

        # Encode annotated image as base64 data URL
        _, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 85])
        b64 = base64.b64encode(buf).decode("utf-8")
        annotated_b64 = f"data:image/jpeg;base64,{b64}"

        return {
            "objects": objects,
            "primary_label": primary_label,
            "annotated_image_b64": annotated_b64,
        }
