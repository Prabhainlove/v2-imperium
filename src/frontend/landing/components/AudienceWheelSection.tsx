import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import logo from "@frontend/landing/assets/imperium_logo.png";

const AUDIENCES = [
  { label: "New Grads", sub: "Start fast. First role ready.", angle: 0 },
  { label: "Creatives", sub: "Portfolio-led applications.", angle: 90 },
  { label: "Engineers", sub: "Tailored technical resumes.", angle: 180 },
  { label: "Leaders", sub: "Land your next senior role.", angle: 270 },
];

/**
 * Compass-like glyph cluster / radial information diagram (not a wheel).
 * Central emblem with audience labels arranged on cardinal points; the
 * whole cluster gently counter-rotates with scroll.
 */
export default function AudienceWheelSection() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.fromTo(
        ".aw-cluster",
        { rotate: -20 },
        {
          rotate: 20,
          ease: "none",
          scrollTrigger: { trigger: ref.current, start: "top bottom", end: "bottom top", scrub: true },
        },
      );
    },
    { scope: ref },
  );

  return (
    <section ref={ref} className="relative min-h-screen w-full bg-[#e8e4dd] py-32">
      <div className="mx-auto max-w-5xl px-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-black/55">
          ( Radial Diagram )
        </p>
        <h2 className="mt-3 font-sans text-[clamp(40px,7vw,96px)] font-medium leading-[0.95] tracking-[-0.03em] text-black">
          Built for everyone<br />
          <span className="text-black/40">who applies.</span>
        </h2>
      </div>

      <div className="relative mx-auto mt-16 grid h-[520px] w-full max-w-3xl place-items-center">
        <div className="aw-cluster relative h-[420px] w-[420px]">
          {/* cardinal axes */}
          <div className="absolute inset-0">
            <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-black/10" />
            <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-black/10" />
            <div className="absolute inset-12 rounded-full border border-dashed border-black/10" />
          </div>

          {/* central emblem */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-3 shadow-[0_20px_60px_rgba(0,0,0,0.08)] ring-1 ring-black/5">
            <img src={logo} alt="" className="h-20 w-20 rounded-xl" />
          </div>

          {/* cardinal labels — counter-rotated to stay upright */}
          {AUDIENCES.map((a, i) => {
            const rad = (a.angle * Math.PI) / 180;
            const r = 180;
            const x = Math.cos(rad) * r;
            const y = Math.sin(rad) * r;
            return (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 w-[150px] -translate-x-1/2 -translate-y-1/2 text-center"
                style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
              >
                <div className="font-sans text-[16px] font-medium text-black">{a.label}</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-black/50">
                  {a.sub}
                </div>
              </div>
            );
          })}
        </div>

        <div className="absolute right-0 top-0 text-right font-mono text-[10px] uppercase tracking-[0.2em] text-black/55">
          Search, tailor,<br />and apply.
        </div>
      </div>
    </section>
  );
}
