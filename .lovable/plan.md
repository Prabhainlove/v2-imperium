# Application Tracker — Visual Re-skin (Frontend Only)

Re-skin the existing `/applications` page to match the attached reference, using the selected pastel-cards + indigo-CTA direction. No store, repo, schema, or backend changes. All existing functionality (dnd-kit drag, virtualized table, Apply integration, intelligence engine, drawer logic) is preserved.

## Scope of change

Edit only:
- `src/frontend/applications/applications.css` — full rewrite of styles
- `src/frontend/applications/ApplicationsPage.tsx` — JSX/markup adjustments only (no logic)
- `src/frontend/applications/components/*.tsx` — class-name/markup updates only

No files added or removed. No store, repo, schema, or route changes.

## Visual system (locked from selected direction + reference)

- **Surface**: `bg-slate-50` page, white cards with `border border-slate-100`, soft shadow (`shadow-sm`), `rounded-2xl`.
- **Typography**: Inter (already available via Google Fonts link in root). Bold tracking-tight headings, uppercase tracking-widest micro-labels in slate-400.
- **Accent**: Indigo-600 primary (Next Step CTA, active tab underline, pagination active).
- **KPI tiles**: pastel-tinted icon squares — indigo, orange, violet, cyan, emerald, pink — with `+%` delta chip in emerald.
- **Pipeline columns**: tinted header strip per status (indigo/amber/orange/cyan/blue/green/red) with count chip; white card body.
- **Status pills**: per-status pastel bg + matching darker text.
- **Score pills**: emerald-50 bg with emerald-700 text for ATS/Match.
- **Drawer**: right side-sheet (desktop) / bottom sheet (mobile), Google-style header with logo tile, Overview/Timeline/Notes/Files tab strip with indigo underline, icon-prefixed fields, indigo "Next Step" CTA card.

## Layout (desktop, matching reference)

```text
┌ Header: title + subtitle ............ search (⌘K) ⋅ bell ⋅ theme ⋅ avatar ┐
├ KPI Row (6 tiles)                                                          ┤
├ Pipeline strip: [Customize] · 7 columns, 2 cards each + "+N more"          ┤
├ All Applications: filters (Status/Sources/Resumes/Date) + search + table   ┤
├ Bottom: Calendar (left, 3/5) · Upcoming Interviews list (right, 2/5)       ┤
└ Right drawer overlays on selection                                         ┘
```

Mobile (≤768px): KPIs horizontal scroll, pipeline horizontal scroll, table collapses to card list, drawer becomes bottom sheet.

## Component-by-component changes

1. **TrackerHeader (inline in ApplicationsPage)** — add ⌘K hint inside search, bell button with badge dot, theme toggle (static icon for now), avatar placeholder using `CompanyAvatar` style.
2. **KpiRow** — keep 8 metrics from store; render first 6 prominently matching reference (Sent, Under Review, Interviews, Offers, Response Rate, Interview Rate). Stale/Active become smaller secondary tiles below or move into a 2nd subtle row. Pastel icon tile + delta chip ("+12% vs last 30 days" computed as static label from existing data; if no prior period available, show neutral subtitle).
3. **PipelineBoard** — column header gets pastel bg + count chip; cards become rounded-2xl white with company • role • date and "+N more" link when bucket > 2 visible cards (kept visible cards = 2 per column to match reference, others summarised).
4. **ApplicationsTable** — restyle row to match reference grid; ATS/Match as green pills; status as colored pill; add 3-dot kebab cell; pagination footer "Showing 1 to N of M applications" with page chips.
5. **FiltersBar** — replace plain selects with rounded-xl pill selects; add date range select (UI only) and view-mode icon buttons (UI only).
6. **Calendar + Upcoming** — new compact month grid component built in `UpcomingPanel` area (purely visual; highlighted today + selected day). Pulls interview events from existing store.
7. **DetailsDrawer** — restructure Overview tab to icon-prefixed two-column field list; add "Next Step" indigo CTA card at bottom using next interview event from timeline; "Edit Details" button (no-op for now since editing already happens via existing controls — wires to existing status select hidden behind a modal toggle).

## Color tokens (added to applications.css)

Local CSS variables scoped under `.tracker-root`, no global theme changes:

```text
--tr-bg: #f8fafc
--tr-card: #ffffff
--tr-border: #f1f5f9
--tr-text: #0f172a
--tr-muted: #64748b
--tr-primary: #4f46e5   (indigo-600)
--tr-applied / viewed / review / assessment / interview / offer / rejected
  with matching -bg (50) and -fg (600/700)
```

## Animation

- `animate-fade-in` on drawer open
- `hover:scale-[1.02] transition` on KPI tiles and score pills
- `transition-colors` on table rows, pipeline cards

## Out of scope

- No new data fields, no schema changes, no new selectors
- No real dark mode toggle wiring (icon-only)
- No real ⌘K palette (visual hint only)
- No drag-to-calendar interactions
- No "Customize Pipeline" modal

## Acceptance

- Page visually matches the attached reference at desktop width
- Existing drag-drop, table virtualization, drawer tabs, notes autosave, status updates all still work
- Resume Studio → Apply still creates a tracker entry and navigates to `/applications`
- Mobile layout remains usable (horizontal scroll for KPI/pipeline, card-stack for table)
