
# Imperium — Full App UI Overhaul

Goal: strip the Japanese-culture layer entirely from the app shell and rebuild every in-app page with a high-end, distinct visual language inspired by the references you attached. Landing page stays untouched.

## Per-page direction (matched to your references)

| Page | Reference | Direction |
|---|---|---|
| Auth / Login + Reset | Dev Studios / Skill Hub dark editorial | Pill-button nav, large display headline, monospace meta ticks (`V_ 1.2.0`, `0%`), thin hairline grid, single coral accent `#FF5A3A` on near-black `#0A0A0A`. Split layout with animated wireframe panel on the right. |
| Dashboard (entry) | Digcy CRM | Light surface `#F5F4F1` + white panels, soft rounded-2xl cards, left icon sidebar, KPI tiles, donut + bar charts, "Best selling" data table. This is the home after login. |
| Jobs | Energy Glass Cards | Dark `#0B0B0E` bento grid of glass cards with gauges, bars, sparklines. Each job = a glass tile with match-score gauge, salary bar, source meter. Accent `#FF6A2B` → `#E8C547`. |
| Applications | Travel "Discover" | Dark navy `#1E2230` hero "Discover roles", yellow `#F4C328` CTA pills, horizontally-scrolling application class cards (First/Premium/Business → Applied/Interview/Offer), dot pagination, side social rail repurposed as filter rail. |
| Profile / Profile Preview | Formula 1 Cards Pack | Hero "driver card" with big faded number + headshot/avatar, red `#E10600` status strip ("Session Stopped" → "Actively Looking"), schedule list, race weekend points → "skills points", standings table → endorsements. |
| Resume Studio + Review | N_Invoice | Tablet-frame canvas, lime `#D8F26B` accent on black, document-style sections (Company/Client → Candidate/Target Role), Concept/Units/Prize table → Experience/Years/Impact, bottom pill action bar. |
| Cover Letters | N_Invoice variant | Same invoice-tablet language, second color (cyan) to distinguish. |
| Interviews | Formula 1 variant | "Race weekend" schedule: upcoming interviews as session cards, lap-time → time-to-interview countdown. |
| Autopilot | Energy Glass variant | Live gauges for queue health, throughput, success rate; power-flow chart for pipeline stages. |
| Activity | Energy Glass variant | Stream of small glass cards with sparkline + status. |
| Skills | Formula 1 standings | Standings-style ranked skill list with points + delta. |
| Settings | Digcy CRM forms | Light CRM-style settings with sectioned cards and toggles. |
| Search | Discover variant | Search hero + horizontal result cards. |
| Onboarding | Dev Studios | Stepper with pill tabs, hairline grid, coral progress. |
| App Shell (sidebar + topbar) | Digcy CRM | Light icon-rail sidebar with section labels, top bar with global search, avatar, "Add" CTA. Dark-mode variant retains the same geometry. |

## Design system (replaces current Japanese tokens)

- Remove all `imp-kanji*`, `imp-brush-divider`, `imp-seal`, `page-font-*` JP fonts, and katana/fuji imagery from in-app pages.
- New token sets in `src/styles.css`:
  - `--app-bg`, `--app-surface`, `--app-panel`, `--app-ink`, `--app-muted`, `--hairline`
  - Accent ramps per surface family: `--accent-coral` (auth), `--accent-crm` (dashboard, indigo `#3D5AFE`), `--accent-energy` (orange→amber gauges), `--accent-discover` (yellow `#F4C328`), `--accent-f1` (red `#E10600`), `--accent-invoice` (lime `#D8F26B`).
- Fonts: one consistent family — Inter for UI, Geist Mono for meta/numbers, Inter Tight for display. No JP fonts.
- New shared primitives in `src/components/imperium/ui/`:
  - `GlassCard`, `Gauge`, `SparkBar`, `StatTile`, `DataTable`, `PillNav`, `MetaTicks`, `DocCanvas` (invoice frame), `DriverCard` (F1), `DiscoverCard`, `CRMShell`.

## File-level changes

1. `src/styles.css` — delete `.imp-kanji*`, `.imp-brush-divider`, `.imp-seal`, `.imp-panel` washi/noise; add new token families + utility classes.
2. `src/routes/__root.tsx` — remove JP font `<link>`s, add Inter / Inter Tight / Geist Mono.
3. `src/components/imperium/app-sidebar.tsx` — rebuild as Digcy CRM rail (icon + label, active pill, no JP subtitles, no red rail).
4. `src/routes/_authenticated/route.tsx` — light CRM shell as default, with top bar (search, add, avatar).
5. `src/components/imperium/page-header.tsx` — drop `kanji`/`kanjiLabel`; add `eyebrow`, `meta` (right-side ticks), `accent` variant.
6. `src/components/imperium/stat-card.tsx` — Digcy KPI tile.
7. Per-page rewrites of layout/markup only (no business logic touched):
   - `auth.tsx`, `reset-password.tsx` → Dev Studios layout.
   - `_authenticated/dashboard.tsx` → Digcy CRM layout.
   - `_authenticated/jobs.tsx`, `autopilot.tsx`, `activity.tsx` → Energy Glass.
   - `_authenticated/applications.tsx`, `search.tsx` → Discover.
   - `_authenticated/profile-preview.tsx`, `interviews.tsx`, `skills.tsx` → F1 cards.
   - `_authenticated/resume.tsx`, `review.$id.tsx`, `cover-letters.tsx` → Invoice canvas.
   - `_authenticated/onboarding.tsx`, `settings.tsx` → Dev Studios stepper / CRM forms.
8. Delete unused JP assets: `fuji_ink.jpg.asset.json`, `katana_vertical.png.asset.json`.

## Guardrails

- No changes to landing page, `KatanaSketchfab`, scroll choreography, or any `src/lib/imperium/**` business logic.
- All existing route props, data hooks (`useQuery`, `useServerFn`, `getProfile`, etc.), component names and imports preserved.
- Dark/light theme toggle continues to work; Dashboard ships light by default, other dark pages adapt.

## Preview generation (before implementation)

Before writing code, I'll generate **6 high-fidelity preview mockups** (one per direction family — Auth/DevStudios, Dashboard/CRM, Jobs/Energy, Applications/Discover, Profile/F1, Resume/Invoice) with the image generator at premium quality, save them under `/mnt/documents/imperium-previews/`, and post them back to you as artifacts. You approve or request tweaks, then I implement.

## Technical notes

- Charts: use lightweight inline SVG (sparklines, gauges, bars) — no new chart library unless you ask.
- New primitives are pure presentational components; pages keep current data wiring.
- Estimated diff: ~18 files edited, ~10 new primitive files, 2 asset pointers deleted, 0 schema changes.

Approve and I'll generate the 6 mockups first, then build.
