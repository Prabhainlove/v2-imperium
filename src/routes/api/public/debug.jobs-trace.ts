/**
 * Debug-only endpoint to trace the Job Discovery funnel without auth.
 * Gated by DEBUG_JOBS_TRACE=1 env var.
 *
 *   curl -X POST $URL/api/public/debug/jobs-trace \
 *     -H 'content-type: application/json' \
 *     -d '{"title":"Front End Developer","location":"Bangalore","experience":"fresher","skills":""}'
 */
import { createFileRoute } from "@tanstack/react-router";
import { SOURCES, type RawJob } from "@backend/jobs/JobSources.server";
import { normalizeMany, selectTop5 } from "@backend/jobs/JobNormalizationService.server";
import { classifyExperience, familyOf, type CandidateContext, type ExperienceBucket } from "@backend/jobs/JobRankingService.server";
import { validateJob } from "@backend/jobs/JobValidationService.server";

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
        const role = body.title || "Front End Developer";
        const location = body.location || "Bangalore";
        const bucket = (body.experience || "") as ExperienceBucket | "";
        const skills = (body.skills || "").split(",").map((s) => s.trim()).filter(Boolean);

        const candidate: CandidateContext = {
          role, skills, experience: "",
          experienceBucket: bucket ? (bucket as ExperienceBucket) : null,
          location,
          desiredSalaryMin: body.salaryMin ?? null,
        };

        // 1. Per-source fetch with timing + error capture + validation summary.
        const perSource = await Promise.all(
          SOURCES.map(async (src) => {
            if (!src.isAvailable()) return { id: src.id, label: src.label, status: "skipped" as const, raw: 0, valid: 0, ms: 0, jobs: [] as RawJob[] };
            const t0 = Date.now();
            try {
              const jobs = await src.fetch(role, location);
              const valid = jobs.filter((j) => validateJob(j).qualityStatus === "ok").length;
              return { id: src.id, label: src.label, status: "ok" as const, raw: jobs.length, valid, ms: Date.now() - t0, jobs };
            } catch (err) {
              return { id: src.id, label: src.label, status: "failed" as const, raw: 0, valid: 0, ms: Date.now() - t0, error: (err as Error).message, jobs: [] as RawJob[] };
            }
          }),
        );

        // 2. Dedup
        const allRaws = perSource.flatMap((s) => s.jobs);
        const seen = new Set<string>();
        const unique = allRaws.filter((j) => {
          const k = `${j.source}:${j.external_id}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });

        const queryFamily = familyOf(role);

        // Validation breakdown
        const validationBreakdown = { ok: 0, incomplete: 0, invalid_url: 0, missing_description: 0 };
        for (const j of unique) validationBreakdown[validateJob(j).qualityStatus]++;

        const sampleRaw = unique.slice(0, 20).map((j) => {
          const q = validateJob(j);
          return {
            source: j.source,
            title: j.title,
            company: j.company,
            location: j.location,
            url: j.url,
            urlValid: q.qualityStatus !== "invalid_url",
            descriptionLen: (j.description ?? "").length,
            descriptionSource: q.descriptionSource,
            qualityStatus: q.qualityStatus,
            qualityScore: q.qualityScore,
            qualityReasons: q.qualityReasons,
            experienceBucket: classifyExperience(j.title, j.description, j.experience_text ?? null),
            experienceText: j.experience_text ?? null,
            experienceIntegrity: q.experienceIntegrity,
            jobFamily: familyOf(j.title),
          };
        });

        let normalized = normalizeMany(unique, candidate);
        const afterNormalize = normalized.length;

        const removals: Record<string, number> = {
          experience_mismatch: 0, salary: 0, mode: 0,
        };

        if (candidate.experienceBucket) {
          const before = normalized.length;
          normalized = normalized.filter(
            (j) => j.experienceBucket == null || j.experienceBucket === candidate.experienceBucket,
          );
          removals.experience_mismatch = before - normalized.length;
        }
        const afterExperienceFilter = normalized.length;

        if (candidate.desiredSalaryMin && candidate.desiredSalaryMin > 0) {
          const before = normalized.length;
          normalized = normalized.filter((j) => {
            const cap = j.salaryMax ?? j.salaryMin;
            return cap == null || cap >= candidate.desiredSalaryMin!;
          });
          removals.salary = before - normalized.length;
        }
        const afterSalaryFilter = normalized.length;

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
        const afterQualityGate = normalized.filter((j) => j.qualityStatus === "ok" && j.qualityScore >= 60).length;
        const afterScoreThreshold = normalized.filter((j) => j.matchScore >= 0.5 && !j.titleMismatch).length;
        const top5 = selectTop5(normalized);

        const sampleFiltered = normalized.slice(0, 20).map((j) => ({
          title: j.title,
          company: j.company,
          location: j.location,
          source: j.source,
          score: Number(j.matchScore.toFixed(3)),
          qualityStatus: j.qualityStatus,
          qualityScore: j.qualityScore,
          qualityReasons: j.qualityReasons,
          descriptionSource: j.descriptionSource,
          sourceConfidence: j.sourceConfidence,
          experienceBucket: j.experienceBucket,
          experienceIntegrity: j.experienceIntegrity,
          locationTier: j.locationTier,
          freshnessDays: j.freshnessDays,
          titleMismatch: j.titleMismatch,
          breakdown: j.breakdown,
          survivesTop5: top5.some((t) => t.id === j.id),
          removedFromTop5Because: top5.some((t) => t.id === j.id) ? null : [
            j.qualityStatus !== "ok" && `quality=${j.qualityStatus}`,
            j.qualityScore < 60 && `qualityScore=${j.qualityScore}`,
            j.titleMismatch && "titleMismatch",
            j.matchScore < 0.5 && `matchScore=${j.matchScore.toFixed(2)}`,
            j.freshnessDays > 30 && `stale=${j.freshnessDays}d`,
            !["same_city","same_state","remote","same_country"].includes(j.locationTier) && `tier=${j.locationTier}`,
          ].filter(Boolean),
        }));

        return Response.json({
          query: { role, location, bucket, skills, queryFamily },
          perSource: perSource.map((s) => ({
            id: s.id, label: s.label, status: s.status,
            raw: s.raw, valid: s.valid, ms: s.ms,
            error: (s as { error?: string }).error,
          })),
          validationBreakdown,
          funnel: {
            afterRetrieval: unique.length,
            afterNormalize,
            afterExperienceFilter,
            afterSalaryFilter,
            afterModeFilter,
            afterTitleFamilyGate,
            afterQualityGate,
            afterScoreThreshold,
            top5: top5.length,
          },
          removalReasons: removals,
          sampleRaw,
          sampleFiltered,
          top5: top5.map((t) => ({
            title: t.title, company: t.company, location: t.location,
            score: t.matchScore, qualityScore: t.qualityScore, source: t.source, url: t.url,
          })),
        });
      },
    },
  },
});
