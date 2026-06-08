
# Imperium Dashboard — Soft Peach Command Center (v2)

New reference approved: **light cream/peach palette, soft shadows, rounded cards, professional friendly tone** (not the dark fantasy version). Same structural layout, new visual language, expanded inventory.

---

## 1. Visual language (matches new reference)

- Background: warm cream `#f7eee6` with subtle peach radial wash.
- Cards: pure white `#ffffff`, radius `20px`, soft shadow `0 6px 24px rgba(217,140,110,.10)`, no borders.
- Accent coral `#ee7b5a`, mint `#7fc7b8`, butter yellow `#f5c452`, lavender `#b9a7e0`, sky `#7fb8d8`, soft red `#e76a6a` — used as rarity/category colors on icons only.
- Typography: Inter Tight (headings), Inter (body), JetBrains Mono (micro labels). All already loaded in root.
- Text: near-black `#1f1d1b` headings, coral `#ee7b5a` subtitles, muted `#7a716a` meta.
- No gold filigree, no particles, no dark fantasy chrome. Clean, premium, modern SaaS-meets-character-sheet.

---

## 2. Layout (unchanged from prior plan)

CSS Grid three columns ≥1280px (`320px 1fr 380px`), two columns on tablet, single stack on mobile with order: Profile → Hero → Career Overview → Equipped → Inventory (horizontal snap-scroll) → Activity → Crest.

Top bar: small Imperium wordmark left, two pill resource counters center (`297` gem, `1,258` coin), single gear icon right.

---

## 3. Inventory — now 10 modules

| # | Name | Color | Route |
|---|---|---|---|
| 1 | Job Agent | coral | `/jobs` |
| 2 | Resume Studio | mint | `/resume` |
| 3 | ATS Optimizer | mint | `/ats` |
| 4 | Application Tracker | lavender | `/applications` |
| 5 | Interview Coach | coral | `/interviews` |
| 6 | Skill Builder | mint | `/skills` |
| 7 | AI Assistant | butter | `/assistant` |
| 8 | Recruiter Scanner | sky | `/recruiters` |
| 9 | Networking Hub | lavender | `/networking` (new) |
| 10 | Salary Insights | mint | `/salary` (new) |

Grid: 5 cols ≥1280px, 4 on tablet, horizontal snap-scroll on mobile. Each tile = soft pastel rounded-square icon + name + `Lv. N`. Hover: lift 2px + soft glow in the tile's accent color + tooltip with description.

---

## 4. Data layer

`src/frontend/dashboard/dashboard.data.ts` — typed `DashboardData` + `useDashboardData()` hook returning hard-coded **Dinesh** profile, overlaying `name`/`email` from `mockAuth` session when available. Easy swap to a server function later. All numbers, levels, activity rows, and inventory state flow through this hook — zero hardcoded JSX values.

---

## 5. Component tree

`src/frontend/dashboard/`
- `DashboardPage.tsx` — grid shell
- `dashboard.css` — `.dash-*` scoped tokens & styles
- `dashboard.data.ts`, `dashboard.logic.ts`
- `components/TopBar.tsx`
- `components/LeftPanel.tsx` (Identity card, AttributesCard, PowersCard, QuoteCard)
- `components/CenterPanel.tsx` (HeroPortrait, CareerOverview, RecentActivity, ContinueCTA)
- `components/RightPanel.tsx` (ProfileCard, EquippedCoreCard, InventoryGrid, CrestCard)
- `components/AttributeBar.tsx`, `PowerEmblem.tsx`, `StatTile.tsx`, `ActivityRow.tsx`, `InventoryTile.tsx`, `HeroPortrait.tsx` (modes: `image | spline | three`)

Hero portrait: AI-generated professional male in cream blazer with coral tie, soft peach circular halo — matches reference. Saved to `src/assets/dashboard/hero-portrait.png`.

---

## 6. Floating navbar for module pages

`src/frontend/shell/ImperiumNavbar.tsx` + `imperium-navbar.css`
- Fixed top-center capsule, white/95% + `backdrop-filter: blur(18px)`, soft shadow, thin coral hairline.
- `framer-motion` animated pill (`layoutId="nav-pill"`) for active item.
- Items: Dashboard, Job Agent, Resume, ATS, Applications, Interviews, Skills, Assistant, Recruiters, Networking, Salary.
- Collapses to icon-only ≤640px with horizontal scroll.
- Route transitions: `<AnimatePresence mode="wait">` wrapping `<Outlet/>` with fade + scale (0.98→1, 180ms).

`AppShell` (used by `_authenticated` layout) renders `ImperiumNavbar` + animated `Outlet` **except** when `useLocation().pathname === "/dashboard"` — dashboard is the only naked page. Delete `Sidebar.tsx` and `Topbar.tsx`.

Install: `framer-motion`.

---

## 7. New route stubs

So navbar links don't 404, create placeholder pages with the clean enterprise style (white cards, coral accents, "Coming soon" hero):
- `/_authenticated/ats.tsx` → `AtsPage`
- `/_authenticated/assistant.tsx` → `AssistantPage`
- `/_authenticated/recruiters.tsx` → `RecruitersPage`
- `/_authenticated/networking.tsx` → `NetworkingPage`
- `/_authenticated/salary.tsx` → `SalaryPage`

Each ships a 3-file frontend folder (`Page.tsx`, `.css`, `.logic.ts`).

---

## 8. Settings menu (top-right gear)

Small popover with Profile, Account, Theme, Logout. Logout → `mockAuth.signOut()` → navigate `/auth`.

---

## 9. Responsiveness

- `clamp()` for fluid typography and gaps everywhere.
- Tabular numbers + `min-width` on stat values to prevent jump (1 vs 5 digits).
- Long usernames: truncate + tooltip.
- Empty states for every list (no activity, no modules unlocked).
- Verified at 1920, 1440, 1366, 1024, 768, 390 via browser tool screenshots after build.

---

## 10. Files summary

**Create**: 10 dashboard components + data/logic, hero portrait asset, ImperiumNavbar + css, 5 new module pages (3 files each), 5 new route files.
**Edit**: `DashboardPage.tsx`, `dashboard.css`, `dashboard.logic.ts`, `AppShell.tsx`, `_authenticated/route.tsx`.
**Delete**: `Sidebar.tsx`, `Topbar.tsx`.
**Install**: `framer-motion`.

---

## 11. Out of scope

Real backend wiring, true 3D avatar (only abstraction layer in place), full module page implementations beyond placeholder shells, theme switcher logic.

---

Approve to build. After build I'll screenshot `/dashboard` at desktop + mobile and one module page to confirm the navbar + transitions.
