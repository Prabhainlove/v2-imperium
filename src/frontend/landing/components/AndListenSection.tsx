import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import SlashText from "../SlashText";
import bonsai from "@frontend/landing/assets/bonsai_tree.png";

export default function AndListenSection() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const st = { trigger: ref.current, start: "top bottom", end: "bottom top", scrub: true };
      gsap.fromTo(".al-square", { y: -40, opacity: 0.4 }, { y: 60, opacity: 1, stagger: 0.1, ease: "none", scrollTrigger: st });
      gsap.fromTo(".al-bonsai", { yPercent: 20, opacity: 0.4 }, { yPercent: -10, opacity: 1, ease: "none", scrollTrigger: st });
    },
    { scope: ref },
  );

  return (
    <section ref={ref} className="relative min-h-screen w-full overflow-hidden bg-[#f1ece6] py-32">
      {/* drifting red squares */}
      <div className="pointer-events-none absolute inset-0">
        {[12, 34, 56, 72, 88].map((x, i) => (
          <div
            key={i}
            className="al-square absolute h-3 w-3 bg-[#ff3a2a]"
            style={{ left: `${x}%`, top: `${15 + (i % 3) * 25}%` }}
          />
        ))}
      </div>

      <img
        src={bonsai}
        loading="lazy"
        alt=""
        className="al-bonsai pointer-events-none absolute bottom-0 right-0 h-[60vh] w-auto opacity-80"
      />

      <div className="relative z-10 mx-auto flex h-screen max-w-6xl flex-col justify-center px-8">
        <SlashText
          text="And listen…"
          className="font-sans text-[clamp(72px,14vw,220px)] font-medium leading-[0.92] tracking-[-0.04em] text-black"
        />
        <p className="mt-10 max-w-md font-mono text-[12px] uppercase leading-relaxed tracking-[0.18em] text-black/60">
          Pause. IMPERIUM listens.<br />Every role finds its candidate.
        </p>
      </div>
    </section>
  );
}
