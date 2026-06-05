/**
 * modules/jobs/job_tracker.ts
 * ===========================
 * Purpose      : Persists discovered / saved jobs and exposes the
 *                server-function reads used by the Jobs page.
 * Inputs       : User id + job records.
 * Outputs      : Lists of saved / pending / dismissed jobs.
 * Responsibility: Job persistence only.
 */
export {
  getJobs,
  runJobSearch,
  saveJobListing,
  unsaveJobListing,
  getSavedJobs,
} from "@/lib/imperium/server.functions";
