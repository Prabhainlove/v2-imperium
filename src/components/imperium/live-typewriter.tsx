import { useEffect, useState } from "react";

/**
 * Progressively reveals `text` to simulate live AI writing.
 * Resets when the source text changes.
 */
export function LiveTypewriter({
  text,
  speedCharsPerTick = 8,
  intervalMs = 24,
  className,
}: {
  text: string;
  speedCharsPerTick?: number;
  intervalMs?: number;
  className?: string;
}) {
  const [shown, setShown] = useState("");

  useEffect(() => {
    setShown("");
    if (!text) return;
    let i = 0;
    const id = window.setInterval(() => {
      i = Math.min(text.length, i + speedCharsPerTick);
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [text, speedCharsPerTick, intervalMs]);

  const done = shown.length >= text.length;
  return (
    <div className={className}>
      <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border border-border/60 bg-muted/30 p-3 font-mono text-[12px] leading-relaxed">
        {shown}
        {!done && (
          <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-primary align-middle" />
        )}
      </pre>
    </div>
  );
}
