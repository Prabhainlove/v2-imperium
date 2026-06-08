/**
 * Imperium Brain — Reasoning primitives. Tolerant JSON extraction so
 * downstream specialists never explode on slightly malformed model output.
 */
import { routeBrainCall, type BrainModelCallInput } from "./model-router.server";

export function extractJson(raw: string): unknown {
  const s = raw.trim();
  // Strip code fences
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : s;
  try {
    return JSON.parse(candidate);
  } catch {
    // Find first {...} block
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        // fall through
      }
    }
  }
  return null;
}

export async function brainText(input: BrainModelCallInput): Promise<string> {
  const out = await routeBrainCall(input);
  return out.content;
}

export async function brainJson<T>(
  input: BrainModelCallInput,
  validate?: (v: unknown) => T,
): Promise<{ data: T | null; raw: string; model: string }> {
  const out = await routeBrainCall({ ...input, json: true });
  const parsed = extractJson(out.content);
  let data: T | null = null;
  if (parsed !== null) {
    try {
      data = validate ? validate(parsed) : (parsed as T);
    } catch {
      data = null;
    }
  }
  return { data, raw: out.content, model: out.model };
}
