import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import bamboo from "@/assets/landing/bamboo_stalks.png";
import bonsai from "@/assets/landing/bonsai_tree.png";

export default function BambooSection() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const st = { trigger: ref.current, start: "top bottom", end: "bottom top", scrub: true };
      gsap.fromTo(".bb-bamboo", { yPercent: 30 }, { yPercent: -20, ease: "none", scrollTrigger: st });
      gsap.fromTo(".bb-bonsai", { yPercent: 15, rotate: -2 }, { yPercent: -10, rotate: 2, ease: "none", scrollTrigger: st });
    },
    { scope: ref },
  );

  return (
    <section ref={ref} className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-[#e8e4dd] via-[#dfd9d1] to-[#e8e4dd]">
      {/* sun haze */}
      <div className="absolute left-1/2 top-1/3 h-[60vh] w-[60vh] -translate-x-1/2 rounded-full bg-[#ff7a5a]/25 blur-3xl" />

      <img src={bamboo} loading="lazy" alt="" className="bb-bamboo pointer-events-none absolute bottom-0 left-0 h-[80vh] w-auto md:h-[95vh]" style={{ imageRendering: "pixelated" }} />
      <img src={bonsai} loading="lazy" alt="" className="bb-bonsai pointer-events-none absolute bottom-10 right-0 h-[80vh] w-auto md:h-[95vh]" />

      <div className="relative z-10 flex h-screen items-center justify-end px-12">
        <p className="font-mono text-[12px] uppercase leading-relaxed tracking-[0.15em] text-black/80">
          Animate with elegance,<br />not overhead.
        </p>
      </div>
    </section>
  );
}
