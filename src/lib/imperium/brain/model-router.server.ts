/**
 * Imperium Brain — model router with multi-provider failover.
 *
 * Provider priority (whichever keys are present, in this order):
 *   1. OPENROUTER_API_KEY   (broadest model catalog, recommended default)
 *   2. OPENAI_API_KEY       (OpenAI direct)
 *   3. ANTHROPIC_API_KEY    (Anthropic direct)
 *   4. LOVABLE_API_KEY      (Lovable AI Gateway — only available on Lovable Cloud)
 *
 * Configure exactly the providers you want by setting the corresponding
 * env vars. If none are set, calls throw a clear error explaining what
 * to add to `.env`.
 *
 * Server-only. Never import from client code.
 */
import type { BrainModelInfo } from "./types";

type Provider = "ollama" | "openrouter" | "openai" | "anthropic";

/** Default chat-model chain per provider (most-capable → cheapest).
 *  Ollama is FIRST when configured — fully local, no API key, no cost.
 *  Set OLLAMA_BASE_URL (e.g. http://localhost:11434) and optionally
 *  OLLAMA_MODEL (default: llama3.1) to enable. */
const PROVIDER_MODELS: Record<Provider, BrainModelInfo[]> = {
  ollama: [
    { id: process.env.OLLAMA_MODEL || "llama3.1", label: `Ollama ${process.env.OLLAMA_MODEL || "llama3.1"} (local)`, free: true },
  ],
  openrouter: [
    { id: "nvidia/nemotron-3-super-120b-a12b:free", label: "Nemotron 3 Super 120B (free)", free: true },
    { id: "openai/gpt-oss-120b:free", label: "GPT-OSS 120B (free)", free: true },
    { id: "qwen/qwen3-235b-a22b-thinking-2507:free", label: "Qwen3 235B Thinking (free)", free: true },
  ],
  openai: [
    { id: "gpt-4o-mini", label: "GPT-4o mini", free: false },
  ],
  anthropic: [
    { id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku", free: false },
  ],
};

/** Exported for UI display. Returns the active chain based on configured keys. */
export const BRAIN_MODELS: BrainModelInfo[] = (() => {
  const out: BrainModelInfo[] = [];
  if (process.env.OLLAMA_BASE_URL) out.push(...PROVIDER_MODELS.ollama);
  if (process.env.OPENROUTER_API_KEY) out.push(...PROVIDER_MODELS.openrouter);
  if (process.env.OPENAI_API_KEY) out.push(...PROVIDER_MODELS.openai);
  if (process.env.ANTHROPIC_API_KEY) out.push(...PROVIDER_MODELS.anthropic);
  return out;
})();

const PROVIDER_HEALTH = new Map<string, { failures: number; cooldownUntil: number }>();
const COOLDOWN_MS = 60_000;
const MAX_FAILURES_BEFORE_COOLDOWN = 2;

function healthKey(provider: Provider, modelId: string) {
  return `${provider}:${modelId}`;
}
function isInCooldown(key: string): boolean {
  const h = PROVIDER_HEALTH.get(key);
  if (!h) return false;
  if (h.failures >= MAX_FAILURES_BEFORE_COOLDOWN && Date.now() < h.cooldownUntil) return true;
  if (Date.now() >= h.cooldownUntil) PROVIDER_HEALTH.delete(key);
  return false;
}
function markFailure(key: string) {
  const h = PROVIDER_HEALTH.get(key) ?? { failures: 0, cooldownUntil: 0 };
  h.failures += 1;
  if (h.failures >= MAX_FAILURES_BEFORE_COOLDOWN) h.cooldownUntil = Date.now() + COOLDOWN_MS;
  PROVIDER_HEALTH.set(key, h);
}
function markSuccess(key: string) {
  PROVIDER_HEALTH.delete(key);
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

interface ProviderConfig {
  url: string;
  headers: Record<string, string>;
  /** Build the request body for this provider. */
  buildBody: (modelId: string, input: BrainModelCallInput) => Record<string, unknown>;
  /** Extract content from the response JSON. */
  extractContent: (json: unknown) => string;
}

function configFor(provider: Provider, apiKey: string): ProviderConfig {
  switch (provider) {
    case "openrouter":
      return {
        url: "https://openrouter.ai/api/v1/chat/completions",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.PUBLIC_APP_URL ?? "http://localhost:3000",
          "X-Title": "Imperium Brain",
        },
        buildBody: (modelId, input) => {
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
          return body;
        },
        extractContent: (json) =>
          (json as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message
            ?.content ?? "",
      };

    case "openai":
      return {
        url: "https://api.openai.com/v1/chat/completions",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        buildBody: (modelId, input) => {
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
          return body;
        },
        extractContent: (json) =>
          (json as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message
            ?.content ?? "",
      };

    case "anthropic":
      return {
        url: "https://api.anthropic.com/v1/messages",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        buildBody: (modelId, input) => ({
          model: modelId,
          system: input.json
            ? `${input.system}\n\nReturn ONLY a valid JSON object. No prose, no markdown fences.`
            : input.system,
          messages: [{ role: "user", content: input.user }],
          temperature: input.temperature ?? 0.4,
          max_tokens: input.max_tokens ?? 1400,
        }),
        extractContent: (json) => {
          const parts = (json as { content?: { type: string; text?: string }[] }).content ?? [];
          return parts
            .filter((p) => p.type === "text")
            .map((p) => p.text ?? "")
            .join("");
        },
      };

    case "ollama": {
      const base = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/$/, "");
      return {
        url: `${base}/v1/chat/completions`,
        headers: { "Content-Type": "application/json" },
        buildBody: (modelId, input) => {
          const body: Record<string, unknown> = {
            model: modelId,
            messages: [
              { role: "system", content: input.system },
              { role: "user", content: input.user },
            ],
            temperature: input.temperature ?? 0.4,
            max_tokens: input.max_tokens ?? 1400,
            stream: false,
          };
          if (input.json) body.response_format = { type: "json_object" };
          return body;
        },
        extractContent: (json) =>
          (json as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message
            ?.content ?? "",
      };
    }
  }
}

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
    const cfg = configFor(provider, apiKey);
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: cfg.headers,
      body: JSON.stringify(cfg.buildBody(modelId, input)),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${provider} ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    const content = cfg.extractContent(data);
    if (!content.trim()) throw new Error(`${provider}: empty response from model`);
    return content;
  } finally {
    clearTimeout(t);
  }
}

/** Build the active provider chain from env keys. */
function buildChain(): { provider: Provider; key: string; model: BrainModelInfo }[] {
  const chain: { provider: Provider; key: string; model: BrainModelInfo }[] = [];
  const push = (provider: Provider, key: string | undefined) => {
    if (!key) return;
    for (const m of PROVIDER_MODELS[provider]) chain.push({ provider, key, model: m });
  };
  const push = (provider: Provider, key: string | undefined) => {
    if (!key) return;
    for (const m of PROVIDER_MODELS[provider]) chain.push({ provider, key, model: m });
  };
  push("ollama", process.env.OLLAMA_BASE_URL);
  push("openrouter", process.env.OPENROUTER_API_KEY);
  push("openai", process.env.OPENAI_API_KEY);
  push("anthropic", process.env.ANTHROPIC_API_KEY);
  return chain;
}

/** Call configured models in order with automatic failover across providers. */
export async function routeBrainCall(
  input: BrainModelCallInput,
): Promise<BrainModelCallResult> {
  const chain = buildChain();
  if (chain.length === 0) {
    throw new Error(
      "Brain has no AI provider configured. Set OPENROUTER_API_KEY (recommended), OPENAI_API_KEY, or ANTHROPIC_API_KEY in your .env file.",
    );
  }

  const start = Date.now();
  const fallback_chain: string[] = [];
  let attempts = 0;
  let lastErr: unknown = null;

  for (const step of chain) {
    const key = healthKey(step.provider, step.model.id);
    if (isInCooldown(key)) {
      fallback_chain.push(`${key}:cooldown`);
      continue;
    }
    attempts++;
    try {
      const content = await callChat(step.provider, step.model.id, input, step.key);
      markSuccess(key);
      return {
        content,
        model: `${step.provider}/${step.model.id}`,
        fallback_chain,
        attempts,
        duration_ms: Date.now() - start,
      };
    } catch (err) {
      lastErr = err;
      markFailure(key);
      fallback_chain.push(
        `${key}:${err instanceof Error ? err.message.slice(0, 60) : "error"}`,
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
