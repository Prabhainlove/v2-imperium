import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useSpring, useInView } from "motion/react";
import { supabase } from "@/integrations/supabase/client";
import { SplineScene } from "@/components/ui/splite";
import { Spotlight } from "@/components/ui/spotlight";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Imperium — The AI Job Agent" },
      { name: "description", content: "Imperium discovers jobs, optimizes resumes, prepares applications and tracks every opportunity. A transparent AI job agent." },
      { property: "og:title", content: "Imperium — The AI Job Agent" },
      { property: "og:description", content: "Discover. Analyze. Optimize. Prepare. Apply. Track." },
    ],
  }),
  component: LandingPage,
});

/* ----------------------------------------------------------------------------
 * Cinematic, scroll-driven landing inspired by editorial agency sites:
 * deep navy stage, oversized outlined numerals, layered headlines, ember
 * accents, scroll-snap sections. Frontend only — no backend changes.
 * -------------------------------------------------------------------------- */

function LandingPage() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const cta = signedIn ? "/dashboard" : "/auth";
  const ctaLabel = signedIn ? "Open Console" : "Launch Imperium";

  const scrollerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ container: scrollerRef });
  const progress = useSpring(scrollYProgress, { stiffness: 80, damping: 20, mass: 0.3 });

  return (
    <div className="imp-stage">
      {/* fixed chrome */}
      <FrameChrome cta={cta} ctaLabel={ctaLabel} />
      <ProgressRail progress={progress} />

      {/* scroll-snap stage */}
      <div ref={scrollerRef} className="imp-scroller">
        <SectionHero cta={cta} ctaLabel={ctaLabel} />
        <SectionDiscovery />
        <SectionAnalysis />
        <SectionResume />
        <SectionWorkflow />
        <SectionTracking />
        <SectionLaunch cta={cta} ctaLabel={ctaLabel} />
      </div>
    </div>
  );
}

/* ---------- chrome ---------- */

function FrameChrome({ cta, ctaLabel }: { cta: string; ctaLabel: string }) {
  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-5 md:px-10">
        <Link to="/" className="pointer-events-auto flex items-center gap-3">
          <span className="imp-mark" aria-hidden />
          <span className="text-[11px] font-medium uppercase tracking-[0.32em] text-white/80">
            Imperium
          </span>
        </Link>
        <div className="pointer-events-auto hidden items-center gap-8 text-[10px] uppercase tracking-[0.3em] text-white/55 md:flex">
          <span>An AI Job Agent</span>
          <span className="text-white/30">·</span>
          <span>v2 · 2026</span>
        </div>
        <Link
          to={cta}
          className="imp-cta-pill pointer-events-auto"
          data-label={ctaLabel}
        >
          <span>{ctaLabel}</span>
          <span aria-hidden>→</span>
        </Link>
      </header>

      {/* corner ticks like editorial sites */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-40">
        <span className="imp-tick imp-tick-tl" />
        <span className="imp-tick imp-tick-tr" />
        <span className="imp-tick imp-tick-bl" />
        <span className="imp-tick imp-tick-br" />
      </div>

      <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex items-end justify-between px-6 pb-5 md:px-10">
        <span className="text-[10px] uppercase tracking-[0.35em] text-white/40">
          Scroll · Discover the agent
        </span>
        <span className="text-[10px] uppercase tracking-[0.35em] text-white/40">
          Frontend / Cinematic Build
        </span>
      </footer>
    </>
  );
}

function ProgressRail({ progress }: { progress: any }) {
  const scaleY = useTransform(progress, [0, 1], [0, 1]);
  return (
    <div className="pointer-events-none fixed right-6 top-1/2 z-40 hidden -translate-y-1/2 md:block">
      <div className="relative h-56 w-px bg-white/15">
        <motion.div
          style={{ scaleY, transformOrigin: "top" }}
          className="absolute inset-0 bg-[color:var(--imp-ember)]"
        />
      </div>
    </div>
  );
}

/* ---------- sections ---------- */

