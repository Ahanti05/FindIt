"""
Builds the synthetic demo images used by seed.js. Run from the repo root:

    python backend/seed/make_demo_images.py

1. idcard.jpg – a fictional campus ID card rendered from scratch, so no real
   person's ID is ever used.
2. *_reshot.jpg – a second photo of the *same* object, simulating how a finder
   photographs an item differently from its owner (new framing, rotation,
   perspective, lighting and background). These are the "found" photos for the
   demo's true matches; every other photo is an independent picture.
"""

import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

IMAGES = Path(__file__).parent / "images"


def font(size, bold=False):
    names = ["arialbd.ttf", "DejaVuSans-Bold.ttf"] if bold else ["arial.ttf", "DejaVuSans.ttf"]
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def make_id_card() -> Image.Image:
    rnd = random.Random(7)
    w, h = 856, 540  # ISO ID-1 aspect ratio
    card = Image.new("RGB", (w, h), "#ffffff")
    d = ImageDraw.Draw(card)

    d.rectangle([0, 0, w, 120], fill="#1f3a68")
    d.text((36, 26), "FINDIT INSTITUTE OF TECHNOLOGY", font=font(34, True), fill="white")
    d.text((36, 74), "Department of Computer Science Engineering", font=font(22), fill="#c9d6ee")
    d.rectangle([0, 120, w, 132], fill="#e0a526")

    # photo placeholder: neutral silhouette, not a real face
    d.rectangle([36, 160, 236, 410], fill="#d9dee6", outline="#9aa6b8", width=2)
    d.ellipse([96, 190, 176, 270], fill="#9aa6b8")
    d.pieslice([66, 270, 206, 430], 180, 360, fill="#9aa6b8")

    rows = [("Name", "Priya Patel"), ("Roll No.", "21EE045"),
            ("Programme", "B.Tech Electrical"), ("Valid till", "06/2027")]
    for i, (k, v) in enumerate(rows):
        y = 168 + i * 62
        d.text((270, y), k.upper(), font=font(18), fill="#6b778a")
        d.text((270, y + 22), v, font=font(30, True), fill="#132036")

    d.text((36, 430), "STUDENT IDENTITY CARD", font=font(24, True), fill="#1f3a68")
    x = 520
    while x < 820:  # decorative barcode
        bw = rnd.choice([2, 3, 5])
        d.rectangle([x, 440, x + bw, 505], fill="#132036")
        x += bw + rnd.choice([2, 3, 4])
    d.rounded_rectangle([w // 2 - 40, 14, w // 2 + 40, 34], radius=10, fill="#0b1a33")  # lanyard slot

    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=36, fill=255)

    # place on a desk-like background and add a soft shadow
    bg = Image.new("RGB", (1100, 820), "#b48a5a")
    noise = Image.effect_noise((1100, 820), 22).convert("RGB")
    bg = Image.blend(bg, noise, 0.12).filter(ImageFilter.GaussianBlur(1))
    shadow = Image.new("L", (w, h), 0)
    ImageDraw.Draw(shadow).rounded_rectangle([0, 0, w - 1, h - 1], radius=36, fill=140)
    bg.paste((40, 30, 20), (132, 162), shadow.filter(ImageFilter.GaussianBlur(14)))
    bg.paste(card, (122, 140), mask)
    return bg.rotate(-6, resample=Image.BICUBIC, fillcolor="#b48a5a")


def reshoot(img: Image.Image, seed: int, background: str) -> Image.Image:
    """Simulate a second, independent photo of the same physical object."""
    rnd = random.Random(seed)
    w, h = img.size
    # different framing
    cw, ch = int(w * rnd.uniform(0.78, 0.9)), int(h * rnd.uniform(0.78, 0.9))
    x0, y0 = rnd.randint(0, w - cw), rnd.randint(0, h - ch)
    out = img.crop((x0, y0, x0 + cw, y0 + ch))
    if rnd.random() < 0.5:
        out = ImageOps.mirror(out)
    # different camera angle
    out = out.rotate(rnd.uniform(-14, 14), resample=Image.BICUBIC, expand=True, fillcolor=background)
    ow, oh = out.size
    dx, dy = ow * 0.06, oh * 0.06
    coeffs = _perspective_coeffs(
        [(0, 0), (ow, 0), (ow, oh), (0, oh)],
        [(rnd.uniform(0, dx), rnd.uniform(0, dy)), (ow - rnd.uniform(0, dx), rnd.uniform(0, dy)),
         (ow - rnd.uniform(0, dx), oh - rnd.uniform(0, dy)), (rnd.uniform(0, dx), oh - rnd.uniform(0, dy))],
    )
    out = out.transform((ow, oh), Image.PERSPECTIVE, coeffs, Image.BICUBIC, fillcolor=background)
    # different lighting and phone camera
    out = ImageEnhance.Brightness(out).enhance(rnd.uniform(0.8, 1.15))
    out = ImageEnhance.Contrast(out).enhance(rnd.uniform(0.85, 1.15))
    out = ImageEnhance.Color(out).enhance(rnd.uniform(0.85, 1.1))
    out = out.filter(ImageFilter.GaussianBlur(rnd.uniform(0.3, 0.9)))
    out.thumbnail((800, 800))
    return out


def _perspective_coeffs(dst, src):
    import numpy as np
    rows = []
    for (x, y), (u, v) in zip(dst, src):
        rows.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        rows.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    a = np.array(rows, dtype=float)
    b = np.array([c for p in src for c in p], dtype=float)
    return np.linalg.solve(a, b).tolist()


if __name__ == "__main__":
    card = make_id_card()
    card.save(IMAGES / "idcard.jpg", quality=90)

    pairs = {
        "wallet": ("#2f3b45", 11),
        "keys_c": ("#5a5048", 12),
        "idcard": ("#3d4a5c", 13),
        "headphones": ("#e8e4dc", 14),
        "backpack": ("#c8c2b8", 15),
    }
    for name, (background, seed) in pairs.items():
        src = Image.open(IMAGES / f"{name}.jpg").convert("RGB")
        reshoot(src, seed, background).save(IMAGES / f"{name}_reshot.jpg", quality=88)
        print("wrote", f"{name}_reshot.jpg")
