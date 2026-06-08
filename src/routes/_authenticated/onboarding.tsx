import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  CareerSection, EducationSection, ExperienceSection, LinksSection,
  PersonalSection, ProjectsSection, SkillsSection,
} from "@/components/imperium/profile-sections";
import { EMPTY_PROFILE, SAMPLE_PROFILE, type ImperiumProfile } from "@/lib/imperium/profile/types";
import { computeCompleteness } from "@/lib/imperium/profile/completeness";
import { getProfile, saveProfile } from "@/lib/imperium/client";


export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome — Imperium" },
      { name: "description", content: "Set up your Imperium profile so every workflow can use it locally." },
    ],
  }),
  component: OnboardingPage,
});

const STEPS = [
  { key: "personal", label: "Personal" },
  { key: "career", label: "Career" },
  { key: "skills", label: "Skills" },
  { key: "experience", label: "Experience" },
  { key: "projects", label: "Projects" },
  { key: "education", label: "Education" },
  { key: "links", label: "Links" },
] as const;

function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<ImperiumProfile | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return;
      const res = await getProfile();
      if (!mounted) return;
      if (res.profile?.onboarded) {
        navigate({ to: "/dashboard", replace: true });
        return;
      }
      // First-run: pre-fill with SAMPLE_PROFILE so the form is demo-ready.
      // Returning users keep their saved profile.
      const base: ImperiumProfile = res.profile
        ? (res.profile as ImperiumProfile)
        : { id: userRes.user.id, ...SAMPLE_PROFILE };
      if (!base.name) base.name = (userRes.user.user_metadata?.name as string) ?? SAMPLE_PROFILE.name;
      if (!base.email) base.email = userRes.user.email ?? SAMPLE_PROFILE.email;
      setDraft(base);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [navigate]);

  const completeness = useMemo(() => computeCompleteness(draft ?? EMPTY_PROFILE), [draft]);

  const set = (patch: Partial<ImperiumProfile>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const canNext = useMemo(() => {
    if (!draft) return false;
    switch (STEPS[step].key) {
      case "personal": return draft.name.trim().length > 1 && draft.headline.trim().length > 1;
      case "career": return draft.target_role.trim().length > 1;
      case "skills": return draft.skills.length >= 3;
      case "experience": return true;
      case "projects": return true;
      case "education": return true;
      case "links": return true;
    }
  }, [draft, step]);

  const finish = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await saveProfile({ ...draft, onboarded: true });
      toast.success("Welcome to Imperium", { description: "Your profile is ready." });
      navigate({ to: "/dashboard", replace: true });
    } catch (e) {
      toast.error("Could not save profile", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !draft) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const progress = ((step + 1) / STEPS.length) * 100;
  const cur = STEPS[step];

  return (
    <div className="app-surface-crm min-h-screen">
    <div className="relative mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <div className="app-card overflow-hidden p-6 md:p-8">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">01 · Onboarding</div>
        <h1 className="imp-h mt-3 text-3xl text-foreground md:text-4xl">Welcome to Imperium.</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Set up your candidate profile. Every workflow — discovery, tailoring, applying — is powered by these facts.
        </p>
      </div>


      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setDraft((d) => (d ? { ...d, ...SAMPLE_PROFILE, id: d.id, onboarded: d.onboarded } : d))
          }
        >
          Load sample profile (Dinesh Kumar)
        </Button>
      </div>

      <div className="space-y-2">
        <Progress value={progress} />
        <div className="flex justify-between gap-2 overflow-x-auto text-xs text-muted-foreground">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStep(i)}
              className={`whitespace-nowrap ${i === step ? "imp-h font-semibold text-foreground" : ""}`}
            >
              {i + 1}. {s.label}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="imp-h text-base">{cur.label}</CardTitle>
        </CardHeader>
        <CardContent>
          {cur.key === "personal" && <PersonalSection p={draft} set={set} />}
          {cur.key === "career" && <CareerSection p={draft} set={set} />}
          {cur.key === "skills" && <SkillsSection p={draft} set={set} />}
          {cur.key === "experience" && <ExperienceSection p={draft} set={set} />}
          {cur.key === "projects" && <ProjectsSection p={draft} set={set} />}
          {cur.key === "education" && <EducationSection p={draft} set={set} />}
          {cur.key === "links" && <LinksSection p={draft} set={set} />}
        </CardContent>
      </Card>

      <div className="rounded-sm border border-border/60 bg-card/40 p-3 text-xs text-muted-foreground">
        Profile completeness: <span className="imp-h font-semibold text-foreground">{Math.round(completeness.completion * 100)}%</span>
        {" · "}Readiness: <span className="imp-h font-semibold text-foreground">{completeness.readiness}</span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" disabled={step === 0 || saving} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            Continue <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={finish} disabled={saving} className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Enter Imperium

          </Button>
        )}
      </div>
    </div>
    </div>
  );
}

