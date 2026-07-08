#!/usr/bin/env python3
"""
Seamless top-down ground textures for the K-fantasy mini-game.
All outputs are perfectly tileable 512x512 PNGs, viewed straight top-down (no perspective).
Palette matches the game's pastel lane colours (index (5).html laneColor()).

Technique: tileable fractal *value noise* — a random lattice of size `period`
sampled with wrap-around indexing (i+1 mod period) and smoothstep interpolation.
Because every octave period divides the image size, the result wraps with no seam.
"""
import numpy as np
from PIL import Image, ImageFilter
import os

SIZE = 512
OUT = os.path.join(os.path.dirname(__file__), "out")
os.makedirs(OUT, exist_ok=True)

# deterministic output
RNG = np.random.default_rng(20260708)

# ---------- tileable noise ----------
def _smooth(t):
    return t * t * t * (t * (t * 6 - 15) + 10)   # quintic smoothstep

def tile_value_noise(size, period, rng):
    """One octave of seamless value noise at the given lattice period."""
    lattice = rng.random((period, period)).astype(np.float64)
    # sample coordinates in lattice space
    coords = np.arange(size) * (period / size)
    xi = np.floor(coords).astype(int)
    xf = coords - xi
    xi0 = xi % period
    xi1 = (xi + 1) % period
    sx = _smooth(xf)

    # rows (y) and cols (x) share the same 1-D setup
    Y0, X0 = np.meshgrid(xi0, xi0, indexing='ij')
    Y1, X1 = np.meshgrid(xi1, xi1, indexing='ij')
    SY, SX = np.meshgrid(sx, sx, indexing='ij')

    v00 = lattice[Y0, X0]; v01 = lattice[Y0, X1]
    v10 = lattice[Y1, X0]; v11 = lattice[Y1, X1]
    top = v00 * (1 - SX) + v01 * SX
    bot = v10 * (1 - SX) + v11 * SX
    return top * (1 - SY) + bot * SY

def fbm(size, base_period, octaves, rng, persistence=0.5, lacunarity=2.0):
    """Fractal (multi-octave) seamless noise, normalised to 0..1."""
    total = np.zeros((size, size))
    amp = 1.0
    period = base_period
    norm = 0.0
    for _ in range(octaves):
        p = max(1, int(round(period)))
        total += amp * tile_value_noise(size, p, rng)
        norm += amp
        amp *= persistence
        period *= lacunarity
    total /= norm
    total -= total.min()
    total /= max(1e-9, total.max())
    return total

def hex2rgb(h):
    return np.array([(h >> 16) & 255, (h >> 8) & 255, h & 255], dtype=np.float64)

def save(arr, name):
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")
    path = os.path.join(OUT, name)
    img.save(path)
    print("wrote", path)
    return img

def lerp_color(t, c0, c1):
    """t: HxW in 0..1 -> HxWx3 blending c0->c1."""
    t = t[..., None]
    return c0 * (1 - t) + c1 * t

# ---------- 1. GRASS — pastel green ----------
def grass():
    dark  = hex2rgb(0x8fd384)   # game grass tone A
    light = hex2rgb(0xb6e8a2)   # highlight blades
    deep  = hex2rgb(0x74bd74)   # shadow between blades
    mott  = fbm(SIZE, 8, 5, RNG, persistence=0.55)          # broad colour mottle
    base  = lerp_color(mott, deep, light)

    # fine blade speckle: high-freq noise thresholded into short strokes
    fine  = fbm(SIZE, 64, 4, RNG, persistence=0.6)
    blade = np.clip((fine - 0.5) * 2.2, -1, 1)
    tint  = (light - dark)
    base += blade[..., None] * tint * 0.35

    # sparse brighter grass tufts
    tuft  = fbm(SIZE, 128, 3, RNG, persistence=0.5)
    mask  = np.clip((tuft - 0.72) / 0.12, 0, 1)
    base  = lerp_color(mask * 0.5, base, light)
    img = save(base, "ground_grass.png")
    # slight organic softening (kept tileable via wrap blur below)
    return img

