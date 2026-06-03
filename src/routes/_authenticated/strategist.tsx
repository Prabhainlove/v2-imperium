import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Brain, Sparkles, Target, FileText, Mail, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ThinkingStream,
  useImperiumThinking,
} from "@/components/imperium/thinking-stream";

export const Route = createFileRoute("/_authenticated/strategist")({
  head: () => ({
    meta: [
      { title: "AI Strategist — Imperium" },
      {
        name: "description",
        content:
          "Imperium's self-thinking career intelligence: profile analysis, job match scoring, ATS resume optimization and cover letters.",
      },
    ],
  }),
  component: StrategistPage,
});

type CandidateAnalysis = {
  strengths: string[];
  weaknesses: string[];
  missing_skills: string[];
  recommended_roles: string[];
  recommended_paths: string[];
  seniority: string;
  positioning: string;
  confidence: number;
};
type JobAnalysisR = {
  match_score: number;
  matched_skills: string[];
  missing_skills: string[];
  experience_fit: number;
  resume_recommendations: string[];
  application_recommendations: string[];
  verdict: string;
  reasoning: string;
};
type ResumeR = {
  optimized_md: string;
  ats_score: number;
  added_keywords: string[];
  missing_keywords: string[];
  changes: string[];
};
type CoverR = {
  cover_letter_md: string;
  reasoning: {
    why_candidate_fits: string;
    why_role_matches: string;
    strengths_highlighted: string[];
  };
};
type PlanR = {
  recommendation: "apply" | "skip";
  confidence: number;
  resume_version: string;
  highlight_projects: string[];
  emphasize_skills: string[];
  summary: string;
};

