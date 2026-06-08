import { useEffect, useRef } from "react";
import katanaAsset from "@/assets/landing/katana_reference_full.png.asset.json";

interface Props {
  progressRef: React.MutableRefObject<number>;
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
// Cinematic easings
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Cinematic katana sprite — matches reference image exactly.
 * Saya + blade as one composed image, anchored bottom-left, blade sweeping
 * up-right behind the Skill Hub card. Responsive scaling preserves the
 * composition across mobile/tablet/desktop.
 *
 * Scroll choreography (progress 0 → 1):
 *   0.00 – 0.35  DRAW    blade slides out of saya along its own axis
 *   0.35 – 0.55  HOLD    blade fully drawn, ember at junction peaks
 *   0.55 – 1.00  STRIKE  fast diagonal slash + flash, then drift off
 */
export default function KatanaSprite({ progressRef }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const bladeRef = useRef<HTMLImageElement>(null);
  const sayaRef = useRef<HTMLImageElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);
  const emberRef = useRef<HTMLDivElement>(null);
  const bloomRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);

  // Blade lies along a -22° axis (lower-left tsuka → upper-right kissaki visually)
  const ANGLE = -22;
  const RAD = (ANGLE * Math.PI) / 180;

  useEffect(() => {
    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const p = clamp(progressRef.current ?? 0);

      // Phase masks
      const drawP = clamp(p / 0.35);
      const holdP = clamp((p - 0.35) / 0.2);
      const strikeP = clamp((p - 0.55) / 0.45);

      // Eased phases
      const drawE = easeOutCubic(drawP);
      const strikeE = easeOutExpo(strikeP);

      // Idle breathing
      const breatheY = Math.sin(t * 0.55) * 3;
      const breatheR = Math.sin(t * 0.45) * 0.18;

      // Blade slide along its own axis (out of the saya)
      const slidePx = lerp(0, 560, drawE);
      const slideX = Math.cos(RAD) * slidePx;
      const slideY = Math.sin(RAD) * slidePx;

      // Strike: fast diagonal arc + slight rotation kick
      const strikeShift = strikeE * 220;
      const strikeRot = strikeE * 3.5;

      if (stageRef.current) {
        const scale = lerp(1, 1.03, drawE) * lerp(1, 1.06, strikeE);
        stageRef.current.style.transform = `translate3d(${strikeShift}px, ${breatheY - strikeShift * 0.35}px, 0) rotate(${breatheR + strikeRot}deg) scale(${scale})`;
      }

      if (bladeRef.current) {
        bladeRef.current.style.transform = `translate3d(${slideX}px, ${slideY}px, 0)`;
      }
      if (sayaRef.current) {
        // saya barely moves — subtle recoil during strike
        const recoil = strikeE * -18;
        sayaRef.current.style.transform = `translate3d(${recoil * Math.cos(RAD)}px, ${recoil * Math.sin(RAD)}px, 0)`;
      }

      // Sheen sweeps faster during draw, then dashes during strike
      const sheenT = (Math.sin(t * 0.5) + 1) / 2;
      const baseSheen = lerp(-30, 130, sheenT);
      const sheenX = baseSheen + drawE * 40 + strikeE * 80;
      if (sheenRef.current) {
        sheenRef.current.style.transform = `translateX(${sheenX}%)`;
        sheenRef.current.style.opacity = String(0.35 + drawE * 0.5 + strikeE * 0.4);
      }

      // Ember at draw junction — fades in during draw, peaks at hold, dims on strike
      if (emberRef.current) {
        const flicker = 0.85 + Math.sin(t * 9) * 0.08 + Math.sin(t * 23) * 0.05;
        const emberOpacity =
          (drawE * 0.9 + holdP * 0.1) * flicker * (1 - strikeE * 0.7);
        const emberScale = 0.6 + drawE * 0.6 + Math.sin(t * 5) * 0.05;
        emberRef.current.style.opacity = String(clamp(emberOpacity, 0, 1));
        emberRef.current.style.transform = `translate(-50%, -50%) scale(${emberScale})`;
      }

      // Bloom halo around full blade — grows with draw, blooms on strike
      if (bloomRef.current) {
        const bloomO = 0.18 + drawE * 0.25 + strikeE * 0.35;
        bloomRef.current.style.opacity = String(bloomO);
      }

      // Strike flash
      if (flashRef.current) {
        const flashO = strikeP > 0 && strikeP < 0.3 ? (strikeP / 0.3) * 0.75 : Math.max(0, 0.75 - (strikeP - 0.3) * 1.3);
        flashRef.current.style.opacity = String(clamp(flashO, 0, 0.85));
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progressRef]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Strike flash overlay */}
      <div
        ref={flashRef}
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 35% 60%, rgba(255,220,170,0.55), rgba(255,120,60,0.15) 30%, transparent 60%)",
          mixBlendMode: "screen",
          opacity: 0,
          willChange: "opacity",
        }}
      />

      {/* Stage — responsive: scales by viewport, preserves composition */}
      <div
        ref={stageRef}
        className="absolute"
        style={{
          // Anchor: tsuka (handle) bottom-left, blade sweeping up-right behind Skill Hub
          left: "-10%",
          right: "-10%",
          top: "10%",
          bottom: "-10%",
          transformOrigin: "18% 78%",
          willChange: "transform",
        }}
      >
        {/* Bloom halo behind blade */}
        <div
          ref={bloomRef}
          className="absolute"
          style={{
            left: "5%",
            top: "20%",
            width: "85%",
            height: "60%",
            background:
              "radial-gradient(ellipse 60% 30% at 50% 50%, rgba(255,200,140,0.35), rgba(255,140,80,0.12) 40%, transparent 70%)",
            transform: `rotate(${ANGLE}deg)`,
            filter: "blur(28px)",
            mixBlendMode: "screen",
            willChange: "opacity",
          }}
        />

        {/* Single composed reference image — saya + blade together,
            but we re-render blade layer above so it can slide independently. */}
        <img
          ref={sayaRef}
          src={katanaAsset.url}
          alt="Katana saya and blade"
          draggable={false}
          className="absolute inset-0 h-full w-full select-none object-contain"
          style={{
            filter:
              "drop-shadow(0 30px 50px rgba(0,0,0,0.85)) drop-shadow(0 8px 20px rgba(0,0,0,0.6))",
            willChange: "transform",
          }}
        />

        {/* Blade overlay — same image masked to blade region, slides on draw */}
        <div
          className="absolute inset-0 overflow-visible"
          style={{
            WebkitMaskImage:
              "linear-gradient(110deg, transparent 0%, transparent 28%, black 38%, black 100%)",
            maskImage:
              "linear-gradient(110deg, transparent 0%, transparent 28%, black 38%, black 100%)",
          }}
        >
          <img
            ref={bladeRef}
            src={katanaAsset.url}
            alt=""
            aria-hidden
            draggable={false}
            className="absolute inset-0 h-full w-full select-none object-contain"
            style={{
              filter:
                "drop-shadow(0 0 18px rgba(255,180,120,0.35)) drop-shadow(0 20px 30px rgba(0,0,0,0.6))",
              willChange: "transform",
            }}
          />

          {/* Sheen sweep across blade */}
          <div
            ref={sheenRef}
            className="absolute"
            style={{
              left: "20%",
              top: "30%",
              width: "60%",
              height: "40%",
              background:
                "linear-gradient(110deg, transparent 0%, rgba(255,240,210,0.45) 50%, transparent 100%)",
              mixBlendMode: "screen",
              filter: "blur(12px)",
              opacity: 0.5,
              willChange: "transform, opacity",
            }}
          />
        </div>

        {/* Ember glow at draw junction (where blade exits saya) */}
        <div
          ref={emberRef}
          className="absolute"
          style={{
            left: "32%",
            top: "62%",
            width: "180px",
            height: "180px",
            background:
              "radial-gradient(circle, rgba(255,220,150,0.95) 0%, rgba(255,140,60,0.6) 25%, rgba(220,80,30,0.35) 45%, transparent 70%)",
            mixBlendMode: "screen",
            filter: "blur(6px)",
            opacity: 0,
            willChange: "transform, opacity",
            transform: "translate(-50%, -50%)",
          }}
        />

        {/* Inner ember core — tighter, hotter */}
        <div
          className="absolute"
          style={{
            left: "32%",
            top: "62%",
            width: "60px",
            height: "60px",
            background:
              "radial-gradient(circle, rgba(255,255,230,0.9), rgba(255,180,80,0.4) 40%, transparent 70%)",
            mixBlendMode: "screen",
            filter: "blur(3px)",
            transform: "translate(-50%, -50%)",
            opacity: 0.7,
          }}
        />
      </div>
    </div>
  );
}
