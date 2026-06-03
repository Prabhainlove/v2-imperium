import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Save,
  Sparkles,
  Target,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/imperium/page-header";
import { MasterResumeStudio } from "@/components/imperium/master-resume-studio";
import {
  getApplications,
  getProfile,
  renderApplicationResume,
  saveProfile,
} from "@/lib/imperium/client";
import type { CandidateProfile } from "@/lib/imperium/types";
import { scoreToPercent } from "@/lib/imperium/format";

export const Route = createFileRoute("/_authenticated/resume")({
  head: () => ({
    meta: [
      { title: "Resume Studio — Imperium" },
      {
        name: "description",
        content:
          "Manage your candidate profile and inspect every RenderCV-style resume Imperium generates, with ATS analysis and PDF export.",
      },
      { property: "og:title", content: "Resume Studio — Imperium" },
      { property: "og:description", content: "RenderCV-style resume studio with ATS analysis." },
    ],
  }),
  component: ResumeStudioPage,
});

type Template = "classic" | "modern" | "compact";

function ResumeStudioPage() {
  const qc = useQueryClient();
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: ({ signal }) => getProfile(signal),
    retry: false,
  });

  const apps = useQuery({
    queryKey: ["applications", { limit: 100 }],
    queryFn: ({ signal }) => getApplications({ limit: 100 }, signal),
    retry: false,
  });

  const [form, setForm] = useState<CandidateProfile>({});
  useEffect(() => {
    if (profile.data?.profile) setForm(profile.data.profile);
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () =>
      saveProfile({
        ...form,
        skills:
          typeof (form as unknown as { skills?: string | string[] }).skills === "string"
            ? ((form as unknown as { skills: string }).skills as string)
                .split(",").map((s) => s.trim()).filter(Boolean)
            : form.skills,
      }),
    onSuccess: () => {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const skillsString = useMemo(
    () =>
      Array.isArray(form.skills)
        ? form.skills.join(", ")
        : (form.skills as unknown as string) ?? "",
    [form.skills],
  );

  const health = profile.data?.profile_health;
  const healthPct = scoreToPercent(health?.score);

  const generated = (apps.data ?? []).filter((a) => a.resume_path);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedAppId && generated.length > 0) setSelectedAppId(generated[0].application_id);
  }, [generated, selectedAppId]);

  const [template, setTemplate] = useState<Template>("classic");

  const rendered = useQuery({
    queryKey: ["rendered-resume", selectedAppId, template],
    queryFn: () => renderApplicationResume(selectedAppId!, template),
    enabled: !!selectedAppId,
    retry: false,
  });

  const downloadMd = () => {
    if (!rendered.data) return;
    const blob = new Blob([rendered.data.optimized_md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resume_${selectedAppId?.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printPdf = () => {
    if (!rendered.data) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(rendered.data.rendered_html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const ats = rendered.data?.ats;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Resume Studio"
        description="RenderCV-style resume generation. Edit your profile, watch the AI-tailored resume, and export ATS-optimized output."
        actions={
          <Button asChild className="bg-gradient-primary text-primary-foreground hover:opacity-95">
            <Link to="/search">
              <Sparkles className="mr-2 h-4 w-4" /> Run Search
            </Link>
          </Button>
        }
      />

      <MasterResumeStudio />

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* LEFT — profile */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Candidate Profile
              </span>
              {health && <Badge variant="outline" className="text-[10px]">{healthPct}% complete</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {health && (
              <div>
                <Progress value={healthPct} className="h-2" />
                {health.missing.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Missing: {health.missing.join(", ")}
                  </p>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label htmlFor="p-name">Name</Label>
                <Input id="p-name" value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
              <div><Label htmlFor="p-email">Email</Label>
                <Input id="p-email" type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" /></div>
              <div><Label htmlFor="p-phone">Phone</Label>
                <Input id="p-phone" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" /></div>
              <div className="col-span-2"><Label htmlFor="p-loc">Location</Label>
                <Input id="p-loc" value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1" /></div>
              <div className="col-span-2"><Label htmlFor="p-skills">Skills (comma-separated)</Label>
                <Textarea id="p-skills" rows={3} value={skillsString}
                  onChange={(e) => setForm({ ...form, skills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                  className="mt-1 resize-none" /></div>
            </div>
            <Separator />
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95"
            >
              {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Profile
            </Button>
          </CardContent>
        </Card>

        {/* RIGHT — RenderCV viewer */}
        <div className="space-y-4">
          {/* Resume picker + template */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-primary" /> Generated Resumes</span>
                <div className="flex gap-1">
                  {(["classic", "modern", "compact"] as Template[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTemplate(t)}
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] capitalize transition ${
                        template === t
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {generated.length === 0 ? (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No resumes generated yet. Run a search to create ATS-tailored resumes per role.
                </p>
              ) : (
                <ul className="grid gap-1 sm:grid-cols-2">
                  {generated.slice(0, 8).map((a) => (
                    <li key={a.application_id}>
                      <button
                        onClick={() => setSelectedAppId(a.application_id)}
                        className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm transition-colors ${
                          selectedAppId === a.application_id
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">
                          {a.job_title}<span className="ml-1 text-xs text-muted-foreground">· {a.company}</span>
                        </span>
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

          {/* ATS analysis */}
          {ats && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2"><Target className="h-4 w-4 text-success" /> ATS Analysis</span>
                  <Badge
                    className={
                      ats.score >= 70
                        ? "bg-success/15 text-success border-success/30"
                        : ats.score >= 40
                          ? "bg-warning/15 text-warning border-warning/30"
                          : "bg-destructive/15 text-destructive border-destructive/30"
                    }
                  >
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    {ats.score}%
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Progress value={ats.score} className="h-2" />
                <div className="grid gap-3 md:grid-cols-3">
                  <KwBlock title="Added" items={ats.added_keywords} tone="success" empty="No new keywords introduced" />
                  <KwBlock title="Matched" items={ats.matched_keywords} tone="info" />
                  <KwBlock title="Missing" items={ats.missing_keywords} tone="warning" />
                </div>
                {ats.improvements.length > 0 && (
                  <div>
                    <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Improvements</div>
                    <ul className="space-y-0.5 text-xs">
                      {ats.improvements.map((i) => (
                        <li key={i} className="flex gap-2"><span className="text-success">✓</span><span>{i}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Side-by-side preview */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Resume Preview</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={downloadMd} disabled={!rendered.data}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Markdown
                </Button>
                <Button size="sm" variant="outline" onClick={printPdf} disabled={!rendered.data}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!selectedAppId ? (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Select a generated resume to preview.
                </p>
              ) : rendered.isLoading ? (
                <div className="flex items-center justify-center p-10 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rendering…
                </div>
              ) : rendered.error ? (
                <p className="text-sm text-destructive">Failed to render resume.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Optimized Markdown</div>
                    <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border border-border/60 bg-muted/30 p-3 font-mono text-[12px] leading-relaxed">
                      {rendered.data!.optimized_md}
                    </pre>
                  </div>
                  <div>
                    <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">RenderCV Output ({template})</div>
                    <iframe
                      title="Rendered Resume"
                      srcDoc={rendered.data!.rendered_html}
                      className="h-[520px] w-full rounded-md border border-border/60 bg-white"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KwBlock({
  title, items, tone, empty,
}: {
  title: string; items: string[]; tone: "success" | "info" | "warning"; empty?: string;
}) {
  const cls =
    tone === "success" ? "border-success/30 bg-success/10 text-success"
    : tone === "warning" ? "border-warning/30 bg-warning/10 text-warning"
    : "border-info/30 bg-info/10 text-info";
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
        {title} ({items.length})
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">{empty ?? "—"}</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {items.slice(0, 10).map((k) => (
            <span key={k} className={`rounded border px-1.5 py-0.5 text-[10px] ${cls}`}>{k}</span>
          ))}
        </div>
      )}
    </div>
  );
}
