import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, Loader2, Sparkles, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/imperium/page-header";
import { LiveTypewriter } from "@/components/imperium/live-typewriter";
import { getApplications, getApplication } from "@/lib/imperium/client";
import { scoreToPercent } from "@/lib/imperium/format";

export const Route = createFileRoute("/_authenticated/cover-letters")({
  head: () => ({
    meta: [
      { title: "Cover Letters — Imperium" },
      { name: "description", content: "Every tailored cover letter Imperium has written, with live evolution preview." },
      { property: "og:title", content: "Cover Letters — Imperium" },
      { property: "og:description", content: "Watch Imperium write tailored cover letters in real time." },
    ],
  }),
  component: CoverLettersPage,
});

function CoverLettersPage() {
  const apps = useQuery({
    queryKey: ["applications", { cover: true, limit: 100 }],
    queryFn: ({ signal }) => getApplications({ limit: 100 }, signal),
    retry: false,
  });

  const generated = useMemo(
    () => (apps.data ?? []).filter((a) => a.cover_letter_path),
    [apps.data],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId = selectedId ?? generated[0]?.application_id ?? null;

  const detail = useQuery({
    queryKey: ["application-detail", activeId],
    queryFn: () => getApplication(activeId!),
    enabled: !!activeId,
    retry: false,
  });

  const download = () => {
    const md = detail.data?.cover_letter_md;
    if (!md) return;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cover-letter_${activeId?.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Cover Letters"
        description="Imperium writes tailored cover letters per application. Watch them stream in live."
        actions={
          <Button asChild className="bg-gradient-primary text-primary-foreground hover:opacity-95">
            <Link to="/search"><Sparkles className="mr-2 h-4 w-4" /> Run Search</Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4 text-primary" /> Generated ({generated.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {generated.length === 0 ? (
              <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No cover letters yet. Run a search to generate tailored letters per role.
              </p>
            ) : (
              <ul className="space-y-1">
                {generated.map((a) => (
                  <li key={a.application_id}>
                    <button
                      onClick={() => setSelectedId(a.application_id)}
                      className={`flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left text-sm transition-colors ${
                        activeId === a.application_id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{a.job_title}</div>
                        <div className="truncate text-xs text-muted-foreground">{a.company}</div>
                      </div>
                      {a.match_score != null && (
                        <Badge variant="secondary" className="text-[10px]">{scoreToPercent(a.match_score)}%</Badge>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" /> Live Cover Letter
              {detail.isFetching && (
                <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">Loading…</span>
              )}
            </CardTitle>
            <Button size="sm" variant="outline" onClick={download} disabled={!detail.data?.cover_letter_md}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Markdown
            </Button>
          </CardHeader>
          <CardContent>
            {!activeId ? (
              <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                Select a cover letter to watch Imperium replay the writing.
              </p>
            ) : detail.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : (
              <LiveTypewriter text={detail.data?.cover_letter_md ?? ""} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
