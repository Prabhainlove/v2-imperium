# Brain System

The Brain is Imperium's centralized AI layer. Every AI feature
(profile analysis, ATS scoring, job matching, cover letters,
application readiness, career insights) routes through it.

---

## Why a Brain

1. **One provider switch.** Change `.env` and every feature switches AI
   provider — no code changes.
2. **Automatic failover.** If a provider rate-limits or 5xxes, the next
   provider in the chain handles the call.
3. **Caching.** Identical inputs reuse the cached result from the
   `brain_memory` table.
4. **Auditability.** Every call records the model used, fallback chain,
   attempt count, and duration.
5. **Consistency.** All modules use the same structured-output
   conventions, the same JSON parsing, and the same error surface.

---

## Provider routing

`src/lib/imperium/brain/model-router.server.ts` is the only place that
talks to a model. It walks the configured providers in priority order:

```
OPENROUTER_API_KEY  →  OPENAI_API_KEY  →  ANTHROPIC_API_KEY  →  LOVABLE_API_KEY
```

For each provider it tries a fixed list of models (most-capable →
cheapest). On any error or empty response, it marks the model unhealthy
(2 strikes → 60s cooldown) and moves to the next.

If no provider keys are set, the router throws a descriptive error
naming the missing variables. The app never silently downgrades.

### Adding a new provider

1. Add the env-var name to `.env.example` and `docs/ENVIRONMENT.md`.
2. Extend `Provider` and `PROVIDER_MODELS` in `model-router.server.ts`.
3. Add a `case` in `configFor()` returning the provider's URL, headers,
   request body builder, and response content extractor.
4. Add it to `buildChain()` in the right priority position.

That's it — no Brain module needs to change.

---

## Brain modules

Each Brain module exposes a single async function returning a typed
result. All modules live in `src/lib/imperium/brain/` and are
server-only (`.server.ts`).

| Module                              | Function                                   | Returns                  |
| ----------------------------------- | ------------------------------------------ | ------------------------ |
| `profile-analysis.server.ts`        | `analyzeProfile(profile)`                  | `ProfileIntelligence`    |
| `profile-import.server.ts`          | `extractProfileFromText(text)` / `extractProfileFromPdfBase64(b64)` | `ImportedProfile` |
| `job-analysis.server.ts`            | `scoreJob(profile, listing)`               | `JobScore`               |
| `resume-optimizer.server.ts`        | `optimizeResume(resume, job)`              | `ResumeOptimization`     |
| `cover-letter-generator.server.ts`  | `generateCoverLetter(profile, job)`        | `CoverLetterPackage`     |
| `application-readiness.server.ts`   | `assessReadiness(application)`             | `ApplicationReadiness`   |
| `career-intelligence.server.ts`     | `generateInsights(profile, market)`        | `CareerInsight`          |

All inputs / outputs are defined in `src/lib/imperium/brain/types.ts`.

---

## Calling the Brain from a feature

```ts
// src/lib/imperium/server.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { scoreJob } from "@/lib/imperium/brain/job-analysis.server";

export const scoreJobForUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: job }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("job_listings").select("*").eq("id", data.jobId).single(),
    ]);
    return scoreJob(profile, job);
  });
```

Rules:

- A UI component never imports a `.server.ts` Brain module directly.
- A UI component never calls `fetch("https://api.openai.com/...")`.
- Every AI call goes through the Brain so caching, retries, logging,
  and failover are uniform.

---

## Caching (`brain_memory` table)

Brain modules that use deterministic prompts hash their input and look
it up in `brain_memory` before calling a model. On a cache hit the
result is returned instantly and the call is recorded as `cached: true`.

To bypass the cache for a single call, modules accept an optional
`{ bypassCache: true }` flag. To clear the cache for a user, delete
their rows from `brain_memory` (RLS allows users to delete their own).

---

## Failure modes

| Symptom in UI                                     | Cause                                          | Fix                                                                 |
| ------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------- |
| `Brain has no AI provider configured`             | No provider env var set.                       | Add `OPENROUTER_API_KEY` (or another) to `.env` and restart.        |
| `Brain: all models failed. Chain=…`               | All providers errored or rate-limited.         | Inspect `fallback_chain` in the error message; fix the upstream.    |
| Cached result is wrong                            | Stale cache row.                               | Delete the row from `brain_memory`, or call with `bypassCache`.     |
| `Empty response from model`                       | Model returned no content.                     | Retried automatically; if persistent, switch providers.             |
