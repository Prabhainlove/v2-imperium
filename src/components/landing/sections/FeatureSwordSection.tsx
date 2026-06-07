import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import katana from "@/assets/landing/katana_horizontal.png";
import clouds from "@/assets/landing/cloud_band_wide.jpg";

const features = [
  { tag: "→", title: "Wide Range\nof Modules", body: "From calm passive search to sharp aggressive outreach.", icon: "◐◑" },
  { tag: "→", title: "Effortless\nInitialization", body: "Import your profile, set the tune — done.", icon: "⊕" },
  { tag: "→", title: "Performance\nOriented", body: "Engineered for speed. 60FPS pipeline end-to-end.", icon: "▦" },
  { tag: "→", title: "Built for\nDevelopers", body: "Compose, override, extend your agent like code.", icon: "◇" },
];

export default function FeatureSwordSection() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.fromTo(
        ".fs-sword",
        { xPercent: -130, rotate: -2 },
        {
          xPercent: 30,
          rotate: 2,
          ease: "none",
          scrollTrigger: { trigger: ref.current, start: "top bottom", end: "bottom top", scrub: true },
        },
      );
      gsap.fromTo(
        ".fs-card",
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.15,
          duration: 0.8,
          ease: "power2.out",
          scrollTrigger: { trigger: ref.current, start: "top 70%" },
        },
      );
    },
    { scope: ref },
  );

  return (
    <section ref={ref} className="relative min-h-screen w-full overflow-hidden bg-[#f1ece6] py-32">
      {/* wide cloud panorama backdrop */}
      <img src={clouds} alt="" loading="lazy" className="pointer-events-none absolute inset-x-0 top-1/4 h-[55vh] w-full object-cover opacity-90" />
      <img src={katana} alt="" loading="lazy" className="fs-sword pointer-events-none absolute left-0 top-1/3 z-10 w-[120vw] max-w-none" />

      <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 gap-10 px-8 pt-20 md:grid-cols-2 md:gap-16">
        {features.map((f, i) => (
          <div key={i} className="fs-card max-w-md">
            <div className="mb-2 flex items-center gap-3 font-mono text-[11px] text-black/50">
              <span>{f.icon}</span>
              <span>{f.tag}</span>
            </div>
            <h3 className="whitespace-pre-line font-sans text-[36px] font-medium leading-[1.05] tracking-[-0.02em] text-black md:text-[44px]">
              {f.title}
            </h3>
            <p className="mt-4 max-w-xs text-[15px] leading-snug text-black/65">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
