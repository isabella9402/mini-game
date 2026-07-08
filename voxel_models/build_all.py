#!/usr/bin/env python3
"""
Build the full set of Isometric Voxel Art models for the K-fantasy mini-game
(꼬마 도깨비의 모험). Outputs binary glTF (.glb) — ready for THREE.GLTFLoader.

Convention: Y is up. Voxel coords are integers; models are centred on X/Z and
based on Y=0 by the exporter. Palette follows the game's pastel tone.
Run:  python3 build_all.py   ->  writes *.glb + previews/*.png + manifest.json
"""
import os, json
from voxelkit import VoxelModel, VOXEL, render_iso

HERE = os.path.dirname(os.path.abspath(__file__))
PREV = os.path.join(HERE, "previews")
os.makedirs(PREV, exist_ok=True)

# ---------------- palette ----------------
INK    = 0x4b3b57   # outline / eyes (dark plum, from game --ink)
WHITE  = 0xfff6f0
BLUSH  = 0xff9aa2
# dokkaebi
DOKBLU = 0x8fb8f0; DOKBLU_D = 0x6f97d6
HORN   = 0xffe08a; HORN_D = 0xe0b45a
CLOTH  = 0xff8f88   # hanbok top (peach)
CLOTH2 = 0x7fcbb0   # hanbok skirt (mint)
# nature
LEAF   = 0x8fd384; LEAF_D = 0x6fb36a; LEAF_L = 0xb6e8a2
TRUNK  = 0xb98a5a; TRUNK_D = 0x8a5a2b
STONE  = 0xb9b6bf; STONE_D = 0x8f8c98; STONE_L = 0xd3d0da
# palanquin / guard
WOOD   = 0xc9a06a; WOOD_D = 0x9a6a3c; ROOF = 0xff8f88; ROOFTOP = 0xe5484d
GOLD   = 0xffd36e
GUARD_ROBE = 0x7fb0e8; GUARD_ROBE_D = 0x5f8fc8; SKIN = 0xffd9b8; HAT = 0x333042
# turtle
SHELL  = 0x6fb36a; SHELL_D = 0x4f8f52; TSKIN = 0x9edd93
# eagle
FEATH  = 0x9a6a3c; FEATH_D = 0x6f4a24; BEAK = 0xffd36e; WHITEF = 0xf3ece0
# ghost
GHOST  = 0xd3b8f0; GHOST_D = 0xb794e0; FIRE = 0x8ad0ff
# items
SAUS   = 0xd98a54; TTEOK = 0xfff2f6; SKEWER = 0xb98a5a       # 소떡소떡
FISH   = 0xe8b96a; FISH_D = 0xc99548                          # 붕어빵
CHILI  = 0xe5484d; CHILI_D = 0xb83338; CH_STEM = 0x5fae74     # 고추
CHARM  = 0xf7e14a; CHARM_INK = 0xd23b3b                       # 부적
# tiles
T_GRASS = 0x8fd384; T_GRASS2 = 0x9edd93; T_GRASSD = 0x6fb36a
T_STONE = 0xb9b6bf; T_STONE2 = 0xc7c4ce
T_SAND  = 0xe9d6b4; T_SAND2 = 0xf0e2c4
T_WATER = 0x8fcdf0; T_WATER2 = 0xaddcf5; T_WATER_D = 0x6fb3e8


def eyes(m, y, z, x_out=3, color=INK, blush=True):
    for sx in (-x_out, x_out - 1):
        m.set(sx, y, z, color)
    if blush:
        for sx in (-x_out - 1, x_out):
            m.set(sx, y - 1, z - 0, BLUSH)


