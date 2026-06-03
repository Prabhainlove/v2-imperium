import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Briefcase, ExternalLink, Filter, MapPin, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/imperium/page-header";
import { MatchScore } from "@/components/imperium/match-score";
import { getJobs } from "@/lib/imperium/client";
import {
  formatRelativeTime,
  formatSalary,
} from "@/lib/imperium/format";
import { REAL_SOURCES } from "@/lib/imperium/config";

export const Route = createFileRoute("/_authenticated/jobs")({
  head: () => ({
    meta: [
      { title: "Discovered Jobs — Imperium" },
      {
        name: "description",
        content:
          "All jobs discovered by the Imperium agent, with match scores, skills and source attribution.",
      },
      { property: "og:title", content: "Discovered Jobs — Imperium" },
      { property: "og:description", content: "Jobs the AI agent has retrieved." },
    ],
  }),
  component: JobsPage,
});

function JobsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["jobs", { limit: 500 }],
    queryFn: ({ signal }) => getJobs({ limit: 500 }, signal),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const [q, setQ] = useState("");
  const [source, setSource] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = data ?? [];
    return list.filter((j) => {
      if (source && j.source !== source) return false;
      if (q) {
        const t = q.toLowerCase();
        return (
          j.title?.toLowerCase().includes(t) ||
          j.company?.toLowerCase().includes(t) ||
          j.location?.toLowerCase().includes(t)
        );
      }
      return true;
    });
  }, [data, q, source]);

  const sourceCounts = useMemo(() => {
    const m = new Map<string, number>();
    (data ?? []).forEach((j) => m.set(j.source, (m.get(j.source) ?? 0) + 1));
    return m;
  }, [data]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 p-4 md:p-6">
      <PageHeader
        title="Discovered Jobs"
        description="Every listing Imperium has pulled from real job sources, scored and de-duplicated."
        actions={
          <Button asChild className="bg-gradient-primary text-primary-foreground hover:opacity-95">
            <Link to="/search">
              <Search className="mr-2 h-4 w-4" /> New Search
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search title, company, location…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <button
              onClick={() => setSource(null)}
              className={`rounded-full border px-2.5 py-0.5 text-xs ${
                source === null
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted/50"
              }`}
            >
              All ({data?.length ?? 0})
            </button>
            {REAL_SOURCES.map((s) => {
              const count = sourceCounts.get(s.id) ?? 0;
              if (count === 0) return null;
              return (
                <button
                  key={s.id}
                  onClick={() => setSource(s.id)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs ${
                    source === s.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {s.label} ({count})
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <EmptyState text="Loading jobs…" />
      ) : error ? (
        <EmptyState text="Cannot reach Imperium backend." tone="error" />
      ) : filtered.length === 0 ? (
        <EmptyState text="No jobs to show. Launch a search to populate this view." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((j) => (
            <Card
              key={j.listing_id}
              className="group overflow-hidden border-border/60 transition-all hover:border-primary/40 hover:shadow-glow"
            >
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <MatchScore score={j.match_score} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
                        {j.title}
                      </h3>
                      {j.url && (
                        <a
                          href={j.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-muted-foreground hover:text-primary"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Briefcase className="h-3 w-3" /> {j.company}
                      </span>
                      {j.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {j.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px]">
                    {j.source}
                  </Badge>
                  {(j.salary_min || j.salary_max) && (
                    <Badge variant="outline" className="text-[10px]">
                      {formatSalary(j.salary_min, j.salary_max, j.salary_currency)}
                    </Badge>
                  )}
                  {j.experience_years != null && (
                    <Badge variant="outline" className="text-[10px]">
                      {j.experience_years}+ yrs
                    </Badge>
                  )}
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {formatRelativeTime(j.discovered_at)}
                  </span>
                </div>

                {(j.required_skills?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {j.required_skills!.slice(0, 7).map((s) => (
                      <span
                        key={s}
                        className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {s}
                      </span>
                    ))}
                    {j.required_skills!.length > 7 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{j.required_skills!.length - 7}
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  text,
  tone = "muted",
}: {
  text: string;
  tone?: "muted" | "error";
}) {
  return (
    <Card
      className={
        tone === "error"
          ? "border-destructive/30 bg-destructive/5"
          : "border-dashed"
      }
    >
      <CardContent className="p-10 text-center text-sm text-muted-foreground">
        {text}
      </CardContent>
    </Card>
  );
}
