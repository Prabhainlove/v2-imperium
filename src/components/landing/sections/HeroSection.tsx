import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import katana from "@/assets/landing/katana_hero.png";

export default function HeroSection() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.to(".hero-katana", {
        yPercent: -20,
        xPercent: 8,
        scale: 1.05,
        ease: "none",
        scrollTrigger: { trigger: ref.current, start: "top top", end: "bottom top", scrub: true },
      });
      gsap.to(".hero-title", {
        y: -60,
        opacity: 0.5,
        ease: "none",
        scrollTrigger: { trigger: ref.current, start: "top top", end: "bottom top", scrub: true },
      });
    },
    { scope: ref },
  );

  return (
    <section ref={ref} className="relative h-screen w-full overflow-hidden bg-black">
      {/* katana background */}
      <img
        src={katana}
        alt="IMPERIUM katana"
        className="hero-katana pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-95"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/60" />

      {/* title block */}
      <div className="relative z-10 flex h-full items-start px-8 pt-28 md:pt-32">
        <h1 className="hero-title font-sans text-[clamp(56px,11vw,180px)] font-medium leading-[0.92] tracking-[-0.03em] text-[#f1ece6]">
          Master<br />Your<br />Craft
        </h1>
        <span className="ml-6 mt-4 hidden font-mono text-[12px] tracking-[0.3em] text-[#f1ece6]/70 md:inline">
          V_ 1.2.0
        </span>
      </div>

      {/* built by */}
      <div className="absolute bottom-32 left-8 z-10 font-sans text-[28px] leading-none tracking-tight text-[#f1ece6] md:text-[36px]">
        Built by<br /><span className="text-[#f1ece6]/70">IMPERIUM</span>
      </div>

      {/* skill hub placeholder card */}
      <div className="absolute bottom-8 left-8 z-10 hidden h-[220px] w-[360px] rounded-2xl ring-1 ring-white/15 backdrop-blur-sm md:block">
        <div className="px-5 py-4 text-[13px] text-white/70">Console</div>
      </div>
    </section>
  );
}
