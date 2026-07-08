# Isometric Voxel Art models — 꼬마 도깨비의 모험

Real 3D voxel models for the mini-game, exported as **binary glTF 2.0 (`.glb`)** —
load directly with `THREE.GLTFLoader`. Every model is axis-aligned voxel art with
flat per-face colours, matching the game's pastel palette.

## Files

| Model | File | Role in game |
|-------|------|--------------|
| Dokkaebi (main character) | `char_dokkaebi.glb` | player |
| Pine tree | `tree_pine.glb` | grass obstacle |
| Round tree | `tree_round.glb` | grass obstacle |
| Rock | `rock.glb` | grass obstacle |
| Palanquin (가마) | `palanquin.glb` | road mob |
| Guard (수문장) | `guard.glb` | road mob |
| Turtle (거북) | `turtle.glb` | water stepping-stone mob |
| Eagle (독수리) | `eagle.glb` | aerial hazard |
| Ghost (도깨비불) | `ghost.glb` | hazard |
| Sotteok (소떡소떡) | `item_sotteok.glb` | item |
| Bungeoppang (붕어빵) | `item_bungeoppang.glb` | item |
| Chili (고추) | `item_chili.glb` | item |
| Charm (부적) | `item_charm.glb` | item |
| Grass / Stone / Sand / Water tile | `tile_*.glb` | isometric ground tiles |

Per-model triangle counts, dimensions and file sizes are in **`manifest.json`**.
Isometric preview thumbnails are in **`previews/`**.

## Conventions

- **Y is up.** Models are centred on X/Z and their base sits on **Y = 0**, so a
  model dropped at a lane position rests on the tile surface with no offset.
- **Scale:** `1 voxel = 0.1 world units` (see `manifest.json → unit_world_per_voxel`).
  Ground tiles are exactly `1.0 × 1.0` units — one lane cell (`TILE = 1`).
- **Colours** are baked into vertex colours (`COLOR_0`) with per-face directional
  shading, so the voxels read as 3D under flat/unlit or lit materials alike.
- Meshes are surface-only (internal faces between solid voxels are culled).

## Loading in Three.js

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const loader = new GLTFLoader();
const base = 'https://raw.githubusercontent.com/isabella9402/mini-game/main/voxel_models/';

loader.load(base + 'char_dokkaebi.glb', (gltf) => {
  const model = gltf.scene;
  model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  model.position.set(gridX, 0, -row * TILE);   // base already at y=0
  scene.add(model);
});
```

Vertex colours render out of the box. For the game's brighter, flatter look you
can swap each mesh material to `MeshBasicMaterial({ vertexColors: true })`, or
keep `MeshStandardMaterial` for soft shading with the existing lights.

## Regenerating / editing

Models are defined procedurally in `build_all.py` using the `voxelkit`
toolkit (`voxelkit.py`). Edit a model function and rebuild:

```bash
pip install numpy pygltflib pillow
python3 build_all.py     # writes *.glb, previews/*.png, manifest.json
```

`voxelkit.py` also re-loads each exported `.glb` and renders the preview from the
real file, so the thumbnails double as an export sanity check.
