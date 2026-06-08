import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

const cols = [
  { n: "(1)", lead: "Reads every", rest: " job description and tailors your resume in seconds." },
  { n: "(2)", lead: "Crafted", rest: " with a focused workflow so IMPERIUM only surfaces roles you actually want." },
  { n: "(3)", lead: "Personalize", rest: " every cover letter and application using your real story — never a generic template." },
  { n: "(4)", lead: "Built for", rest: " focused applicants, yet flexible enough for every industry and seniority level." },
];

export default function ClaritySection() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.fromTo(
        ".cl-col",
        { opacity: 0.3 },
        {
          opacity: 1,
          stagger: 0.15,
          ease: "none",
          scrollTrigger: { trigger: ref.current, start: "top 70%", end: "bottom bottom", scrub: true },
        },
      );
    },
    { scope: ref },
  );

  return (
    <section ref={ref} className="relative min-h-screen w-full bg-[#e8e4dd] px-8 py-32">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-start justify-between gap-12 md:flex-row">
          <h2 className="font-sans text-[clamp(56px,9vw,140px)] font-medium leading-[0.92] tracking-[-0.04em] text-black">
            Apply<br />With<br />Clarity
          </h2>
          <div className="max-w-xs pt-12 font-mono text-[11px] uppercase leading-relaxed tracking-[0.15em] text-black/70">
            Built to launch your career,<br />not battle your inbox.
          </div>
        </div>

        <h3 className="mt-12 text-center font-sans text-[clamp(120px,22vw,360px)] font-medium leading-none tracking-[-0.05em] text-black">
          Career
        </h3>

        <div className="mt-16 grid grid-cols-1 gap-10 md:grid-cols-4">
          {cols.map((c, i) => (
            <div key={i} className="cl-col">
              <div className="font-mono text-[12px] text-black/40">{c.n}</div>
              <p className="mt-4 text-[15px] leading-snug">
                <span className="font-medium text-black">{c.lead}</span>
                <span className="text-black/45">{c.rest}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
