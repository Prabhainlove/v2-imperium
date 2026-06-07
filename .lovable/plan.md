## What I see vs. what we have (honest diff)

**Reference katana** (image 1 + hero shot):
- BLACK lacquered saya with a RED flame/marbling core showing through a cutaway window
- WHITE ito-wrapped tsuka with BLACK diamond menuki spacing, gold fuchi/kashira
- Brand kanji ベ on the saya near the koiguchi
- Composition: sheathed katana enters from lower-left, runs diagonally up to the right, handle exits top-right corner

**Our `katana_hero.png`**: opposite — RED saya with BLACK smoke, and it shows the bare blade crossed with the saya (an unsheathing pose, not the sealed sheathed hero pose). Wrong colors, wrong pose.

**Our `katana_horizontal.png`**: plain naked blade with a black-wrap tsuka. Fine as the "drawn blade" image for later sections, but not the hero.

**Reference hero background**: dark near-black canvas with a delicate, almost ukiyo-e ink-drawn tree forming a circular mandala silhouette behind the katana, tiny red blossoms dotted across it. No moon. Very muted, ~20% luminance.

**Our `branches_backdrop.png`**: bright pink cherry blossoms with a giant yellow moon — wrong era, wrong mood, wrong density, wrong shape.

**Reference hero layout**:
```
[logo+®] [red-pill icon]  Master                V_ 1.2.0           [i] [Dev Guides] [Skill Hub]   0%
                          Your
                          Skills  Built by
                                  Fiddle.Digital

         Skill Hub
         ┌─────────────┐                                  Hey there, wanderer! 🎮 Welcome to the
         │             │   ← empty rounded card           realm of StringTune, where precision
         │             │                                  meets mastery
         └─────────────┘                                                                  [ Next ]
                                                                                          🧍 AIKA
```

**Our hero**: title split between SlashText("Master") and a separate h1("Your / Skills") — they desync; "Built by IMPERIUM" stacked vertically at bottom-left instead of inline; Skill Hub card is bottom-RIGHT (collides with companion); extra full-bleed black gradient overlay washes out the backdrop.

## Plan (focus: hero only, surgical)

### 1. Regenerate two assets (premium quality, transparent where needed)

- `src/assets/landing/katana_hero.png` — sheathed katana, transparent PNG. Prompt locked to: black lacquered saya, red flame/marble core visible through a cutaway window mid-saya, white cotton ito-wrap on tsuka with black diamond menuki, gold tsuba with floral relief, kanji ベ on saya. Diagonal pose, blade pointing lower-left, handle upper-right.
- `src/assets/landing/branches_backdrop.png` — dark muted ink-painted bare tree branches forming a soft circular mandala, sparse tiny red blossoms, near-black background, subtle paper grain. No moon. Premium tier.

### 2. Rewrite `HeroSection.tsx` to match the reference

- Single `<h1>` with three lines `Master / Your / Skills`, left-aligned, top-left at `top-28 left-8`, tight `leading-[0.88]`, weight 500, tracking `-0.03em`, color `#f1ece6`.
- Inline `Built by\nFiddle.Digital` as a small block beside the "Skills" line (flex row, items-end), small sans `text-[18px]` muted `text-white/70`.
- Remove the `<SlashText text="Master">` — it desyncs with the static lines; the hero title should be calm, not slash-blurred (reference is static).
- Move Skill Hub card to bottom-LEFT (`bottom-8 left-8`), keep it as an empty rounded card with just the "Skill Hub" label top-left inside it.
- Remove the heavy `bg-gradient-to-b from-black/40 ... to-black/70` overlay so the backdrop reads.
- Reduce the red flame glow radius and opacity (currently bleeds across the whole canvas; reference has a tight glow only inside the saya cutaway, so push opacity to ~0.25 and shrink to 35vh).
- Add subtle paper grain via existing CSS; keep `V_ 1.2.0` top-center-right as already placed.
- Companion (`AIKA`) stays bottom-right — already correct.

### 3. No changes to other sections this turn

The user explicitly asked to focus on starting / hero / katana. KeepScrolling, Awakening, FeatureSword, Bento, etc. stay as-is this pass.

### Files touched
- `src/assets/landing/katana_hero.png` (regenerate)
- `src/assets/landing/branches_backdrop.png` (regenerate)
- `src/components/landing/sections/HeroSection.tsx` (rewrite layout)

No new dependencies. No backend changes.
