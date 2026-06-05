/**
 * core/agents/job_agent/planner.ts
 * ================================
 * Purpose      : Decides "should this application be submitted?" — readiness
 *                scoring, risk flags, final recommendation.
 * Inputs       : Job + profile + resume snapshot.
 * Outputs      : `ApplicationReadiness` verdict.
 * Responsibility: Planning only. Execution happens in `workflow_engine`.
 */
export * from "@/lib/imperium/brain/application-engine.server";
