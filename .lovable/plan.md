## Goal
Replace the GLB-based `KatanaCanvas` in the hero with a **2D sprite-based katana** using your uploaded reference image as the source. Blade slides out of saya on scroll, both with a subtle 3D-feel rotation (perspective tilt + roll). Lighter, faster, and looks exactly like your reference because it IS your reference.

## Approach

### 1. Prepare two transparent-PNG sprites from your upload
Your reference image shows the blade already unsheathed, no saya. I need both halves to animate them apart. Generate via `imagegen--edit_image` (two passes from the same source):
- **`katana_blade.png`** — isolated blade + gold tsuba + black/diamond tsuka, transparent background, horizontal orientation, kept faithful to your reference's exact metal/gold/wrap pattern.
- **`katana_saya.png`** — matching black lacquer saya (sheath) sized to fit the blade, with subtle red flame motif and a gold koiguchi mouth, transparent background. Generated to visually pair with the blade so the silhouette reads as one katana when overlapped.

Both uploaded to Lovable CDN as `.asset.json` pointers.

### 2. New component `KatanaSprite.tsx` (replaces `KatanaCanvas` in Hero)
Plain DOM, no Three.js. Two stacked `<img>` layers inside a `perspective: 1200px` wrapper:

```text
   ┌─────────── perspective wrapper ───────────┐
   │  [saya layer]    ← behind, translateX -   │
   │     ▓▓▓▓▓▓▓▓▓▓▓▓▓ ═════════════           │
   │  [blade layer]   ← front, translateX +    │
   │     ━━━━━━━━━━━━━━━━━━━━━━━╪═══           │
   └────────────────────────────────────────────┘
```

Animation driven by the existing `heroProgressRef` (0→1 across Hero + KeepScrolling):

| p range | What happens |
|---|---|
| 0.00–0.15 | Sheathed, slight overhead 3D tilt (rotateX -8°, rotateY 12°). Both layers fully overlapped. |
| 0.15–0.45 | "Camera" rotates to horizontal — wrapper rotateX → 0°, rotateY → 0°. Subtle parallax: blade scales 1 → 1.05. |
| 0.40–0.85 | **Unsheathe.** Blade `translateX` 0 → +28%, saya `translateX` 0 → −12%. Both also `rotateZ` from −4° → +2° together (the "rolling katana" motion). |
| 0.55–0.80 | Red emissive glow under the blade-saya junction fades from 1 → 0 (CSS radial-gradient div, matches your prior "flame core" beat). |

Idle ambience (independent of scroll, requestAnimationFrame): wrapper `rotateY` breathes ±1.5° and `translateY` ±4px so it never looks static.

### 3. 3D feel without WebGL
- `perspective: 1200px` on the wrapper + `transform-style: preserve-3d` gives real depth between blade and saya layers (blade `translateZ(20px)` sits above saya).
- Soft `drop-shadow(0 30px 40px rgba(0,0,0,0.6))` on the blade layer for grounded weight.
- A `mix-blend-screen` highlight strip across the blade that follows scroll (gives a "polished steel catches light" sweep as it unsheathes).

### 4. Files touched
- New: `src/components/landing/KatanaSprite.tsx`
- New: `src/assets/landing/katana_blade.png.asset.json`
- New: `src/assets/landing/katana_saya.png.asset.json`
- Edit: `src/components/landing/LandingShell.tsx` — swap `<KatanaCanvas />` for `<KatanaSprite />`, keep the same `heroProgressRef` prop wiring.
- Edit: `src/components/landing/sections/HeroSection.tsx` — remove the reference-image mood bleed (the actual katana sprite now IS the visual; the bleed becomes redundant).
- Keep `KatanaCanvas.tsx` on disk (unused) in case you want to switch back. Or delete — your call; I'll delete by default to keep the tree clean.

### 5. Dependencies
None. Pure CSS transforms + GSAP (already installed) for the scroll-driven tween.

### Honest caveats
- AI-generating a matching saya from a blade-only reference means the saya's exact ornamentation is the model's interpretation — close to your reference's aesthetic (black + red flame + gold mouth) but not pixel-identical. If you want a specific saya, upload one and I'll swap the pointer.
- 2D sprites can't show the blade's edge thickness when the katana rotates head-on. The perspective tilt is kept subtle to avoid that breaking the illusion. This matches your "should look like 2D" guidance.
