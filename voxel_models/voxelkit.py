#!/usr/bin/env python3
"""
voxelkit — a tiny voxel modelling + glTF(.glb) exporter for the mini-game.

Design goals
------------
* Isometric Voxel Art look: axis-aligned cubes, flat per-face colours.
* Real 3D output: binary glTF 2.0 (.glb), loads directly with THREE.GLTFLoader.
* Efficient meshes: internal faces between solid voxels are culled; only the
  visible surface is emitted. Each visible face is a quad with its own vertex
  colour (COLOR_0), so voxels keep crisp flat shading.
* World units: 1 voxel = VOXEL world units (default 0.1). Models are centred on
  X/Z and their base sits on Y=0, so they drop straight onto a lane tile.

The module also loads a .glb back and renders an isometric preview PNG straight
from the exported buffers — that verifies the real file, not just the source.
"""
import json, struct, math, os
import numpy as np

VOXEL = 0.1  # default world size of one voxel

# ---- axis-aligned face definitions: (normal, 4 corner offsets CCW seen from outside) ----
# corners are offsets of the unit cube occupying [x,x+1]x[y,y+1]x[z,z+1]
_FACES = {
    # +X
    ( 1, 0, 0): [(1,0,0),(1,1,0),(1,1,1),(1,0,1)],
    (-1, 0, 0): [(0,0,1),(0,1,1),(0,1,0),(0,0,0)],
    ( 0, 1, 0): [(0,1,0),(0,1,1),(1,1,1),(1,1,0)],   # +Y (top)
    ( 0,-1, 0): [(0,0,0),(1,0,0),(1,0,1),(0,0,1)],   # -Y (bottom)
    ( 0, 0, 1): [(1,0,1),(1,1,1),(0,1,1),(0,0,1)],   # +Z
    ( 0, 0,-1): [(0,0,0),(0,1,0),(1,1,0),(1,0,0)],   # -Z
}
# subtle per-direction shading so flat colours still read as 3D (baked into vertex colour)
_SHADE = {
    ( 0, 1, 0): 1.00,   # top brightest
    ( 1, 0, 0): 0.86,
    (-1, 0, 0): 0.72,
    ( 0, 0, 1): 0.80,
    ( 0, 0,-1): 0.66,
    ( 0,-1, 0): 0.55,   # bottom darkest
}


def hx(h):
    return ((h >> 16) & 255, (h >> 8) & 255, h & 255)


class VoxelModel:
    def __init__(self, name="model"):
        self.name = name
        self.v = {}          # (x,y,z) -> (r,g,b) 0..255

    # ---- modelling primitives ----
    def set(self, x, y, z, color):
        self.v[(int(x), int(y), int(z))] = hx(color) if isinstance(color, int) else tuple(color)

    def box(self, x0, x1, y0, y1, z0, z1, color):
        for x in range(int(x0), int(x1) + 1):
            for y in range(int(y0), int(y1) + 1):
                for z in range(int(z0), int(z1) + 1):
                    self.set(x, y, z, color)

    def mirror_x(self):
        """Mirror everything across x=0 plane (voxel at x -> also -1-x) for symmetry."""
        add = {}
        for (x, y, z), c in self.v.items():
            add[(-1 - x, y, z)] = c
        self.v.update(add)

    # ---- info ----
    def bounds(self):
        xs = [k[0] for k in self.v]; ys = [k[1] for k in self.v]; zs = [k[2] for k in self.v]
        return (min(xs), max(xs), min(ys), max(ys), min(zs), max(zs))

    # ---- meshing (surface only) ----
    def build_mesh(self, unit=VOXEL):
        if not self.v:
            raise ValueError("empty model " + self.name)
        x0, x1, y0, y1, z0, z1 = self.bounds()
        cx = (x0 + x1 + 1) / 2.0      # centre on X
        cz = (z0 + z1 + 1) / 2.0      # centre on Z
        by = y0                        # base to Y=0

        pos, nrm, col, idx = [], [], [], []
        occ = self.v
        for (x, y, z), c in occ.items():
            base = (c[0] / 255.0, c[1] / 255.0, c[2] / 255.0)
            for n, corners in _FACES.items():
                nb = (x + n[0], y + n[1], z + n[2])
                if nb in occ:
                    continue  # cull internal face
                s = _SHADE[n]
                fc = (base[0] * s, base[1] * s, base[2] * s)
                start = len(pos)
                for cxr in corners:
                    wx = (x + cxr[0] - cx) * unit
                    wy = (y + cxr[1] - by) * unit
                    wz = (z + cxr[2] - cz) * unit
                    pos.append((wx, wy, wz))
                    nrm.append(n)
                    col.append((fc[0], fc[1], fc[2], 1.0))
                idx += [start, start + 1, start + 2, start, start + 2, start + 3]
        return (np.array(pos, np.float32), np.array(nrm, np.float32),
                np.array(col, np.float32), np.array(idx, np.uint32))

    # ---- export ----
    def export_glb(self, path, unit=VOXEL):
        pos, nrm, col, idx = self.build_mesh(unit)
        _write_glb(path, pos, nrm, col, idx, self.name)
        return len(idx) // 3


# ------------------------------------------------------------------ GLB writer
def _pad(b, val=b'\x00'):
    while len(b) % 4:
        b += val
    return b