function StrategistPage() {
  const { steps, result, running, error, run } = useImperiumThinking();
  const [tab, setTab] = useState("full");
  const [jobTitle, setJobTitle] = useState("");
  const [jobCompany, setJobCompany] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [jobStack, setJobStack] = useState("");
  const [resumeMd, setResumeMd] = useState("");

  const candidate = result.candidate as CandidateAnalysis | undefined;
  const jobAnalysis = result.job as JobAnalysisR | undefined;
  const resumeR = result.resume as ResumeR | undefined;
  const coverR = result.cover as CoverR | undefined;
  const plan = result.plan as PlanR | undefined;

  const startThinking = async (mode: "full" | "candidate" | "job" | "resume" | "cover") => {
    if (mode !== "candidate" && (!jobTitle || !jobCompany)) {
      toast.error("Provide a job title and company first");
      return;
    }
    await run({
      mode,
      job: mode !== "candidate"
        ? {
            title: jobTitle,
            company: jobCompany,
            description: jobDesc,
            tech_stack: jobStack
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          }
        : undefined,
      resume_md: resumeMd || undefined,
    });
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="imp-eyebrow flex items-center gap-2">
            <Brain className="h-3.5 w-3.5" /> Self-thinking engine · Lovable AI · multi-model fallback
          </p>
          <h1 className="imp-display text-2xl mt-1.5">AI Career Strategist</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Imperium reasons before acting: it studies your profile, scores the role, rewrites your
            resume for ATS, drafts a company-specific cover letter, and recommends a decision — with
            its thinking visible end-to-end.
          </p>
        </div>
        {plan && (
          <div className="text-right">
            <p className="imp-eyebrow">AI verdict</p>
            <div className="flex items-center gap-2 mt-1 justify-end">
              {plan.recommendation === "apply" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span className="imp-display text-lg uppercase">{plan.recommendation}</span>
              <Badge variant="outline">{(plan.confidence * 100).toFixed(0)}%</Badge>
            </div>
          </div>
        )}
      </header>

      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6">
        {/* Left: input + thinking stream */}
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="jt">Target role</Label>
              <Input id="jt" placeholder="Senior Frontend Engineer" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jc">Company</Label>
              <Input id="jc" placeholder="Acme Corp" value={jobCompany} onChange={(e) => setJobCompany(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="jd">Job description</Label>
                <Textarea id="jd" rows={5} placeholder="Paste the JD…" value={jobDesc} onChange={(e) => setJobDesc(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="js">Tech stack (comma separated)</Label>
                <Input id="js" placeholder="React, TypeScript, Node.js…" value={jobStack} onChange={(e) => setJobStack(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rm">Existing resume (markdown, optional)</Label>
                <Textarea id="rm" rows={4} placeholder="Leave empty to start from your profile" value={resumeMd} onChange={(e) => setResumeMd(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => startThinking("full")} disabled={running} className="imp-ember-btn">
                <Sparkles className="h-4 w-4 mr-1.5" /> Run full strategy
              </Button>
              <Button onClick={() => startThinking("candidate")} disabled={running} variant="outline">
                Profile only
              </Button>
              <Button onClick={() => startThinking("job")} disabled={running} variant="outline">
                Match score
              </Button>
              <Button onClick={() => startThinking("resume")} disabled={running} variant="outline">
                Resume only
              </Button>
              <Button onClick={() => startThinking("cover")} disabled={running} variant="outline">
                Cover letter
              </Button>
            </div>
            {error && (
              <p className="text-xs text-destructive flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5" /> {error}
              </p>
            )}
          </Card>

          <ThinkingStream steps={steps} running={running} />
        </div>

        {/* Right: results */}
        <Card className="p-5">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="full"><Brain className="h-3.5 w-3.5" /></TabsTrigger>
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="match"><Target className="h-3.5 w-3.5 mr-1" />Match</TabsTrigger>
              <TabsTrigger value="resume"><FileText className="h-3.5 w-3.5 mr-1" />Resume</TabsTrigger>
              <TabsTrigger value="cover"><Mail className="h-3.5 w-3.5 mr-1" />Cover</TabsTrigger>
            </TabsList>

            <TabsContent value="full" className="mt-4 space-y-3">
              {plan ? (
                <>
                  <h3 className="imp-display text-lg">Recommendation Summary</h3>
                  <p className="text-sm text-muted-foreground">{plan.summary}</p>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <p className="imp-eyebrow">Highlight projects</p>
                      <ul className="text-xs mt-1 space-y-1">{plan.highlight_projects.map((p, i) => <li key={i}>• {p}</li>)}</ul>
                    </div>
                    <div>
                      <p className="imp-eyebrow">Emphasize skills</p>
                      <div className="flex flex-wrap gap-1 mt-1">{plan.emphasize_skills.map((s, i) => <Badge key={i} variant="secondary">{s}</Badge>)}</div>
                    </div>
                  </div>
                </>
              ) : <Empty label="Run full strategy to see Imperium's recommendation" />}
            </TabsContent>

            <TabsContent value="profile" className="mt-4 space-y-3">
              {candidate ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="imp-eyebrow">Positioning</p>
                    <p className="mt-1">{candidate.positioning}</p>
                  </div>
                  <Group label="Strengths" items={candidate.strengths} />
                  <Group label="Weaknesses" items={candidate.weaknesses} />
                  <Group label="Missing skills" items={candidate.missing_skills} />
                  <Group label="Recommended roles" items={candidate.recommended_roles} />
                  <p className="text-xs text-muted-foreground">Seniority: {candidate.seniority} · Confidence {(candidate.confidence * 100).toFixed(0)}%</p>
                </div>
              ) : <Empty label="Run profile analysis" />}
            </TabsContent>

            <TabsContent value="match" className="mt-4 space-y-3">
              {jobAnalysis ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="imp-eyebrow">Overall match</span>
                      <span className="imp-display text-lg">{(jobAnalysis.match_score * 100).toFixed(0)}%</span>
                    </div>
                    <Progress value={jobAnalysis.match_score * 100} className="h-1.5 mt-1.5" />
                  </div>
                  <Group label="Matched skills" items={jobAnalysis.matched_skills} variant="success" />
                  <Group label="Missing skills" items={jobAnalysis.missing_skills} variant="warning" />
                  <Group label="Resume recommendations" items={jobAnalysis.resume_recommendations} />
                  <Group label="Application recommendations" items={jobAnalysis.application_recommendations} />
                  <div>
                    <p className="imp-eyebrow">AI reasoning</p>
                    <p className="text-xs text-muted-foreground mt-1">{jobAnalysis.reasoning}</p>
                  </div>
                </div>
              ) : <Empty label="Run match score on a job" />}
            </TabsContent>

            <TabsContent value="resume" className="mt-4 space-y-3">
              {resumeR ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="imp-eyebrow">ATS score</span>
                    <span className="imp-display text-lg">{(resumeR.ats_score * 100).toFixed(0)}%</span>
                  </div>
                  <Progress value={resumeR.ats_score * 100} className="h-1.5" />
                  <Group label="Added keywords" items={resumeR.added_keywords} variant="success" />
                  <Group label="Missing keywords" items={resumeR.missing_keywords} variant="warning" />
                  <Group label="Changes made" items={resumeR.changes} />
                  <div>
                    <p className="imp-eyebrow mb-1">Optimized resume</p>
                    <pre className="text-[11px] whitespace-pre-wrap p-3 rounded bg-muted/30 border border-border/60 max-h-72 overflow-y-auto">{resumeR.optimized_md}</pre>
                  </div>
                </>
              ) : <Empty label="Optimize a resume" />}
            </TabsContent>

            <TabsContent value="cover" className="mt-4 space-y-3">
              {coverR ? (
                <>
                  <Group label="Why candidate fits" items={[coverR.reasoning.why_candidate_fits]} />
                  <Group label="Why role matches" items={[coverR.reasoning.why_role_matches]} />
                  <Group label="Strengths highlighted" items={coverR.reasoning.strengths_highlighted} variant="success" />
                  <div>
                    <p className="imp-eyebrow mb-1">Cover letter</p>
                    <pre className="text-[11px] whitespace-pre-wrap p-3 rounded bg-muted/30 border border-border/60 max-h-72 overflow-y-auto">{coverR.cover_letter_md}</pre>
                  </div>
                </>
              ) : <Empty label="Generate a cover letter" />}
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="text-xs text-muted-foreground py-12 text-center">{label}</p>;
}

function Group({
  label,
  items,
  variant,
}: {
  label: string;
  items: string[];
  variant?: "success" | "warning";
}) {
  if (!items?.length) return null;
  const color =
    variant === "success"
      ? "border-emerald-500/30 text-emerald-300"
      : variant === "warning"
        ? "border-amber-500/30 text-amber-300"
        : "";
  return (
    <div>
      <p className="imp-eyebrow">{label}</p>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {items.map((s, i) => (
          <Badge key={i} variant="outline" className={color}>
            {s}
          </Badge>
        ))}
      </div>
    </div>
  );
}
