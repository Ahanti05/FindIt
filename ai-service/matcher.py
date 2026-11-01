"""
Cosine similarity matcher.
Queries MongoDB for item embeddings, computes cosine similarity,
then applies multi-signal ranking (visual + category + location + date).
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import numpy as np
from bson import ObjectId
from pymongo import MongoClient

logger = logging.getLogger("findit-ai.matcher")

CATEGORY_WEIGHT = 0.15
LOCATION_WEIGHT = 0.10
DATE_WEIGHT = 0.05
VISUAL_WEIGHT = 0.70


class EmbeddingMatcher:
    def __init__(self, mongo_uri: str):
        self.client = MongoClient(mongo_uri)
        self.db = self.client.get_default_database()
        logger.info("EmbeddingMatcher connected to MongoDB.")

    async def find_matches(
        self,
        item_id: str,
        item_type: str,
        top_k: int = 10,
    ) -> list[dict[str, Any]]:
        """
        Given a lost/found item, find best matching items from the opposite collection.
        """
        # Determine source and target collections
        if item_type == "lost":
            src_col = self.db["lostitems"]
            tgt_col = self.db["founditems"]
            tgt_type = "found"
            date_field = "foundDate"
            location_field = "foundLocation"
        else:
            src_col = self.db["founditems"]
            tgt_col = self.db["lostitems"]
            tgt_type = "lost"
            date_field = "lostDate"
            location_field = "lastSeenLocation"

        # Fetch source item
        source = src_col.find_one({"_id": ObjectId(item_id)})
        if not source:
            logger.warning(f"Source item {item_id} not found.")
            return []

        source_vec = source.get("embedding", {}).get("vector")
        if not source_vec:
            logger.warning(f"No embedding for item {item_id}.")
            return []

        source_vec = np.array(source_vec, dtype=np.float32)
        source_category = source.get("category", "")
        source_building = (source.get("lastSeenLocation") or source.get("foundLocation") or {}).get("building", "")
        source_date = source.get("lostDate") or source.get("foundDate")

        # Fetch candidate items (same status, has embedding)
        candidates = list(
            tgt_col.find(
                {"status": "active", "embedding.vector": {"$exists": True}},
                {"_id": 1, "category": 1, date_field: 1, location_field: 1, "embedding.vector": 1},
            ).limit(500)
        )

        results = []
        for candidate in candidates:
            cand_vec = candidate.get("embedding", {}).get("vector")
            if not cand_vec:
                continue

            cand_vec = np.array(cand_vec, dtype=np.float32)

            # Visual similarity (cosine – vecs are already L2 normalized)
            visual_score = float(np.dot(source_vec, cand_vec))
            visual_score = max(0.0, min(1.0, visual_score))

            # Category match
            cand_category = candidate.get("category", "")
            category_score = 1.0 if cand_category == source_category else 0.0

            # Location proximity (same building = 1.0, else 0)
            cand_loc = candidate.get(location_field) or {}
            cand_building = cand_loc.get("building", "")
            location_score = 1.0 if (source_building and cand_building and
                                      source_building.lower() == cand_building.lower()) else 0.0

            # Date proximity (within 3 days = full score, 7 days = half)
            date_score = 0.0
            cand_date = candidate.get(date_field)
            if source_date and cand_date:
                diff = abs((source_date - cand_date).days)
                if diff <= 3:
                    date_score = 1.0
                elif diff <= 7:
                    date_score = 0.5

            combined = (
                VISUAL_WEIGHT * visual_score +
                CATEGORY_WEIGHT * category_score +
                LOCATION_WEIGHT * location_score +
                DATE_WEIGHT * date_score
            )

            results.append({
                "item_id": str(candidate["_id"]),
                "item_type": tgt_type,
                "similarity_score": round(visual_score, 4),
                "combined_score": round(combined, 4),
                "score_breakdown": {
                    "visual": round(visual_score, 4),
                    "category": round(category_score, 4),
                    "location": round(location_score, 4),
                    "date_proximity": round(date_score, 4),
                },
            })

        # Sort by combined score and return top-k
        results.sort(key=lambda r: r["combined_score"], reverse=True)
        return results[:top_k]
