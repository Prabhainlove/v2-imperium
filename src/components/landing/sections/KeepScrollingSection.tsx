import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import katana from "@/assets/landing/katana_horizontal.png";

export default function KeepScrollingSection() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const st = { trigger: ref.current, start: "top top", end: "bottom top", scrub: true, pin: true };
      gsap.fromTo(".ks-blade", { xPercent: -120, yPercent: -30 }, { xPercent: 0, yPercent: -30, ease: "none", scrollTrigger: st });
      gsap.fromTo(".ks-saya", { xPercent: 120, yPercent: 30 }, { xPercent: 0, yPercent: 30, ease: "none", scrollTrigger: st });
      gsap.fromTo(
        ".ks-text",
        { filter: "blur(28px)", opacity: 0.2 },
        { filter: "blur(0px)", opacity: 1, ease: "none", scrollTrigger: { trigger: ref.current, start: "top top", end: "bottom top", scrub: true } },
      );
    },
    { scope: ref },
  );

  return (
    <section ref={ref} className="relative h-[200vh] w-full bg-black">
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <img src={katana} alt="" loading="lazy" className="ks-blade pointer-events-none absolute left-1/2 top-1/2 w-[140vw] max-w-none -translate-x-1/2 -translate-y-1/2 select-none" style={{ filter: "brightness(1.1)" }} />
        <img src={katana} alt="" loading="lazy" className="ks-saya pointer-events-none absolute left-1/2 top-1/2 w-[140vw] max-w-none -translate-x-1/2 -translate-y-1/2 select-none opacity-80" style={{ transform: "scaleX(-1)", filter: "hue-rotate(330deg) saturate(1.4) brightness(0.7)" }} />
        <div className="ks-text relative z-10 flex h-full items-center justify-center">
          <h2 className="font-sans text-[clamp(72px,14vw,220px)] font-medium tracking-[-0.04em] text-white/30">
            Keep Scrolling
          </h2>
        </div>
      </div>
    </section>
  );
}
