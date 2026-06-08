import { useEffect, useRef } from "react";
import bladeAsset from "@/assets/landing/katana_blade.png.asset.json";
import sayaAsset from "@/assets/landing/katana_saya.png.asset.json";

interface Props {
  progressRef: React.MutableRefObject<number>;
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);

/**
 * Cinematic katana composition.
 * - Saya behind (anchored bottom-left, behind Skill Hub card)
 * - Blade in front, diagonal across the hero from lower-left to upper-right
 * - Scroll progress drives unsheathe (blade slides toward upper-right along its own axis)
 * - Idle breathing keeps it alive
 */
export default function KatanaSprite({ progressRef }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const bladeRef = useRef<HTMLImageElement>(null);
  const sayaRef = useRef<HTMLImageElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);

  // Diagonal angle of the composition (degrees). Blade lies along this axis.
  const ANGLE = -22;

  useEffect(() => {
    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const p = clamp(progressRef.current ?? 0);

      // Camera breathing
      const breatheY = Math.sin(t * 0.6) * 0.8;
      const breatheT = Math.sin(t * 0.8) * 3;

      // Unsheathe progress (0.15 → 0.85)
      const u = ease(clamp((p - 0.15) / 0.7));

      // Blade slides ALONG its own axis (toward the tip = upper-right).
      // We translate in unrotated space — the parent applies the rotation.
      const slidePx = lerp(0, 520, u); // px along blade axis

      // Saya recoils slightly the opposite direction
      const sayaSlide = lerp(0, -60, u);

      // Junction glow fades as blade leaves the saya
      const glowP = (1 - ease(clamp((p - 0.5) / 0.35))) * 0.7;

      // Sheen sweep on blade
      const sheenX = lerp(-30, 130, u);

      if (stageRef.current) {
        stageRef.current.style.transform = `translate3d(0, ${breatheT}px, 0) rotate(${ANGLE + breatheY * 0.2}deg)`;
      }
      if (bladeRef.current) {
        bladeRef.current.style.transform = `translate3d(${slidePx}px, 0, 0)`;
      }
      if (sayaRef.current) {
        sayaRef.current.style.transform = `translate3d(${sayaSlide}px, 0, 0)`;
      }
      if (glowRef.current) {
        glowRef.current.style.opacity = String(glowP);
      }
      if (sheenRef.current) {
        sheenRef.current.style.transform = `translateX(${sheenX}%)`;
        sheenRef.current.style.opacity = String(u * 0.55);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progressRef]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Stage is anchored so saya bottom sits behind the Skill Hub card (bottom-left of hero).
          Width is intentionally wider than viewport so blade tip can extend off the top-right. */}
      <div
        ref={stageRef}
        className="absolute"
        style={{
          // anchor near bottom-left, slightly off-screen so saya end is behind Skill Hub card
          left: "-6%",
          bottom: "8%",
          width: "150vw",
          maxWidth: "2200px",
          height: "44vh",
          minHeight: "360px",
          transformOrigin: "12% 70%",
          willChange: "transform",
        }}
      >
        {/* SAYA — behind, fills full stage so it reads as the sheath body */}
        <img
          ref={sayaRef}
          src={sayaAsset.url}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain object-left"
          style={{
            willChange: "transform",
            filter: "drop-shadow(0 35px 45px rgba(0,0,0,0.75)) contrast(1.05) saturate(1.05)",
          }}
        />

        {/* Ember glow at the junction where blade exits saya */}
        <div
          ref={glowRef}
          className="absolute"
          style={{
            left: "38%",
            top: "42%",
            width: "22%",
            height: "32%",
            background:
              "radial-gradient(ellipse at center, rgba(255,110,55,0.85) 0%, rgba(255,50,30,0.35) 40%, transparent 75%)",
            filter: "blur(30px)",
            opacity: 0,
            willChange: "opacity",
            mixBlendMode: "screen",
          }}
        />

        {/* BLADE — front, same stage so it shares the rotation */}
        <img
          ref={bladeRef}
          src={bladeAsset.url}
          alt="Katana"
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain object-left"
          style={{
            willChange: "transform",
            filter:
              "drop-shadow(0 28px 35px rgba(0,0,0,0.8)) drop-shadow(0 0 22px rgba(190,215,255,0.1))",
          }}
        />

        {/* Sheen sweeping across the blade */}
        <div
          ref={sheenRef}
          className="absolute"
          style={{
            left: 0,
            top: "44%",
            height: "16%",
            width: "14%",
            background:
              "linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)",
            mixBlendMode: "screen",
            filter: "blur(10px)",
            opacity: 0,
            willChange: "transform, opacity",
          }}
        />
      </div>
    </div>
  );
}
