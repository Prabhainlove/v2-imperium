import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  kanji,
  kanjiLabel,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Decorative Japanese character watermarked behind the title */
  kanji?: string;
  /** Small romaji / english label rendered under the kanji */
  kanjiLabel?: string;
}) {
  return (
    <div className="relative">
      {kanji && (
        <span
          aria-hidden
          className="imp-kanji imp-kanji-lg -top-6 right-0 hidden md:block"
        >
          {kanji}
        </span>
      )}
      <div className="relative flex flex-col gap-3 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="imp-mark-sm" aria-hidden />
            {kanjiLabel && (
              <span className="imp-eyebrow">{kanjiLabel}</span>
            )}
          </div>
          <h1 className="imp-h mt-2 text-3xl text-foreground">{title}</h1>
          {description && (
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="relative z-10 flex flex-wrap gap-2">{actions}</div>}
      </div>
      <div className="imp-brush-divider" aria-hidden />
    </div>
  );
}
