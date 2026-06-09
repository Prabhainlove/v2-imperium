/**
 * AI Cache — content-addressed memoization. Key = hash(resume) + hash(jd) + feature.
 * Memory cache for the session; localStorage cache survives reloads. AI
 * responses are deterministic enough that caching saves substantial time on
 * Ollama (Qwen3:8B) on modest hardware.
 */

const STORE_KEY = "imperium-ai-cache-v1";
const MAX_ENTRIES = 80;

export interface AiCacheEntry<T = unknown> {
  key: string;
  feature: string;
  model?: string;
  createdAt: number;
  result: T;
}

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  // unsigned hex
  return (h >>> 0).toString(36);
}

export function hashContent(input: unknown): string {
  return djb2(JSON.stringify(input ?? ""));
}

export function cacheKey(feature: string, resume: unknown, jd: unknown): string {
  return `${feature}:${hashContent(resume)}:${hashContent(jd)}`;
}

const memory = new Map<string, AiCacheEntry>();

function loadPersisted(): Record<string, AiCacheEntry> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, AiCacheEntry>) : {};
  } catch { return {}; }
}

function savePersisted(map: Record<string, AiCacheEntry>): void {
  try {
    const entries = Object.entries(map);
    if (entries.length > MAX_ENTRIES) {
      entries.sort((a, b) => b[1].createdAt - a[1].createdAt);
      const trimmed = Object.fromEntries(entries.slice(0, MAX_ENTRIES));
      localStorage.setItem(STORE_KEY, JSON.stringify(trimmed));
    } else {
      localStorage.setItem(STORE_KEY, JSON.stringify(map));
    }
  } catch { /* quota ignored */ }
}

export function aiCacheGet<T>(key: string): AiCacheEntry<T> | null {
  if (memory.has(key)) return memory.get(key) as AiCacheEntry<T>;
  const persisted = loadPersisted();
  const hit = persisted[key];
  if (hit) {
    memory.set(key, hit);
    return hit as AiCacheEntry<T>;
  }
  return null;
}

export function aiCacheSet<T>(key: string, feature: string, result: T, model?: string): AiCacheEntry<T> {
  const entry: AiCacheEntry<T> = { key, feature, model, createdAt: Date.now(), result };
  memory.set(key, entry);
  const persisted = loadPersisted();
  persisted[key] = entry as AiCacheEntry;
  savePersisted(persisted);
  return entry;
}

export function aiCacheClear(): void {
  memory.clear();
  try { localStorage.removeItem(STORE_KEY); } catch { /* noop */ }
}
