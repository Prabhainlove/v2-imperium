# Application Tracker V2 — Final Approved Plan

Replaces the placeholder `ApplicationsPage`. Pure frontend, local-first, ready for Local Agent without redesign.

## 1. Schema

`src/frontend/applications/schema.ts`

```ts
JobSnapshot { title, company, location, salary?, source, descriptionHash }

ApplicationIntelligence { ageDays, stale, responseProbability, nextRecommendedAction }

Application {
  id, company, role, location,
  source: "linkedin"|"naukri"|"foundit"|"instahyre"|"hirist"|"wellfound"|"other",
  applicationSource: "resume_studio"|"local_agent",
  appliedAt,
  status: "applied"|"viewed"|"under_review"|"assessment"|"interview"|"offer"|"rejected"|"withdrawn",
  atsScore?, matchScore?,
  resumeId, resumeVersion, templateUsed,
  sourceUrl?, notes?,
  agentRunId?, agentMetadata?: { portal, executionTime, resumeVersion },
  jobSnapshot: JobSnapshot,
  intelligence: ApplicationIntelligence,        // recomputed on read
  createdAt, updatedAt
}

ApplicationEvent { id, applicationId, type, title, description?, timestamp }
```

## 2. Persistence (mirrors Resume Studio)

- `state/repository.ts` — `ApplicationRepository` interface + `LocalApplicationRepository` (localStorage keys `imperium-applications`, `imperium-application-events`).
- `state/useApplicationsStore.ts` — Zustand store with selectors:
  - `createFromResumeStudio(payload)` — only public creator. Snapshots job, generates `application_submitted` event.
  - `updateStatus(id, status)` — persists + appends timeline event
  - `updateNotes`, `selectApplication`, `setFilter`, `setSearch`
  - Selectors: `selectKpis`, `selectFunnel`, `selectPipelineBuckets`, `selectResumePerformance`, `selectSourcePerformance`, `selectActivityFeed`

Future Supabase swap = new repository, zero UI change.

## 3. Intelligence Engine

`intelligence/ApplicationIntelligenceEngine.ts` — pure TS, computed at read time (memoized per app id + updatedAt):

- `ageDays` from `appliedAt`
- `stale` = age > 21 days AND status in {applied, viewed}
- `responseProbability` = blend of source response rate (from user's own data), atsScore, matchScore, age decay
- `nextRecommendedAction` rule table:
  - applied <7d → "Wait for response"
  - applied 7–14d → "Send polite follow-up"
  - applied >14d → "Follow up or move on"
  - interview → "Prepare interview brief"
  - offer → "Active negotiation"
  - rejected → "Closed — request feedback"

## 4. Resume Studio Integration

`src/frontend/resume/panes/InsightsPane.tsx` — existing Apply flow calls `useApplicationsStore.getState().createFromResumeStudio({ job, resume, atsScore, matchScore, templateId })`. Single line, no UI change to Resume Studio.

## 5. UI Composition

```text
src/frontend/applications/
  ApplicationsPage.tsx
  applications.css
  components/
    TrackerHeader.tsx          (title + search + actions)
    KpiRow.tsx                 (8 cards, computed)
    FunnelPanel.tsx            (Applied→Viewed→Review→Interview→Offer)
    PipelineBoard.tsx          (dnd-kit, 7 columns)
    ApplicationsTable.tsx      (virtualized via @tanstack/react-virtual)
    FiltersBar.tsx
    AnalyticsRow.tsx
      ResumePerformancePanel.tsx
      SourceAnalyticsPanel.tsx
    ActivityFeed.tsx
    UpcomingPanel.tsx          (compact: interviews + follow-ups + recent)
    DetailsDrawer/
      index.tsx                (tabs)
      OverviewTab.tsx          (+ IntelligenceCard)
      TimelineTab.tsx
      NotesTab.tsx             (debounced autosave)
      FilesTab.tsx             (PDF/DOCX via Resume Studio export, CL slot reserved)
      IntelligenceCard.tsx
    CompanyAvatar.tsx          (deterministic initials fallback)
  intelligence/
    ApplicationIntelligenceEngine.ts
  state/
    repository.ts
    useApplicationsStore.ts
  schema.ts
```

## 6. KPI Row (all computed)

Applications Sent · Under Review · Interviews · Offers · Response Rate · Interview Rate · **Stale Applications** · **Active Applications**

## 7. Pipeline

`@dnd-kit/core` + `@dnd-kit/sortable`. Drop → `updateStatus` → repo write → timeline event. Counts per column from selector.

## 8. Table

`@tanstack/react-virtual` row virtualization (handles 500+). Columns per spec. Sort, search, pagination (50/page after virtualization). Filters: Status, Source, Resume Version, Date Range, Company, Location.

## 9. Analytics

- **ResumePerformancePanel**: groupBy `resumeVersion` → applications, avgATS, avgMatchScore, interviews, offers, interviewRate.
- **SourceAnalyticsPanel**: groupBy `source` → applications, responses, interviews, offers, response rate.
- **ActivityFeed**: latest 20 events globally.
- **UpcomingPanel**: replaces large calendar — Upcoming Interviews / Follow-ups Needed / Recent Activity (compact list).

## 10. Drawer

Tabs: Overview · Timeline · Notes · Files. Overview includes **IntelligenceCard** (age, response probability, status health pill, next action). Files lists PDF/DOCX generated from `resumeId` via existing Resume Studio export functions; cover letter slot reserved (disabled).

## 11. Error Handling

`CompanyAvatar` deterministic initials when no logo. Missing dates → "—". Missing ATS/match → "Not Available". Missing `sourceUrl` → disabled link. All renderers defensive.

## 12. Dependencies

`bun add @dnd-kit/core @dnd-kit/sortable @tanstack/react-virtual` (only those not already installed; verified at build time).

## 13. Out of Scope

- Manual application creation UI (intentionally absent)
- Cover letter generation (slot only)
- Local Agent runtime (schema fields prepared)
- Server persistence (interface ready)
- Backend KPIs/analytics (all client-side from store)

## 14. Acceptance

- Resume Studio Apply auto-creates tracker entry with snapshot
- Timeline events auto-generated on submit + status change
- KPIs, funnel, analytics all from real data
- Drag-drop persists + writes event
- Stale detection via intelligence engine
- Drawer fully functional with IntelligenceCard
- 500+ rows scroll smooth via virtualization
- Works in Lovable Preview, local dev, offline — no backend
- Reference screenshot layout reproduced (KPI row, pipeline, table, drawer, bottom row)

## Technical Notes

- Pure frontend; no server functions, no migrations.
- Intelligence recomputed via memoized selector keyed on `id + updatedAt + today()`.
- Drawer = CSS slide-over in `applications.css`.
- Dates via `Intl.DateTimeFormat` in try/catch.
- Zustand subscriptions per panel via fine-grained selectors to avoid full-tree rerenders.
