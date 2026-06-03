import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  FileText,
  Mail,
  Send,
  ShieldCheck,
  SkipForward,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/imperium/page-header";
import { StatusBadge } from "@/components/imperium/status-badge";
import { MatchScore } from "@/components/imperium/match-score";
import { ActivityFeed } from "@/components/imperium/activity-feed";
import {
  approveApplication,
  getActivity,
  getApplication,
  skipApplication,
} from "@/lib/imperium/client";
import { scoreToPercent } from "@/lib/imperium/format";

export const Route = createFileRoute("/applications/$id/review")({
  head: () => ({
    meta: [
      { title: "Application Review — Imperium" },
      {
        name: "description",
        content:
          "Review and approve an Imperium-prepared job application before submission. Resume, cover letter, fields and match score.",
      },
      { property: "og:title", content: "Application Review — Imperium" },
      { property: "og:description", content: "Final user-approval gate before Imperium hands off the application." },
    ],
  }),
  component: ReviewPage,
});

function ReviewPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const app = useQuery({
    queryKey: ["application", id],
    queryFn: () => getApplication(id),
    retry: false,
    refetchInterval: 2500,
  });

  const live = useQuery({
    queryKey: ["activity", { application: id }],
    queryFn: ({ signal }) => getActivity({ limit: 60 }, signal),
    refetchInterval: 1500,
  });

  const approve = useMutation({
    mutationFn: () => approveApplication(id),
    onSuccess: () => {
      toast.success("Application submitted");
      qc.invalidateQueries({ queryKey: ["application", id] });
      qc.invalidateQueries({ queryKey: ["applications"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const skip = useMutation({
    mutationFn: () => skipApplication(id),
    onSuccess: () => {
      toast.message("Application skipped");
      qc.invalidateQueries({ queryKey: ["applications"] });
      navigate({ to: "/applications" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fillSteps = useMemo(() => {
    const acts = [
      "fill_open_application",
      "fill_read_form",
      "fill_name",
      "fill_email",
      "fill_phone",
      "fill_resume",
      "fill_cover_letter",
      "fill_review_complete",
    ];
    const entries = live.data ?? [];
    return acts.map((a) => {
      const events = entries.filter((e) => e.action === a);
      const last = events[0];
      return {
        action: a,
        label: a
          .replace(/^fill_/, "")
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        detail: last?.detail ?? "",
        status: (last?.status ?? "pending").toLowerCase(),
      };
    });
  }, [live.data]);

  if (app.isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl p-6">
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Loading application…</CardContent></Card>
      </div>
    );
  }
  if (app.error || !app.data) {
    return (
      <div className="mx-auto w-full max-w-5xl p-6">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-10 text-center text-sm text-destructive">
            Application not found.{" "}
            <Link to="/applications" className="underline">
              Back to Applications
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const a = app.data;
  const fields = a.application_fields ?? {};
  const isSubmitted = a.status === "Applied";
  const isPending = a.status === "Pending Review";

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 p-4 md:p-6">
      <PageHeader
        title="Application Review"
        description="Final user-approval gate. Imperium has prepared the package — you decide what is sent."
        actions={
          <Button asChild variant="outline">
            <Link to="/applications">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> All Applications
            </Link>
          </Button>
        }
      />

      {/* READY TO APPLY banner */}
      <Card
        className={
          isPending
            ? "border-warning/40 bg-warning/5"
            : isSubmitted
              ? "border-success/40 bg-success/5"
              : "border-border"
        }
      >
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <ShieldCheck
            className={`h-10 w-10 ${
              isPending ? "text-warning" : isSubmitted ? "text-success" : "text-muted-foreground"
            }`}
          />
          <div className="flex-1">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {isPending ? "Awaiting your approval" : isSubmitted ? "Submitted" : a.status}
            </div>
            <div className="text-2xl font-bold tracking-tight">
              {isPending ? "READY TO APPLY" : isSubmitted ? "APPLICATION SENT" : a.status.toUpperCase()}
            </div>
            <div className="mt-0.5 text-sm text-muted-foreground">
              {a.job_title} · {a.company}
            </div>
          </div>
          <MatchScore score={a.match_score} size="lg" />
          {isPending && (
            <div className="flex w-full gap-2 md:w-auto">
              <Button
                onClick={() => approve.mutate()}
                disabled={approve.isPending}
                className="flex-1 bg-success text-success-foreground hover:opacity-90"
              >
                <Send className="mr-2 h-4 w-4" />
                {approve.isPending ? "Submitting…" : "YES, APPLY"}
              </Button>
              <Button
                variant="outline"
                onClick={() => skip.mutate()}
                disabled={skip.isPending}
                className="flex-1"
              >
                <SkipForward className="mr-2 h-4 w-4" /> SKIP
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        {/* Application fields */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" /> Application Fields
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row k="Company" v={a.company} />
            <Row k="Job Title" v={a.job_title} />
            <Row k="Status" v={<StatusBadge status={a.status} />} />
            <Row k="Match Score" v={`${scoreToPercent(a.match_score)}%`} />
            <Separator className="my-2" />
            <Row k="Full Name" v={fields.full_name ?? "—"} />
            <Row k="Email" v={fields.email ?? "—"} />
            <Row k="Phone" v={fields.phone ?? "—"} />
            <Row k="Location" v={fields.location ?? "—"} />
            {(a.matched_skills?.length ?? 0) > 0 && (
              <>
                <Separator className="my-2" />
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                    Matched skills
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {a.matched_skills!.map((s) => (
                      <Badge
                        key={s}
                        variant="outline"
                        className="border-success/30 bg-success/10 text-success text-[10px]"
                      >
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
            {(a.missing_skills?.length ?? 0) > 0 && (
              <div>
                <div className="mb-1 mt-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  Missing skills
                </div>
                <div className="flex flex-wrap gap-1">
                  {a.missing_skills!.slice(0, 8).map((s) => (
                    <Badge
                      key={s}
                      variant="outline"
                      className="border-warning/30 bg-warning/10 text-warning text-[10px]"
                    >
                      − {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live fill steps */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ChevronRight className="h-4 w-4 text-primary" /> Live Application Fill
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-1.5 text-sm">
              {fillSteps.map((s) => (
                <li
                  key={s.action}
                  className={`flex items-start gap-2 rounded-md px-2 py-1.5 ${
                    s.status === "running"
                      ? "bg-primary/5"
                      : s.status === "success"
                        ? "bg-success/5"
                        : "bg-muted/20"
                  }`}
                >
                  <CheckCircle2
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      s.status === "success"
                        ? "text-success"
                        : s.status === "running"
                          ? "text-primary animate-pulse"
                          : "text-muted-foreground/50"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{s.label}</div>
                    {s.detail && (
                      <div className="text-[11px] text-muted-foreground">{s.detail}</div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            {!isSubmitted && !approve.isPending && (
              <p className="mt-3 text-[11px] text-muted-foreground">
                Steps will animate when you press <strong>YES, APPLY</strong>.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" /> Tailored Resume
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/resume">Open Studio</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-md border border-border/60 bg-muted/30 p-3 font-mono text-[12px] leading-relaxed">
              {a.resume_md || "—"}
            </pre>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4 text-primary" /> Cover Letter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-md border border-border/60 bg-muted/30 p-3 font-mono text-[12px] leading-relaxed">
              {a.cover_letter_md || "—"}
            </pre>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Execution Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-60 overflow-y-auto">
            <ActivityFeed
              entries={(live.data ?? []).filter((e) => e.task_id === (live.data?.find(()=>true) && live.data?.find(()=>true)?.task_id) || true).slice(0, 20)}
              dense
              showRelative={false}
              emptyHint="No events yet."
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</span>
      <span className="text-right text-sm">{v}</span>
    </div>
  );
}