def _write_glb(path, pos, nrm, col, idx, name):
    # concatenate binary buffer: pos | nrm | col | idx  (each 4-byte aligned)
    parts, views, offset = [], [], 0

    def add(arr, target=None):
        nonlocal offset
        raw = arr.tobytes()
        raw = _pad(raw)
        views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(arr.tobytes())})
        if target:
            views[-1]["target"] = target
        parts.append(raw)
        offset += len(raw)
        return len(views) - 1

    ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER = 34962, 34963
    v_pos = add(pos, ARRAY_BUFFER)
    v_nrm = add(nrm, ARRAY_BUFFER)
    v_col = add(col, ARRAY_BUFFER)
    v_idx = add(idx, ELEMENT_ARRAY_BUFFER)
    bin_blob = b"".join(parts)

    accessors = [
        {"bufferView": v_pos, "componentType": 5126, "count": len(pos), "type": "VEC3",
         "min": pos.min(axis=0).tolist(), "max": pos.max(axis=0).tolist()},
        {"bufferView": v_nrm, "componentType": 5126, "count": len(nrm), "type": "VEC3"},
        {"bufferView": v_col, "componentType": 5126, "count": len(col), "type": "VEC4"},
        {"bufferView": v_idx, "componentType": 5125, "count": len(idx), "type": "SCALAR"},
    ]
    gltf = {
        "asset": {"version": "2.0", "generator": "voxelkit"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": name}],
        "meshes": [{"name": name, "primitives": [{
            "attributes": {"POSITION": 0, "NORMAL": 1, "COLOR_0": 2},
            "indices": 3, "material": 0}]}],
        "materials": [{
            "name": "voxel",
            "pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 1],
                                     "metallicFactor": 0.0, "roughnessFactor": 0.95},
            "doubleSided": False}],
        "accessors": accessors,
        "bufferViews": views,
        "buffers": [{"byteLength": len(bin_blob)}],
    }
    json_blob = _pad(json.dumps(gltf, separators=(",", ":")).encode("utf-8"), b" ")

    total = 12 + 8 + len(json_blob) + 8 + len(bin_blob)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))            # header
        f.write(struct.pack("<II", len(json_blob), 0x4E4F534A))       # JSON chunk
        f.write(json_blob)
        f.write(struct.pack("<II", len(bin_blob), 0x004E4942))        # BIN chunk
        f.write(bin_blob)


# ------------------------------------------------------------------ GLB reader + preview
def _read_glb(path):
    with open(path, "rb") as f:
        data = f.read()
    magic, ver, total = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67 and ver == 2, "not a glb v2"
    off = 12
    jlen, jtype = struct.unpack_from("<II", data, off); off += 8
    gltf = json.loads(data[off:off + jlen]); off += jlen
    blen, btype = struct.unpack_from("<II", data, off); off += 8
    blob = data[off:off + blen]
    return gltf, blob


def _accessor_array(gltf, blob, acc_i):
    acc = gltf["accessors"][acc_i]
    bv = gltf["bufferViews"][acc["bufferView"]]
    start = bv.get("byteOffset", 0)
    ncomp = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[acc["type"]]
    dt = {5125: np.uint32, 5126: np.float32, 5123: np.uint16}[acc["componentType"]]
    count = acc["count"] * ncomp
    arr = np.frombuffer(blob, dt, count=count, offset=start)
    return arr.reshape(-1, ncomp) if ncomp > 1 else arr


def render_iso(path, out_png, size=256, angle=35.264, yaw=45.0, bg=(0, 0, 0, 0)):
    """Load the *exported* glb and paint a true-isometric preview (painter's alg)."""
    from PIL import Image, ImageDraw
    gltf, blob = _read_glb(path)
    prim = gltf["meshes"][0]["primitives"][0]
    pos = _accessor_array(gltf, blob, prim["attributes"]["POSITION"]).astype(float)
    col = _accessor_array(gltf, blob, prim["attributes"]["COLOR_0"]).astype(float)
    idx = _accessor_array(gltf, blob, prim["indices"]).astype(int)

    # rotate: yaw around Y then tilt around X (isometric)
    ry = math.radians(yaw); rx = math.radians(angle)
    cy, sy = math.cos(ry), math.sin(ry); cxx, sxx = math.cos(rx), math.sin(rx)
    p = pos.copy()
    x, y, z = p[:, 0], p[:, 1], p[:, 2]
    x2 = cy * x + sy * z
    z2 = -sy * x + cy * z
    y3 = cxx * y - sxx * z2
    z3 = sxx * y + cxx * z2
    sx = x2; sy_ = y3; depth = z3

    # fit to canvas
    pad = size * 0.08
    minx, maxx = sx.min(), sx.max(); miny, maxy = sy_.min(), sy_.max()
    span = max(maxx - minx, maxy - miny) or 1
    scale = (size - 2 * pad) / span
    px = pad + (sx - minx) * scale
    py = pad + (maxy - sy_) * scale   # flip Y for image space

    img = Image.new("RGBA", (size, size), bg)
    d = ImageDraw.Draw(img)
    tris = idx.reshape(-1, 3)
    tri_depth = depth[tris].mean(axis=1)
    order = np.argsort(tri_depth)      # far -> near
    for t in tris[order]:
        poly = [(px[t[0]], py[t[0]]), (px[t[1]], py[t[1]]), (px[t[2]], py[t[2]])]
        c = col[t[0]]
        d.polygon(poly, fill=(int(c[0] * 255), int(c[1] * 255), int(c[2] * 255), 255))
    img.save(out_png)
    return img
