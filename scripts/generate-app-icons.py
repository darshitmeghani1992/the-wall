"""Deterministic temporary launch icon, using only Python stdlib (no font/IP asset).

1024px PNG icon and transparent Android adaptive foreground. Geometric card +
pin mark communicate The Wall's product without relying on glyph fonts/emoji.
The final mark/logo remains a Product approval item before App Store release.
"""
from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path

SIZE = 1024
YELLOW = (243, 227, 0)
INK = (30, 29, 27)
PAPER = (251, 249, 244)
ORANGE = (242, 117, 46)
ROOT = Path(__file__).resolve().parent.parent / "assets"


def blend(rgb: tuple[int, int, int], old: tuple[int, int, int, int], strength: float) -> tuple[int, int, int, int]:
    strength = max(0.0, min(1.0, strength))
    existing = old[3] / 255
    result_alpha = strength + existing * (1 - strength)
    if result_alpha < 1e-6:
        return (0, 0, 0, 0)
    value = [round((rgb[i] * strength + old[i] * existing * (1 - strength)) / result_alpha) for i in range(3)]
    return (*value, round(255 * result_alpha))


def card_sdf(x: float, y: float, center_x: float, center_y: float, width: float, height: float, radius: float, radians: float) -> float:
    dx, dy = x - center_x, y - center_y
    cosine, sine = math.cos(radians), math.sin(radians)
    rx, ry = dx * cosine + dy * sine, -dx * sine + dy * cosine
    qx, qy = abs(rx) - width / 2 + radius, abs(ry) - height / 2 + radius
    return math.hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) - radius


def distance_line(px: float, py: float, ax: float, ay: float, bx: float, by: float) -> float:
    vx, vy = bx - ax, by - ay
    t = max(0, min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)))
    return math.hypot(px - (ax + t * vx), py - (ay + t * vy))


def rotation(x: float, y: float, radians: float) -> tuple[float, float]:
    c, s = math.cos(radians), math.sin(radians)
    return (x * c - y * s, x * s + y * c)


def render(transparent: bool) -> bytearray:
    pix = bytearray(SIZE * SIZE * 4)
    front_angle = math.radians(-6)
    pin_x, pin_y = 683, 225
    vertices = [rotation(x, y, front_angle) for x, y in [(-196, -115), (-98, 128), (0, -65), (98, 128), (196, -115)]]
    vertices = [(x + 512, y + 522) for x, y in vertices]
    for y in range(SIZE):
        for x in range(SIZE):
            xx, yy = x + .5, y + .5
            old = (*YELLOW, 255) if not transparent else (0, 0, 0, 0)
            # Back layer of the pinned paper, intentionally not a wall grid.
            d = card_sdf(xx, yy, 527, 528, 660, 665, 89, math.radians(7))
            if d < 1:
                old = blend(INK, old, max(0., min(1., .5 - d)))
            d = card_sdf(xx, yy, 510, 506, 638, 650, 74, front_angle)
            if d < 1:
                old = blend(PAPER, old, max(0., min(1., .5 - d)))
            # Distinct hand-built W icon, not a rendered font character.
            if 200 < xx < 820 and 280 < yy < 785:
                dist = min(distance_line(xx, yy, *a, *b) for a, b in zip(vertices, vertices[1:]))
                if dist < 51:
                    old = blend(INK, old, max(0., min(1., 50.5 - dist)))
            # The single mark's orange pin, with dark outline and a light centre.
            pin = math.hypot(xx - pin_x, yy - pin_y)
            if pin < 49:
                old = blend(INK, old, max(0., min(1., 48.5 - pin)))
            if pin < 36:
                old = blend(ORANGE, old, max(0., min(1., 35.5 - pin)))
            index = (y * SIZE + x) * 4
            pix[index:index + 4] = bytes(old)
    return pix


def chunk(t: bytes, data: bytes) -> bytes:
    return struct.pack('>I', len(data)) + t + data + struct.pack('>I', zlib.crc32(t + data))


def save_png(path: Path, rgba: bytearray) -> None:
    rows = bytearray()
    for y in range(SIZE):
        rows.append(0)
        offset = y * SIZE * 4
        rows.extend(rgba[offset:offset + SIZE * 4])
    path.write_bytes(b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', struct.pack('>IIBBBBB', SIZE, SIZE, 8, 6, 0, 0, 0))
        + chunk(b'IDAT', zlib.compress(rows, 9))
        + chunk(b'IEND', b''))


if __name__ == '__main__':
    ROOT.mkdir(exist_ok=True)
    for filename, alpha in [('icon.png', False), ('adaptive-icon.png', True)]:
        path = ROOT / filename
        save_png(path, render(alpha))
        print(f'{filename}: {path.stat().st_size} bytes, {SIZE}x{SIZE} RGBA')
