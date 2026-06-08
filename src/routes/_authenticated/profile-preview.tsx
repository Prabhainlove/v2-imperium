import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ShieldCheck, AlertTriangle, Settings as SettingsIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/imperium/page-header";
import { getAgentContext } from "@/lib/imperium/client";

export const Route = createFileRoute("/_authenticated/profile-preview")({
  head: () => ({
    meta: [
      { title: "Profile Preview — Imperium" },
      {
        name: "description",
        content:
          "See exactly what data Imperium agents receive before generating any resume, cover letter or job match.",
      },
    ],
  }),
  component: ProfilePreviewPage,
});

function ProfilePreviewPage() {
  const q = useQuery({ queryKey: ["agent-context"], queryFn: getAgentContext, retry: false });

  if (q.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading agent context…
      </div>
    );
  }

  if (q.error || !q.data) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">Failed to load profile.</p>
      </div>
    );
  }

  const { profile, completeness, agent_context } = q.data;
  const ctx = agent_context;

  return (
    <div className="app-surface-f1 min-h-screen mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Profile Preview"
        kanji="人"
        kanjiLabel="Jinbutsu · 人物 · Persona"
        description="This is the exact, source-of-truth payload every Imperium agent receives. Resume, cover letter and job-match outputs are built ONLY from these facts — never invented."
        actions={
          <Button asChild variant="outline">
            <Link to="/settings">
              <SettingsIcon className="mr-2 h-4 w-4" /> Edit profile
            </Link>
          </Button>
        }
      />

      {/* Completeness banner */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Agent Readiness
            </span>
            <Badge variant="secondary">{Math.round(completeness.completion * 100)}% complete</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Completion" value={`${Math.round(completeness.completion * 100)}%`} />
            <Metric label="Strength" value={`${completeness.strength}/100`} />
            <Metric label="Apply Readiness" value={`${completeness.readiness}/100`} />
          </div>
          <Progress value={completeness.readiness} className="h-2" />
          {completeness.missing_sections.length > 0 && (
            <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs">
              <div className="mb-1 flex items-center gap-1 font-medium text-warning">
                <AlertTriangle className="h-3.5 w-3.5" /> Missing or weak sections
              </div>
              <div className="flex flex-wrap gap-1">
                {completeness.missing_sections.slice(0, 8).map((s) => (
                  <Badge key={s} variant="outline" className="text-[10px]">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Personal">
          <KV k="Name" v={ctx.personal.name as string} />
          <KV k="Email" v={ctx.personal.email as string} />
          <KV k="Phone" v={ctx.personal.phone as string} />
          <KV k="Location" v={ctx.personal.location as string} />
          <KV k="Headline" v={ctx.personal.headline as string} />
          <KV k="LinkedIn" v={((ctx.personal.links as Record<string, string>)?.linkedin) || ""} />
          <KV k="GitHub" v={((ctx.personal.links as Record<string, string>)?.github) || ""} />
          <KV k="Portfolio" v={((ctx.personal.links as Record<string, string>)?.portfolio) || ""} />
          <Separator className="my-2" />
          <KV k="Summary" v={(ctx.personal.summary as string) || "—"} wrap />
        </Section>

        <Section title="Career">
          <KV k="Target role" v={(ctx.career.target_role as string) || "—"} />
          <KV k="Seniority" v={(ctx.career.seniority as string) || "—"} />
          <KV k="Work mode" v={(ctx.career.work_mode as string) || "—"} />
          <KV
            k="Target locations"
            v={(ctx.career.target_locations as string[])?.join(", ") || "—"}
          />
          <Separator className="my-2" />
          <KV k="Fresher mode" v={ctx.is_fresher ? "yes — projects emphasized" : "no"} />
          <KV k="Vocabulary terms" v={String(ctx.vocabulary_size)} />
        </Section>

        <Section title={`Skills (${ctx.skills.length})`}>
          {ctx.skills.length === 0 ? (
            <Empty msg="No skills — agents have nothing to align against." />
          ) : (
            <div className="flex flex-wrap gap-1">
              {ctx.skills.map((s) => (
                <Badge key={s} variant="secondary" className="text-[11px]">
                  {s}
                </Badge>
              ))}
            </div>
          )}
        </Section>

        <Section title={`Projects (${ctx.projects.length}) — primary evidence`}>
          {ctx.projects.length === 0 ? (
            <Empty msg="No projects. Resume agents will have nothing to anchor on." />
          ) : (
            <ul className="space-y-3">
              {(ctx.projects as Array<Record<string, unknown>>).map((p, i) => (
                <li key={i} className="rounded-md border border-border/60 p-3">
                  <div className="font-medium text-sm">{String(p.name ?? "Untitled")}</div>
                  {p.description ? (
                    <p className="mt-1 text-xs text-muted-foreground">{String(p.description)}</p>
                  ) : null}
                  {Array.isArray(p.stack) && p.stack.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(p.stack as string[]).map((t) => (
                        <Badge key={t} variant="outline" className="text-[10px]">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  {Array.isArray(p.highlights) && p.highlights.length > 0 ? (
                    <ul className="mt-2 list-disc pl-4 text-xs">
                      {(p.highlights as string[]).map((h, j) => (
                        <li key={j}>{h}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={`Experience (${ctx.experience.length})`}>
          {ctx.experience.length === 0 ? (
            <Empty msg="No experience — fresher mode active. Projects act as primary evidence." />
          ) : (
            <ul className="space-y-2 text-sm">
              {(ctx.experience as Array<Record<string, unknown>>).map((e, i) => (
                <li key={i} className="rounded-md border border-border/60 p-3">
                  <div className="font-medium">
                    {String(e.title ?? "")} {e.company ? `· ${String(e.company)}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[e.start, e.end].filter(Boolean).join(" – ") || ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={`Education (${ctx.education.length})`}>
          {ctx.education.length === 0 ? (
            <Empty msg="No education entries." />
          ) : (
            <ul className="space-y-2 text-sm">
              {(ctx.education as Array<Record<string, unknown>>).map((e, i) => (
                <li key={i} className="rounded-md border border-border/60 p-3">
                  <div className="font-medium">
                    {String(e.degree ?? "")} {e.field ? `· ${String(e.field)}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {String(e.school ?? "")} {e.gpa ? `· GPA ${String(e.gpa)}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={`Certifications (${ctx.certifications.length})`}>
          {ctx.certifications.length === 0 ? (
            <Empty msg="None." />
          ) : (
            <ul className="text-sm">
              {(ctx.certifications as Array<Record<string, unknown>>).map((c, i) => (
                <li key={i}>• {String(c.name ?? "")}</li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={`Achievements (${ctx.achievements.length})`}>
          {ctx.achievements.length === 0 ? (
            <Empty msg="None." />
          ) : (
            <ul className="space-y-1 text-sm">
              {ctx.achievements.map((a, i) => (
                <li key={i}>• {a}</li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* Raw JSON (agent payload) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Raw agent payload (JSON)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[420px] overflow-auto rounded-md border border-border/60 bg-muted/30 p-3 text-[11px] leading-relaxed">
            {JSON.stringify(agent_context, null, 2)}
          </pre>
          {!profile && (
            <p className="mt-2 text-xs text-muted-foreground">
              No saved profile yet — fill it in from{" "}
              <Link to="/settings" className="underline">
                Settings
              </Link>
              .
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 text-sm">{children}</CardContent>
    </Card>
  );
}

function KV({ k, v, wrap = false }: { k: string; v: string; wrap?: boolean }) {
  return (
    <div className={`grid ${wrap ? "" : "grid-cols-[140px_1fr]"} gap-2`}>
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{k}</span>
      <span className={wrap ? "whitespace-pre-wrap" : "truncate"}>{v || "—"}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
      {msg}
    </p>
  );
}
