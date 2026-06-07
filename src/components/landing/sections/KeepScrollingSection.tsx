import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import katana from "@/assets/landing/katana_horizontal.png";
import SlashText from "../SlashText";

export default function KeepScrollingSection() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const st = { trigger: ref.current, start: "top top", end: "bottom top", scrub: true, pin: true };
      // Unsheathe: blade and saya start fully overlapped at center, drift apart
      gsap.fromTo(".ks-blade", { xPercent: 0 }, { xPercent: -55, ease: "none", scrollTrigger: st });
      gsap.fromTo(".ks-saya", { xPercent: 0 }, { xPercent: 55, ease: "none", scrollTrigger: st });
      // Top red progress hairline fills as you scroll the sticky stage
      gsap.fromTo(".ks-hairline", { scaleX: 0 }, { scaleX: 1, ease: "none", scrollTrigger: st });
    },
    { scope: ref },
  );

  return (
    <section ref={ref} className="relative h-[220vh] w-full bg-black">
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* top red hairline */}
        <div className="absolute left-0 right-0 top-0 z-30 h-[2px] origin-left">
          <div className="ks-hairline h-full origin-left bg-[#ff3a2a]" />
        </div>

        {/* blade (sharp, light) */}
        <img
          src={katana}
          alt=""
          loading="lazy"
          className="ks-blade pointer-events-none absolute left-1/2 top-[42%] w-[120vw] max-w-none -translate-x-1/2 -translate-y-1/2 select-none"
          style={{ filter: "brightness(1.15) drop-shadow(0 0 30px rgba(255,255,255,0.15))" }}
        />
        {/* saya (sheath, dark red) */}
        <img
          src={katana}
          alt=""
          loading="lazy"
          className="ks-saya pointer-events-none absolute left-1/2 top-[58%] w-[120vw] max-w-none -translate-x-1/2 -translate-y-1/2 select-none"
          style={{ transform: "translate(-50%,-50%) scaleX(-1)", filter: "hue-rotate(330deg) saturate(1.6) brightness(0.55)" }}
        />

        {/* text reveals */}
        <div className="relative z-10 flex h-full flex-col items-center justify-center gap-4">
          <SlashText
            text="Control"
            className="font-sans text-[clamp(72px,14vw,220px)] font-medium tracking-[-0.04em] text-white/85"
            ghosts={4}
          />
          <SlashText
            text="Keep Scrolling"
            className="font-sans text-[clamp(28px,4vw,56px)] font-medium tracking-[-0.02em] text-white/50"
            start="top -10%"
            end="top -60%"
          />
        </div>
      </div>
    </section>
  );
}
