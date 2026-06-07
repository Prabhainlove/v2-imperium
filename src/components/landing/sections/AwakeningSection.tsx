import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import clouds from "@/assets/landing/clouds_band.jpg";
import master from "@/assets/landing/master_portrait.png";

export default function AwakeningSection() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const st = { trigger: ref.current, start: "top bottom", end: "bottom top", scrub: true };
      gsap.fromTo(".aw-band", { scale: 1.08, xPercent: -3 }, { scale: 1.0, xPercent: 3, ease: "none", scrollTrigger: st });
      gsap.fromTo(".aw-master", { y: 60, opacity: 0 }, { y: 0, opacity: 1, ease: "power2.out", scrollTrigger: { trigger: ref.current, start: "top 60%" } });
    },
    { scope: ref },
  );

  return (
    <section ref={ref} className="relative min-h-screen w-full bg-black py-40">
      <div className="relative h-[60vh] w-full overflow-hidden">
        <img src={clouds} loading="lazy" alt="" className="aw-band absolute inset-0 h-full w-full object-cover" />
      </div>
      <div className="relative z-10 mx-auto mt-20 flex max-w-5xl items-end gap-8 px-8">
        <img src={master} loading="lazy" alt="Master" className="aw-master h-32 w-32 rounded-lg ring-1 ring-white/10 md:h-40 md:w-40" style={{ imageRendering: "pixelated" }} />
        <div className="aw-master pb-2">
          <p className="font-sans text-[28px] leading-tight text-white md:text-[40px]">
            🌩️ Ah, you've finally<br />awoken……
          </p>
          <p className="mt-3 font-mono text-[11px] tracking-[0.3em] text-white/50">MASTER OJI</p>
        </div>
      </div>
    </section>
  );
}
