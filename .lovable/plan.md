
## Final Reading of string-tune.fiddle.digital (corrected)

The site is not a 3D camera tour and not a traditional marketing page. It behaves like an **interactive design publication** whose pages turn under a fixed UI chrome. Every correction you sent is folded into the description below.

### Overall design language
A single creative system runs end-to-end:
- Japanese craftsmanship aesthetic (katana, saya, bonsai, bamboo, clouds, ukiyo-e tone)
- Katana symbolism as the narrative spine
- Developer-tooling metaphors (Console, Skill Hub, code chips, easing curves)
- Editorial display typography at hero scale (not serif — large sans presented like a magazine cover)
- Motion-graphics treatment of text (slash-blur reveals, ghost copies, scrub blur)
- Technical interface overlays (HUD, mono micro-labels, version chips)
- Scroll storytelling that crossfades layered artwork

### Persistent chrome (HUD) — always visible
While the artwork beneath changes, this UI stays mounted and updates continuously:
- Top-left: logo + IMPERIUM© wordmark
- Top-center: nav pills (info `i`, Dashboard, Console)
- Top-right: scroll-progress percentage
- Left rail (vertical mono): `• FPS: NN  • TOP: #### PX`
- Bottom-right: companion sprite + dialogue bubble (Next / Skip)
- Thin red progress hairline on key sticky stages

### Scene-by-scene (corrected)
1. **0–6 s — Cold open.** Black canvas, centered brand glyph, corner crescent spinner. Cuts via a slash wipe into the hero.
2. **6–10 s — Hero.** Sheathed katana diagonal, saya glows with a red flame core, dim ukiyo-e branches behind. Editorial display title `Master / Your / Skills` (large sans, magazine-cover scale). Skill Hub / Console placeholder card bottom-left. Companion bubble bottom-right.
3. **10–16 s — Unsheathing.** Blade and saya start overlapped and drift apart on scroll. Word `Control` reveals via heavy horizontal motion-blur slash with ghost copies.
4. **16–22 s — Keep Scrolling.** Two-stage slash-blur reveal of `Keep Scrolling`. Red hairline at top of the sticky stage. Companion line updates.
5. **22–32 s — The Spirit Awakened (interstitial).** A short transitional bridge between the unsheathing sequence and the cloud narrative — naked blade above, empty saya below, blurred title between, master-portrait pixel card with dialogue in the lower right. Not a major standalone scene.
6. **32–42 s — Cloud panorama.** Wide red/cream cloud band. The katana **glides** across with subtle parallax and scale shifts (restrained, not flying). Master Oji portrait card + bonsai pixel.
7. **42–48 s — Warm wash / bamboo.** Cream-sand background, pixel bamboo, orange sun haze, transition into the dark monochrome compass.
8. **48–54 s — And listen…** Scrub-blur typography, drifting red squares, bonsai silhouette.
9. **54–58 s — Principles bento.** `Principles` wordmark + 9-cell magazine bento grid (hero portrait tile, spec tiles, easing curve, scroll smoothie tile, logo tile).
10. **58–63 s — Compass + Clarity finale.** **Compass-like glyph cluster / radial information diagram** (not a wheel) with the central emblem and rotating audience labels. Compact letter-chip cluster, then `Code With Clarity / Native` numbered columns and footer CTA.

### Composition transitions
There is no virtual camera. Section-to-section change is achieved with **layered motion, parallax, crossfades, and scroll choreography** — artwork layers transforming, never a camera moving through 3D.

---

## Revised 40% → 100% Plan (existing files, plus the few additions already approved)

Scope: edit only existing landing files, plus 4 new assets, 1 helper, 1 interstitial (already approved earlier as "And listen"). No new sections beyond what was approved.

### New assets (generated)
- `src/assets/landing/loader_glyph.png` — cold-open brand glyph
- `src/assets/landing/branches_backdrop.png` — dim ukiyo-e branches for hero
- `src/assets/landing/bento_red_portrait.jpg` — bento hero tile
- `src/assets/landing/cloud_band_wide.jpg` — wide red/cream cloud panorama

### New shared helpers
- `src/components/landing/SlashText.tsx` — shared slash-blur reveal used by Hero, KeepScrolling, Awakening, AndListen.
- `src/components/landing/sections/AndListenSection.tsx` — cream interstitial.
- `src/components/landing/ColdOpen.tsx` — 5 s loader → slash-cut into hero, mounted from `LandingShell`.

### Edits to existing files (no rewrites of unrelated logic)
- `LandingShell.tsx` — mount `ColdOpen` and `AndListenSection` in the section order.
- `HeroSection.tsx` — wordmark `Master / Your / Skills`, layered composition (branches backdrop + saya with red flame core + sheathed blade diagonal), Skill Hub / Console placeholder card, companion bubble alignment.
- `KeepScrollingSection.tsx` — unsheathe choreography (blade + saya start overlapped, drift apart), shared `SlashText`, two-stage reveal, top red hairline.
- `AwakeningSection.tsx` — restructure as **interstitial**: naked blade top, empty saya bottom, slash-blur title centered, master-portrait dialogue lower-right. Smaller vertical footprint than other sections.
- `BambooSection.tsx` — cream wash, pixel bamboo, orange sun haze, transition into compass.
- `CompassSection.tsx` — dark monochrome compass beat.
- `BentoSection.tsx` — true 9-cell magazine bento grid using `bento_red_portrait.jpg` + spec/easing/scroll/logo tiles.
- `AudienceWheelSection.tsx` — rename intent only in copy/labels; render as **compass-like glyph cluster / radial information diagram** (central emblem + rotating audience labels). No new file, no route change.
- `ClaritySection.tsx` — letter-chip cluster + `Code With Clarity / Native` numbered columns.
- `TopChrome.tsx` — confirm logo + pills + info chip + scroll % stay mounted across all sections.
- `Companion.tsx` — sprite swaps and line updates aligned to new section progress thresholds.
- `chrome/SideTicker.tsx` — confirm `FPS` + `TOP: #### PX` rail visible from cold open through footer.

### Out of scope
- No router, auth, server-function, or schema changes.
- No new dependencies beyond `lenis` + `gsap` + `@gsap/react` (already installed).
- No additional sections beyond the ones listed above.

Approve and I will implement in one pass.
