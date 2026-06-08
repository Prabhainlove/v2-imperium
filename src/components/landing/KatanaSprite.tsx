import { useEffect, useRef } from "react";
import katanaAsset from "@/assets/landing/katana_reference_full.png.asset.json";

interface Props {
  progressRef: React.MutableRefObject<number>;
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);

/**
 * Single-image cinematic katana — matches the reference photo exactly.
 * The katana lies diagonally across the hero, tsuka (handle) on the right,
 * kissaki (tip) on the left, sweeping behind the title and Skill Hub card.
 * Scroll progress drives a gentle drift + sheen sweep; no fake compositing.
 */
export default function KatanaSprite({ progressRef }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const p = clamp(progressRef.current ?? 0);

      // Idle breathing
      const breatheY = Math.sin(t * 0.6) * 4;
      const breatheR = Math.sin(t * 0.5) * 0.15;

      // Scroll drift — katana drifts slightly right and scales as we scroll
      const u = ease(clamp(p));
      const driftX = lerp(0, 60, u);
      const scale = lerp(1, 1.04, u);

      // Sheen across blade
      const sheenX = lerp(-20, 120, (Math.sin(t * 0.4) + 1) / 2);

      if (stageRef.current) {
        stageRef.current.style.transform = `translate3d(${driftX}px, ${breatheY}px, 0) rotate(${breatheR}deg) scale(${scale})`;
      }
      if (sheenRef.current) {
        sheenRef.current.style.transform = `translateX(${sheenX}%)`;
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progressRef]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        ref={stageRef}
        className="absolute"
        style={{
          // Anchor so handle sits to the right (off-screen tsuka end) and
          // tip extends to the left behind the title — like the reference.
          left: "-8%",
          right: "-4%",
          top: "30%",
          height: "55%",
          transformOrigin: "60% 50%",
          willChange: "transform",
        }}
      >
        <img
          ref={imgRef}
          src={katanaAsset.url}
          alt="Katana"
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain"
          style={{
            filter:
              "drop-shadow(0 40px 60px rgba(0,0,0,0.85)) drop-shadow(0 0 30px rgba(0,0,0,0.5))",
          }}
        />

        {/* Subtle sheen sweep across blade region */}
        <div
          ref={sheenRef}
          className="absolute"
          style={{
            left: "10%",
            top: "38%",
            height: "22%",
            width: "20%",
            background:
              "linear-gradient(110deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)",
            mixBlendMode: "screen",
            filter: "blur(14px)",
            opacity: 0.6,
            willChange: "transform",
          }}
        />
      </div>
    </div>
  );
}
