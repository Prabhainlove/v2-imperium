## Goal

Replace the Sketchfab iframe in the profile hero box with a two-phase experience:

1. **Phase 1** — F1 race intro video plays inside the box.
2. **Phase 2** — at video end, swap to a static 3D model of the new McLaren MCL39 GLB (no hover, no animations — just load and display).

## Video choice

Use the uploaded `f1_race.mp4` (not the YouTube embed). A local `<video>` lets us hit `currentTime=3`, `playbackRate=1.5`, and a hard cutoff at 40s reliably; YouTube's iframe API can't guarantee any of those on every browser, and it injects branding/ads.

Plays from **t=3s → t=40s at 1.5×**, muted, autoplay, `playsInline`, no controls.

## 3D model

Use the newly uploaded `2025-mclaren-mcl39.zip` → `source/f1-2025_mclaren_mcl39.glb` (43 MB, textures embedded). Render only — no `take_001`, no hover interaction, no auto-rotate.

## Files

**New CDN pointers**
- `src/assets/profile/f1-race.mp4.asset.json` — `lovable-assets create --file /mnt/user-uploads/f1_race.mp4 --filename f1-race.mp4`
- `src/assets/profile/mclaren-mcl39.glb.asset.json` — `lovable-assets create --file /tmp/mcl39/source/f1-2025_mclaren_mcl39.glb --filename mclaren-mcl39.glb` (extracted from the user's zip; textures are embedded in the GLB so no separate texture uploads needed)

**Delete**
- `src/assets/profile/mclaren-w1.fbx.asset.json` — obsolete (old FBX model)
- `src/assets/profile/mclaren-textures.map.json` and the 23 `mclaren-textures/*.asset.json` pointers — obsolete (FBX-era texture map, no longer referenced once McLarenScene is rewritten)

**New**
- `src/frontend/profile/components/HeroIntroVideo.tsx` — `<video>` element:
  - `src` from `f1-race.mp4.asset.json`, `muted`, `autoPlay`, `playsInline`, `preload="auto"`, no controls
  - `onLoadedMetadata` → `currentTime = 3`, `playbackRate = 1.5`
  - `onTimeUpdate` → when `currentTime >= 40` (or `onEnded`) → call `onFinish()` once
  - CSS: `width:100%; height:100%; object-fit:cover; display:block;`

**Edit**
- `src/frontend/profile/components/McLarenScene.tsx` — rewrite. No more Sketchfab iframe.
  - Use existing `three` (already installed at `^0.184.0`) directly — no new deps, no `@react-three/fiber`.
  - Inside the component: create `Scene`, `PerspectiveCamera`, `WebGLRenderer` (antialias, `outputColorSpace = SRGBColorSpace`, `toneMapping = ACESFilmicToneMapping`).
  - Load GLB via `GLTFLoader` from `three/examples/jsm/loaders/GLTFLoader.js`. Center the model via `Box3` and frame the camera using the bounding sphere so it fits the canvas at any aspect.
  - Lighting: `HemisphereLight` + one `DirectionalLight` (key) + soft `AmbientLight`. Add an `Environment`-style fallback by loading a simple `RoomEnvironment` from `three/examples/jsm/environments/RoomEnvironment.js` via `PMREMGenerator` for clean PBR reflections.
  - Slow continuous gentle yaw on the model (`model.rotation.y += 0.0025` per frame) so it doesn't feel frozen, but **no user interaction, no OrbitControls, no hover triggers**.
  - `ResizeObserver` on the container to keep renderer/camera in sync.
  - Cleanup on unmount: dispose geometries/materials/textures, stop RAF, drop renderer.
  - Export a `preloadMclarenModel()` helper that fires a `fetch(url)` early so the GLB is in the HTTP cache by the time the video ends.

- `src/frontend/profile/components/ProfileHeader.tsx`
  - Add `phase` state: `"video" | "model"`.
  - On mount: call `preloadMclarenModel()` so the 43 MB GLB downloads in parallel with video playback.
  - Phase `"video"`: render `<HeroIntroVideo onFinish={() => setPhase("model")} />`.
  - Phase `"model"`: render `<McLarenScene />` (inside the existing `ClientOnly`/`Suspense`).
  - Tagline copy block below the box stays unchanged.

- `src/frontend/profile/profile.css`
  - Add: `.profile-hero-model > video { width:100%; height:100%; object-fit:cover; display:block; }`
  - Add: `.profile-hero-model > canvas { width:100% !important; height:100% !important; display:block; }`
  - No other layout changes.

**No changes**
- Racing-track page background, ProfileCard, status cards, info cards, right rail, routes, data layer — all untouched.

## Sequence

```text
ProfileHeader mounts
  ├── preloadMclarenModel()   ← 43 MB GLB starts downloading
  ▼
phase = "video"
  ┌──────────────────────────────────────────┐
  │ <video> f1-race.mp4, muted, autoplay     │
  │   loadedmetadata → t=3, rate=1.5×        │
  │   timeupdate → t >= 40 → onFinish()      │
  └──────────────────────────────────────────┘
  ▼ (GLB already cached → instant swap)
phase = "model"
  ┌──────────────────────────────────────────┐
  │ WebGLRenderer + GLTFLoader               │
  │   MCL39, centered, slow yaw, no controls │
  └──────────────────────────────────────────┘
```

## Acceptance

- Hero box first plays `f1_race.mp4` clip from 3 s to 40 s at 1.5× speed, muted, no controls.
- At ~40 s, video disappears and the McLaren MCL39 GLB renders in the same box with no perceptible loading gap.
- No hover effect, no animation playback, no orbit/drag controls — model just sits there with a gentle idle rotation.
- No Sketchfab iframe, no YouTube embed, no old FBX/texture pointers remain.
- Rest of the profile page is unchanged.
