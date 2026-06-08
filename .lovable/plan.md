# Imperium Profile Page — Implementation Plan

Rebuild `/profile` to mirror the attached F1 Cards Pack layout exactly (proportions, card placement, density), replacing all F1 content with Imperium career-identity content. Premium dark glassmorphism, isolated from the peach dashboard theme.

## Visual Structure (locked to reference)

```text
┌─ Logo ─┬──────────────────────────────┬─ ProfileCard ─┬─ TopBar (gems/coins/settings)
│ Vert.  │  IMPERIUM PROFILE (H1)       │  [portrait]   │ ┌─ Basic Info ─────────┐
│ bars:  │  Career Identity System      │  Dinesh Kumar │ │ Name/Title/Email/    │
│ • PS   │                              │  AI Engineer  │ │ Phone/Location/Web   │
│ • ATS  │                              │  Lvl 12       │ ├─ Professional Links ─┤
│ • RQ   │                              │               │ │ LI/GH/Portfolio/     │
│        │                              │               │ │ LeetCode/HackerRank  │
│        ├─ GREEN ─┬─ RED ──┬─ YELLOW ──┤               │ └──────────────────────┘
│        │ Extract │ Missing│ Optimize  │               │
│        ├─ EDU ───┬─ EXP ──┬─ JOB PREF ┤
│        ├─ Professional Summary ───────┤
│        ├─ SKILLS ─┬─ PROJECTS ─┬─ RESUME ─┤
│        ├─ CERTIFICATIONS ──────┬─ JOB PREF (detailed) ─┤
```

Three status cards (green/red/yellow) stay exactly in row-2 position. Profile card stays top-right of main column. Right rail is two stacked glass panels.

## Files

**New**
- `src/frontend/profile/components/ProfileHeader.tsx` — H1 "IMPERIUM PROFILE" + subtitle + vertical strength bars (Profile Strength, ATS Readiness, Resume Quality)
- `src/frontend/profile/components/ProfileCard.tsx` — portrait + name/role/exp/location/level (placeholder for future 3D avatar)
- `src/frontend/profile/components/StatusCard.tsx` — variant `green | red | yellow`, used 3×
- `src/frontend/profile/components/InfoCard.tsx` — generic glass card with title + Edit button
- `src/frontend/profile/components/SkillsCard.tsx`, `ProjectsCard.tsx`, `ResumeCard.tsx`, `CertificationsCard.tsx`, `JobPrefDetailedCard.tsx`, `SummaryCard.tsx`, `EducationCard.tsx`, `ExperienceCard.tsx`, `JobPreferencesCard.tsx`
- `src/frontend/profile/components/RightRail.tsx` — Basic Info + Professional Links
- `src/frontend/profile/components/VerticalProgress.tsx`
- `src/frontend/profile/profile.data.ts` — `useProfilePageData()` hook returning typed profile derived from existing `SAMPLE_PROFILE` (Dinesh) + computed strength/ATS/resume scores; overlays mockAuth session name/email
- `src/frontend/profile/profile.extraction.ts` — stubs `extractFromResume(file)`, `importFromLinkedIn(url)`, `mergeProfile()` (wired to existing `ResumeFileParser`; LinkedIn returns "coming soon" toast for now)
- `src/assets/profile/avatar-placeholder.png` — generated AI portrait (dark premium style)

**Edited**
- `src/frontend/profile/ProfilePage.tsx` — full layout per reference
- `src/frontend/profile/profile.css` — dark glassmorphism scoped under `.profile-root` (no leak to dashboard/landing)
- `src/frontend/profile/profile.logic.ts` — page-level handlers (edit toggles, upload, import)

**No changes** to dashboard, navbar, routes, backend, or `SAMPLE_PROFILE`.

## Data Layer

`useProfilePageData()` composes:
- Identity from `SAMPLE_PROFILE` (Dinesh) overlaid with `useSession()`
- `extraction`: derived flags — resumeUploaded, linkedinConnected, profileSynced
- `missing[]`: scans profile for empty experience/skills/education/resume
- `optimization[]`: ATS score < 80 → "ATS Score Low"; missing keywords from target_role; etc.
- `strength`, `atsReadiness`, `resumeQuality`: 0–100 numbers for vertical bars (uses existing `ProfileCompleteness` + `AtsScorer` from backend types, client-safe computation)

## Design Tokens (scoped, dark)

```css
.profile-root {
  --p-bg: #07070a;
  --p-surface: rgba(20,20,28,0.72);
  --p-border: rgba(255,255,255,0.06);
  --p-text: #ececf1; --p-muted: #8a8a96;
  --p-violet: #8b6cf6; --p-green: #2ecc8b;
  --p-red: #ef5a6f; --p-amber: #f5b544;
  --p-blur: blur(18px) saturate(140%);
  --p-shadow: 0 8px 32px rgba(0,0,0,0.45);
}
```
All cards: `background: var(--p-surface); backdrop-filter: var(--p-blur); border: 1px solid var(--p-border); border-radius: 18px;`. Status cards use accented gradient fills (green/red/amber) matching reference. Hover: subtle lift + border glow.

## Interactions (this pass)

- **Edit** buttons → toggle inline edit mode per card (local state, no backend write yet)
- **Upload resume** → uses existing `extractTextFromFile`, surfaces parsed snippets in green card
- **LinkedIn import** → input + button; shows toast "Local LinkedIn import — coming with Ollama integration"
- **Settings cog** → routes to `/settings`
- Gems/coins in top bar pulled from dashboard data hook (consistent currency)

## Responsive

- ≥1280px: full 3-column layout per reference
- 1024–1279px: right rail collapses below main grid
- ≤768px: single column, status cards horizontal scroll-snap, profile card stacks above main

## Out of Scope (reserved as placeholders, not built)

3D avatar, Ollama wiring, real LinkedIn scraping, level/XP progression, server-side profile persistence. Locked Job Agent vs Local Agent boundary respected — Profile page does not surface Local Agent.

## Acceptance

- Visual: side-by-side with reference, every card in same position, same proportions, same density
- Theme: dark glass throughout `.profile-root`; navbar (peach) still renders above and does not bleed
- Data: all visible fields driven by `profile.data.ts`; no hardcoded JSX strings except labels
- Build passes; no new deps required
