import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import katanaHero from "@/assets/landing/katana_hero.png";
import branches from "@/assets/landing/branches_backdrop.png";

export default function HeroSection() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const st = { trigger: ref.current, start: "top top", end: "bottom top", scrub: true };
      gsap.to(".hero-katana", { yPercent: -12, xPercent: 4, rotate: 1, ease: "none", scrollTrigger: st });
      gsap.to(".hero-branches", { yPercent: -6, scale: 1.05, ease: "none", scrollTrigger: st });
      gsap.fromTo(
        ".hero-flame",
        { opacity: 0.55 },
        { opacity: 0.9, duration: 1.8, ease: "sine.inOut", yoyo: true, repeat: -1 },
      );
    },
    { scope: ref },
  );

  return (
    <section ref={ref} className="relative h-screen w-full overflow-hidden bg-black">
      {/* ukiyo-e branches backdrop — muted, circular mandala */}
      <img
        src={branches}
        alt=""
        className="hero-branches pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70"
      />

      {/* tight red flame glow — only behind saya cutaway, not full screen */}
      <div
        className="hero-flame pointer-events-none absolute left-[42%] top-[58%] h-[32vh] w-[32vh] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,40,28,0.45) 0%, rgba(255,40,28,0.12) 45%, transparent 72%)",
          filter: "blur(28px)",
        }}
      />

      {/* sheathed katana — diagonal, blade lower-left, handle upper-right */}
      <img
        src={katanaHero}
        alt="Sheathed katana"
        className="hero-katana pointer-events-none absolute left-1/2 top-1/2 w-[125vw] max-w-none select-none"
        style={{ transform: "translate(-50%, -50%) rotate(-18deg)" }}
      />

      {/* editorial title — single block, left aligned */}
      <div className="absolute left-8 top-28 z-10 flex items-end gap-6 md:left-12 md:top-32">
        <h1 className="font-sans text-[clamp(56px,11vw,180px)] font-medium leading-[0.88] tracking-[-0.03em] text-[#f1ece6]">
          Master<br />Your<br />Skills
        </h1>
        <div className="hidden pb-4 font-sans text-[16px] leading-tight text-[#f1ece6]/75 md:block md:text-[18px]">
          Built by<br />Fiddle.Digital
        </div>
      </div>

      {/* version tag, top center-right */}
      <span className="absolute left-1/2 top-28 z-10 hidden -translate-x-1/2 font-mono text-[12px] tracking-[0.3em] text-[#f1ece6]/55 md:inline">
        V_ 1.2.0
      </span>

      {/* Skill Hub card — bottom LEFT, empty rounded console */}
      <div className="absolute bottom-10 left-8 z-10 hidden md:block md:left-12">
        <p className="mb-3 font-sans text-[14px] text-[#f1ece6]/85">Skill Hub</p>
        <div className="h-[220px] w-[360px] rounded-2xl bg-white/[0.03] ring-1 ring-white/15 backdrop-blur-sm" />
      </div>
    </section>
  );
}
