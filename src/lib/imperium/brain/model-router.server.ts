/**
 * Imperium Brain — model router with automatic failover.
 * Server-only. Prefers Lovable AI Gateway (LOVABLE_API_KEY, auto-provisioned).
 * Falls back to OpenRouter only if OPENROUTER_API_KEY is configured.
 */
import type { BrainModelInfo } from "./types";

/** Lovable AI Gateway models (primary chain). */
export const BRAIN_MODELS: BrainModelInfo[] = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", free: false },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", free: false },
  { id: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", free: false },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", free: false },
];

/** OpenRouter fallback chain — used only if OPENROUTER_API_KEY is set. */
const OPENROUTER_MODELS: BrainModelInfo[] = [
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

type Provider = "lovable" | "openrouter";

async function callChat(
  provider: Provider,
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

    const url =
      provider === "lovable"
        ? "https://ai.gateway.lovable.dev/v1/chat/completions"
        : "https://openrouter.ai/api/v1/chat/completions";
    const headers: Record<string, string> =
      provider === "lovable"
        ? { "Content-Type": "application/json", "Lovable-API-Key": apiKey }
        : {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": "https://imperium.lovable.app",
            "X-Title": "Imperium Brain",
          };

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      const tag = provider === "lovable" ? "LovableAI" : "OpenRouter";
      throw new Error(`${tag} ${res.status}: ${text.slice(0, 200)}`);
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

/** Call models in order with automatic failover across providers. */
export async function routeBrainCall(
  input: BrainModelCallInput,
): Promise<BrainModelCallResult> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (!lovableKey && !openrouterKey) {
    throw new Error(
      "Brain needs an AI key. LOVABLE_API_KEY is auto-provisioned by Lovable Cloud — enable Cloud or add OPENROUTER_API_KEY.",
    );
  }

  const chain: { provider: Provider; key: string; model: BrainModelInfo }[] = [];
  if (lovableKey) for (const m of BRAIN_MODELS) chain.push({ provider: "lovable", key: lovableKey, model: m });
  if (openrouterKey) for (const m of OPENROUTER_MODELS) chain.push({ provider: "openrouter", key: openrouterKey, model: m });

  const start = Date.now();
  const fallback_chain: string[] = [];
  let attempts = 0;
  let lastErr: unknown = null;

  for (const step of chain) {
    if (isInCooldown(step.model.id)) {
      fallback_chain.push(`${step.model.id}:cooldown`);
      continue;
    }
    attempts++;
    try {
      const content = await callChat(step.provider, step.model.id, input, step.key);
      markSuccess(step.model.id);
      return {
        content,
        model: step.model.id,
        fallback_chain,
        attempts,
        duration_ms: Date.now() - start,
      };
    } catch (err) {
      lastErr = err;
      markFailure(step.model.id);
      fallback_chain.push(
        `${step.model.id}:${err instanceof Error ? err.message.slice(0, 60) : "error"}`,
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
