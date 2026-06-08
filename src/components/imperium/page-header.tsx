import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  // Legacy props — accepted but no longer rendered (Japanese layer removed).
  kanji: _kanji,
  kanjiLabel: _kanjiLabel,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
  kanji?: string;
  kanjiLabel?: string;
}) {
  return (
    <div className="relative">
      <div className="relative flex flex-col gap-3 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          {eyebrow && (
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              {eyebrow}
            </div>
          )}
          <h1 className="imp-h mt-2 text-3xl text-foreground md:text-4xl">{title}</h1>
          {description && (
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="relative z-10 flex flex-wrap gap-2">{actions}</div>}
      </div>
      <div className="h-px w-full bg-border" aria-hidden />
    </div>
  );
}
