/**
 * modules/jobs/job_search.ts
 * ==========================
 * Purpose      : Fetches raw job postings from every supported source
 *                (RemoteOK, Remotive, LinkedIn, Adzuna, etc.).
 * Inputs       : role + location strings.
 * Outputs      : `RawJob[]` arrays per source.
 * Responsibility: Source I/O only. Filtering, scoring, and persistence
 *                happen in the other `modules/jobs/*` files.
 */
export * from "@/lib/imperium/sources.server";