# ============================================================ CHARACTER
def char_dokkaebi():
    m = VoxelModel("char_dokkaebi")
    # legs
    m.box(-3, -1, 0, 2, -1, 1, DOKBLU_D)
    m.box(0, 2, 0, 2, -1, 1, DOKBLU_D)
    # body (hanbok: mint skirt + peach top)
    m.box(-3, 2, 3, 4, -2, 2, CLOTH2)      # skirt
    m.box(-3, 2, 5, 7, -2, 2, CLOTH)       # jeogori top
    m.set(-1, 7, 3, GOLD); m.set(0, 7, 3, GOLD)   # collar knot
    # arms
    m.box(-4, -4, 4, 6, -1, 1, CLOTH)
    m.box(3, 3, 4, 6, -1, 1, CLOTH)
    m.set(-4, 3, 0, DOKBLU); m.set(3, 3, 0, DOKBLU)  # hands
    # head (round blue dokkaebi)
    m.box(-3, 2, 8, 12, -2, 2, DOKBLU)
    m.box(-2, 1, 13, 13, -1, 1, DOKBLU)    # crown rounding
    # face
    m.set(-2, 10, 3, INK); m.set(1, 10, 3, INK)     # eyes
    m.set(-3, 9, 3, BLUSH); m.set(2, 9, 3, BLUSH)   # blush
    m.set(-1, 9, 3, INK); m.set(0, 9, 3, INK)       # smile
    # horns
    for hx0 in (-3, 2):
        m.set(hx0, 13, -1, HORN); m.set(hx0, 14, -1, HORN); m.set(hx0, 15, 0, HORN_D)
    return m


# ============================================================ TREES
def tree_pine():
    m = VoxelModel("tree_pine")
    m.box(-1, 0, 0, 4, -1, 0, TRUNK_D)
    # stacked cones
    m.box(-3, 2, 4, 6, -3, 2, LEAF_D)
    m.box(-2, 1, 7, 8, -2, 1, LEAF)
    m.box(-1, 0, 9, 10, -1, 0, LEAF_L)
    m.set(-1, 11, 0, LEAF_L); m.set(0, 11, 0, LEAF_L)
    return m


def tree_round():
    m = VoxelModel("tree_round")
    m.box(-1, 0, 0, 3, -1, 0, TRUNK)
    m.box(-3, 2, 4, 8, -3, 2, LEAF)
    m.box(-4, -4, 5, 7, -2, 1, LEAF_D)
    m.box(3, 3, 5, 7, -2, 1, LEAF_D)
    m.box(-2, 1, 9, 9, -2, 1, LEAF_L)
    # highlights
    m.box(-2, 0, 7, 8, -3, -3, LEAF_L)
    return m


def rock():
    m = VoxelModel("rock")
    m.box(-3, 2, 0, 2, -2, 2, STONE_D)
    m.box(-2, 1, 3, 3, -2, 1, STONE)
    m.box(-1, 1, 4, 4, -1, 0, STONE_L)
    m.set(-2, 3, 2, STONE_L); m.set(1, 2, -2, STONE_L)
    m.box(2, 3, 0, 1, 0, 1, STONE)   # small side chunk
    return m


# ============================================================ PALANQUIN (가마)
def palanquin():
    m = VoxelModel("palanquin")
    # carry poles
    m.box(-5, 4, 3, 3, -3, -3, WOOD_D)
    m.box(-5, 4, 3, 3, 2, 2, WOOD_D)
    # cabin
    m.box(-3, 2, 2, 6, -2, 1, WOOD)
    m.box(-3, 2, 2, 6, -3, -3, ROOF)   # front/back curtains (peach)
    m.box(-3, 2, 2, 6, 2, 2, ROOF)
    m.box(-3, -3, 2, 6, -2, 1, WOOD_D)
    m.box(2, 2, 2, 6, -2, 1, WOOD_D)
    # window
    m.box(-1, 0, 4, 5, -3, -3, GOLD)
    # curved roof
    m.box(-4, 3, 7, 7, -3, 2, ROOFTOP)
    m.box(-3, 2, 8, 8, -2, 1, ROOFTOP)
    m.set(-1, 9, 0, GOLD); m.set(0, 9, 0, GOLD)   # finial
    return m


