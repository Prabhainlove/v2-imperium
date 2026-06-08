/**
 * core/agents/job_agent/state_manager.ts
 * ======================================
 * Purpose      : Exposes every TanStack server function the Job Agent ships
 *                (profile, jobs, applications, activity, interviews, etc.).
 * Inputs       : Validated server-fn payloads.
 * Outputs      : DTOs consumed by routes and the React UI.
 * Responsibility: Read/write of agent state in Lovable Cloud. No business
 *                logic — that lives in modules.
 */
export * from "@backend/api/imperium.api";
