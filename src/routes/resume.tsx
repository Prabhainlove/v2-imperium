import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  CheckCircle2,
  FileText,
  Loader2,
  Save,
  Sparkles,
  TrendingUp,
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
import {
  fetchArtifactText,
  getApplications,
  getProfile,
  saveProfile,
} from "@/lib/imperium/client";
import type { CandidateProfile } from "@/lib/imperium/types";
import { scoreToPercent } from "@/lib/imperium/format";

export const Route = createFileRoute("/resume")({
  head: () => ({
    meta: [
      { title: "Resume Studio — Imperium" },
      {
        name: "description",
        content:
          "Manage your candidate profile, view ATS health, and inspect resumes generated for each application.",
      },
      { property: "og:title", content: "Resume Studio — Imperium" },
      { property: "og:description", content: "Profile + ATS resume optimization studio." },
    ],
  }),
  component: ResumeStudioPage,
});

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
          typeof (form as unknown as { skills?: string | string[] }).skills ===
          "string"
            ? ((form as unknown as { skills: string }).skills as string)
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
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
    if (!selectedAppId && generated.length > 0) {
      setSelectedAppId(generated[0].application_id);
    }
  }, [generated, selectedAppId]);

  const selected = generated.find((a) => a.application_id === selectedAppId);

  const optimized = useQuery({
    queryKey: ["artifact", selected?.resume_path],
    queryFn: () => fetchArtifactText(selected!.resume_path!),
    enabled: !!selected?.resume_path,
    retry: false,
  });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Resume Studio"
        description="Maintain a structured candidate profile, watch ATS health, and inspect every resume Imperium generates."
        actions={
          <Button asChild className="bg-gradient-primary text-primary-foreground hover:opacity-95">
            <Link to="/search">
              <Sparkles className="mr-2 h-4 w-4" /> Run Search with this Profile
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Profile editor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Candidate Profile
              </span>
              {health && (
                <Badge variant="outline" className="text-[10px]">
                  {healthPct}% complete
                </Badge>
              )}
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
              <div className="col-span-2">
                <Label htmlFor="p-name">Name</Label>
                <Input
                  id="p-name"
                  value={form.name ?? ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="p-email">Email</Label>
                <Input
                  id="p-email"
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="p-phone">Phone</Label>
                <Input
                  id="p-phone"
                  value={form.phone ?? ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="p-loc">Location</Label>
                <Input
                  id="p-loc"
                  value={form.location ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="p-li">LinkedIn URL</Label>
                <Input
                  id="p-li"
                  value={form.linkedin_profile ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, linkedin_profile: e.target.value })
                  }
                  className="mt-1"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="p-skills">Skills (comma-separated)</Label>
                <Textarea
                  id="p-skills"
                  rows={3}
                  value={skillsString}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      skills: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className="mt-1 resize-none"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="p-roles">Target Roles (comma-separated)</Label>
                <Input
                  id="p-roles"
                  value={(form.target_roles ?? []).join(", ")}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      target_roles: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="p-smin">Salary Min</Label>
                <Input
                  id="p-smin"
                  type="number"
                  value={form.salary_min ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      salary_min: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="p-smax">Salary Max</Label>
                <Input
                  id="p-smax"
                  type="number"
                  value={form.salary_max ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      salary_max: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                  className="mt-1"
                />
              </div>
            </div>

            <Separator />

            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95"
            >
              {save.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Profile
            </Button>
          </CardContent>
        </Card>

        {/* Generated resumes */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-success" /> Generated Resumes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {generated.length === 0 ? (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No resumes generated yet. Run a search to create ATS-tailored
                  resumes per role.
                </p>
              ) : (
                <ul className="max-h-48 space-y-1 overflow-y-auto pr-1">
                  {generated.map((a) => (
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
                          {a.job_title}
                          <span className="ml-1 text-xs text-muted-foreground">
                            · {a.company}
                          </span>
                        </span>
                        {a.match_score != null && (
                          <Badge variant="secondary" className="text-[10px]">
                            {scoreToPercent(a.match_score)}%
                          </Badge>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                {selected
                  ? `Optimized for ${selected.company}`
                  : "Optimized Resume"}
              </CardTitle>
              {selected?.match_score != null && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">ATS match</span>
                  <Badge className="bg-success/15 text-success border-success/30">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    {scoreToPercent(selected.match_score)}%
                  </Badge>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {!selected ? (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Select a generated resume to preview its ATS-optimized output.
                </p>
              ) : optimized.isLoading ? (
                <div className="flex items-center justify-center p-10 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading
                  resume…
                </div>
              ) : optimized.error ? (
                <p className="text-sm text-destructive">
                  Failed to load resume content.
                </p>
              ) : (
                <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-md border border-border/60 bg-muted/30 p-3 font-mono text-[12px] leading-relaxed">
                  {optimized.data}
                </pre>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