# ---------- 2. STONE SLABS — long grey slabs ----------
def stone():
    base_col = hex2rgb(0xb9b6bf)
    arr = np.zeros((SIZE, SIZE, 3))
    # rock surface grain
    grain = fbm(SIZE, 32, 5, RNG, persistence=0.55)
    surf  = base_col + (grain[..., None] - 0.5) * 26

    row_h = 128                       # 4 rows -> tiles vertically
    slab_w = 256                      # long slabs
    mortar = 6                        # groove width (px)
    mort_col = hex2rgb(0x6f6c78)      # dark joint

    yy, xx = np.meshgrid(np.arange(SIZE), np.arange(SIZE), indexing='ij')
    row = (yy // row_h)
    # offset alternate rows by half a slab (running-bond); wraps because 512 % slab_w == 0
    offset = (row % 2) * (slab_w // 2)
    sx = (xx + offset) % slab_w
    sy = yy % row_h

    # per-slab tone variation (stable id per slab)
    slab_id = (row.astype(np.int64) * 991 + ((xx + offset) // slab_w) * 131)
    tone = (np.sin(slab_id * 12.9898) * 43758.5453)
    tone = (tone - np.floor(tone))                # 0..1 hash
    surf += (tone[..., None] - 0.5) * 22

    # mortar grooves (edges of each slab) — seamless because modular
    edge = (sx < mortar) | (sx > slab_w - mortar) | (sy < mortar) | (sy > row_h - mortar)
    # soft bevel near edges
    dx = np.minimum(sx, slab_w - sx)
    dy = np.minimum(sy, row_h - sy)
    d = np.minimum(dx, dy).astype(np.float64)
    bevel = np.clip(d / 18.0, 0, 1)
    shade = 0.75 + 0.25 * bevel                    # darker toward joints
    surf *= shade[..., None]
    surf = np.where(edge[..., None], mort_col + (grain[..., None]-0.5)*12, surf)
    save(surf, "ground_stone.png")

# ---------- 3. SAND — fine beige earth ----------
def sand():
    base_col = hex2rgb(0xe9d6b4)     # warm beige (matches road tone family)
    dark     = hex2rgb(0xd9c199)
    light    = hex2rgb(0xf4e6c9)
    # very fine grain + broad dunes
    fine  = fbm(SIZE, 128, 5, RNG, persistence=0.62)
    broad = fbm(SIZE, 16, 4, RNG, persistence=0.5)
    t = np.clip(broad * 0.6 + fine * 0.4, 0, 1)
    surf = lerp_color(t, dark, light)

    # subtle wind ripples: tileable sine warped by noise (integer freq -> seamless)
    freq = 6
    warp = fbm(SIZE, 32, 3, RNG) * 2 * np.pi
    xx = np.linspace(0, 2*np.pi*freq, SIZE, endpoint=False)
    ripple = np.sin(xx[None, :] + warp)            # broadcast across rows via warp
    surf += ripple[..., None] * 6

    # sparse tiny pebbles (dark specks)
    speck = fbm(SIZE, 200, 2, RNG)
    pit = np.clip((speck - 0.8) / 0.1, 0, 1)
    surf = lerp_color(pit * 0.4, surf, dark)
    save(surf, "ground_sand.png")

# ---------- 4. CHECKER — grey square stone tiles ----------
def checker():
    a = hex2rgb(0xc3c0cb)   # light grey
    b = hex2rgb(0x9d99a8)   # dark grey
    n = 4                    # 4x4 squares -> 128px each, tiles perfectly
    cell = SIZE // n
    grain = fbm(SIZE, 48, 5, RNG, persistence=0.5)

    yy, xx = np.meshgrid(np.arange(SIZE), np.arange(SIZE), indexing='ij')
    cx = xx // cell
    cy = yy // cell
    chk = ((cx + cy) % 2) == 0
    surf = np.where(chk[..., None], a, b)
    surf = surf + (grain[..., None] - 0.5) * 20    # stone grain per tile

    # groove + bevel between tiles (seamless: modular over cell)
    lx = xx % cell; ly = yy % cell
    dx = np.minimum(lx, cell - lx); dy = np.minimum(ly, cell - ly)
    d = np.minimum(dx, dy).astype(np.float64)
    groove = 5
    joint = hex2rgb(0x6c6976)
    bevel = np.clip(d / 16.0, 0, 1)
    surf *= (0.78 + 0.22 * bevel)[..., None]
    edge = d < groove
    surf = np.where(edge[..., None], joint, surf)
    save(surf, "ground_checker.png")

# ---------- 5. WATER — pastel blue stream ----------
def water():
    deep  = hex2rgb(0x6fb3e8)
    shal  = hex2rgb(0xaddcf5)
    foam  = hex2rgb(0xeaf6ff)
    # layered tileable sine caustics (all integer frequencies -> seamless)
    yy, xx = np.meshgrid(np.linspace(0, 2*np.pi, SIZE, endpoint=False),
                         np.linspace(0, 2*np.pi, SIZE, endpoint=False), indexing='ij')
    warp = fbm(SIZE, 24, 4, RNG) * 1.4
    w = (np.sin(xx*3 + yy*2 + warp*3) +
         np.sin(xx*5 - yy*4 + warp*2) * 0.6 +
         np.sin(xx*2 + yy*7 + warp) * 0.5)
    w = (w - w.min()) / (w.max() - w.min())
    body = lerp_color(w, deep, shal)

    # gentle broad flow mottle
    flow = fbm(SIZE, 8, 3, RNG)
    body = lerp_color(flow * 0.35, body, deep)

    # bright specular ripples where caustics peak
    crest = np.clip((w - 0.82) / 0.1, 0, 1)
    body = lerp_color(crest * 0.7, body, foam)
    save(body, "water_river.png")

if __name__ == "__main__":
    grass(); stone(); sand(); checker(); water()
    print("done")
