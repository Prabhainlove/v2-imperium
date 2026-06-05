/**
 * core/automation/automation_client.ts
 * ====================================
 * Purpose      : Existing Imperium HTTP client used by React components
 *                (health, profile, jobs, applications, etc.). Re-exported
 *                here so the UI imports from `core/automation` instead of
 *                reaching into `lib/imperium`.
 * Inputs       : Whatever each call needs (see `lib/imperium/client.ts`).
 * Outputs      : DTOs returned by TanStack server functions.
 * Responsibility: Transport only.
 */
export * from "@/lib/imperium/client";
