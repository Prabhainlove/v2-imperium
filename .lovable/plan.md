# Plan: Recruiter-Grade, JD-Adaptive Resume System v2

## Goal
One master profile → many tailored, truthful, single-page, ATS-compliant resumes in the Jake's / FAANG-intern style. Same facts, different summary/skill order/project order/keywords per JD. Cover letter + LinkedIn optimizer reuse the same JD engine.

## Out of scope
- No new auth, no schema changes.
- No Canva / Europass / icons / tables / multi-column / progress bars.
- No fabricated skills, metrics, or links — ever.

---

## 1. JD Analysis Engine (shared, dynamic classifier)
File: `src/lib/imperium/profile/jd-analysis.ts` (client-safe, pure, no LLM required)

```ts
interface JDAnalysis {
  primaryRole: string;          // free-form, e.g. "ML Engineer", "QA Engineer"
  confidence: number;           // 0–1
  primaryKeywords: string[];    // must-haves
  secondaryKeywords: string[];  // nice-to-haves
  responsibilities: string[];
  requiredSkills: string[];
  preferredSkills: string[];
}
```

- Dynamic title extraction (no fixed enum). Detect role by scoring weighted keyword clusters (AI / ML / Data Science / Frontend / Backend / Full Stack / Cloud / DevOps / QA / Security / Product Analyst / Business Analyst / Software Engineer / …) — winner becomes `primaryRole`, with `confidence` = winner_score / total_score. Unknown clusters fall back to the literal job title text.
- Required vs. preferred parsed from "Requirements / Must have" vs "Nice to have / Preferred" sections (regex blocks + sentence verbs like "must", "should", "is a plus").
- Reused everywhere — single source of truth (§8).

## 2. Resume Generator (Jake-ATS layout)
File: `src/lib/imperium/profile/generators.ts` (rewrite `buildResumeFromProfile`)

Section order matches user's reference:
1. **Name** (bold)
2. `Location | Phone | Email`
3. `LinkedIn | GitHub | Portfolio` (only validated links — see §7)
4. **PROFILE SUMMARY** — 2–3 lines max, composed from {education + top JD-aligned skills + top project name + primaryRole}. No company name, no AI clichés ("results-driven", "passionate"), no keyword dump.
5. **TECHNICAL SKILLS** — fixed labels: Languages / Frontend / Backend / Databases / Cloud & DevOps / AI & ML / Tools. Skills inside each group reordered by JD relevance. Empty groups hidden. De-duped case-insensitively.
6. **PROJECTS** — re-ranked by JD relevance; max 3 for freshers. Each project:
   - Header: `Project Name | tech stack | dates`
   - `GitHub:` / `Demo:` lines only if URL validates
   - 3–4 bullets produced by the impact rewriter (§5)
7. **EXPERIENCE** — only when non-fresher.
8. **EDUCATION** — single-line compact: `College — Degree — CGPA — Dates`.
9. **CERTIFICATIONS** — `Name – Issuer` per line.
10. **ACHIEVEMENTS** — max 4 bullets.
11. **LANGUAGES** — pipe-separated single line.

Truthfulness: keep existing `validateAgainstProfile` + `stripHallucinations`. Bullets may only mention tech present in the project's stack/highlights.

## 3. Impact Bullet Rewriter (§5)
Function `tailorBullet(rawHighlight, jdAnalysis, projectStack): string` in `generators.ts`.

Format enforced for **every** bullet: **ACTION + TECHNOLOGY + OUTCOME**, ≤ 28 words, ends with period.

- Strong verb chosen from action library (Engineered, Architected, Implemented, Optimized, Automated, Shipped, Reduced, Scaled, Integrated, Refactored). Banned openers: `Developed a…`, `Built an…`, `Created a…`, `Worked on…`, `Helped…`.
- Technology token must come from `projectStack ∩ profile.skills` — no fabrication.
- Outcome clause appended only when the original highlight contains a measurable phrase (improving X, reducing Y, supporting N users). If absent, append a *qualitative* outcome derived from highlight text — never a fake metric.
- Validator rejects bullets that don't satisfy the triple and re-runs the rewriter.

## 4. One-Page PDF Validation (§2 — PDF is source of truth)
File: `src/lib/imperium/resume-render.ts` + new `enforceSinglePage()`.

Flow:
1. Build markdown.
2. Render to off-screen iframe with template CSS.
3. Measure: `pages = ceil(body.scrollHeight / A4_height_px)`.
4. If `pages > 1`, compress in order:
   - Drop achievements beyond 3
   - Drop 4th bullet of lowest-ranked project
   - Drop lowest-ranked project (down to min 2)
   - Drop coursework
   - Tighten summary to 2 lines
   - Last resort: shrink template body font from 11pt → 10.5pt → 10pt
5. Re-render and re-measure. Max 6 iterations; abort with explicit error if still > 1 page.
6. Never drops: contact, education, skills, top-2 projects, certifications presence.

Same loop used both for download and for the live preview badge.

## 5. ATS Scoring + Gap Analysis (§3 + §4)
New: `src/lib/imperium/profile/ats-score.ts`.

```ts
calculateATSMatch(resumeMd, jdAnalysis, profile): {
  atsScore: number;           // 0–100
  keywordCoverage: number;    // 0–100
  matchedSkills: string[];
  missingSkills: string[];    // present in JD, absent from profile
  recommendations: string[];  // actionable, profile-safe
}
```

