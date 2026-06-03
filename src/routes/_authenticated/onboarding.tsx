import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome — Imperium" },
      { name: "description", content: "Set up your candidate profile so Imperium can tailor every application to you." },
    ],
  }),
  component: OnboardingPage,
});

type Form = {
  name: string;
  headline: string;
  location: string;
  phone: string;
  summary: string;
  skills: string[];
  linkedin_url: string;
  github_url: string;
  portfolio_url: string;
};

const EMPTY: Form = {
  name: "",
  headline: "",
  location: "",
  phone: "",
  summary: "",
  skills: [],
  linkedin_url: "",
  github_url: "",
  portfolio_url: "",
};

const STEPS = ["Basics", "Experience", "Links"] as const;

function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [skillInput, setSkillInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return;
      if (mounted) setEmail(userRes.user.email ?? "");
      const { data } = await supabase
        .from("profiles")
        .select("name,headline,location,phone,summary,skills,linkedin_url,github_url,portfolio_url,onboarded")
        .eq("id", userRes.user.id)
        .maybeSingle();
      if (!mounted) return;
      if (data?.onboarded) {
        navigate({ to: "/dashboard", replace: true });
        return;
      }
      if (data) {
        setForm({
          name: data.name || userRes.user.user_metadata?.name || "",
          headline: data.headline || "",
          location: data.location || "",
          phone: data.phone || "",
          summary: data.summary || "",
          skills: Array.isArray(data.skills) ? (data.skills as string[]) : [],
          linkedin_url: data.linkedin_url || "",
          github_url: data.github_url || "",
          portfolio_url: data.portfolio_url || "",
        });
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const update = <K extends keyof Form>(k: K, v: Form[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const addSkill = () => {
    const s = skillInput.trim();
    if (!s) return;
    if (form.skills.includes(s)) {
      setSkillInput("");
      return;
    }
    update("skills", [...form.skills, s]);
    setSkillInput("");
  };

  const removeSkill = (s: string) =>
    update("skills", form.skills.filter((x) => x !== s));

  const canNext =
    step === 0
      ? form.name.trim().length > 1 && form.headline.trim().length > 1
      : step === 1
        ? form.summary.trim().length > 10 && form.skills.length >= 3
        : true;

  const finish = async () => {
    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        name: form.name,
        headline: form.headline,
        location: form.location,
        phone: form.phone,
        summary: form.summary,
        skills: form.skills,
        linkedin_url: form.linkedin_url,
        github_url: form.github_url,
        portfolio_url: form.portfolio_url,
        email,
        onboarded: true,
      })
      .eq("id", userRes.user.id);
    setSaving(false);
    if (error) {
      toast.error("Could not save profile", { description: error.message });
      return;
    }
    toast.success("Welcome to Imperium", {
      description: "Your profile is ready. Let's find you some jobs.",
    });
    navigate({ to: "/dashboard", replace: true });
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 md:p-8">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex items-center justify-center gap-3">
          <span className="imp-mark-sm" aria-hidden />
          <span className="imp-eyebrow">Onboarding</span>
        </div>
        <h1 className="imp-display text-2xl text-foreground">Set up your candidate profile</h1>
        <p className="text-sm text-muted-foreground">
          Imperium uses this to tailor every resume and cover letter to you.
        </p>
      </div>


      <div className="space-y-2">
        <Progress value={progress} />
        <div className="flex justify-between text-xs text-muted-foreground">
          {STEPS.map((s, i) => (
            <span key={s} className={i === step ? "text-foreground font-medium" : ""}>
              {i + 1}. {s}
            </span>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{STEPS[step]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Ada Lovelace" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="headline">Professional headline</Label>
                <Input id="headline" value={form.headline} onChange={(e) => update("headline", e.target.value)} placeholder="Senior Full-Stack Engineer · React / Node / AWS" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="Remote · EU" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone (optional)</Label>
                  <Input id="phone" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+44 ..." />
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="summary">Professional summary</Label>
                <Textarea
                  id="summary"
                  rows={5}
                  value={form.summary}
                  onChange={(e) => update("summary", e.target.value)}
                  placeholder="2–4 sentences about what you build, the stacks you love, and the roles you want."
                />
              </div>
              <div className="grid gap-2">
                <Label>Core skills (min. 3)</Label>
                <div className="flex gap-2">
                  <Input
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSkill();
                      }
                    }}
                    placeholder="e.g. TypeScript"
                  />
                  <Button type="button" variant="secondary" onClick={addSkill}>
                    Add
                  </Button>
                </div>
                {form.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {form.skills.map((s) => (
                      <Badge
                        key={s}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => removeSkill(s)}
                      >
                        {s} ×
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="linkedin">LinkedIn URL</Label>
                <Input id="linkedin" value={form.linkedin_url} onChange={(e) => update("linkedin_url", e.target.value)} placeholder="https://linkedin.com/in/..." />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="github">GitHub URL</Label>
                <Input id="github" value={form.github_url} onChange={(e) => update("github_url", e.target.value)} placeholder="https://github.com/..." />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="portfolio">Portfolio / website</Label>
                <Input id="portfolio" value={form.portfolio_url} onChange={(e) => update("portfolio_url", e.target.value)} placeholder="https://..." />
              </div>
              <p className="text-xs text-muted-foreground">
                All optional — you can edit these any time in Settings.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          disabled={step === 0 || saving}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
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
  );
}
