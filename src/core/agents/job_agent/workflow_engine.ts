/**
 * core/agents/job_agent/workflow_engine.ts
 * ========================================
 * Purpose      : Runs the end-to-end job application pipeline
 *                (fetch → score → render resume → evaluate → record).
 * Inputs       : `PipelineInput` (user id, search params, profile).
 * Outputs      : Created application records + activity events.
 * Responsibility: Orchestration only. Each step delegates to a module.
 */
export * from "@/lib/imperium/pipeline.server";
