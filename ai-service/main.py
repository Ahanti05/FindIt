"""
FindIt AI Service – FastAPI application
Provides:
  POST /detect   – YOLOv8 object detection on an image URL
  POST /embed    – ResNet50 visual embedding extraction
  POST /match    – Cosine similarity matching against DB embeddings
  GET  /health   – Health check
"""

import os
import io
import logging
from contextlib import asynccontextmanager
from typing import Optional

import httpx
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from detector import YOLODetector
from embedder import ImageEmbedder
from matcher import EmbeddingMatcher

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("findit-ai")

# ─── Global model instances ───────────────────────────────────────────────────
detector: Optional[YOLODetector] = None
embedder: Optional[ImageEmbedder] = None
matcher: Optional[EmbeddingMatcher] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load models on startup, release on shutdown."""
    global detector, embedder, matcher
    logger.info("Loading YOLO model...")
    detector = YOLODetector(model_name=os.getenv("YOLO_MODEL", "yolov8n.pt"))
    logger.info("Loading embedding model...")
    embedder = ImageEmbedder()
    logger.info("Initializing matcher...")
    matcher = EmbeddingMatcher(
        mongo_uri=os.getenv("MONGODB_URI", "mongodb://localhost:27017/findit")
    )
    logger.info("✅ AI Service ready.")
    yield
    logger.info("Shutting down AI Service...")


app = FastAPI(
    title="FindIt AI Service",
    description="YOLO-powered object detection and visual similarity matching",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request / Response schemas ───────────────────────────────────────────────

class DetectRequest(BaseModel):
    image_url: str
    confidence_threshold: float = 0.3

class EmbedRequest(BaseModel):
    image_url: str

class MatchRequest(BaseModel):
    item_id: str
    item_type: str  # "lost" | "found"
    top_k: int = 10


# ─── Utility: fetch image bytes from URL ─────────────────────────────────────

async def fetch_image_bytes(url: str) -> bytes:
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(url)
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Failed to fetch image: {url}")
        return response.content


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "models": {
            "yolo": detector.model_name if detector else None,
            "embedder": embedder.model_name if embedder else None,
        },
    }


@app.post("/detect")
async def detect(req: DetectRequest):
    """
    Run YOLO object detection on an image URL.
    Returns detected objects with bounding boxes and an annotated image (base64).
    """
    try:
        image_bytes = await fetch_image_bytes(req.image_url)
        result = detector.detect(image_bytes, confidence_threshold=req.confidence_threshold)
        return {
            "detected_objects": result["objects"],
            "primary_label": result["primary_label"],
            "annotated_image_url": result.get("annotated_image_b64"),
            "object_count": len(result["objects"]),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/embed")
async def embed(req: EmbedRequest):
    """
    Extract a visual embedding vector from an image URL.
    """
    try:
        image_bytes = await fetch_image_bytes(req.image_url)
        vector = embedder.embed(image_bytes)
        return {
            "embedding": vector.tolist(),
            "model": embedder.model_name,
            "dimensions": len(vector),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Embedding error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/match")
async def match(req: MatchRequest):
    """
    Compare the embedding of the given item against all relevant items in the DB.
    Returns ranked matches with similarity scores.
    """
    try:
        matches = await matcher.find_matches(
            item_id=req.item_id,
            item_type=req.item_type,
            top_k=req.top_k,
        )
        return {"matches": matches, "count": len(matches)}
    except Exception as e:
        logger.error(f"Matching error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