function SectionHero({ cta, ctaLabel }: { cta: string; ctaLabel: string }) {
  return (
    <section className="imp-snap imp-hero">
      {/* layered oversized type — top + bottom */}
      <div className="imp-band imp-band-top">
        <span aria-hidden>IMPERIUM</span>
      </div>
      <div className="imp-band imp-band-bottom">
        <span aria-hidden>JOB&nbsp;AGENT</span>
      </div>

      {/* aceternity spotlight wash */}
      <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" fill="#ff6b3d" />

      {/* central showcase: spline + copy */}
      <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl items-center px-6 md:px-10">
        <div className="grid w-full gap-6 md:grid-cols-2 md:gap-10">
          {/* Left copy */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col justify-center"
          >
            <div className="text-[10px] uppercase tracking-[0.4em] text-[color:var(--imp-ember)]">
              An AI Job Agent
            </div>
            <h1 className="mt-4 bg-gradient-to-b from-white to-white/40 bg-clip-text font-display text-[clamp(2.4rem,6vw,4.6rem)] leading-[0.95] tracking-[-0.03em] text-transparent">
              Interactive
              <span className="block text-[color:var(--imp-ember)]">Job Hunt.</span>
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/65">
              Imperium discovers, scores, tailors, and tracks every opportunity —
              an autonomous, transparent pipeline for the modern career.
            </p>
            <div className="mt-8 flex items-center gap-4">
              <Link to={cta} className="imp-cta-pill">
                <span>{ctaLabel}</span>
                <span aria-hidden>→</span>
              </Link>
              <span className="text-[10px] uppercase tracking-[0.32em] text-white/45">
                Scroll · discover
              </span>
            </div>
          </motion.div>

          {/* Right: Spline 3D scene */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative h-[420px] min-h-[320px] w-full md:h-[560px]"
          >
            <SplineScene
              scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
              className="h-full w-full"
            />
          </motion.div>
        </div>
      </div>

      {/* year markers like reference */}
      <div className="imp-year imp-year-left" aria-hidden>2026</div>
      <div className="imp-year imp-year-right" aria-hidden>V&nbsp;2</div>
    </section>
  );
}

/* ---- generic numbered section ---- */

function NumberedSection({
  index,
  kicker,
  title,
  highlight,
  body,
  children,
}: {
  index: string;
  kicker: string;
  title: string;
  highlight?: string;
  body: string;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  return (
    <section ref={ref} className="imp-snap imp-section">
      <div className="imp-section-grid">
        <motion.div
          className="imp-numeral"
          aria-hidden
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <span>{index}</span>
        </motion.div>

        <div className="imp-section-copy">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-[10px] uppercase tracking-[0.4em] text-[color:var(--imp-ember)]"
          >
            {kicker}
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.9, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="mt-3 font-display text-[clamp(2.6rem,7vw,5.6rem)] leading-[0.95] tracking-[-0.03em] text-white"
          >
            {title}
            {highlight && (
              <span className="block text-[color:var(--imp-ember)]">{highlight}</span>
            )}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/65"
          >
            {body}
          </motion.p>
        </div>

        <div className="imp-section-stage">
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
            transition={{ duration: 1, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="h-full"
          >
            {children}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ---- 02 Discovery ---- */
function SectionDiscovery() {
  const sources = [
    { name: "RemoteOK", note: "Remote-first roles" },
    { name: "Remotive", note: "Curated remote" },
    { name: "Arbeitnow", note: "EU remote" },
    { name: "LinkedIn", note: "Network postings" },
    { name: "Indeed", note: "Global index" },
    { name: "Adzuna", note: "Aggregated" },
    { name: "Naukri", note: "India market" },
  ];
  return (
    <NumberedSection
      index="02"
      kicker="The Search"
      title="Seven sources."
      highlight="One sweep."
      body="Imperium queries every connected job source in parallel — dedupes, normalizes, and surfaces only what fits your profile."
    >
      <div className="imp-card">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-white/55">
          <span>Live discovery</span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--imp-ember)] [animation:pulse-dot_1.6s_ease-in-out_infinite]" />
            scanning
          </span>
        </div>
        <ul className="mt-5 space-y-2.5">
          {sources.map((s, i) => (
            <motion.li
              key={s.name}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="flex items-center justify-between gap-4 border-b border-white/5 pb-2"
            >
              <span className="flex items-center gap-3">
                <span className="font-display text-xs text-white/45 normal-case tracking-wider">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sm text-white">{s.name}</span>
              </span>
              <span className="text-[11px] text-white/45">{s.note}</span>
              <span className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--imp-ember)]">
                live
              </span>
            </motion.li>
          ))}
        </ul>
        <div className="mt-5 h-px overflow-hidden bg-white/10">
          <div className="scanline h-full w-1/3" />
        </div>
      </div>
    </NumberedSection>
  );
}

/* ---- 03 Analysis ---- */
function SectionAnalysis() {
  return (
    <NumberedSection
      index="03"
      kicker="The Read"
      title="Match. Rank."
      highlight="Reveal the gap."
      body="Every role is scored against your profile — what fits, what's missing, what to learn next. Decisions become legible."
    >
      <div className="imp-card flex h-full flex-col gap-5">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-white/55">Match score</div>
            <div className="mt-1 font-display text-5xl leading-none text-white">94<span className="text-[color:var(--imp-ember)]">.</span></div>
          </div>
          <div className="text-right text-[10px] uppercase tracking-[0.3em] text-white/55">
            <div>Rank</div>
            <div className="mt-1 font-display text-2xl normal-case tracking-tight text-white">#3 / 128</div>
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/55">Skills present</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["React", "TypeScript", "TanStack", "Tailwind", "Postgres"].map((s) => (
              <span key={s} className="rounded border border-white/15 px-2 py-0.5 text-[11px] text-white/85">
                {s}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/55">Skills missing</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["GraphQL", "Playwright"].map((s) => (
              <span
                key={s}
                className="rounded border border-[color:var(--imp-ember)]/50 px-2 py-0.5 text-[11px] text-[color:var(--imp-ember)]"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-auto">
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/55">Fit breakdown</div>
          <div className="mt-2 space-y-2">
            {[
              ["Role", 92],
              ["Stack", 96],
              ["Seniority", 88],
            ].map(([k, v]) => (
              <div key={k as string} className="flex items-center gap-3">
                <span className="w-20 text-[11px] uppercase tracking-wider text-white/55">{k}</span>
                <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${v}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute inset-y-0 left-0 bg-[color:var(--imp-ember)]"
                  />
                </div>
                <span className="w-8 text-right text-[11px] text-white/75">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </NumberedSection>
  );
}

/* ---- 04 Resume Studio ---- */
function SectionResume() {
  return (
    <NumberedSection
      index="04"
      kicker="The Studio"
      title="Resume,"
      highlight="rendered properly."
      body="Markdown in, RenderCV-grade output. Five typographic templates, live ATS scoring, instant PDF export."
    >
      <div className="imp-card flex h-full gap-4 p-4">
        <div className="flex w-1/2 flex-col rounded-md border border-white/10 bg-black/30 p-4 font-mono text-[11px] leading-relaxed text-white/75">
          <div className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/45">resume.md</div>
          <pre className="whitespace-pre-wrap text-white/80">{`# Ada Lovelace
**Senior Frontend Engineer**

## Experience
- Imperium · 2024 — Now
  Built the cinematic shell of v2.
- Atlas · 2021 — 2024
  Shipped design system used by 4 squads.

## Skills
React · TypeScript · TanStack
`}</pre>
        </div>
        <div className="flex w-1/2 flex-col rounded-md border border-white/10 bg-white/[0.96] p-4 text-neutral-900">
          <div className="border-b border-neutral-300 pb-2">
            <div className="font-display text-xl leading-tight tracking-tight">Ada Lovelace</div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-neutral-500">
              Senior Frontend Engineer
            </div>
          </div>
          <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Experience
          </div>
          <div className="mt-1 text-[11px] leading-snug text-neutral-700">
            <div className="font-medium">Imperium · 2024 — Now</div>
            <div>Built the cinematic shell of v2.</div>
            <div className="mt-1 font-medium">Atlas · 2021 — 2024</div>
            <div>Shipped design system used by 4 squads.</div>
          </div>
          <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Skills
          </div>
          <div className="mt-1 text-[11px] text-neutral-700">React · TypeScript · TanStack</div>
          <div className="mt-auto flex items-center justify-between pt-3 text-[10px] uppercase tracking-[0.25em] text-neutral-500">
            <span>Template · Classic</span>
            <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-white">ATS A</span>
          </div>
        </div>
      </div>
    </NumberedSection>
  );
}

/* ---- 05 Workflow ---- */
function SectionWorkflow() {
  const steps = [
    ["Find", "Surface the role"],
    ["Tailor", "Optimize resume"],
    ["Compose", "Generate cover letter"],
    ["Review", "Inspect every field"],
    ["Decide", "Approve or skip"],
  ];
  return (
    <NumberedSection
      index="05"
      kicker="The Loop"
      title="Five steps,"
      highlight="visible end to end."
      body="No silent submissions. Every artifact — resume, letter, form — is staged for your approval before anything leaves."
    >
      <div className="imp-card flex h-full flex-col">
        <ol className="relative flex-1 space-y-4">
          <span className="absolute left-3 top-1 bottom-1 w-px bg-white/15" aria-hidden />
          {steps.map(([t, body], i) => (
            <motion.li
              key={t}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ delay: i * 0.12, duration: 0.55 }}
              className="relative pl-10"
            >
              <span className="absolute left-0 top-0 grid h-6 w-6 place-items-center rounded-full border border-[color:var(--imp-ember)] bg-[color:var(--imp-navy-2)] text-[10px] font-medium text-[color:var(--imp-ember)]">
                {i + 1}
              </span>
              <div className="text-sm text-white">{t}</div>
              <div className="text-[11px] text-white/55">{body}</div>
            </motion.li>
          ))}
        </ol>
        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-[10px] uppercase tracking-[0.3em] text-white/55">
          <span>Human in the loop</span>
          <span className="text-[color:var(--imp-ember)]">Approve · Skip</span>
        </div>
      </div>
    </NumberedSection>
  );
}

/* ---- 06 Tracking ---- */
function SectionTracking() {
  const lanes = [
    { name: "Applied", n: 14 },
    { name: "Under Review", n: 6 },
    { name: "Interview", n: 3 },
    { name: "Offer", n: 1 },
  ];
  return (
    <NumberedSection
      index="06"
      kicker="The Board"
      title="Every status,"
      highlight="one surface."
      body="From the first save to the signed offer. Imperium keeps the whole funnel auditable, sortable, and yours."
    >
      <div className="imp-card grid h-full grid-cols-2 gap-3 md:grid-cols-4">
        {lanes.map((l, i) => (
          <motion.div
            key={l.name}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ delay: i * 0.1, duration: 0.55 }}
            className="flex flex-col rounded-md border border-white/10 bg-white/[0.03] p-3"
          >
            <div className="text-[10px] uppercase tracking-[0.3em] text-white/55">{l.name}</div>
            <div className="mt-2 font-display text-4xl leading-none text-white">{l.n}</div>
            <div className="mt-auto space-y-1.5 pt-3">
              {Array.from({ length: Math.min(l.n, 3) }).map((_, k) => (
                <div key={k} className="h-1.5 rounded bg-white/10">
                  <div
                    className="h-full rounded bg-[color:var(--imp-ember)]/70"
                    style={{ width: `${40 + k * 18}%` }}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </NumberedSection>
  );
}

/* ---- 07 Launch ---- */
function SectionLaunch({ cta, ctaLabel }: { cta: string; ctaLabel: string }) {
  return (
    <section className="imp-snap imp-launch">
      <div className="imp-band imp-band-top">
        <span aria-hidden>ENTER</span>
      </div>
      <div className="imp-band imp-band-bottom">
        <span aria-hidden>IMPERIUM</span>
      </div>
      <div className="relative z-10 text-center">
        <div className="text-[10px] uppercase tracking-[0.4em] text-[color:var(--imp-ember)]">
          07 · The Console
        </div>
        <h2 className="mt-5 font-display text-[clamp(2.5rem,7vw,5.4rem)] leading-[0.95] tracking-tight text-white">
          Your agent
          <span className="block text-white/55">is waiting.</span>
        </h2>
        <Link
          to={cta}
          className="imp-cta-pill mt-10 inline-flex"
          data-label={ctaLabel}
        >
          <span>{ctaLabel}</span>
          <span aria-hidden>→</span>
        </Link>
        <div className="mt-6 text-[10px] uppercase tracking-[0.35em] text-white/45">
          One minute to set up · Cancel anytime
        </div>
      </div>
    </section>
  );
}

/* ---------- styles (scoped via class names) ---------- */
/* Tailwind utilities used; the rest lives in styles.css via the imp-* tokens. */
