## IMPERIUM — Single-Canvas R3F Scroll Experience

Replace landing `/` with one fixed full-viewport `<Canvas>` that never unmounts. All six rooms exist in world space simultaneously; the camera travels through them on a `CatmullRomCurve3` scrubbed by Lenis-driven scroll progress.

### Dependencies to install
`three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `postprocessing`, `lenis`, `gsap`

### Files

**Modified**
- `src/routes/index.tsx` — keep `head()` + Supabase session → CTA wiring; render `<ClientOnly>` wrapping a lazy-loaded `<ImperiumExperience />`.

**Created** (`src/components/imperium/world/`)
- `ImperiumExperience.tsx` — 600vh spacer, fixed `<Canvas dpr={[1, isMobile?1.25:1.75]}>`, mounts `<World/>`, `<CameraRig/>`, `<PostFX/>`, `<HtmlOverlay/>`. Initializes Lenis once and writes `progressRef.current` (0..1) every RAF — no React state, no remounts.
- `useScrollProgress.ts` — exposes a stable `MutableRefObject<number>` consumed inside `useFrame`.
- `CameraRig.tsx` — builds two `CatmullRomCurve3` (`positions[6]`, `targets[6]`) with `catmullrom`/tension `0.5`; each frame: `t = easeInOutCubic(progress)`, `camera.position.copy(posCurve.getPoint(t))`, `camera.lookAt(targetCurve.getPoint(t))`. No OrbitControls.
- `PostFX.tsx` — `<EffectComposer>` with `<Bloom>`, `<DepthOfField>` (desktop only), `<ChromaticAberration>`, `<Noise>`, `<Vignette>`. Per-frame: read progress, compute per-room weights, lerp each effect's uniforms (bloom intensity 0.4→1.8, CA offset 0.0006→0.004, DOF focusDistance, vignette darkness). Crossfade only — no hard cuts.
- `World.tsx` — composes all six rooms at fixed world coordinates along `+X` axis (rooms spaced ~40 units apart), plus shared `<Environment preset="night">` and a single procedural `<Character/>` instanced per room.
- `rooms/RoomIntro.tsx` — black void, fog plane, IMPERIUM wordmark via `<Html transform>`.
- `rooms/RoomRooftop.tsx` — inverted sky sphere with gradient shader, large `PlaneGeometry` ground with custom wet-reflection material (env reflection + normal-map noise), distant city silhouette = instanced boxes, one warm directional light.
- `rooms/RoomStudio.tsx` — black box, `MeshPhysicalMaterial` props `{ transmission: 0.05, iridescence: 0.3, thickness: 0.4, roughness: 0.15 }`, exponential fog via shader plane.
- `rooms/RoomArena.tsx` — 6 stacked `RingGeometry` tiers, two angled emissive plane "light blades", `InstancedMesh` of ~2000 (desktop) / 500 (mobile) point sprites animated with curl-noise in vertex shader.
- `rooms/RoomMemory.tsx` — `BoxGeometry` interior with procedural `fract(p*scale)` cyan grid shader, ~30 floating cube sprites, zero direct lights.
- `rooms/RoomOutro.tsx` — warm amber `fogExp2`, max bloom region, ENTER IMPERIUM CTA via `<Html>` linking to `/dashboard` or `/auth` (Supabase session prop).
- `Character.tsx` — procedural humanoid built from primitives: capsule torso, sphere head, cylinder limbs, all `MeshPhysicalMaterial` `{ iridescence: 1, iridescenceIOR: 1.8, transmission: 0.1, roughness: 0.2, metalness: 0.4 }`. Positioned once per room.
- `HtmlOverlay.tsx` — fixed DOM layer above canvas: top-left `IMPERIUM` + `[SECTION]`, top-center flickering `5.0`, top-right `Sound: Off` · `MENU`, right vertical scroll rail (cyan fill = progress), bottom-left `scroll ▾`, bottom-right `hi@imperium.app` · `Open 2026`, plus per-room bracket text + copy from the current `src/routes/index.tsx`. Section label and per-room copy fade via `framer-motion` reading the same progress ref.
- `shaders/wetGround.ts`, `shaders/grid.ts`, `shaders/fog.ts`, `shaders/sky.ts` — GLSL strings.

### Scroll → room mapping
`[0–.16] intro · [.16–.33] rooftop · [.33–.5] studio · [.5–.66] arena · [.66–.83] memory · [.83–1] outro`. Camera anchors land at center of each room; targets bias slightly forward into the next room for continuous motion.

### Mobile
`matchMedia('(max-width: 768px)')` → disable `<DepthOfField>`, particle count 2000→500, bloom intensity ×0.6, DPR cap 1.25.

### SSR
Entire experience is `ClientOnly` + `React.lazy`. No `window` access at module scope.

### Out of scope
No backend changes. No new routes. No external GLB / HDRI files (procedural + drei built-in `night` preset only). Auth CTA logic preserved.
