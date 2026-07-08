# PMJ 3D Models (GLTF / GLB)

Place one `.glb` file per product in this folder.

## Naming convention

```
assets/models/{PRODUCT_ID}.glb
```

Example:
```
assets/models/SPND998476.glb
assets/models/SBNG1030085.glb
```

## Product config (optional overrides in js/products.js)

```javascript
{
  id: 'SPND998476',
  model: 'assets/models/SPND998476.glb',  // optional — auto-detected by ID
  modelScale: 1.2,                         // optional size multiplier
  modelRotation: [0, Math.PI / 4, 0],      // optional radians [x,y,z]
  ...
}
```

## How to create models

1. Photogrammetry or CAD export from your jewellery design software
2. Export as **GLB** (binary glTF, single file)
3. Keep file size under ~5 MB per piece for fast web loading
4. Centre the model at origin; the loader auto-scales to fit

## Fallback behaviour

If no `.glb` is found:
- **Photo billboard** — uses product hero image on a 3D plane with gold frame
- **Procedural mesh** — category-aware gold placeholder (necklace, ring, earring, bangle)

## Recommended tools

- [Blender](https://www.blender.org) — export glTF 2.0 (.glb)
- [Sketchfab](https://sketchfab.com) — download / embed GLB assets
- [gltf.report](https://gltf.report) — validate and compress models

## Draco compression (optional)

For large models, enable Draco compression in Blender export and add DRACOLoader to index.html.
