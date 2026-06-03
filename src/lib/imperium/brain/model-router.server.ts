/**
 * Imperium Brain — OpenRouter model router with automatic failover.
 * Server-only. Reads OPENROUTER_API_KEY from process.env.
 */
import type { BrainModelInfo } from "./types";

export const BRAIN_MODELS: BrainModelInfo[] = [
  { id: "nvidia/nemotron-3-super-120b-a12b:free", label: "Nemotron 3 Super 120B", free: true },
  { id: "openai/gpt-oss-120b:free", label: "GPT-OSS 120B", free: true },
  { id: "deepseek/deepseek-chat", label: "DeepSeek Chat", free: false },
  { id: "qwen/qwen3-235b-a22b", label: "Qwen3 235B", free: false },
  { id: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick", free: false },
];

const PROVIDER_HEALTH = new Map<string, { failures: number; cooldownUntil: number }>();
const COOLDOWN_MS = 60_000;
const MAX_FAILURES_BEFORE_COOLDOWN = 2;

function isInCooldown(modelId: string): boolean {
  const h = PROVIDER_HEALTH.get(modelId);
  if (!h) return false;
  if (h.failures >= MAX_FAILURES_BEFORE_COOLDOWN && Date.now() < h.cooldownUntil) return true;
  if (Date.now() >= h.cooldownUntil) PROVIDER_HEALTH.delete(modelId);
  return false;
}

function markFailure(modelId: string) {
  const h = PROVIDER_HEALTH.get(modelId) ?? { failures: 0, cooldownUntil: 0 };
  h.failures += 1;
  if (h.failures >= MAX_FAILURES_BEFORE_COOLDOWN) h.cooldownUntil = Date.now() + COOLDOWN_MS;
  PROVIDER_HEALTH.set(modelId, h);
}

function markSuccess(modelId: string) {
  PROVIDER_HEALTH.delete(modelId);
}

export interface BrainModelCallInput {
  system: string;
  user: string;
  temperature?: number;
  max_tokens?: number;
  json?: boolean;
}

export interface BrainModelCallResult {
  content: string;
  model: string;
  fallback_chain: string[];
  attempts: number;
  duration_ms: number;
}

async function callOpenRouter(
  modelId: string,
  input: BrainModelCallInput,
  apiKey: string,
  timeoutMs = 25_000,
): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body: Record<string, unknown> = {
      model: modelId,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
      temperature: input.temperature ?? 0.4,
      max_tokens: input.max_tokens ?? 1400,
    };
    if (input.json) body.response_format = { type: "json_object" };

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://imperium.lovable.app",
        "X-Title": "Imperium Brain",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    if (!content.trim()) throw new Error("Empty response from model");
    return content;
  } finally {
    clearTimeout(t);
  }
}

/** Call models in order with automatic failover. */
export async function routeBrainCall(
  input: BrainModelCallInput,
): Promise<BrainModelCallResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const start = Date.now();
  const fallback_chain: string[] = [];
  let attempts = 0;
  let lastErr: unknown = null;

  for (const model of BRAIN_MODELS) {
    if (isInCooldown(model.id)) {
      fallback_chain.push(`${model.id}:cooldown`);
      continue;
    }
    attempts++;
    try {
      const content = await callOpenRouter(model.id, input, apiKey);
      markSuccess(model.id);
      return {
        content,
        model: model.id,
        fallback_chain,
        attempts,
        duration_ms: Date.now() - start,
      };
    } catch (err) {
      lastErr = err;
      markFailure(model.id);
      fallback_chain.push(
        `${model.id}:${err instanceof Error ? err.message.slice(0, 60) : "error"}`,
      );
      continue;
    }
  }

  throw new Error(
    `Brain: all models failed. Chain=${fallback_chain.join(" | ")}. Last=${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`,
  );
}
