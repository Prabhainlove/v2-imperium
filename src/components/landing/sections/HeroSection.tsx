import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import branches from "@/assets/landing/branches_backdrop.png";
import skillBalance from "@/assets/landing/skill_balance.jpg";

interface Props {
  heroProgressRef: React.MutableRefObject<number>;
}

export default function HeroSection({ heroProgressRef }: Props) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!ref.current) return;

      // Drive heroProgressRef from this hero section + the next sibling (KeepScrolling).
      // We measure across hero start → hero+keepScrolling end so progress is 0→1 across both.
      const trigger = ScrollTrigger.create({
        trigger: ref.current,
        start: "top top",
        endTrigger: ref.current.nextElementSibling as Element,
        end: "bottom bottom",
        scrub: true,
        onUpdate: (self) => {
          heroProgressRef.current = self.progress;
        },
      });

      // Local hero scrub: fade title/card out as we leave the hero
      const localSt = { trigger: ref.current, start: "top top", end: "bottom top", scrub: true };
      gsap.to(".hero-branches", { yPercent: -6, scale: 1.05, ease: "none", scrollTrigger: localSt });
      gsap.to(".hero-title", { yPercent: -20, opacity: 0, ease: "none", scrollTrigger: localSt });
      gsap.to(".hero-card", { yPercent: 20, opacity: 0, ease: "none", scrollTrigger: localSt });

      return () => {
        trigger.kill();
      };
    },
    { scope: ref },
  );

  return (
    <section ref={ref} className="relative h-screen w-full overflow-hidden bg-transparent">
      {/* ukiyo-e branches backdrop */}
      <img
        src={branches}
        alt=""
        className="hero-branches pointer-events-none absolute inset-y-0 left-0 h-full w-[70%] object-cover opacity-50"
        style={{ filter: "sepia(0.25) saturate(0.85) brightness(0.75)" }}
      />

      {/* Note: KatanaCanvas is mounted globally in LandingShell as a fixed background */}

      {/* editorial title — tight, top-left, kept inside left 35% column */}
      <div className="hero-title absolute left-10 top-24 z-10 flex items-end gap-4 md:left-14 md:top-32">
        <h1
          className="font-sans font-medium leading-[0.92] tracking-[-0.025em] text-[#f1ece6]"
          style={{ fontSize: "clamp(40px,6.5vw,104px)" }}
        >
          Master<br />Your<br />Skills
        </h1>
        <div className="hidden pb-2 font-sans text-[12px] leading-tight text-[#f1ece6]/75 md:block">
          Built by<br />Fiddle.Digital
        </div>
      </div>

      {/* version tag, top center */}
      <span className="absolute left-1/2 top-28 z-10 hidden -translate-x-1/2 font-mono text-[12px] tracking-[0.3em] text-[#f1ece6]/55 md:inline">
        V_ 1.2.0
      </span>

      {/* Skill Hub card */}
      <div className="hero-card absolute bottom-14 left-10 z-10 hidden md:block md:left-14">
        <p className="mb-3 font-sans text-[14px] text-[#f1ece6]/85">Skill Hub</p>
        <div className="h-[170px] w-[260px] rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/15 backdrop-blur-sm">
          <div className="relative h-full w-full overflow-hidden rounded-xl">
            <img
              src={skillBalance}
              alt="Balance"
              loading="lazy"
              width={512}
              height={512}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 grid place-items-center bg-black/25">
              <span className="font-sans text-[22px] font-medium text-white/95">Balance</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
