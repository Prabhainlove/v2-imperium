import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { MutableRefObject } from "react";

interface HtmlOverlayProps {
  progressRef: MutableRefObject<number>;
  cta: string;
  ctaLabel: string;
}

const ROOMS = [
  { key: "intro", label: "[ABOUT]" },
  { key: "rooftop", label: "[ABOUT]" },
  { key: "studio", label: "[STUDIO]" },
  { key: "arena", label: "[WORKS]" },
  { key: "memory", label: "[ROOM OF MEMORIES]" },
  { key: "outro", label: "[CONTACT]" },
];

const COPY: Record<string, { lines: string[]; body: string; cta?: string }> = {
  intro: {
    lines: ["[", "[ENTER]", "]"],
    body: "",
  },
  rooftop: {
    lines: ["[", "[ABOUT]", "]]]", "[[]"],
    body: "IMPERIUM interfaces with job boards, recruiters, and language models to build a transparent application pipeline. It engineers purposeful motion to bring static careers to functional life.",
    cta: "ABOUT",
  },
  studio: {
    lines: ["_]", "[STUDIO]", "[]", "]][_"],
    body: "A quiet observer. Imperium watches the market, your profile, and the gap between them — then closes it, one application at a time.",
  },
  arena: {
    lines: ["_]]", "[WORKS]", "[]", "]][", "]]]]_"],
    body: "A selection of modules that represent what Imperium can do. They all push the boundaries of what an agent can quietly accomplish on your behalf.",
  },
  memory: {
    lines: ["]]]", "[]", "[ROOM OF MEMORIES]]", "]][_"],
    body: "Every fragment of intent finds its place in the unwavering precision of the agent. Every application, every reply, every interview — remembered.",
    cta: "ADD A MEMORY",
  },
  outro: {
    lines: ["[", "[ENTER]", "]"],
    body: "",
  },
};

export function HtmlOverlay({ progressRef, cta, ctaLabel }: HtmlOverlayProps) {
  const [p, setP] = useState(0);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setP(progressRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progressRef]);

  const roomIndex = Math.min(
    ROOMS.length - 1,
    Math.floor(p * ROOMS.length),
  );
  const room = ROOMS[roomIndex];
  const copy = COPY[room.key];

  // Per-section progress (0..1 within section)
  const seg = 1 / ROOMS.length;
  const local = (p - roomIndex * seg) / seg;
  const fade = local < 0.15
    ? local / 0.15
    : local > 0.85
    ? 1 - (local - 0.85) / 0.15
    : 1;

  return (
    <>
      {/* TOP CHROME */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-start justify-between px-6 pt-5 md:px-10 md:pt-7">
        <Link to="/" className="pointer-events-auto imp-mono text-[15px] leading-[1.05] text-white/85">
          IMPERIUM
          <br />
          <span className="text-white/55 transition-opacity duration-300">{room.label}</span>
        </Link>
        <div className="imp-mono text-[15px] text-white/70 imp-flicker">5.0</div>
        <div className="pointer-events-auto flex items-center gap-6 imp-mono text-[15px] text-white/75">
          <button className="hover:text-white transition" type="button">
            Sound: <span className="text-white/55">Off</span>
          </button>
          <button className="hover:text-white transition tracking-wider" type="button">
            MENU
          </button>
        </div>
      </header>

      {/* RIGHT SCROLL RAIL */}
      <div className="pointer-events-none fixed right-6 top-1/2 z-40 hidden -translate-y-1/2 md:block">
        <div className="relative h-56 w-px bg-white/15">
          <div
            className="absolute inset-x-0 top-0 bg-[#7ad8ff] transition-[height] duration-100"
            style={{ height: `${p * 100}%` }}
          />
        </div>
      </div>

      {/* BOTTOM CHROME */}
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

      {/* PER-ROOM SIDE COPY */}
      <div
        className="pointer-events-none fixed inset-0 z-30 flex items-center px-6 md:px-12"
        style={{ opacity: fade, transition: "opacity 200ms linear" }}
      >
        <div className="w-full grid grid-cols-12 gap-4">
          {room.key === "intro" || room.key === "outro" ? (
            <div className="col-span-12 flex flex-col items-center text-center">
              {room.key === "outro" && (
                <>
                  <div className="imp-mono text-[18px] leading-[1.6] text-white/60 mb-8">
                    {copy.lines.map((l, i) => (
                      <div key={i} className={i === 1 ? "text-[#ffb070]" : ""}>
                        {l}
                      </div>
                    ))}
                  </div>
                  <Link
                    to={cta}
                    className="pointer-events-auto imp-mono inline-flex items-center gap-4 border border-white/60 px-10 py-4 text-[clamp(1rem,2.2vw,1.6rem)] tracking-[0.25em] text-white imp-glow-amber hover:bg-white/10 transition"
                  >
                    <span aria-hidden>[</span>
                    <span>{ctaLabel}</span>
                    <span aria-hidden>]</span>
                  </Link>
                  <div className="mt-8 imp-mono text-[12px] uppercase tracking-[0.4em] text-white/55">
                    one minute to set up · cancel anytime
                  </div>
                </>
              )}
            </div>
          ) : (
            <div
              className={`col-span-12 md:col-span-5 ${
                room.key === "rooftop" || room.key === "memory" ? "md:col-start-7" : ""
              }`}
            >
              <div className="imp-mono text-[18px] leading-[1.6] text-white/55 select-none">
                {copy.lines.map((l, i) => (
                  <div key={i} className={i === 1 ? "text-[#7ad8ff] imp-glow-cyan" : ""}>
                    {l}
                  </div>
                ))}
              </div>
              <p className="imp-mono mt-8 text-[18px] md:text-[20px] leading-[1.55] text-white max-w-lg imp-glow-cyan">
                {copy.body}
              </p>
              {copy.cta && (
                <Link
                  to={cta}
                  className="pointer-events-auto imp-mono mt-8 inline-flex items-center gap-3 border border-white/40 px-7 py-3 text-[15px] tracking-[0.2em] text-white hover:border-white hover:bg-white/5 transition"
                >
                  <span aria-hidden>[</span> {copy.cta} <span aria-hidden>]</span>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
