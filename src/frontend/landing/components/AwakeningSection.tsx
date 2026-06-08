import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import katana from "@/assets/landing/katana_horizontal.png";
import master from "@/assets/landing/master_portrait.png";
import SlashText from "../SlashText";

/**
 * Short transitional interstitial between unsheathing and cloud narrative.
 * Naked blade above, empty saya below, slash-blur title between, master
 * dialogue lower-right.
 */
export default function AwakeningSection() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const st = { trigger: ref.current, start: "top bottom", end: "bottom top", scrub: true };
      gsap.fromTo(".aw-blade", { xPercent: 30, opacity: 0.4 }, { xPercent: -10, opacity: 1, ease: "none", scrollTrigger: st });
      gsap.fromTo(".aw-saya", { xPercent: -30, opacity: 0.4 }, { xPercent: 10, opacity: 0.85, ease: "none", scrollTrigger: st });
      gsap.fromTo(".aw-master", { y: 60, opacity: 0 }, { y: 0, opacity: 1, ease: "power2.out", scrollTrigger: { trigger: ref.current, start: "top 60%" } });
    },
    { scope: ref },
  );

  return (
    <section ref={ref} className="relative min-h-[80vh] w-full overflow-hidden bg-black py-24">
      {/* naked blade, top third */}
      <img
        src={katana}
        loading="lazy"
        alt=""
        className="aw-blade pointer-events-none absolute left-1/2 top-[18%] w-[110vw] max-w-none -translate-x-1/2 select-none"
        style={{ filter: "brightness(1.2)" }}
      />
      {/* empty saya, bottom third */}
      <img
        src={katana}
        loading="lazy"
        alt=""
        className="aw-saya pointer-events-none absolute left-1/2 bottom-[12%] w-[110vw] max-w-none -translate-x-1/2 select-none"
        style={{ transform: "translateX(-50%) scaleX(-1)", filter: "hue-rotate(330deg) saturate(1.4) brightness(0.5)" }}
      />

      {/* slash-blur title centered */}
      <div className="relative z-10 flex h-[60vh] items-center justify-center">
        <SlashText
          text="IMPERIUM Awakens"
          className="font-sans text-[clamp(40px,7vw,110px)] font-medium tracking-[-0.03em] text-white/80"
          ghosts={3}
        />
      </div>

      {/* master dialogue lower-right */}
      <div className="relative z-10 mx-auto flex max-w-6xl items-end justify-end gap-4 px-8">
        <img
          src={master}
          loading="lazy"
          alt="Master Oji"
          className="aw-master h-24 w-24 rounded-lg ring-1 ring-white/10"
          style={{ imageRendering: "pixelated" }}
        />
        <div className="aw-master pb-2">
          <p className="font-sans text-[20px] leading-tight text-white md:text-[26px]">
            🌩️ Your agent is ready……
          </p>
          <p className="mt-2 font-mono text-[10px] tracking-[0.3em] text-white/50">IMPERIUM AGENT</p>
        </div>
      </div>
    </section>
  );
}