- Weighted: required keyword coverage 0.55 + preferred 0.20 + section completeness 0.15 + bullet quality (impact triple present) 0.10.
- `missingSkills` is profile-aware: only lists JD terms NOT in profile vocabulary (so the user knows what's actually missing vs. just missing from resume).
- Recommendations are advice ("Add cloud deployment project", "Highlight API development experience") — never fabricate skills.
- Resume Review page (`src/routes/_authenticated/review.$id.tsx`) shows: ATS Score, Keyword Coverage, Matched chips, Missing chips, Recommendations list. No new route.

## 6. GitHub Repository Analysis (§6) — opt-in, graceful fallback
New server fn: `src/lib/imperium/brain/github-intel.functions.ts` (wraps existing `github-intel.server.ts`).

- If a project has a parsable `github.com/<owner>/<repo>` URL: fetch repo metadata + README via GitHub public API (no token required for public repos; uses connector token if linked).
- Extract: top languages, package.json deps (frameworks), first README H1/H2 sections, feature list bullets.
- Feeds `tailorBullet` with repo-derived evidence; clearly tagged so they're preferred over generic highlights.
- Failure (404 / rate limit / private repo) → silently fall back to profile-only generation. Never blocks resume.
- Cached by repo URL via existing `brainOnce` memo.

## 7. Link Validation (§7)
New: `src/lib/imperium/profile/link-validator.ts`.

`validateLinks(profile)` rejects:
- empty / whitespace
- `example.com`, `your-username`, `username`, `linkedin.com/in/yourname`, `github.com/yourname`
- non-http(s) schemes
- malformed URLs (URL constructor throws)
- placeholders matching `^(http(s)?://)?(www\.)?(github|linkedin|portfolio)\.com/?$`

Invalid links are *omitted* from the rendered resume (not "Broken link" text). Surface a warning in the Review page so the user can fix in Profile.

## 8. Shared JD Engine (§8)
Replace JD parsing inside:
- `src/lib/imperium/brain/resume-optimizer.server.ts`
- `src/lib/imperium/brain/cover-letter-generator.server.ts`
- `src/lib/imperium/brain/profile-analysis.server.ts` (LinkedIn / profile recommendations)

…with a single call to `analyzeJobDescription(job)`. All downstream prompts/templates read from the same `JDAnalysis`.

## 9. Quality Gate (§9)
File: `src/lib/imperium/profile/quality-gate.ts`.

Hard-fails generation and triggers a single retry with compression knobs if any of:
- PDF > 1 page after `enforceSinglePage` (§4)
- Summary > 3 lines or > 60 words
- Any project > 4 bullets
- Duplicate skill (case-insensitive)
- Placeholder URL leaked through (§7)
- Generic bullet detected (banned opener / missing triple) (§3)
- ATS score < 55 AND JD overlap with profile ≥ 30% (low score is only a gate when the profile could have done better)

On gate failure: compress + rewrite, re-run gate. Max 2 retries; on second failure return the best attempt with explicit gate-failure annotations in `improvements[]` so the user sees why.

## 10. Template Future-Proofing (§10)
- Rename `template` ids to namespaced: `jake-ats` (default), keep `classic`, `modern`, `compact` as legacy aliases.
- Reserve ids: `stanford`, `faang-modern`, `executive` (not implemented now — registered in `RESUME_TEMPLATES` with `disabled: true` so the UI can show "coming soon" or hide).
- Default everywhere `template ?? "classic"` → `template ?? "jake-ats"`.

## 11. Acceptance Criteria (§11) — automated check
Add a dev-only diagnostic on `/profile-preview`:
- Run generator against 3 sample JDs (AI Engineer / Full Stack / Data Analyst) using the demo profile.
- Show a diff matrix: Summary / Skill order / Project order / ATS score must all differ; Education / Certifications / Email / Phone / Profile skill set must be byte-identical.
- Confirms "different surfacing, identical facts" guarantee.

---

## Files to touch

**New**
- `src/lib/imperium/profile/jd-analysis.ts`
- `src/lib/imperium/profile/ats-score.ts`
- `src/lib/imperium/profile/link-validator.ts`
- `src/lib/imperium/profile/quality-gate.ts`
- `src/lib/imperium/brain/github-intel.functions.ts`

**Rewrite**
- `src/lib/imperium/profile/generators.ts` (impact rewriter + Jake-ATS layout)
- `src/lib/imperium/resume-render.ts` (jake-ats template + `enforceSinglePage` + PDF-truth loop)
- `src/lib/imperium/brain/resume-optimizer.server.ts` (wire JD engine + quality gate + ATS report)
- `src/lib/imperium/brain/cover-letter-generator.server.ts` (use shared JD engine)
- `src/lib/imperium/brain/profile-analysis.server.ts` (use shared JD engine)

**Surface**
- `src/routes/_authenticated/review.$id.tsx` — ATS score panel, matched/missing chips, recommendations, link warnings.
- `src/routes/_authenticated/profile-preview.tsx` — JD-diff diagnostic + one-page badge.
- `src/routes/_authenticated/resume.tsx` — default template = `jake-ats`.

## Acceptance run after build
1. Login `fresher.demo@imperium.app` / `Demo@12345`.
2. Search 3 JDs (AI Engineer, Full Stack Developer, Data Analyst).
3. Each Review page shows: 1-page PDF (verified), distinct Summary + skill/project order + ATS score, profile-safe Missing Skills + Recommendations.
4. Same education, certifications, email, phone, languages across all three.
5. No banned openers; every bullet ≤ 28 words and contains action + tech + outcome; no placeholder/broken links rendered.
