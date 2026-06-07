import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useSpring } from "motion/react";
import { supabase } from "@/integrations/supabase/client";

import heroBg from "@/assets/landing/hero_rooftop.jpg.asset.json";
import figureBg from "@/assets/landing/figure_study.jpg.asset.json";
import fragmentsBg from "@/assets/landing/fragments_works.jpg.asset.json";
import memoryBg from "@/assets/landing/memory_room.jpg.asset.json";
import outroBg from "@/assets/landing/contact_outro.jpg.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IMPERIUM — The AI Job Agent" },
      { name: "description", content: "IMPERIUM interfaces with sources, recruiters, and AI to build a transparent job pipeline. Discover. Analyze. Optimize. Apply. Track." },
      { property: "og:title", content: "IMPERIUM — The AI Job Agent" },
      { property: "og:description", content: "A cinematic, autonomous job agent. Built for the modern career." },
    ],
  }),
  component: LandingPage,
});

/* ---------- shared chrome ---------- */

function TopChrome({ section }: { section: string }) {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-start justify-between px-6 pt-5 md:px-10 md:pt-7">
      <Link to="/" className="pointer-events-auto imp-mono text-[15px] leading-[1.05] text-white/85">
        IMPERIUM
        <br />
        <span className="text-white/55">{section}</span>
      </Link>
      <div className="imp-mono text-[15px] text-white/70 imp-flicker">5.0</div>
      <div className="pointer-events-auto flex items-center gap-6 imp-mono text-[15px] text-white/75">
        <button className="hover:text-white transition" type="button">Sound: <span className="text-white/55">Off</span></button>
        <button className="hover:text-white transition tracking-wider" type="button">MENU</button>
      </div>
    </header>
  );
}

function BottomChrome() {
  return (
    <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex items-end justify-between px-6 pb-5 md:px-10 md:pb-7">
      <div className="imp-mono text-[12px] uppercase tracking-[0.3em] text-white/40">
        scroll ▾
      </div>
      <div className="imp-mono text-[14px] text-white/75 text-right leading-[1.15]">
        hi@imperium.app
        <br />
        <span className="text-white/55">Open 2026</span>
      </div>
    </footer>
  );
}

/* ---------- bracket art ---------- */

function Brackets({
  lines,
  highlight,
  className = "",
}: {
  lines: string[];
  highlight?: number;
  className?: string;
}) {
  return (
    <div className={`imp-mono text-[18px] leading-[1.6] text-white/55 select-none ${className}`}>
      {lines.map((l, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ delay: i * 0.08, duration: 0.5 }}
          className={i === highlight ? "text-[#7ad8ff] imp-glow-cyan" : ""}
        >
          {l}
        </motion.div>
      ))}
    </div>
  );
}

/* ---------- page ---------- */

function LandingPage() {
  const [signedIn, setSignedIn] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const cta = signedIn ? "/dashboard" : "/auth";
  const ctaLabel = signedIn ? "ENTER CONSOLE" : "ENTER IMPERIUM";

  const [section, setSection] = useState("[ABOUT]");
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const p = el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight);
      setProgress(p);
      const labels = ["[ABOUT]", "[ABOUT]", "[WORKS]", "[MODULES]", "[ROOM OF MEMORIES]", "[CONTACT]"];
      const idx = Math.min(labels.length - 1, Math.floor(p * labels.length));
      setSection(labels[idx]);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black text-white">
      <TopChrome section={section} />
      <BottomChrome />

      {/* right side scroll rail */}
      <div className="pointer-events-none fixed right-6 top-1/2 z-40 hidden -translate-y-1/2 md:block">
        <div className="relative h-56 w-px bg-white/15">
          <div
            className="absolute inset-x-0 top-0 bg-[#7ad8ff]"
            style={{ height: `${progress * 100}%` }}
          />
        </div>
      </div>

      <div ref={scrollerRef} className="imp-scroller">
        <SectionIntro />
        <SectionAbout cta={cta} ctaLabel={ctaLabel} />
        <SectionFigure />
        <SectionWorks />
        <SectionModules />
        <SectionMemory />
        <SectionContact cta={cta} ctaLabel={ctaLabel} />
      </div>
    </div>
  );
}

/* ---------- sections ---------- */

