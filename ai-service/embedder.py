"""
Image embedding using a pretrained ResNet50 (torchvision).
Extracts a 2048-dimensional feature vector from each image.
"""

import io
import logging

import numpy as np
import torch
import torchvision.transforms as T
from PIL import Image
from torchvision.models import resnet50, ResNet50_Weights

logger = logging.getLogger("findit-ai.embedder")


class ImageEmbedder:
    model_name = "resnet50"

    def __init__(self):
        logger.info("Loading ResNet50 for image embeddings...")
        weights = ResNet50_Weights.DEFAULT
        base_model = resnet50(weights=weights)
        # Remove the classification head – keep feature extractor
        self.model = torch.nn.Sequential(*list(base_model.children())[:-1])
        self.model.eval()
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model.to(self.device)

        self.transform = T.Compose([
            T.Resize(256),
            T.CenterCrop(224),
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        logger.info(f"Embedder ready on {self.device}.")

    def embed(self, image_bytes: bytes) -> np.ndarray:
        """Return a normalized 2048-d feature vector for the given image."""
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        tensor = self.transform(image).unsqueeze(0).to(self.device)

        with torch.no_grad():
            features = self.model(tensor)

        vec = features.squeeze().cpu().numpy()
        # L2 normalize for cosine similarity via dot product
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec
