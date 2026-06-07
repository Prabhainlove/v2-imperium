import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import katanaHero from "@/assets/landing/katana_hero.png";
import branches from "@/assets/landing/branches_backdrop.png";
import SlashText from "../SlashText";

export default function HeroSection() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const st = { trigger: ref.current, start: "top top", end: "bottom top", scrub: true };
      gsap.to(".hero-katana", { yPercent: -18, xPercent: 6, rotate: 2, ease: "none", scrollTrigger: st });
      gsap.to(".hero-branches", { yPercent: -10, scale: 1.08, ease: "none", scrollTrigger: st });
      gsap.to(".hero-flame", { scale: 1.25, opacity: 0.55, ease: "none", scrollTrigger: st });
      gsap.fromTo(
        ".hero-flame",
        { opacity: 0.7 },
        { opacity: 1, duration: 1.6, ease: "sine.inOut", yoyo: true, repeat: -1 },
      );
    },
    { scope: ref },
  );

  return (
    <section ref={ref} className="relative h-screen w-full overflow-hidden bg-black">
      {/* ukiyo-e branches backdrop */}
      <img
        src={branches}
        alt=""
        className="hero-branches pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25"
      />

      {/* red flame core behind blade */}
      <div
        className="hero-flame pointer-events-none absolute left-1/2 top-1/2 h-[60vh] w-[60vh] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,58,42,0.55) 0%, rgba(255,58,42,0.15) 40%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* sheathed katana, diagonal */}
      <img
        src={katanaHero}
        alt="IMPERIUM katana"
        className="hero-katana pointer-events-none absolute left-1/2 top-1/2 h-[110vh] w-auto max-w-none -translate-x-1/2 -translate-y-1/2"
        style={{ transform: "translate(-50%, -50%) rotate(-22deg)" }}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />

      {/* editorial display title */}
      <div className="relative z-10 flex h-full items-start px-8 pt-28 md:pt-32">
        <SlashText
          text="Master"
          start="top top"
          end="top -20%"
          className="font-sans text-[clamp(56px,11vw,180px)] font-medium leading-[0.92] tracking-[-0.03em] text-[#f1ece6]"
        />
      </div>
      <div className="absolute left-8 top-[32%] z-10">
        <h1 className="font-sans text-[clamp(56px,11vw,180px)] font-medium leading-[0.92] tracking-[-0.03em] text-[#f1ece6]">
          Your<br />Skills
        </h1>
      </div>

      <span className="absolute right-8 top-28 z-10 hidden font-mono text-[12px] tracking-[0.3em] text-[#f1ece6]/60 md:inline">
        V_ 1.2.0
      </span>

      {/* built by */}
      <div className="absolute bottom-28 left-8 z-10 font-sans text-[24px] leading-none tracking-tight text-[#f1ece6] md:text-[32px]">
        Built by<br /><span className="text-[#f1ece6]/60">IMPERIUM</span>
      </div>

      {/* skill hub / console card */}
      <div className="absolute bottom-8 right-8 z-10 hidden h-[180px] w-[320px] rounded-2xl bg-white/5 ring-1 ring-white/15 backdrop-blur-md md:block">
        <div className="flex items-center justify-between px-5 py-3 text-[11px] uppercase tracking-[0.2em] text-white/55">
          <span>Skill Hub</span>
          <span>● live</span>
        </div>
        <div className="px-5 pb-5 pt-2 text-[13px] leading-snug text-white/75">
          Console ready. Import a resume to begin tuning your agent.
        </div>
      </div>
    </section>
  );
}
