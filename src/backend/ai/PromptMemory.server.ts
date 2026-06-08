/**
 * Imperium Brain — Memory layer.
 * - In-process LRU + request dedup for the current Worker request lifetime.
 * - Persistent `brain_memory` table for cross-request reuse (per-user, RLS-scoped).
 */
import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

interface MemoryEntry<T> { value: T; expiresAt: number }
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
  if (Date.now() > e.expiresAt) { cache.delete(key); return null; }
  return e.value;
}

export async function brainOnce<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const cached = brainRecall<T>(key);
  if (cached !== null) return cached;
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = fn()
    .then((v) => { brainRemember(key, v); return v; })
    .finally(() => { inflight.delete(key); });
  inflight.set(key, p);
  return p;
}

/* ---------- Persistent memory (Supabase) ---------- */

export interface PersistentMemoryHandle {
  supabase: SupabaseClient;
  userId: string;
}

export async function recallPersistent<T>(
  h: PersistentMemoryHandle,
  kind: string,
  keyHash: string,
  maxAgeMs?: number,
): Promise<T | null> {
  const { data, error } = await h.supabase
    .from("brain_memory")
    .select("payload, created_at")
    .eq("user_id", h.userId)
    .eq("kind", kind)
    .eq("key_hash", keyHash)
    .maybeSingle();
  if (error || !data) return null;
  if (maxAgeMs != null && data.created_at) {
    const age = Date.now() - new Date(data.created_at as string).getTime();
    if (age > maxAgeMs) return null;
  }
  return data.payload as T;
}

export async function rememberPersistent<T>(
  h: PersistentMemoryHandle,
  kind: string,
  keyHash: string,
  payload: T,
  model = "",
): Promise<void> {
  await h.supabase
    .from("brain_memory")
    .upsert(
      { user_id: h.userId, kind, key_hash: keyHash, payload: payload as never, model },
      { onConflict: "user_id,kind,key_hash" },
    );
}

/** Persistent dedup: recall, run, remember. */
export async function brainOncePersistent<T>(
  h: PersistentMemoryHandle,
  kind: string,
  keyHash: string,
  fn: () => Promise<T>,
  maxAgeMs = 24 * 60 * 60_000,
): Promise<T> {
  const cached = await recallPersistent<T>(h, kind, keyHash, maxAgeMs);
  if (cached !== null) return cached;
  const cacheKey = `${h.userId}:${kind}:${keyHash}`;
  return brainOnce(cacheKey, async () => {
    const value = await fn();
    await rememberPersistent(h, kind, keyHash, value);
    return value;
  });
}
