# Cinematic 3D Katanas — Three Models, Three Acts

Replace the 2D `KatanaSprite` with a real Three.js stage that swaps between three GLB katana models as the user scrolls. Each model gets its own "act" with a different camera language, lighting mood, and user-triggered moment so it feels like a director cut, not a turntable.

## What you need to provide

The three Sketchfab links all require a logged-in download. Lovable can't fetch them automatically. Please download these as **glTF (.glb)** and drop them into chat:

1. `real_katana.glb` — from skfb.ly/o9CXU (REAL Katana by csheffield) → **Act I: Hero / Strike**
2. `katana_b.glb` — from skfb.ly/pJGx6 → **Act II: Feature / Analyze**
3. `katana_c.glb` — from skfb.ly/owwBK → **Act III: Finale / Resting pose**

I'll upload them to the CDN as `.asset.json` pointers and reference them from the Three.js loader. If any has baked animations (FBX-style clips), I'll wire those into the scroll timeline; if not, I'll author camera + transform animations against the static mesh.

## The three acts

### Act I — Hero (model 1, "Strike")
- Section: `HeroSection` + `KeepScrollingSection`
- Fixed full-screen Three.js canvas behind the hero copy
- 0.00–0.20 scroll: katana sheathed, slow dolly-in, ambient steel glint
- 0.20–0.55: unsheathe — blade slides out of saya, camera tracks blade tip
- 0.55–0.80: **strike** — fast diagonal slash, motion blur trail, screen-space red flash, audio cue (optional)
- 0.80–1.00: blade rests, blood-groove highlight, camera settles into hero composition
- Click/tap the blade to replay the strike

### Act II — Feature/Analyze (model 2)
- Section: `FeatureSwordSection`
- Section-scoped canvas, slow orbit (~15s loop)
- Hover/scroll triggers **analyze mode**: katana rotates to broadside, four part-callouts fade in with thin connector lines (kissaki, shinogi, habaki, tsuka) — typography-driven, no UI chrome
- Subtle parallax: pointer moves camera ±3°
- Cinematic key light from upper-left, rim light from behind

### Act III — Finale (model 3)
- Section: `FooterCTASection` (or `ClaritySection` — confirm)
- Katana mounted on a virtual stand, locked-off cinema shot
- Slow breathing camera (±0.5°), volumetric dust motes
- CTA button hover causes a faint blade resonance hum + glint sweep

## Technical plan

**Stack additions**
- `three` + `@react-three/fiber` + `@react-three/drei` (GLTFLoader, useGLTF, Environment, ContactShadows, useScroll-like primitive). Install via `bun add`.
- Reuse existing `useLenisScroll` progress refs — no new scroll lib.

**New files**
- `src/components/landing/katana3d/KatanaStage.tsx` — shared `<Canvas>` wrapper with tone mapping, env lighting, post-processing (bloom + subtle vignette).
- `src/components/landing/katana3d/HeroKatana.tsx` — Act I rig, consumes `heroProgressRef`, animates unsheathe + strike.
- `src/components/landing/katana3d/FeatureKatana.tsx` — Act II rig with analyze callouts.
- `src/components/landing/katana3d/FinaleKatana.tsx` — Act III rig.
- `src/components/landing/katana3d/useScrollRange.ts` — small helper that maps a scroll range → eased local 0–1 per rig.
- `src/assets/landing/katana_hero.glb.asset.json`, `katana_feature.glb.asset.json`, `katana_finale.glb.asset.json` — CDN pointers after I upload your files.

**Files edited**
- `LandingShell.tsx` — remove fixed `KatanaSprite` layer. Mount `HeroKatana` fixed behind hero only (unmounted once `heroProgressRef > 1`). Mount `FeatureKatana` and `FinaleKatana` inside their section wrappers with `IntersectionObserver` so canvases pause when off-screen.
- `FeatureSwordSection.tsx` — add canvas slot + analyze callout overlay.
- `FooterCTASection.tsx` — add canvas slot, wire CTA hover state into katana glint shader uniform.
- `HeroSection.tsx` — remove any leftover sprite references.
- Delete `KatanaSprite.tsx` and the two sprite `.asset.json` pointers.

**Performance**
- Each canvas uses `frameloop="demand"` + `invalidate()` on scroll/hover so we don't burn GPU when idle.
- DRACO/Meshopt decoding on the GLBs (drei `useGLTF.preload`).
- Mobile fallback: if `matchMedia('(max-width: 640px)')` or `prefers-reduced-motion`, skip strike animation, render static hero pose only.
- Sections II + III use `IntersectionObserver` with 50% threshold to mount/unmount canvas.

**Cinematic polish**
- Custom anisotropic env map for steel reflections (`drei <Environment preset="warehouse" />` to start, can swap to a curated HDRI later).
- Soft contact shadows under blade.
- Postprocessing: subtle bloom on blade highlights, film grain in finale only.
- Tone mapping: ACES filmic, exposure ~1.1.

## Open questions before I implement

- Which existing section should host Act III — `FooterCTASection` or `ClaritySection`? (I'll default to footer CTA unless you say otherwise.)
- Audio cue on the strike — yes or no?
- Reduced-motion users: static hero pose, or skip the 3D entirely and fall back to a still render?

Drop the three `.glb` files in chat and confirm the questions above, and I'll build it in one pass.
