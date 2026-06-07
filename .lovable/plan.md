## Goal
Match the reference hero ~95%: a photoreal **3D katana** macro shot filling the right ~65% of the screen, with a tight editorial title block on the left, populated Skill Hub card, and corrected top chrome.

## 1. Add 3D stack
```bash
bun add three @react-three/fiber @react-three/drei
bun add -d @types/three
```

## 2. Source the katana GLB
- Use a CC0/CC-BY katana model (Poly Pizza / Sketchfab CC0 / Quaternius). I'll fetch one via `curl` into `public/models/katana.glb` (kept out of bundle, served as static asset, lazy-loaded).
- If no suitable free model is found at fetch time, fall back to a procedural katana built from primitives in R3F (cylinder tsuka + torus tsuba + box saya with emissive red inner material + thin box blade). Procedural still beats the flat PNG because it has real lighting and depth.

## 3. New component: `src/components/landing/KatanaCanvas.tsx`
- `<Canvas>` absolutely positioned right side, `camera={{ position: [0, 0, 2.2], fov: 28 }}` for a tight macro framing
- Load GLB with `useGLTF`, rotated so tsuka points upper-right, blade exits lower-left of canvas
- Lighting: 1 key directional light (warm), 1 rim light (cool), 1 small red point light **inside the saya cutaway** for the volumetric flame glow
- Emissive red marble material applied to the inner saya geometry (or a red emissive sphere placed inside if the model lacks a cutaway)
- Subtle scroll-driven rotation (~6°) and slow idle bob via `useFrame`
- Lazy-mount with `<Suspense fallback={null}>`; render only after ColdOpen finishes (delay 5s or via prop)
- `dpr={[1, 1.5]}`, `gl={{ antialias: true, alpha: true }}`, `frameloop="demand"` when idle

## 4. Rewrite `HeroSection.tsx`
- Remove `<img src={katanaHero}>`
- Remove the CSS radial flame blob (the red light is now part of the 3D scene)
- Keep `branches_backdrop.png` but lower opacity to ~0.45 and shift left so the 3D katana visually occludes the right side
- Mount `<KatanaCanvas />` absolute, `right-0 top-0 h-full w-[65%]`
- Title block:
  - Shrink to `clamp(48px, 7.5vw, 120px)` (currently 11vw is too large)
  - `leading-[0.92]`, `tracking-[-0.025em]`
  - Position `top-24 left-10`
  - "Built by Fiddle.Digital" inline next to the "Skills" baseline as a tiny `text-[13px]` block (flex row, `items-end`, gap-3) — not stacked below
- Skill Hub card (bottom-left): add a real thumbnail tile inside — generate `src/assets/landing/skill_balance.jpg` (athletic figure, soft warm light, "Balance" label overlay rendered in JSX, not baked in)
- `V_ 1.2.0` stays top-center

## 5. Fix `TopChrome.tsx`
- Replace `Dashboard` / `Console` labels with `Dev Guides` / `Skill Hub`
- Add a small **red rounded katana chip** next to the logo (32×28 rounded-lg, `bg-[#ff3a2a]`, contains a tiny katana glyph) — matches reference TL
- Keep `0%` progress at TR

## 6. Asset cleanup
- `katana_hero.png` becomes unused → delete via `rm`
- Keep `katana_horizontal.png` (still used by `AwakeningSection`)

## Files touched
- **new** `src/components/landing/KatanaCanvas.tsx`
- **new** `public/models/katana.glb` (downloaded) or procedural fallback
- **new** `src/assets/landing/skill_balance.jpg` (generated)
- **edit** `src/components/landing/sections/HeroSection.tsx` (rewrite layout, mount Canvas)
- **edit** `src/components/landing/chrome/TopChrome.tsx` (nav labels, red katana chip)
- **delete** `src/assets/landing/katana_hero.png`

## Out of scope
KeepScrolling, Awakening, Cloud band, Bento, Audience Wheel, Compass, etc. Untouched this turn — we finish Hero first, then move to the next section per your one-by-one plan.

## Risk / notes
- Free GLB katana availability is the only unknown. If the fetched model is low-quality or licensing is unclear, I'll use the procedural R3F fallback so we still get true 3D depth and lighting without a flat PNG. Either way, the result is real 3D, not a regenerated image.
- Bundle impact: ~250KB gz for three+fiber+drei. Acceptable for a landing page.
- No backend / auth / routing changes.

Approve and I'll implement.