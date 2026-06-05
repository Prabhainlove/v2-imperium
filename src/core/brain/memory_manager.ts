/**
 * core/brain/memory_manager.ts
 * ============================
 * Purpose      : Long-lived memory the brain reads/writes across runs
 *                (profile facts, prior decisions, scoring history).
 * Inputs       : User id + memory key/value records.
 * Outputs      : Memory records used by reasoning modules.
 * Responsibility: Persistence of brain memory. No reasoning, no UI.
 */
export * from "@/lib/imperium/brain/memory.server";
