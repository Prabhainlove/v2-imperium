/**
 * core/brain/ollama_brain.ts
 * ==========================
 * Purpose      : Entry point for Imperium's reasoning layer. Re-exports the
 *                server-side brain facade so callers depend on `core/brain`
 *                instead of the implementation path.
 * Inputs       : Tasks from Job Agent modules (job analysis, resume
 *                optimization, cover letters, etc.).
 * Outputs      : Structured JSON / text responses.
 * Responsibility: Single import surface for "the brain". The local Python
 *                automation agent uses its own Ollama client at
 *                `IMPERIUM/local_agent/shared/llm_brain.py`; this module
 *                covers the TypeScript / server-function side only.
 */
export * from "@/lib/imperium/brain/brain.server";