# ============================================================ GUARD (수문장)
def guard():
    m = VoxelModel("guard")
    m.box(-2, 1, 0, 2, -1, 1, INK)             # boots/legs
    m.box(-3, 2, 3, 8, -2, 2, GUARD_ROBE)      # robe
    m.box(-3, 2, 3, 4, -2, 2, GUARD_ROBE_D)    # hem shadow
    m.set(-1, 6, 3, GOLD); m.set(0, 6, 3, GOLD)  # sash
    m.box(-4, -4, 5, 8, -1, 1, GUARD_ROBE); m.box(3, 3, 5, 8, -1, 1, GUARD_ROBE)  # arms
    m.set(-4, 4, 0, SKIN); m.set(3, 4, 0, SKIN)
    # spear in right hand
    m.box(4, 4, 2, 12, 0, 0, TRUNK_D); m.set(4, 13, 0, STONE_L); m.set(4, 14, 0, STONE_L)
    # head
    m.box(-2, 1, 9, 12, -2, 2, SKIN)
    m.set(-1, 11, 3, INK); m.set(0, 11, 3, INK)
    # gat (traditional hat)
    m.box(-3, 2, 13, 13, -3, 2, HAT)
    m.box(-1, 0, 14, 15, -1, 0, HAT)
    return m


# ============================================================ TURTLE (거북)
def turtle():
    m = VoxelModel("turtle")
    # shell dome
    m.box(-3, 2, 1, 2, -3, 2, SHELL)
    m.box(-2, 1, 3, 3, -2, 1, SHELL_D)
    m.set(-1, 4, 0, SHELL_D); m.set(0, 4, 0, SHELL_D)
    # shell pattern highlights
    m.set(-2, 3, -1, SHELL_D); m.set(1, 3, 1, SHELL_D); m.set(-1, 2, 2, SHELL_D)
    # belly / feet
    m.box(-3, 2, 0, 0, -3, 2, TSKIN)
    for fx, fz in [(-3, -3), (2, -3), (-3, 2), (2, 2)]:
        m.set(fx, 0, fz, TSKIN)
    # head
    m.box(-1, 0, 1, 2, 3, 4, TSKIN)
    m.set(-1, 2, 4, INK); m.set(0, 2, 4, INK)
    # tail
    m.set(-1, 1, -4, TSKIN); m.set(0, 1, -4, TSKIN)
    return m


# ============================================================ EAGLE (독수리)
def eagle():
    m = VoxelModel("eagle")
    # body
    m.box(-1, 0, 3, 6, -2, 2, FEATH)
    m.box(-1, 0, 2, 3, -1, 3, WHITEF)     # chest
    # head
    m.box(-1, 0, 7, 9, -1, 1, WHITEF)
    m.set(-1, 8, 2, INK); m.set(0, 8, 2, INK)
    m.set(-1, 7, 3, BEAK); m.set(0, 7, 3, BEAK)   # beak
    # spread wings
    m.box(-6, -2, 5, 6, 0, 0, FEATH_D)
    m.box(1, 5, 5, 6, 0, 0, FEATH_D)
    m.box(-8, -7, 4, 5, 0, 0, FEATH)
    m.box(6, 7, 4, 5, 0, 0, FEATH)
    # tail
    m.box(-1, 0, 2, 3, -4, -3, FEATH_D)
    # talons
    m.set(-1, 2, 1, BEAK); m.set(0, 2, 1, BEAK)
    return m


# ============================================================ GHOST (도깨비불/귀신)
def ghost():
    m = VoxelModel("ghost")
    m.box(-2, 1, 3, 7, -2, 2, GHOST)
    m.box(-2, 1, 8, 9, -1, 1, GHOST)      # rounded top
    # wispy tail
    m.box(-2, 1, 1, 2, -1, 1, GHOST_D)
    m.set(-2, 0, 0, GHOST_D); m.set(1, 0, 0, GHOST_D)
    # face
    m.set(-1, 6, 3, INK); m.set(0, 6, 3, INK)
    m.set(-2, 5, 3, FIRE); m.set(1, 5, 3, FIRE)  # cheek flames
    # floating flame tuft on top
    m.set(-1, 10, 0, FIRE); m.set(0, 11, 0, FIRE)
    return m


# ============================================================ ITEMS
def item_sotteok():   # 소떡소떡 (sausage + rice-cake skewer)
    m = VoxelModel("item_sotteok")
    m.box(0, 0, 0, 9, 0, 0, SKEWER)       # stick
    order = [SAUS, TTEOK, SAUS, TTEOK]
    y = 2
    for c in order:
        m.box(-1, 1, y, y + 1, -1, 1, c)
        y += 2
    return m


