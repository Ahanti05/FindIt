"""
Multi-signal ranking of lost/found candidates.

The backend sends the query item and its candidates (it owns the database);
this module only scores them.

  combined = 0.60 * visual + 0.20 * category + 0.10 * location + 0.10 * date

visual   – CLIP cosine similarity, rescaled from [COS_FLOOR, COS_CEIL] to [0, 1].
           Raw CLIP image-image cosine is ~0.59 on average even for unrelated
           photos, so the raw value would overstate similarity. Measured with
           calibrate.py on the 22 seed photos:
             same object, different photo   0.889 – 0.978
             same category, other object    0.640 – 0.856
             different category             0.307 – 0.770
category – 1 if both reports use the same category, else 0.
location – 1 same building, 0 different building, 0.5 if either is unknown.
date     – Gaussian decay on the gap in days (sigma 5 days). A found date more
           than a day *before* the lost date is impossible, so it scores 0.
"""

import math
import os
from datetime import datetime

import numpy as np

WEIGHTS = {"visual": 0.60, "category": 0.20, "location": 0.10, "date": 0.10}
COS_FLOOR = float(os.getenv("VISUAL_COS_FLOOR", "0.65"))
COS_CEIL = float(os.getenv("VISUAL_COS_CEIL", "0.95"))
DATE_SIGMA_DAYS = 5.0


def visual_score(cos: float) -> float:
    return float(min(1.0, max(0.0, (cos - COS_FLOOR) / (COS_CEIL - COS_FLOOR))))


def location_score(a: str | None, b: str | None) -> float:
    if not a or not b:
        return 0.5
    return 1.0 if a.strip().lower() == b.strip().lower() else 0.0


def date_score(lost: datetime | None, found: datetime | None) -> float:
    if not lost or not found:
        return 0.5
    gap_days = (found - lost).total_seconds() / 86400
    if gap_days < -1:
        return 0.0
    return math.exp(-0.5 * (max(gap_days, 0.0) / DATE_SIGMA_DAYS) ** 2)


def rank(query: dict, candidates: list[dict], query_type: str, top_k: int) -> list[dict]:
    q_vec = np.asarray(query["embedding"], dtype=np.float32)
    results = []
    for cand in candidates:
        c_vec = np.asarray(cand["embedding"], dtype=np.float32)
        if c_vec.shape != q_vec.shape:
            continue  # embedding from a different model – skip rather than compare garbage
        cos = float(np.dot(q_vec, c_vec))

        if query_type == "lost":
            lost_date, found_date = query.get("date"), cand.get("date")
        else:
            lost_date, found_date = cand.get("date"), query.get("date")

        scores = {
            "visual": visual_score(cos),
            "category": 1.0 if query.get("category") == cand.get("category") else 0.0,
            "location": location_score(query.get("building"), cand.get("building")),
            "date": date_score(lost_date, found_date),
        }
        combined = sum(WEIGHTS[k] * v for k, v in scores.items())
        results.append({
            "id": cand["id"],
            "cosine": round(cos, 4),
            "similarity_score": round(scores["visual"], 4),
            "combined_score": round(combined, 4),
            "score_breakdown": {k: round(v, 4) for k, v in scores.items()},
        })

    results.sort(key=lambda r: r["combined_score"], reverse=True)
    return results[:top_k]
