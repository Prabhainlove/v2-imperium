/**
 * useAi — React hook over AiTaskQueue + AiCache. Runs a single AI server
 * function at a time, caches by content hash, exposes status to the UI.
 */
import { useCallback, useEffect, useState } from "react";
import { aiTaskQueue, type AiTask } from "./AiTaskQueue";
import { aiCacheGet, aiCacheSet, cacheKey } from "./AiCache";

export interface UseAiRunOpts<T> {
  feature: string;
  label: string;
  cacheInput: unknown;        // hashed for cache key
  cacheJd?: unknown;          // additional cache key component
  call: () => Promise<T>;
}

export function useAiQueue() {
  const [tasks, setTasks] = useState<AiTask[]>(() => aiTaskQueue.snapshot());
  useEffect(() => aiTaskQueue.subscribe(setTasks), []);
  return tasks;
}

export function useAiRunner() {
  const run = useCallback(async <T,>(opts: UseAiRunOpts<T>): Promise<T> => {
    const key = cacheKey(opts.feature, opts.cacheInput, opts.cacheJd ?? "");
    const cached = aiCacheGet<T>(key);
    if (cached) return cached.result;
    const result = await aiTaskQueue.enqueue<T>({
      feature: opts.feature,
      label: opts.label,
      run: opts.call,
    });
    aiCacheSet(key, opts.feature, result);
    return result;
  }, []);
  return { run };
}
