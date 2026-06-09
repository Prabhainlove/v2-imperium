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
import { classifyExperience, familyOf, type CandidateContext, type ExperienceBucket } from "@backend/jobs/JobRankingService.server";

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

        // 1. Per-source fetch with timing + error capture
        const perSource = await Promise.all(
          SOURCES.map(async (src) => {
            if (!src.isAvailable()) return { id: src.id, label: src.label, status: "skipped", kept: 0, ms: 0 };
            const t0 = Date.now();
            try {
              const jobs = await src.fetch(role, location);
              return { id: src.id, label: src.label, status: "ok", kept: jobs.length, ms: Date.now() - t0, jobs };
            } catch (err) {
              return { id: src.id, label: src.label, status: "failed", kept: 0, ms: Date.now() - t0, error: (err as Error).message };
            }
          }),
        );

        // 2. Dedup
        const allRaws = perSource.flatMap((s: any) => s.jobs ?? []);
        const seen = new Set<string>();
        const unique = allRaws.filter((j: any) => {
          const k = `${j.source}:${j.external_id}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });

        const queryFamily = familyOf(role);

        const sampleRaw = unique.slice(0, 20).map((j: any) => ({
          source: j.source,
          title: j.title,
          location: j.location,
          remote: j.remote,
          experienceBucket: classifyExperience(j.title, j.description, j.experience_text ?? null),
          experienceText: j.experience_text ?? null,
          jobFamily: familyOf(j.title),
        }));

        let normalized = normalizeMany(unique as any, candidate);
        const afterNormalize = normalized.length;

        // Track removal reasons
        const removals: Record<string, number> = {
          experience_mismatch: 0,
          salary: 0,
          mode: 0,
        };

        // Experience filter — keep unknown (null) buckets
        if (candidate.experienceBucket) {
          const before = normalized.length;
          normalized = normalized.filter(
            (j) => j.experienceBucket == null || j.experienceBucket === candidate.experienceBucket,
          );
          removals.experience_mismatch = before - normalized.length;
        }
        const afterExperienceFilter = normalized.length;

        // Salary
        if (candidate.desiredSalaryMin && candidate.desiredSalaryMin > 0) {
          const before = normalized.length;
          normalized = normalized.filter((j) => {
            const cap = j.salaryMax ?? j.salaryMin;
            return cap == null || cap >= candidate.desiredSalaryMin!;
          });
          removals.salary = before - normalized.length;
        }
        const afterSalaryFilter = normalized.length;

        // Mode
        const mode = (body.workMode || "").toLowerCase();
        if (mode === "remote") {
          const before = normalized.length;
          normalized = normalized.filter((j) => j.remote);
          removals.mode = before - normalized.length;
        } else if (mode === "onsite") {
          const before = normalized.length;
          normalized = normalized.filter((j) => !j.remote);
          removals.mode = before - normalized.length;
        }
        const afterModeFilter = normalized.length;

        const afterTitleFamilyGate = normalized.filter((j) => !j.titleMismatch).length;
        const afterScoreThreshold = normalized.filter((j) => j.matchScore >= 0.5 && !j.titleMismatch).length;
        const top5 = selectTop5(normalized);

        const sampleFiltered = normalized.slice(0, 20).map((j) => ({
          title: j.title,
          company: j.company,
          location: j.location,
          source: j.source,
          score: Number(j.matchScore.toFixed(3)),
          experienceBucket: j.experienceBucket,
          locationTier: j.locationTier,
          freshnessDays: j.freshnessDays,
          titleMismatch: j.titleMismatch,
          breakdown: j.breakdown,
          survivesTop5: top5.some((t) => t.id === j.id),
          why: `title=${j.breakdown.title} skills=${j.breakdown.skills} exp=${j.breakdown.experience} loc=${j.breakdown.location}(${j.locationTier}) fresh=${j.breakdown.freshness}(${j.freshnessDays}d) sal=${j.breakdown.salary}${j.titleMismatch ? " [TITLE_MISMATCH]" : ""}`,
        }));

        return Response.json({
          query: { role, location, bucket, skills, queryFamily },
          perSource: perSource.map((s: any) => ({
            id: s.id, label: s.label, status: s.status, kept: s.kept, ms: s.ms, error: s.error,
          })),
          funnel: {
            afterRetrieval: unique.length,
            afterNormalize,
            afterExperienceFilter,
            afterSalaryFilter,
            afterModeFilter,
            afterTitleFamilyGate,
            afterScoreThreshold,
            top5: top5.length,
          },
          removalReasons: removals,
          sampleRaw,
          sampleFiltered,
          top5: top5.map((t) => ({ title: t.title, company: t.company, location: t.location, score: t.matchScore, source: t.source })),
        });
      },
    },
  },
});
