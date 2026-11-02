"""
CLIP image embeddings and zero-shot category recognition.

CLIP (ViT-B/32) maps images and text into the same 512-d space, which gives us:
  * an image embedding for visual similarity between lost and found photos, and
  * category suggestions by comparing the image with text prompts such as
    "a photo of a student ID card" – this covers items COCO/YOLO cannot detect.
"""

import logging

import numpy as np
import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

from categories import CATEGORY_PROMPTS

logger = logging.getLogger("findit-ai.embedder")


class ImageEmbedder:
    def __init__(self, model_name: str = "openai/clip-vit-base-patch32"):
        self.model_name = model_name
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info(f"Loading {model_name} on {self.device}...")
        self.model = CLIPModel.from_pretrained(model_name).to(self.device).eval()
        self.processor = CLIPProcessor.from_pretrained(model_name)

        self.categories = list(CATEGORY_PROMPTS)
        with torch.no_grad():
            per_category = []
            for cat in self.categories:
                tokens = self.processor(text=CATEGORY_PROMPTS[cat], return_tensors="pt", padding=True)
                feats = self.model.get_text_features(**{k: v.to(self.device) for k, v in tokens.items()})
                feats = feats / feats.norm(dim=-1, keepdim=True)
                mean = feats.mean(dim=0)
                per_category.append(mean / mean.norm())
            self.text_features = torch.stack(per_category)
        logger.info("Embedder ready.")

    @torch.no_grad()
    def _image_features(self, image: Image.Image) -> torch.Tensor:
        inputs = self.processor(images=image, return_tensors="pt").to(self.device)
        feats = self.model.get_image_features(**inputs)
        return (feats / feats.norm(dim=-1, keepdim=True))[0]

    @torch.no_grad()
    def analyze(self, image: Image.Image, top_k: int = 3) -> tuple[np.ndarray, list[dict]]:
        """Return (L2-normalised 512-d embedding, top-k category guesses)."""
        feats = self._image_features(image)
        logits = self.model.logit_scale.exp() * (self.text_features @ feats)
        probs = logits.softmax(dim=0).cpu().numpy()
        order = np.argsort(-probs)[:top_k]
        guesses = [{"category": self.categories[i], "confidence": round(float(probs[i]), 3)} for i in order]
        return feats.cpu().numpy().astype(np.float32), guesses
