# World kit (village and marble-run templates)

Asset contract between the Blender author (`scripts/author-world-kit.py`) and the Three.js
runtime. The script is the source of truth: one background Blender run rebuilds
`village-kit.blend` (editable, templates on a review grid), `public/models/world-kit.glb`,
the compact runtime file `public/models/world-kit.json`, `kit-stats.json` and the review sheets
in `output/current/world-3d/` (`kit-review.png` plus three close-ups).

```sh
'/mnt/d/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --threads 2 \
  --python "$(wslpath -w scripts/author-world-kit.py)"
```

## Units, axes, origins

- 1 unit = 1 game unit (the village places stops about 5 units apart on a 20×30 landmass).
- Authoring is Blender Z-up with the front facing -Y. Both exports are Three.js Y-up:
  `three = (blender.x, blender.z, -blender.y)`, so fronts face +z, towards the 3/4 camera.
- Every template stands on y = 0 with its footprint centred on x = z = 0, except
  `mechanism-gear`, whose origin is its axle (half the gear is below y = 0).
- Templates export at the origin with identity rotation and scale. The runtime positions,
  rotates and scales instances. The `.blend` spreads them on a 5.2-unit grid for review.

## Templates and animated parts

| Model | Footprint x × z | Height | Animated part, pivot, axis |
| --- | --- | --- | --- |
| `house-a` | 2.4 × 2.3 | 2.7 | terracotta roof, timber frame, chimney, curved doorstep |
| `house-b` | 2.3 × 2.4 | 3.3 | teal roof, dormer, taller |
| `tree-a` | 1.5 | 2.3 | stacked canopy |
| `mill` | 3.0 × 2.6 | 3.3 | `rotor` at (1.12, 1.05, 0), spin about local z |
| `clock` | 1.8 × 1.8 | 5.4 | `hand` at (0, 3.55, 0.84), spin about local z |
| `greenhouse` | 3.0 × 2.9 | 2.6 | panes on `world-glass`, ribs opaque |
| `bridge` | 4.0 × 1.6 | 1.7 | arch spans x |
| `boat` | 3.0 × 1.3 | 2.3 | bow at +x |
| `glassworks` | 2.6 × 2.0 | 5.4 | glass lantern, copper roof, furnace stack |
| `mechanism-wheel` | 2.6 × 1.1 | 2.1 | `rotor` at (0, 1.05, 0), spin about local z |
| `mechanism-spiral` | 2.0 × 2.0 | 2.9 | static helix of open channel |
| `mechanism-seesaw` | 2.2 × 0.6 | 0.8 | `lever` at (0, 0.62, 0), tilt about local z |
| `mechanism-channel` | 2.0 × 0.5 | 0.5 | straight open U channel along x |
| `mechanism-funnel` | 1.3 × 1.3 | 1.2 | open funnel with a neck hole |
| `mechanism-gear` | 0.984 × 0.984 | 0.600 | origin at the axle, spin about local y; broad plane xz |
| `warehouse` | 3.0 × 1.7 (hoist crate and barrel reach z ≈ +1.9 in front) | 2.3 | quayside store: boarded shed, loading door, hoist beam, crate, barrel |
| `willow` | 2.6 | 2.2 | weeping tree: leaning trunk, domed crown, hanging skirt and fronds |

`mechanism-spiral` and `mill-rotor` are kept in the `.blend` and the GLB but left out of
the packed runtime file (`RUNTIME_RETIRED` in the script): no plan, scene or reward composition
uses the static helix, and the Mill village drives the compiler's own bucket wheel from the
mill's axle bracket. Append `-- --stage <dir>` to write every output under one staging
directory for review before copying it into place.

Wheel and mill rotors have their axle along Three z. `mechanism-gear` is the
exception: its bounds are x/z ±0.492 and y ±0.300, its axle is local y and its
broad plane is xz. Do not rotate it as though it were a wheel rotor. Pivot parts carry their vertices relative to the pivot and no
other transform; the runtime parents them to the template at `pivot`.

## `world-kit.json` (runtime format)

```
{ version: 1, positionScale: 250, normalScale: 127,
  palette: [[linearR, linearG, linearB], ...], paletteNames: [...],
  meshes: [{ name, model, positions: [int...], normals: [int...], colors: [paletteIndex per vertex],
             indices: [...], part?: 'rotor' | 'lever' | 'hand', pivot?: [x, y, z] }] }
```

Positions are `round(x * positionScale)`; geometry is authored on a 4 mm grid so the ints
are small. Normals are flat per face, quantised to ±127. Vertices are shared only when
position, normal and palette index all match, which is what a flat-shaded indexed
`BufferGeometry` needs. One mesh per template plus one per animated part. Glass faces are
in the same mesh with the `glass` palette colour; the GLB keeps them on a second material.

## Materials in the GLB

- `world-solid`: opaque, all colour from `COLOR_0` (sRGB bytes, linear on load). Use the
  runtime's own `MeshStandardMaterial({ vertexColors: true })`.
- `world-glass`: single-sided, backface-culled, alpha 0.45, only on greenhouse and glassworks
  panes.

## Measured sizes

See `kit-stats.json` for the current run. Last run:

| Export | Triangles | Vertices | Raw | Gzip |
| --- | --- | --- | --- | --- |
| `world-kit.json` (contract format) | 10,290 | 21,003 | 627 KB | 115 KB |
| same, positionScale 100 | | 20,979 | 595 KB | 109 KB |
| JSON without normals, flat normals computed on load | | 5,882 | 197 KB | 47 KB |
| `world-kit.glb` | 10,290 | | 711 KB | 114 KB |

These rows are historical format experiments, not the current import policy.
The packed runtime files preserve authored normals and mesh streams exactly;
`scripts/pack-world-models.py` performs the reproducible lossless packing. Do not
replace authored normals with normals reconstructed after merging. The editable
Blender source still contains all fifteen templates and their animated pivots.

The current village, wide valley overview and live 25-second Rube sequence share
these assets and the existing renderer. The rig adds 24,660 triangles in 25 meshes;
the separate merged Workshop hammer sign adds 116 triangles and one draw. Its
static bracket is baked into the village. The sign responds to the route-derived
closest approach without a physical cord; its smaller reduced-motion response
has no overshoot. Current fixed-art compression is 118,577 / 120,000 bytes.
See [the integration notes](../../docs/world-3d.md) for the current build and the
remaining motion/frame-budget checks, rather than treating asset counts as
physical-phone performance.

## Gameplay mechanic insets

The seven PNGs in `public/models/projects/cues/` are crops of real gameplay,
separate from the Blender reward renders. They are 128 px wide for a 64 CSS-pixel
inset, use at most 64 palette colours and total 33,908 bytes. Their provenance,
SHA256 hashes, original capture paths and crop rectangles are recorded in
[`mechanic-insets.json`](mechanic-insets.json). Colour and grayscale originals
remain under `output/current/verify/insets-20261107T103159/probe/`.

The captures used development bank routes for presentation. They do not prove
project gates or wins. The chooser's separate reward and mechanic image layout,
including actual image decoding, is checked by `workshop-projects.spec.ts` at
375×690 and desktop in French grayscale with reduced motion. The paired handle
is used for `board-211`; its sealed-lid alternative stays in the capture evidence.
The recursive 100,000-byte project-image budget includes these seven files.
