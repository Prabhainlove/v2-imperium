import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Sparkles, Search, FileText, Send, Activity, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Imperium — AI Job Agent Platform" },
      { name: "description", content: "Imperium is an AI-powered job agent that searches roles across the web, tailors your resume to each posting, prepares applications, and tracks every opportunity — with every step visible." },
      { property: "og:title", content: "Imperium — AI Job Agent Platform" },
      { property: "og:description", content: "Search jobs, optimize resumes with ATS scoring, prepare applications, and track every opportunity. Transparent AI job agent." },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const cta = signedIn ? "/dashboard" : "/auth";
  const ctaLabel = signedIn ? "Open Console" : "Get Started — Free";

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold tracking-tight">IMPERIUM</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
          </nav>
          <Button asChild size="sm">
            <Link to={cta}>{ctaLabel}</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,theme(colors.primary/15),transparent_60%)]" />
        <div className="mx-auto max-w-6xl px-4 py-24 text-center">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Production-ready AI Job Agent
          </div>
          <h1 className="mx-auto max-w-3xl text-balance text-5xl font-semibold tracking-tight md:text-6xl">
            Your <span className="text-gradient">AI Job Agent</span> — transparent by design
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-base text-muted-foreground md:text-lg">
            Search jobs across the web, tailor your resume to every posting with ATS scoring, prepare applications, and track every opportunity. Every step visible. No silent submissions.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to={cta}>
                {ctaLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#how">How it works</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-b border-border/60 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Everything you need to land the role</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Built for serious job seekers. Visible at every step.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: Search, title: "Multi-source job search", body: "RemoteOK, Remotive, Arbeitnow today — Adzuna, Jooble, LinkedIn integrations coming next." },
              { icon: FileText, title: "RenderCV-grade resume studio", body: "Live markdown editor, multiple ATS-friendly templates, keyword scoring, PDF export." },
              { icon: Send, title: "Application review center", body: "Nothing is sent without your approval. Inspect, edit, approve or skip every package." },
              { icon: Activity, title: "Full workflow visibility", body: "Watch every step in real time: discover → analyze → optimize → prepare → review." },
              { icon: ShieldCheck, title: "Your data, your account", body: "Row-level security on every record. Jobs, applications and activity are scoped to you." },
              { icon: Zap, title: "Fast by default", body: "Cloud-native edge runtime. AI gateway included — no API keys to configure." },
            ].map((f) => (
              <Card key={f.title} className="p-6">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="text-base font-semibold">{f.title}</div>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-b border-border/60 py-20">
        <div className="mx-auto max-w-4xl px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">How Imperium works</h2>
          </div>
          <ol className="space-y-4">
            {[
              ["1", "Set up your profile", "Tell us about your role, skills, and target locations."],
              ["2", "Launch a search", "Imperium queries every connected job source in parallel."],
              ["3", "Watch the pipeline", "Every step is logged: dedupe → score → analyze → resume → cover letter."],
              ["4", "Review each application", "Inspect the tailored resume, cover letter, and form fields."],
              ["5", "Approve or skip", "Approved applications are marked Applied. Nothing happens silently."],
              ["6", "Track everything", "Dashboard shows all statuses from Saved to Offer."],
            ].map(([n, title, body]) => (
              <li key={n} className="flex gap-4 rounded-lg border border-border/60 bg-card p-5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{n}</div>
                <div>
                  <div className="font-medium">{title}</div>
                  <div className="mt-0.5 text-sm text-muted-foreground">{body}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-b border-border/60 py-20">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="mb-10 text-center text-3xl font-semibold tracking-tight md:text-4xl">Frequently asked</h2>
          <div className="space-y-4">
            {[
              ["Does Imperium auto-submit applications?", "No. Imperium prepares the application package and waits for your explicit approval before marking it as applied."],
              ["Which job sources are supported?", "RemoteOK, Remotive, and Arbeitnow are live. Adzuna, Jooble, and LinkedIn are coming in the next release."],
              ["Is my data private?", "Yes. Every record is row-level scoped to your account. Other users cannot see your jobs, resumes, or applications."],
              ["Do I need any API keys?", "No. The Lovable AI gateway is included. You only need to bring your own keys for premium job sources if you opt in."],
            ].map(([q, a]) => (
              <details key={q} className="group rounded-lg border border-border/60 bg-card p-5">
                <summary className="cursor-pointer list-none font-medium">{q}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Ready to launch your agent?</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Set up takes under a minute. Cancel anytime.</p>
          <div className="mt-6">
            <Button asChild size="lg">
              <Link to={cta}>
                {ctaLabel} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Imperium</span>
          <span>Built on Lovable Cloud</span>
        </div>
      </footer>
    </div>
  );
}