function SceneBg({ url, parallax = 0 }: { url: string; parallax?: number }) {
  return (
    <>
      <motion.div
        className="imp-bg"
        style={{ backgroundImage: `url(${url})`, y: parallax }}
      />
      <div className="imp-bg-fade" />
      <div className="absolute inset-0 imp-grain imp-scanlines imp-vignette pointer-events-none" />
    </>
  );
}

function SectionIntro() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useSpring(useTransform(scrollYProgress, [0, 1], [0, 120]), { stiffness: 60, damping: 18 });

  return (
    <section ref={ref} className="imp-snap">
      <SceneBg url={heroBg.url} />
      <motion.div
        style={{ y }}
        className="relative z-10 flex h-full min-h-screen items-center justify-center px-6"
      >
        <div className="text-center imp-mono">
          <motion.div
            initial={{ opacity: 0, letterSpacing: "0.6em" }}
            animate={{ opacity: 1, letterSpacing: "0.15em" }}
            transition={{ duration: 2.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-[clamp(2.4rem,8vw,6rem)] leading-none text-white imp-glow-amber"
          >
            IMPERIUM
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 1 }}
            className="mt-4 text-[14px] uppercase tracking-[0.4em] text-white/55"
          >
            An AI Job Agent <span className="imp-blink">_</span>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

function SectionAbout({ cta, ctaLabel }: { cta: string; ctaLabel: string }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [-40, 80]);

  return (
    <section ref={ref} className="imp-snap">
      <SceneBg url={heroBg.url} parallax={0} />
      <motion.div style={{ y }} className="relative z-10 grid h-full min-h-screen grid-cols-12 items-center gap-4 px-6 md:px-12">
        <div className="col-span-12 md:col-span-6 md:col-start-7">
          <Brackets
            lines={["[", "[ABOUT]", "]]]", "[[]"]}
            highlight={1}
            className="mb-6"
          />
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="imp-mono text-[18px] md:text-[22px] leading-[1.55] text-white max-w-xl imp-glow-amber"
          >
            IMPERIUM interfaces with job boards, recruiters, and language
            models to build a transparent application pipeline. It engineers
            purposeful motion to bring static careers to functional life.
          </motion.p>
          <Brackets lines={["]]]"]} className="mt-8" />

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="mt-8"
          >
            <Link
              to={cta}
              className="imp-mono inline-flex items-center gap-3 border border-white/40 px-7 py-3 text-[16px] tracking-[0.2em] text-white hover:border-white hover:bg-white/5 transition"
            >
              <span>ABOUT</span>
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

function SectionFigure() {
  return (
    <section className="imp-snap">
      <SceneBg url={figureBg.url} />
      <div className="relative z-10 grid h-full min-h-screen grid-cols-12 items-center gap-4 px-6 md:px-12">
        <div className="col-span-12 md:col-span-5">
          <Brackets lines={["_]", "[STUDIO]", "[]", "]][_"]} highlight={1} />
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 1 }}
            className="imp-mono mt-8 text-[18px] leading-[1.55] text-white max-w-md imp-glow-cyan"
          >
            A quiet observer. Imperium watches the market, your profile,
            and the gap between them — then closes it, one application
            at a time.
          </motion.p>
        </div>
      </div>
    </section>
  );
}

