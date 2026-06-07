## What the reference video actually does (frame by frame)

- **0–15% scroll** — macro close-up: tsuba + saya cutaway fill ~70% of the screen, sheathed. Title "Master / Your / Skills" sits top-left, "Skill Hub" thumbnail bottom-left. Katana is **static** here; just gentle idle.
- **15–40%** — **camera dollies back + rotates**. The katana shrinks from "macro fill" to a "full-weapon shot" angled ~10° tilt. Title + Skill Hub fade out. Big "StringTune©" word appears center, katana is now small and horizontal across the screen, blade still sheathed.
- **40–70%** — **unsheathe begins**. The blade slides out of the saya to the right while the saya stays/drifts left. Camera rotates further so the weapon is near-horizontal. "Concentrate" text crossfades in.
- **70–100%** — fully unsheathed: bare blade fully separated from saya, both horizontal, "Keep Scrolling" text behind them. AIKA companion swaps to Oji sprite.

My current build is **static** — no camera move, no unsheathe, no separation. That's the gap.

## Implementation plan

### 1. Make `KatanaCanvas` scroll-driven
- Already accepts `progressRef`. Wire it to a **page-level scroll progress** (0 → 1 across the combined Hero + KeepScrolling sticky stage), not just the hero's local progress.
- Split the katana group into two named sub-groups: `sayaGroup` (saya + cutaway + koiguchi + fuchi + tsuba) and `bladeGroup` (new — thin reflective steel blade extending from tsuka through where the saya was).
- New `useFrame` timeline based on `p = progressRef.current`:
  - **Camera dolly**: `camera.position.z` lerps `2.6 → 5.2` over `p ∈ [0.05, 0.45]`, then `5.2 → 4.6` over `[0.45, 1]`. `camera.position.y` slight `0 → 0.2`.
  - **Group rotation**: whole katana `rotation.z` lerps `-0.05 → -0.35 → 0` (tilts down then levels horizontal); `rotation.y` `0.15 → 0` (turns to face camera flat).
  - **Group position**: lerps from `[0.3, -0.1, 0]` (offset right macro) to `[0, 0, 0]` (centered).
  - **Unsheathe**: `bladeGroup.position.x` lerps `0 → +1.8` over `p ∈ [0.4, 0.85]` (blade slides out right); `sayaGroup.position.x` lerps `0 → -0.4` over same range (slight recoil left).
  - **Flame fade**: red emissive plane + point light intensity ramp `2.4 → 0` over `[0.55, 0.8]` (no flame once unsheathed).
- Add a real blade mesh: long thin `boxGeometry` ~3.2×0.06×0.02, `meshPhysicalMaterial` (metalness 1, roughness 0.1, clearcoat 1, color `#e8eef2`), with subtle curve via slight rotation. Add `hamon` (temper line) via a second thinner emissive-ish strip.

### 2. Restructure the Hero + KeepScrolling stage
- Lift `KatanaCanvas` out of `HeroSection` and into a **fixed full-screen canvas** in `LandingShell`, mounted once, positioned `fixed inset-0 z-0 pointer-events-none`, only visible while combined progress < ~1.05.
- Build a single `ScrollTrigger` in `useLenisScroll` (or a new `useHeroProgress` hook) that measures scroll from `top of HeroSection` to `bottom of KeepScrollingSection` and writes 0–1 into a new `heroProgressRef`. Pass that ref into `KatanaCanvas` instead of the global page progress.
- `HeroSection`: keep title, V_1.2.0, Skill Hub card. Add GSAP scrub fading these out at local progress > 0.6.
- `KeepScrollingSection`: **remove the two `<img>` katana copies entirely** (the 3D canvas now owns the katana). Keep the pinned text reveals ("Control", "StringTune", "Concentrate", "Keep Scrolling") timed to align with the 3D timeline beats.

### 3. Fix the layout gap (title vs 3D katana overlap on current screenshot)
- Currently the canvas covers the right 68% but the katana sits centered-right inside it, so it visually crashes into "Master / Your / Skills". Adjust initial camera framing: at `p=0`, position the katana so its visible bulk sits in the right ~55% (move group `position.x` to `+0.6` at start).
- Move title block to `left-14 top-32`, cap font at `clamp(40px, 6.5vw, 104px)` so it fits in the left 35% column.
- Move Skill Hub card to bottom-left with `left-14 bottom-14`, shrink to `w-[260px] h-[170px]`.

### 4. Files touched
- **edit** `src/components/landing/useLenisScroll.ts` — add `heroProgressRef` measured against hero+keepScrolling stage.
- **edit** `src/components/landing/KatanaCanvas.tsx` — add bladeGroup, scroll-driven camera + unsheathe + rotation timeline.
- **edit** `src/components/landing/LandingShell.tsx` — mount `KatanaCanvas` once as fixed background, fade out after sections pass.
- **edit** `src/components/landing/sections/HeroSection.tsx` — remove local KatanaCanvas, fix title/card layout, scrub-fade text.
- **edit** `src/components/landing/sections/KeepScrollingSection.tsx` — remove img katanas, re-time text beats to match 3D unsheathe.

### Out of scope
Everything below KeepScrolling (Awakening → Footer) untouched. No new packages.

Approve and I'll implement in one pass.