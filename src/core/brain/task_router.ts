/**
 * core/brain/task_router.ts
 * =========================
 * Purpose      : Routes a brain task (classification, scoring, generation)
 *                to the right model + handles fallback chain.
 * Inputs       : `BrainModelCallInput` describing the task kind + payload.
 * Outputs      : `BrainModelCallResult` with model used + timing stats.
 * Responsibility: Model selection only. Reasoning lives in specialist
 *                modules under `core/agents/job_agent/modules/**`.
 */
export * from "@/lib/imperium/brain/model-router.server";
