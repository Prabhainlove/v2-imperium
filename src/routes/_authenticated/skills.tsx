import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Target, Loader2, RefreshCw, Sparkles, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/imperium/page-header";
import { getSkillGap, type SkillGapItem } from "@/lib/imperium/client";

export const Route = createFileRoute("/_authenticated/skills")({
  head: () => ({
    meta: [
      { title: "Skill Gap — Imperium" },
      { name: "description", content: "AI-powered skill gap analysis vs your target role and the live job market." },
      { property: "og:title", content: "Skill Gap — Imperium" },
      { property: "og:description", content: "Close the gap between you and your target role." },
    ],
  }),
  component: SkillsPage,
});

const TONES: Record<SkillGapItem["importance"], string> = {
  critical: "border-destructive/40 bg-destructive/10 text-destructive",
  important: "border-warning/40 bg-warning/10 text-warning",
  nice_to_have: "border-border bg-muted/30 text-muted-foreground",
};

function SkillsPage() {
  const q = useQuery({
    queryKey: ["skill-gap"],
    queryFn: () => getSkillGap(),
    retry: false,
    staleTime: 5 * 60_000,
  });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Skill Gap Analysis"
        description="Imperium Brain compares your skills against your target role and the live market signal."
        actions={
          <Button onClick={() => q.refetch()} variant="outline" disabled={q.isFetching}>
            {q.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Re-analyze
          </Button>
        }
      />

      {q.isLoading ? (
        <Card><CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Brain is analyzing…</CardContent></Card>
      ) : q.error ? (
        <Card><CardContent className="p-6 text-sm text-destructive">Failed to analyze: {(q.error as Error).message}</CardContent></Card>
      ) : q.data ? (
        <>
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" /> Brain Summary — {q.data.target_role}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{q.data.summary}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {q.data.matched_skills.slice(0, 16).map((s) => (
                  <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                ))}
                {q.data.matched_skills.length === 0 && (
                  <span className="text-xs text-muted-foreground">No matched market skills yet — run a job search to gather signal.</span>
                )}
              </div>
              <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">Model: {q.data.model}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4 text-primary" /> Missing Skills ({q.data.missing_skills.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {q.data.missing_skills.length === 0 ? (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No clear gaps detected. <Link to="/search" className="text-primary underline">Run a search</Link> to gather more market signal.
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {q.data.missing_skills.map((m) => (
                    <li key={m.skill} className="py-3 flex items-start gap-3">
                      <Badge className={`shrink-0 capitalize ${TONES[m.importance]}`}>{m.importance.replace("_", " ")}</Badge>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{m.skill}</div>
                        <div className="text-xs text-muted-foreground">{m.rationale}</div>
                        <div className="mt-1 text-[11px] text-primary/80 flex items-center gap-1">
                          <BookOpen className="h-3 w-3" /> {m.resource_hint}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <RoadmapBlock title="Next 30 days" items={q.data.roadmap_30_60_90.thirty} />
            <RoadmapBlock title="Next 60 days" items={q.data.roadmap_30_60_90.sixty} />
            <RoadmapBlock title="Next 90 days" items={q.data.roadmap_30_60_90.ninety} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function RoadmapBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">—</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {items.map((i, idx) => (
              <li key={idx} className="flex gap-2"><span className="text-primary">›</span><span>{i}</span></li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
