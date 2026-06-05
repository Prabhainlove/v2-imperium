/**
 * core/agents/job_agent/agent_memory.ts
 * =====================================
 * Purpose      : Job Agent's view of brain memory (decisions, prior scores,
 *                user preferences gathered over time).
 * Inputs       : User id + memory key/value records.
 * Outputs      : Memory records keyed per user.
 * Responsibility: Re-exports the shared memory layer so the Job Agent
 *                imports its own memory surface instead of reaching into
 *                the brain folder.
 */
export * from "@/lib/imperium/brain/memory.server";