def item_bungeoppang():  # 붕어빵 (fish-shaped pastry)
    m = VoxelModel("item_bungeoppang")
    m.box(-4, 3, 1, 4, -1, 1, FISH)
    m.box(-4, -3, 2, 3, -1, 1, FISH_D)    # head end
    m.box(4, 5, 2, 3, 0, 0, FISH_D)       # tail fin
    m.set(-1, 3, 2, FISH_D); m.set(0, 3, 2, FISH_D)  # scale lines
    m.set(-4, 3, 2, INK)                   # eye
    return m


def item_chili():   # 고추
    m = VoxelModel("item_chili")
    m.box(0, 0, 0, 6, 0, 0, CHILI)
    m.box(-1, 1, 1, 5, -1, 1, CHILI)
    m.box(-1, 1, 4, 5, -1, 1, CHILI_D)    # shadow side
    m.set(0, 7, 0, CH_STEM); m.set(0, 8, 0, CH_STEM)  # stem
    m.set(-1, 3, -1, WHITE)                # highlight
    return m


def item_charm():   # 부적 (amulet talisman)
    m = VoxelModel("item_charm")
    m.box(-2, 1, 0, 9, 0, 0, CHARM)       # yellow paper
    # painted red marks
    m.set(-1, 7, 1, CHARM_INK); m.set(0, 7, 1, CHARM_INK)
    m.set(0, 5, 1, CHARM_INK); m.set(-1, 3, 1, CHARM_INK); m.set(0, 3, 1, CHARM_INK)
    m.set(0, 2, 1, CHARM_INK)
    return m


# ============================================================ GROUND TILES (isometric voxel)
def _tile(name, top, top2, side, thickness=2, water=False):
    m = VoxelModel(name)
    S = 10   # 10x10 voxels -> 1.0 world unit wide at VOXEL=0.1 == one lane tile
    for x in range(-S // 2, S // 2):
        for z in range(-S // 2, S // 2):
            for y in range(0, thickness):
                c = side if y < thickness - 1 else (top if (x + z) % 2 == 0 else top2)
                m.set(x, y, z, c)
    if water:
        # a couple of raised ripple voxels
        for (x, z) in [(-3, -2), (1, 2), (3, -3), (-2, 3)]:
            m.set(x, thickness, z, T_WATER2)
    return m


def tile_grass(): return _tile("tile_grass", T_GRASS, T_GRASS2, T_GRASSD)
def tile_stone(): return _tile("tile_stone", T_STONE, T_STONE2, STONE_D)
def tile_sand():  return _tile("tile_sand", T_SAND, T_SAND2, WOOD_D)
def tile_water(): return _tile("tile_water", T_WATER, T_WATER2, T_WATER_D, water=True)


# ============================================================ BUILD
MODELS = [
    char_dokkaebi, tree_pine, tree_round, rock, palanquin, guard, turtle,
    eagle, ghost, item_sotteok, item_bungeoppang, item_chili, item_charm,
    tile_grass, tile_stone, tile_sand, tile_water,
]

if __name__ == "__main__":
    manifest = []
    for fn in MODELS:
        m = fn()
        glb = os.path.join(HERE, m.name + ".glb")
        tris = m.export_glb(glb)
        b = m.bounds()
        dims = [(b[1] - b[0] + 1), (b[3] - b[2] + 1), (b[5] - b[4] + 1)]
        render_iso(glb, os.path.join(PREV, m.name + ".png"))
        size_kb = round(os.path.getsize(glb) / 1024, 1)
        manifest.append({"name": m.name, "file": m.name + ".glb", "tris": tris,
                         "voxel_dims_xyz": dims,
                         "world_size_xyz": [round(d * VOXEL, 3) for d in dims],
                         "kb": size_kb})
        print(f"{m.name:18s} tris={tris:5d} dims={dims} {size_kb}KB")
    with open(os.path.join(HERE, "manifest.json"), "w") as f:
        json.dump({"unit_world_per_voxel": VOXEL, "models": manifest}, f, indent=2)
    print("\nmanifest.json written;", len(MODELS), "models")
