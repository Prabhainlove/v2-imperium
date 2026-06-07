## Why the current katana looks cheap

The current `KatanaCanvas.tsx` builds the sword from raw Three.js primitives:
- Blade = a flat `boxGeometry`
- Saya / tsuka / fuchi / kashira = bare `cylinderGeometry`
- Ito wrap = rotated `planeGeometry` squares
- Hamon, flame, kanji = flat `planeGeometry` with solid colors

These shapes have no real geometry, no UV-mapped textures, no painted saya art, no woven ito, no curvature on the blade. That is the cap — procedural primitives will never look like your reference image. The fix is to load a real katana 3D model (GLB) with PBR textures.

## Plan

### 1. Source the model
- Find a free CC0 / CC-BY katana GLB (Sketchfab, Poly Pizza, Quaternius). Target: stylized anime/Demon-Slayer-style katana with painted saya, ito wrap, gold tsuba — matching your reference image. Backup: if no suitable free model surfaces, ask you to upload a `.glb` (you confirmed this path is OK).
- Upload via `lovable-assets create` so the GLB is served from CDN, not committed to repo.

### 2. Rewrite `KatanaCanvas.tsx`
- Delete the entire procedural `<Katana>` component (every box/cylinder/plane).
- Replace with a `<KatanaModel>` that uses drei's `useGLTF(modelUrl)` and renders the loaded scene.
- Split the loaded scene into two refs at load time: `bladeGroup` (everything with "blade"/"katana_blade" in the node name) and `sayaGroup` (everything with "saya"/"sheath"). These two groups are what slide apart on unsheathe.
- Keep the existing scroll timeline math (`range`, `ease`, `lerp`) and the `Rig` camera dolly — only the geometry source changes.
- Lighting: keep the warm key + cool fill + ambient, add `Environment preset="warehouse"` (better metal reflections than "studio" for a katana), and an `<AccumulativeShadows>` ground catcher so it doesn't float.
- Use `<Suspense fallback={null}>` so the rest of the page renders while the GLB downloads. Add `useGLTF.preload(modelUrl)` at module scope.

### 3. Use your reference image
- Save your uploaded katana reference as the Hero's mood backdrop (low opacity, behind the canvas, sepia-tinted like the existing `branches_backdrop`) so the painted-saya/flame art bleeds through visually even before the model loads. Upload via `lovable-assets`.

### 4. Scroll animation (unchanged behavior, real geometry)
- `p 0.00–0.15`: macro close-up of the tsuba area, sheathed
- `p 0.15–0.45`: camera dollies back, group rotates to horizontal
- `p 0.40–0.85`: `bladeGroup.position.x` lerps +1.9, `sayaGroup.position.x` lerps −0.45 → blade pulls out
- `p 0.55–0.80`: a red emissive `pointLight` inside the saya fades from 3 → 0 (keeps the "flame core" beat from your reference without faking it with a plane)

### 5. Files touched
- `src/components/landing/KatanaCanvas.tsx` — rewrite
- `src/assets/katana.glb.asset.json` — new (CDN pointer)
- `src/assets/katana_reference.png.asset.json` — new (CDN pointer for your uploaded image, used as Hero backdrop)
- `src/components/landing/sections/HeroSection.tsx` — swap backdrop image source
- No changes to `useLenisScroll.ts`, `LandingShell.tsx`, or `KeepScrollingSection.tsx`

### 6. Dependencies
Already installed: `three`, `@react-three/fiber`, `@react-three/drei`. No new packages needed — `useGLTF`, `Environment`, `AccumulativeShadows` all ship with drei.

### Risks / honest caveats
- Free CC0 katana models vary a lot in quality. If I can't find a stylized anime-style one that matches your red-flame-saya reference, the realistic outcome is: I wire in a decent generic katana GLB now, and you provide a custom `.glb` later for an exact match. I will tell you which model I picked and link the source so you can swap it.
- A real GLB is typically 1–5 MB. It loads async — first paint shows the page without the sword, then it pops in. We mitigate with `useGLTF.preload` + the reference-image backdrop so the hero never looks empty.
