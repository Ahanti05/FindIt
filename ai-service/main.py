"""
FindIt AI Service – FastAPI application

  POST /analyze  – multipart image → YOLO detections, CLIP category guesses,
                   512-d CLIP embedding (of the detected object when one is found)
  POST /match    – rank candidate items against a query item
  GET  /health   – model status

The service never fetches URLs and never touches the database: the backend
uploads image bytes and sends candidate embeddings. That keeps it free of
SSRF risk and lets it run on a separate GPU box.
"""

import io
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Literal, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, Field

from detector import YOLODetector, pick_crop
from embedder import ImageEmbedder
from matcher import WEIGHTS, rank

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("findit-ai")

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
MIN_CATEGORY_CONFIDENCE = 0.35

detector: Optional[YOLODetector] = None
embedder: Optional[ImageEmbedder] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global detector, embedder
    detector = YOLODetector(model_name=os.getenv("YOLO_MODEL", "yolov8n.pt"))
    embedder = ImageEmbedder(model_name=os.getenv("CLIP_MODEL", "openai/clip-vit-base-patch32"))
    logger.info("AI Service ready.")
    yield


app = FastAPI(
    title="FindIt AI Service",
    description="YOLOv8 detection + CLIP embeddings and category recognition",
    version="2.0.0",
    lifespan=lifespan,
)


# ─── Schemas ──────────────────────────────────────────────────────────────────

class MatchItem(BaseModel):
    id: str = ""
    embedding: list[float]
    category: Optional[str] = None
    building: Optional[str] = None
    date: Optional[datetime] = None


class MatchRequest(BaseModel):
    query_type: Literal["lost", "found"]
    query: MatchItem
    candidates: list[MatchItem] = Field(default_factory=list)
    top_k: int = Field(default=10, ge=1, le=100)


# ─── Inference ────────────────────────────────────────────────────────────────

def _run_analysis(image: Image.Image) -> dict:
    detection = detector.detect(image)
    embedding, guesses = embedder.analyze(image)

    # Crop to the detected object only when YOLO and CLIP agree on what it is.
    # COCO labels are often wrong for our items (a wallet detected as an
    # "umbrella"), and cropping one photo of a pair but not the other hurts
    # similarity more than background clutter does.
    top = guesses[0]
    crop = pick_crop(detection["objects"], image.size, top["category"])
    if crop:
        embedding, _ = embedder.analyze(image.crop(tuple(crop)))

    suggested = top["category"] if top["confidence"] >= MIN_CATEGORY_CONFIDENCE else "Other"
    return {
        "detected_objects": detection["objects"],
        "primary_label": detection["primary_label"],
        "annotated_image": detection["annotated_image"],
        "crop_box": crop,
        "suggested_category": suggested,
        "category_guesses": guesses,
        "embedding": embedding.tolist(),
        "model": embedder.model_name,
        "dimensions": int(embedding.shape[0]),
    }


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok" if detector and embedder else "loading",
        "models": {
            "detector": detector.model_name if detector else None,
            "embedder": embedder.model_name if embedder else None,
            "device": str(embedder.device) if embedder else None,
        },
        "weights": WEIGHTS,
    }


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image too large")
    try:
        image = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=400, detail="Not a readable image")

    try:
        return await run_in_threadpool(_run_analysis, image)
    except Exception as e:
        logger.exception("Analysis failed")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {e}")


@app.post("/match")
async def match(req: MatchRequest):
    results = await run_in_threadpool(
        rank,
        req.query.model_dump(),
        [c.model_dump() for c in req.candidates],
        req.query_type,
        req.top_k,
    )
    return {"matches": results, "count": len(results)}
