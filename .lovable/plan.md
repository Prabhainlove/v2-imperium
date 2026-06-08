## Goal

Fix the profile hero per feedback:
1. Racing-track image becomes the **whole profile page background** (not a small framed card).
2. McLaren W1 3D model loads **fully, HD, with all FBX textures**, anchored in one place — no floating, no auto-rotate drift.
3. Tagline + emoji line sits **below the 3D model**, not overlaid on top of it.
4. Hover on the model plays its built-in **Take 001** action; leave returns to idle pose.

## Files

**Edit**
- `src/frontend/profile/profile.css`
  - `.profile-root` gets the racing-track image as a fixed, full-page background (cover, center, with a dark gradient overlay for readability). Remove the radial violet/green tints so the track reads cleanly.
  - Delete `.profile-hero-stage`, `.profile-hero-bg`, `.profile-hero-overlay`, `.profile-hero-3d`, `.profile-hero-copy` overlay positioning.
  - Add new `.profile-hero-block` (transparent, no card chrome): vertical stack — `.profile-hero-model` (fixed-height stage just for the 3D canvas, transparent) above `.profile-hero-text` (eyebrow + tagline + sub + hint), centered/left-aligned.
- `src/frontend/profile/components/ProfileHeader.tsx`
  - Remove the background `<img>` and overlay div.
  - Render `<McLarenScene />` in its own block, then the tagline copy underneath.
- `src/frontend/profile/components/McLarenScene.tsx`
  - Remove auto-rotate; the car stays still at a fixed camera angle.
  - Disable `OrbitControls` (or set it to look-only with no user spin) so the model is anchored.
  - Texture/material fix: FBXLoader needs a `THREE.LoadingManager` with a URL modifier so embedded texture references (`textures/Screenshot_*.png`, `alcantaraseamless.jpeg`, etc.) resolve to CDN URLs. Plan: upload all 23 texture files from the zip via `lovable-assets` and build a `{filename → cdnUrl}` map; the manager rewrites any incoming texture path to the matching CDN URL. This restores the model's real paint/tire/interior textures instead of fallback grey.
  - Ensure correct color space: set `renderer.outputColorSpace = SRGB`, mark all loaded textures `colorSpace = SRGBColorSpace`, enable `physicallyCorrectLights`, and turn on tone mapping (`ACESFilmicToneMapping`) for HD look.
  - Lighting upgrade: stronger key light + rim + ground bounce; add a subtle contact-shadow plane so the car visually sits on the track instead of floating.
  - Keep the hover → play `Take 001` (or first clip if not named) animation; on leave, fade out and reset to t=0.
  - Camera framed tightly using the model's bounding box so the entire car fits cleanly with no clipping at any viewport width.

**New (CDN uploads only, no source files)**
- `src/assets/profile/mclaren-textures/*.asset.json` — one pointer per texture file from the zip, used by the LoadingManager URL modifier.

**No changes**
- Routes, data layer, other profile cards (status row, info cards, right rail) stay as-is. Only the hero header block changes.

## Layout sketch

```text
┌──────────────────────────────────────────────────────────────┐
│  (entire page background = racing track image, fixed)        │
│                                                              │
│   ┌────────────────────────┐   ┌──────────────┐ ┌──────────┐ │
│   │      3D McLaren W1     │   │ ProfileCard  │ │ RightRail│ │
│   │   (anchored, HD, no    │   │   (Dinesh)   │ │          │ │
│   │      float, hover →    │   │              │ │          │ │
│   │      Take 001)         │   │              │ │          │ │
│   └────────────────────────┘   └──────────────┘ └──────────┘ │
│   🏁 Imperium · Career Grand Prix                            │
│   Life is a race. Your career is the championship.           │
│   Navigate like a champion… 🏆✨                              │
│   (hover the car to start the engine)                        │
│                                                              │
│   [status cards / info cards continue below, unchanged]      │
└──────────────────────────────────────────────────────────────┘
```

## Acceptance

- Racing track image covers the entire profile page background, readable through a dark gradient.
- McLaren renders in full HD with its real paint/tire/interior textures (not grey shaded).
- Car is centered, anchored, does not auto-spin or drift.
- Hovering the car plays Take 001 once-through and loops; leaving fades back to idle.
- Tagline copy sits below the model, never overlapping it.
- Existing profile cards/sections remain visually intact on top of the new track background.
