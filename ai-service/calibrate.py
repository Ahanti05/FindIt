"""
Measures what the AI actually does on the seed photos, through the running
service (so YOLO cropping is included):

  * category recognition for every photo, and
  * CLIP cosine similarity for (a) the same object photographed twice,
    (b) different objects of the same category, (c) unrelated items.

The gap between (a) and (b)/(c) is what VISUAL_COS_FLOOR / VISUAL_COS_CEIL in
matcher.py are based on.

    python calibrate.py [--url http://localhost:8000] [--images ../backend/seed/images]
"""

import argparse
import itertools
from pathlib import Path

import httpx
import numpy as np

# file stem -> category a human would assign
LABELS = {
    "wallet": "Wallet", "wallet_reshot": "Wallet", "wallet_b": "Wallet",
    "keys_a": "Keys", "keys_b": "Keys", "keys_c": "Keys", "keys_c_reshot": "Keys",
    "idcard": "ID Card", "idcard_reshot": "ID Card",
    "headphones": "Earphones/AirPods", "headphones_reshot": "Earphones/AirPods", "earbuds_a": "Earphones/AirPods",
    "backpack": "Bag/Backpack", "backpack_reshot": "Bag/Backpack",
    "charger_a": "Charger/Cable", "charger_b": "Charger/Cable",
    "umbrella_a": "Umbrella", "umbrella_b": "Umbrella",
    "bottle": "Water Bottle", "bottle_b": "Water Bottle",
    "laptop": "Laptop", "watch": "Watch",
}

SAME_OBJECT = [("wallet", "wallet_reshot"), ("keys_c", "keys_c_reshot"), ("idcard", "idcard_reshot"),
               ("headphones", "headphones_reshot"), ("backpack", "backpack_reshot")]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:8000")
    ap.add_argument("--images", default=str(Path(__file__).parent.parent / "backend" / "seed" / "images"))
    args = ap.parse_args()

    emb, correct = {}, 0
    with httpx.Client(timeout=60) as client:
        for stem, label in LABELS.items():
            path = Path(args.images) / f"{stem}.jpg"
            r = client.post(f"{args.url}/analyze", files={"file": (path.name, path.read_bytes(), "image/jpeg")})
            r.raise_for_status()
            d = r.json()
            emb[stem] = np.array(d["embedding"], dtype=np.float32)
            ok = d["suggested_category"] == label
            correct += ok
            guesses = ", ".join(f'{g["category"]} {g["confidence"]:.2f}' for g in d["category_guesses"])
            yolo = d["primary_label"] or "-"
            print(f'{"OK " if ok else "XX "} {stem:18s} want {label:18s} got {d["suggested_category"]:18s} '
                  f'| yolo: {yolo:10s} crop: {"yes" if d["crop_box"] else "no ":3s} | {guesses}')
    print(f"\nCategory accuracy: {correct}/{len(LABELS)}")

    cos = lambda a, b: float(np.dot(emb[a], emb[b]))
    same = [cos(a, b) for a, b in SAME_OBJECT]
    same_cat, other, named = [], [], []
    for a, b in itertools.combinations(LABELS, 2):
        if (a, b) in SAME_OBJECT or (b, a) in SAME_OBJECT:
            continue
        if a.split("_")[0] == b.split("_")[0] and "reshot" in a + b:
            continue  # a reshot vs another photo of the same source counts as same object
        (same_cat if LABELS[a] == LABELS[b] else other).append(cos(a, b))
        named.append((cos(a, b), a, b, LABELS[a] == LABELS[b]))

    def summary(name, xs):
        xs = np.array(xs)
        print(f"{name:34s} n={len(xs):3d}  min={xs.min():.3f}  mean={xs.mean():.3f}  max={xs.max():.3f}")

    print()
    summary("same object, different photo", same)
    summary("same category, different object", same_cat)
    summary("different category", other)
    for a, b in SAME_OBJECT:
        print(f"   {a} vs {b}: {cos(a, b):.3f}")
    print("\nMost similar pairs that are NOT the same object:")
    for c, a, b, same_category in sorted(named, reverse=True)[:6]:
        print(f'   {c:.3f}  {a} vs {b}  ({"same category" if same_category else "different category"})')


if __name__ == "__main__":
    main()
