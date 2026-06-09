/**
 * Debug-only endpoint to trace the Job Discovery funnel without auth.
 * Gated by DEBUG_JOBS_TRACE=1 env var.
 *
 *   curl -X POST $URL/api/public/debug/jobs-trace \
 *     -H 'content-type: application/json' \
 *     -d '{"title":"Front End","location":"Hyderabad","experience":"fresher","skills":""}'
 */
import { createFileRoute } from "@tanstack/react-router";
import { SOURCES } from "@backend/jobs/JobSources.server";
import { normalizeMany, selectTop5 } from "@backend/jobs/JobNormalizationService.server";
import { classifyExperience, type CandidateContext, type ExperienceBucket } from "@backend/jobs/JobRankingService.server";

export const Route = createFileRoute("/api/public/debug/jobs-trace")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (process.env.DEBUG_JOBS_TRACE !== "1") {
          return new Response("Disabled. Set DEBUG_JOBS_TRACE=1.", { status: 403 });
        }
        const body = (await request.json().catch(() => ({}))) as {
          title?: string; location?: string; experience?: string;
          skills?: string; salaryMin?: number | null; workMode?: string;
        };
        const role = body.title || "Front End";
        const location = body.location || "Hyderabad";
        const bucket = (body.experience || "") as ExperienceBucket | "";
        const skills = (body.skills || "").split(",").map((s) => s.trim()).filter(Boolean);

        const candidate: CandidateContext = {
          role,
          skills,
          experience: "",
          experienceBucket: bucket ? (bucket as ExperienceBucket) : null,
          location,
          desiredSalaryMin: body.salaryMin ?? null,
        };

        // 1. Per-source fetch (kept = after each adapter's internal matchesQuery).
        const perSource = await Promise.all(
          SOURCES.map(async (src) => {
            if (!src.isAvailable()) return { id: src.id, label: src.label, status: "skipped", kept: 0 };
            try {
              const jobs = await src.fetch(role, location);
              return { id: src.id, label: src.label, status: "ok", kept: jobs.length, jobs };
            } catch (err) {
              return { id: src.id, label: src.label, status: "failed", kept: 0, error: (err as Error).message };
            }
          }),
        );

        // Known-missing sources (not implemented):
        const missing = ["foundit", "wellfound", "yc"].map((id) => ({
          id, label: id, status: "not_implemented", kept: 0,
        }));

        // 2. Dedup & normalize
        const allRaws = perSource.flatMap((s: any) => s.jobs ?? []);
        const seen = new Set<string>();
        const unique = allRaws.filter((j: any) => {
          const k = `${j.source}:${j.external_id}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });

        const sampleRaw = unique.slice(0, 20).map((j: any) => ({
          source: j.source,
          title: j.title,
          location: j.location,
          experienceBucket: classifyExperience(j.title, j.description),
        }));

        let normalized = normalizeMany(unique as any, candidate);
        const afterNormalize = normalized.length;

        // 3. Experience filter
        const beforeExp = normalized.length;
        if (candidate.experienceBucket) {
          normalized = normalized.filter((j) => j.experienceBucket === candidate.experienceBucket);
        }
        const afterExperienceFilter = normalized.length;

        // 4. Salary filter
        if (candidate.desiredSalaryMin && candidate.desiredSalaryMin > 0) {
          normalized = normalized.filter((j) => {
            const cap = j.salaryMax ?? j.salaryMin;
            return cap == null || cap >= candidate.desiredSalaryMin!;
          });
        }
        const afterSalaryFilter = normalized.length;

        // 5. Work mode
        const mode = (body.workMode || "").toLowerCase();
        if (mode === "remote") normalized = normalized.filter((j) => j.remote);
        else if (mode === "onsite") normalized = normalized.filter((j) => !j.remote);
        const afterModeFilter = normalized.length;

        // 6. Title family gate / score
        const afterTitleFamilyGate = normalized.filter((j) => !j.titleMismatch).length;
        const afterScoreThreshold = normalized.filter((j) => j.matchScore >= 0.45 && !j.titleMismatch).length;

        const sampleFiltered = normalized.slice(0, 20).map((j) => ({
          title: j.title,
          location: j.location,
          source: j.source,
          score: Number(j.matchScore.toFixed(3)),
          experienceBucket: j.experienceBucket,
          locationTier: j.locationTier,
          titleMismatch: j.titleMismatch,
          breakdown: j.breakdown,
          survived: j.matchScore >= 0.45 && !j.titleMismatch,
          why: `title=${j.breakdown.title} skills=${j.breakdown.skills} exp=${j.breakdown.experience} loc=${j.breakdown.location}(${j.locationTier}) fresh=${j.breakdown.freshness} sal=${j.breakdown.salary}`,
        }));

        const top5 = selectTop5(normalized);

        return Response.json({
          query: { role, location, bucket, skills },
          perSource: [...perSource.map((s: any) => ({ id: s.id, label: s.label, status: s.status, kept: s.kept, error: s.error })), ...missing],
          funnel: {
            afterRetrieval: unique.length,
            afterNormalize,
            beforeExperienceFilter: beforeExp,
            afterExperienceFilter,
            afterSalaryFilter,
            afterModeFilter,
            afterTitleFamilyGate,
            afterScoreThreshold,
            top5: top5.length,
          },
          sampleRaw,
          sampleFiltered,
        });
      },
    },
  },
});
