import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import SlashText from "./SlashText";

export default function KeepScrollingSection() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const st = { trigger: ref.current, start: "top top", end: "bottom top", scrub: true, pin: true };
      gsap.fromTo(".ks-hairline", { scaleX: 0 }, { scaleX: 1, ease: "none", scrollTrigger: st });
    },
    { scope: ref },
  );

  return (
    <section ref={ref} className="relative h-[220vh] w-full bg-transparent">
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* top red hairline */}
        <div className="absolute left-0 right-0 top-0 z-30 h-[2px] origin-left">
          <div className="ks-hairline h-full origin-left bg-[#ff3a2a]" />
        </div>

        {/* 3D katana is rendered by global KatanaCanvas in LandingShell — driven by heroProgressRef */}

        {/* text reveals timed to the unsheathe beats */}
        <div className="relative z-10 flex h-full flex-col items-center justify-center gap-4">
          <SlashText
            text="IMPERIUM"
            className="font-sans text-[clamp(72px,14vw,220px)] font-medium tracking-[-0.04em] text-white/85"
            ghosts={4}
          />
          <SlashText
            text="Unsheathe your career"
            className="font-sans text-[clamp(28px,4vw,56px)] font-medium tracking-[-0.02em] text-white/50"
            start="top -10%"
            end="top -60%"
          />
        </div>
      </div>
    </section>
  );
}
