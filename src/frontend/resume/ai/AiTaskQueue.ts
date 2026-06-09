/**
 * AI Task Queue — single-flight scheduler. Runs ONE AI task at a time to
 * protect modest local hardware (i5-8350U / 16GB / Ollama Qwen3:8B). Tasks
 * queue FIFO; subscribers receive status updates.
 */

export type AiTaskStatus = "queued" | "running" | "done" | "error";

export interface AiTask<T = unknown> {
  id: string;
  feature: string;
  label: string;
  status: AiTaskStatus;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
  result?: T;
}

type Listener = (snapshot: AiTask[]) => void;

class TaskQueue {
  private queue: Array<{ task: AiTask; run: () => Promise<unknown>; resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];
  private history: AiTask[] = [];
  private listeners = new Set<Listener>();
  private running = false;

  enqueue<T>(opts: { feature: string; label: string; run: () => Promise<T> }): Promise<T> {
    const task: AiTask<T> = {
      id: `t-${Math.random().toString(36).slice(2, 9)}`,
      feature: opts.feature,
      label: opts.label,
      status: "queued",
      createdAt: Date.now(),
    };
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        task: task as AiTask,
        run: opts.run as () => Promise<unknown>,
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      this.emit();
      void this.pump();
    });
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => { this.listeners.delete(fn); };
  }

  snapshot(): AiTask[] {
    const active = this.queue.map((q) => q.task);
    return [...active, ...this.history].sort((a, b) => b.createdAt - a.createdAt).slice(0, 12);
  }

  private emit() {
    const snap = this.snapshot();
    for (const l of this.listeners) l(snap);
  }

  private async pump() {
    if (this.running) return;
    const next = this.queue[0];
    if (!next) return;
    this.running = true;
    next.task.status = "running";
    next.task.startedAt = Date.now();
    this.emit();
    try {
      const result = await next.run();
      next.task.status = "done";
      next.task.finishedAt = Date.now();
      next.task.result = result;
      next.resolve(result);
    } catch (err) {
      next.task.status = "error";
      next.task.finishedAt = Date.now();
      next.task.error = err instanceof Error ? err.message : String(err);
      next.reject(err);
    } finally {
      this.queue.shift();
      this.history.unshift(next.task);
      this.history = this.history.slice(0, 12);
      this.running = false;
      this.emit();
      // process next task
      if (this.queue.length) void this.pump();
    }
  }
}

export const aiTaskQueue = new TaskQueue();
