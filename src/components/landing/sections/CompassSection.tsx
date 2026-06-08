import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import emblem from "@/assets/landing/diamond_emblem.jpg";
import katana from "@/assets/landing/katana_horizontal.png";

export default function CompassSection() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const st = { trigger: ref.current, start: "top bottom", end: "bottom top", scrub: true };
      gsap.fromTo(".cp-diamond", { rotate: -12, scale: 0.9 }, { rotate: 12, scale: 1.05, ease: "none", scrollTrigger: st });
      gsap.fromTo(".cp-sword", { xPercent: -30, rotate: -10 }, { xPercent: 30, rotate: 10, ease: "none", scrollTrigger: st });
      gsap.fromTo(".cp-grey", { color: "#bcb6ad" }, { color: "#0a0a0a", ease: "none", scrollTrigger: st });
    },
    { scope: ref },
  );

  return (
    <section ref={ref} className="relative min-h-screen w-full bg-[#e8e4dd] py-32">
      <h2 className="px-8 text-center font-sans text-[clamp(36px,7vw,96px)] font-medium leading-[0.95] tracking-[-0.03em] text-black">
        To master the search is to
        <br />
        master <span className="cp-grey">your story…</span>
      </h2>

      <div className="relative mx-auto mt-20 flex h-[480px] w-full max-w-3xl items-center justify-center">
        {/* compass markers */}
        <div className="absolute inset-0">
          <span className="absolute left-1/2 top-2 -translate-x-1/2 font-serif text-2xl italic text-black/40">N</span>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[11px] tracking-[0.25em] text-black/40">E</span>
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[11px] tracking-[0.25em] text-black/40">S</span>
          <span className="absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[11px] tracking-[0.25em] text-black/40">W</span>
          {/* axis lines */}
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-black/10" />
          <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-black/10" />
        </div>

        {/* diamond emblem */}
        <div className="cp-diamond relative z-10 h-[260px] w-[260px] overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.2)]" style={{ transform: "rotate(45deg)" }}>
          <img src={emblem} alt="" loading="lazy" className="h-full w-full object-cover" style={{ transform: "rotate(-45deg) scale(1.6)" }} />
        </div>

        {/* katana overlay */}
        <img src={katana} alt="" loading="lazy" className="cp-sword pointer-events-none absolute left-1/2 top-1/2 z-20 w-[420px] -translate-x-1/2 -translate-y-1/2" />

        {/* FLOW CONTROL label */}
        <div className="absolute right-8 top-12 font-mono text-[10px] uppercase tracking-[0.2em] text-black/60">
          Career<br />Compass
        </div>
      </div>
    </section>
  );
}
