# Imperium — Japanese Culture UI Pass (Auth + App Pages)

Bring every non-landing page (auth, onboarding, dashboard, jobs, applications, resume, cover letters, autopilot, interviews, skills, settings, profile-preview) onto the same visual language as the landing page: deep ink background, sumi-e textures, red katana accent, Japanese cultural motifs, premium typography. UI only — no business logic changes.

## Design language (shared tokens)

Add to `src/styles.css`:
- Background: deep ink `oklch(0.12 0.02 250)` with subtle washi paper noise + faint sumi brush stroke SVG overlay.
- Accent: katana red `#ff3a2a` (already used in landing chrome) + gold leaf `#c9a84c` for highlights.
- Surfaces: translucent panels `bg-white/[0.04]` ring-1 `ring-white/10` backdrop-blur, sharp corners (rounded-sm) like landing bento.
- Add CSS utilities: `.imp-panel`, `.imp-hairline`, `.imp-kanji-watermark` (large faded kanji bg), `.imp-seal` (red circular hanko stamp).
- Page-level kanji watermark per section (一 dashboard, 業 jobs, 文 resume, 信 cover letters, 自 autopilot, 面 interviews, 技 skills, 設 settings, 人 profile, 鍵 auth).

## Typography (different font per page family)

Load via `<link>` in `__root.tsx` and expose as `--font-*` tokens. Map by page family:
- Auth / Onboarding → `Shippori Mincho` headings + `Inter` body (ceremonial, serif brush feel).
- Dashboard / Mission Control → `Noto Serif JP` headings + `JetBrains Mono` numerics + `Inter` body.
- Jobs / Applications / Search → `Zen Old Mincho` headings + `Inter` body.
- Resume / Cover Letters → `Klee One` (handwritten) headings + `Inter` body.
- Autopilot / Interviews / Skills → `Yuji Syuku` (calligraphic) headings + `Inter` body.
- Settings / Profile Preview → `Sawarabi Mincho` headings + `Inter` body.

Each page sets its heading font via a wrapper class (`page-font-dashboard`, etc.) on the outermost div — no global swap.

## Imagery (CDN assets)

Generate and upload via `lovable-assets` (transparent PNGs / JPGs):
- `katana_vertical.png` — vertical katana silhouette for auth split panel.
- `torii_silhouette.png` — torii gate watermark for dashboard hero.
- `wave_seigaiha.svg` — repeating wave pattern for footer strips.
- `enso_circle.png` — zen brush circle for empty states.
- `sumi_brush_streak.png` — horizontal ink stroke divider.
- `mt_fuji_ink.jpg` — ink-wash Fuji for onboarding hero.
- `red_seal_stamp.png` — hanko stamp for "submit/applied" confirmations.

## Per-page changes

1. **`src/routes/auth.tsx`** — split-screen: left = vertical katana art + IMPERIUM mark + kanji watermark + tagline; right = form on translucent panel with gold hairline borders, hanko-stamped submit button.
2. **`src/routes/_authenticated/onboarding.tsx`** — full-bleed Fuji ink-wash hero with step indicator as enso circles; cards on washi panels.
3. **`src/routes/_authenticated/route.tsx`** (shell) — replace flat header bg with ink + sumi streak; sidebar gets katana-red active indicator bar and large kanji watermark behind the nav list.
4. **`src/components/imperium/app-sidebar.tsx`** — keep nav items, restyle: vertical red accent rail, Japanese label under each English label (e.g. Dashboard / 司令), brush-stroke divider between groups.
5. **`src/routes/_authenticated/dashboard.tsx`** — page wrapper with 司 watermark, StatCards become bento tiles matching landing (`.imp-panel`), Execution Timeline gets katana-red timeline rail, Local Intelligence card frames with gold hairline.
6. **`src/routes/_authenticated/jobs.tsx`, `applications.tsx`, `search.tsx`, `resume.tsx`, `cover-letters.tsx`, `autopilot.tsx`, `interviews.tsx`, `skills.tsx`, `settings.tsx`, `profile-preview.tsx`** — each gets:
   - Page wrapper class for its font family.
   - Kanji watermark in top-right of `PageHeader`.
   - `Card` → `.imp-panel` styling (handled by extending `Card` defaults? No — keep Card neutral, override via wrapper classes per page to avoid touching every Card usage. Override `--card`, `--border` tokens at the page wrapper scope).
7. **`src/components/imperium/page-header.tsx`** — accept optional `kanji?: string` prop; render as large faded kanji absolutely-positioned behind the title.
8. **`src/components/imperium/stat-card.tsx`** — sharper corners, hairline gold border on hover, tone colors retuned to landing palette.

## Scope guardrails

- No changes to: route loaders, server functions, queries, schemas, business logic, data shapes.
- Keep every existing prop, import, and component name.
- Don't touch the landing page (`src/components/landing/*`, `src/routes/index.tsx`).
- Don't modify `KatanaSketchfab.tsx` or scroll choreography.

## Technical notes

- Tailwind v4 — all tokens go in `src/styles.css` under `@theme`; no `tailwind.config.js`.
- Use `@theme inline` for page-scoped font tokens; bind via wrapper `.page-font-*` classes that set `--font-display`.
- Fonts loaded once in `__root.tsx` head as a single Google Fonts link with all families.
- Asset uploads via `lovable-assets create --file ...` then write `.asset.json` pointer; reference via `import x from "@/assets/x.png.asset.json"; <img src={x.url} />`.
- Verify with `bun run build` after.

## Out of scope (will not do this round)

- Animating sword choreography on auth/dashboard.
- Replacing shadcn primitives.
- Light theme variant.
- Translating actual UI copy to Japanese (only decorative kanji labels added).