function SectionWorks() {
  return (
    <section className="imp-snap">
      <SceneBg url={fragmentsBg.url} />
      {/* drifting motes overlay */}
      <div className="pointer-events-none absolute inset-0 z-[5]">
        {Array.from({ length: 22 }).map((_, i) => (
          <motion.span
            key={i}
            className="absolute h-[3px] w-[3px] rounded-full bg-white"
            style={{
              left: `${(i * 47) % 100}%`,
              top: `${(i * 73) % 100}%`,
              boxShadow: "0 0 12px 3px rgba(180,220,255,0.7)",
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 5 + (i % 5),
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>
      <div className="relative z-10 grid h-full min-h-screen grid-cols-12 items-center gap-4 px-6 md:px-12">
        <div className="col-span-12 md:col-span-5">
          <Brackets lines={["_]]", "[WORKS]", "[]", "]][", "]]]]_"]} highlight={1} />
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 1 }}
            className="imp-mono mt-8 text-[18px] leading-[1.55] text-white max-w-md imp-glow-cyan"
          >
            A selection of modules that represent what Imperium can do.
            They all push the boundaries of what an agent can quietly
            accomplish on your behalf.
          </motion.p>
        </div>
      </div>
    </section>
  );
}

function SectionModules() {
  const modules = [
    { name: "JOB DISCOVERY",      tag: "AGGREGATION",   span: "2024 — 2026" },
    { name: "MATCH ENGINE",       tag: "INTELLIGENCE",  span: "2024 — 2026" },
    { name: "RESUME STUDIO",      tag: "GENERATIVE",    span: "2025 — 2026" },
    { name: "COVER LETTERS",      tag: "AUTHORSHIP",    span: "2025 — 2026" },
    { name: "AUTOPILOT",          tag: "AUTOMATION",    span: "2025 — 2026" },
    { name: "INTERVIEW PREP",     tag: "COACHING",      span: "2024 — 2025" },
    { name: "APPLICATION TRACK",  tag: "PIPELINE",      span: "2023 — 2024" },
  ];

  return (
    <section className="imp-snap">
      <SceneBg url={fragmentsBg.url} />
      <div className="absolute inset-0 z-[2] bg-black/55 backdrop-blur-[1.5px]" />
      <div className="relative z-10 mx-auto flex h-full min-h-screen max-w-6xl flex-col justify-center px-6 md:px-12">
        <div className="mb-10 flex items-baseline justify-between">
          <Brackets lines={["[MODULES]"]} highlight={0} />
          <div className="imp-mono text-[12px] uppercase tracking-[0.35em] text-white/45">
            seven · listed
          </div>
        </div>
        <ul className="divide-y divide-white/10 border-y border-white/10">
          {modules.map((m, i) => (
            <motion.li
              key={m.name}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ delay: i * 0.07, duration: 0.55 }}
              className="group grid grid-cols-12 items-center gap-2 py-4 hover:bg-white/[0.04] transition px-3"
            >
              <span className="imp-mono col-span-1 text-[14px] text-white/40">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="imp-mono col-span-6 text-[18px] md:text-[22px] tracking-wide text-white group-hover:imp-glow-cyan transition">
                {m.name}
              </span>
              <span className="imp-mono col-span-3 text-[13px] uppercase tracking-[0.25em] text-white/55">
                {m.tag}
              </span>
              <span className="imp-mono col-span-2 text-right text-[14px] text-white/70">
                {m.span}
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function SectionMemory() {
  return (
    <section className="imp-snap">
      <SceneBg url={memoryBg.url} />
      <div className="relative z-10 grid h-full min-h-screen grid-cols-12 items-center gap-4 px-6 md:px-12">
        <div className="col-span-12 md:col-span-6 md:col-start-7">
          <Brackets
            lines={["]]]", "[]", "[ROOM OF MEMORIES]]", "]][_"]}
            highlight={2}
          />
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 1 }}
            className="imp-mono mt-8 max-w-lg text-[18px] leading-[1.55] text-white imp-glow-cyan"
          >
            Every fragment of intent finds its place in the unwavering
            precision of the agent. Every application, every reply, every
            interview — remembered.
          </motion.p>
          <Brackets lines={["[]"]} className="mt-6" />
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="imp-mono mt-8 inline-flex items-center gap-4 border border-[#7ad8ff]/60 px-7 py-3 text-[15px] tracking-[0.2em] text-white hover:bg-[#7ad8ff]/10 transition"
          >
            <span aria-hidden>[</span> ADD A MEMORY <span aria-hidden>]</span>
          </motion.button>
        </div>
      </div>
    </section>
  );
}

function SectionContact({ cta, ctaLabel }: { cta: string; ctaLabel: string }) {
  return (
    <section className="imp-snap">
      <SceneBg url={outroBg.url} />
      <div className="relative z-10 flex h-full min-h-screen flex-col items-center justify-center px-6 text-center">
        <Brackets lines={["[", "[ENTER]", "]"]} highlight={1} className="text-center" />
        <Link
          to={cta}
          className="imp-mono mt-10 inline-flex items-center gap-4 border border-white/60 px-10 py-4 text-[clamp(1rem,2.2vw,1.6rem)] tracking-[0.25em] text-white imp-glow-amber hover:bg-white/10 transition"
        >
          <span aria-hidden>[</span>
          <span>{ctaLabel}</span>
          <span aria-hidden>]</span>
        </Link>
        <div className="mt-8 imp-mono text-[12px] uppercase tracking-[0.4em] text-white/55">
          one minute to set up · cancel anytime
        </div>
      </div>
    </section>
  );
}
