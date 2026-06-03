import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, XCircle, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type ThinkStep = {
  id: string;
  label: string;
  detail?: string;
  status: "running" | "done" | "failed";
  ts: number;
};

export type ThinkResult = {
  candidate?: unknown;
  job?: unknown;
  resume?: unknown;
  cover?: unknown;
  plan?: unknown;
};

export type ThinkRequest = {
  mode: "full" | "candidate" | "job" | "resume" | "cover";
  job?: {
    title: string;
    company: string;
    description?: string;
    tech_stack?: string[];
  };
  resume_md?: string;
};

export function useImperiumThinking() {
  const [steps, setSteps] = useState<ThinkStep[]>([]);
  const [result, setResult] = useState<ThinkResult>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = () => {
    setSteps([]);
    setResult({});
    setError(null);
  };

  const run = async (req: ThinkRequest) => {
    reset();
    setRunning(true);
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch("/api/imperium/think", {
        method: "POST",
        signal: ac.signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(req),
      });
      if (!res.body) throw new Error("No response stream");

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";
        for (const block of events) {
          if (!block.trim()) continue;
          const ev = /event:\s*(.+)/.exec(block)?.[1]?.trim() ?? "message";
          const dataLine = /data:\s*(.+)/.exec(block)?.[1] ?? "{}";
          let payload: unknown = {};
          try {
            payload = JSON.parse(dataLine);
          } catch {
            /* skip */
          }
          if (ev === "thinking") {
            const step = payload as ThinkStep;
            setSteps((prev) => {
              // Mark previous running steps as done when a new one arrives
              const updated = prev.map((p) =>
                p.status === "running" ? { ...p, status: "done" as const } : p,
              );
              return [...updated, step];
            });
          } else if (ev === "candidate") setResult((r) => ({ ...r, candidate: payload }));
          else if (ev === "job") setResult((r) => ({ ...r, job: payload }));
          else if (ev === "resume") setResult((r) => ({ ...r, resume: payload }));
          else if (ev === "cover") setResult((r) => ({ ...r, cover: payload }));
          else if (ev === "plan") setResult((r) => ({ ...r, plan: payload }));
          else if (ev === "error") {
            setError((payload as { message?: string }).message ?? "Thinking failed");
          } else if (ev === "done") {
            setSteps((prev) =>
              prev.map((p) =>
                p.status === "running" ? { ...p, status: "done" as const } : p,
              ),
            );
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message);
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  useEffect(() => () => abortRef.current?.abort(), []);

  return { steps, result, running, error, run, stop, reset };
}

export function ThinkingStream({ steps, running }: { steps: ThinkStep[]; running: boolean }) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [steps.length]);

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <Brain className={`h-4 w-4 ${running ? "animate-pulse text-primary" : "text-muted-foreground"}`} />
        <span className="imp-eyebrow">Imperium · Thinking Trace</span>
        {running && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-primary" />}
      </div>
      <div className="max-h-72 overflow-y-auto p-3 space-y-1.5">
        {steps.length === 0 && (
          <p className="text-xs text-muted-foreground px-2 py-3">
            Waiting for input… Imperium will narrate its reasoning here.
          </p>
        )}
        {steps.map((s) => (
          <div
            key={s.id}
            className="flex items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/30 transition-colors"
          >
            <span className="mt-0.5">
              {s.status === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
              {s.status === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
              {s.status === "failed" && <XCircle className="h-3.5 w-3.5 text-destructive" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground">{s.label}</p>
              {s.detail && (
                <p className="text-[11px] text-muted-foreground truncate font-mono">{s.detail}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
