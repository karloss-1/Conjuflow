#!/usr/bin/env python3
"""Create simple PNG PWA icons without external image tooling."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]

for size in (192, 512):
    image = Image.new("RGB", (size, size), "#183a5a")
    draw = ImageDraw.Draw(image)
    margin = round(size * 0.21)
    draw.rounded_rectangle(
        (margin, round(size * 0.28), size - margin, round(size * 0.72)),
        radius=round(size * 0.07), fill="white"
    )
    try:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", round(size * 0.34))
    except OSError:
        font = ImageFont.load_default()
    box = draw.textbbox((0, 0), "C", font=font)
    x = (size - (box[2] - box[0])) / 2
    y = (size - (box[3] - box[1])) / 2 - box[1]
    draw.text((x, y), "C", fill="#183a5a", font=font)
    image.save(ROOT / "icons" / f"icon-{size}.png", optimize=True)
