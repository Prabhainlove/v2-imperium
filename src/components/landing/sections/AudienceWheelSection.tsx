import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import logo from "@/assets/landing/imperium_logo.png";

export default function AudienceWheelSection() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.fromTo(
        ".aw-wheel",
        { rotate: -45 },
        {
          rotate: 45,
          ease: "none",
          scrollTrigger: { trigger: ref.current, start: "top bottom", end: "bottom top", scrub: true },
        },
      );
    },
    { scope: ref },
  );

  return (
    <section ref={ref} className="relative min-h-screen w-full bg-[#e8e4dd] py-32">
      <div className="mx-auto max-w-2xl rounded-3xl bg-white px-10 py-14 ring-1 ring-black/5">
        <h3 className="font-sans text-[36px] font-medium leading-tight text-black">Beginner Developers</h3>
        <p className="mt-24 text-[15px] text-black/65">Get started fast. Markup-first. No JS wizardry required.</p>
      </div>

      <div className="relative mx-auto mt-20 grid h-[420px] w-full max-w-3xl place-items-center">
        <div className="aw-wheel relative h-[360px] w-[360px]">
          {/* cross */}
          <div className="absolute inset-0">
            <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-black/10" />
            <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-black/10" />
          </div>
          {/* central emblem */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <img src={logo} alt="" className="h-32 w-32 rounded-2xl" />
          </div>

          {/* rotated labels */}
          <span className="absolute left-0 top-1/2 origin-left -translate-y-1/2 -rotate-90 font-sans text-[14px] tracking-tight text-black/70">
            Even Designers — Control behavior visually
          </span>
          <span className="absolute right-0 top-1/2 origin-right -translate-y-1/2 rotate-90 font-sans text-[14px] tracking-tight text-black/70">
            Experienced Developers — Extend &amp; compose
          </span>
        </div>

        <div className="absolute right-0 top-0 text-right font-mono text-[10px] uppercase tracking-[0.2em] text-black/55">
          Extend, override,<br />and compose.
        </div>
      </div>
    </section>
  );
}
