/**
 * Imperium Brain — Memory layer (in-process LRU + request dedup).
 * Server-only. Persistent profile/resume/job memory lives in Supabase
 * (profiles, resume_documents, job_listings, applications); this module
 * memoizes brain-derived intelligence keyed by a deterministic input hash.
 */
import crypto from "crypto";

interface MemoryEntry<T> {
  value: T;
  expiresAt: number;
}

const MAX_ENTRIES = 500;
const cache = new Map<string, MemoryEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export function brainKey(parts: Array<string | number | boolean | null | undefined>): string {
  const h = crypto.createHash("sha256");
  h.update(parts.map((p) => String(p ?? "")).join("|"));
  return h.digest("hex").slice(0, 32);
}

export function brainRemember<T>(key: string, value: T, ttlMs = 15 * 60_000): void {
  if (cache.size >= MAX_ENTRIES) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function brainRecall<T>(key: string): T | null {
  const e = cache.get(key) as MemoryEntry<T> | undefined;
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    cache.delete(key);
    return null;
  }
  return e.value;
}

/** Deduplicate concurrent identical brain calls. */
export async function brainOnce<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const cached = brainRecall<T>(key);
  if (cached !== null) return cached;
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = fn()
    .then((v) => {
      brainRemember(key, v);
      return v;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, p);
  return p;
}
