/**
 * core/brain/context_manager.ts
 * =============================
 * Purpose      : Builds the per-call reasoning context (prompts, JSON
 *                schemas, extraction helpers) shared by every brain task.
 * Inputs       : Task-specific payloads (profile, job, resume, etc.).
 * Outputs      : Normalized prompts + parsed JSON results.
 * Responsibility: Prompt assembly + safe JSON parsing. No model selection.
 */
export * from "@/lib/imperium/brain/reasoning.server";
