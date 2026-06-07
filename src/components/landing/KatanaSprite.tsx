import { useEffect, useRef } from "react";
import bladeAsset from "@/assets/landing/katana_blade.png.asset.json";
import sayaAsset from "@/assets/landing/katana_saya.png.asset.json";

interface Props {
  progressRef: React.MutableRefObject<number>;
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t); // smoothstep

/**
 * 2D sprite katana with CSS-perspective 3D feel.
 * - Two layered PNGs (saya behind, blade in front) inside a perspective wrapper.
 * - Scroll progress unsheathes the blade while both pieces roll.
 * - Idle breathing tilt keeps it alive even when not scrolling.
 */
export default function KatanaSprite({ progressRef }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const bladeRef = useRef<HTMLImageElement>(null);
  const sayaRef = useRef<HTMLImageElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const p = clamp(progressRef.current ?? 0);

      // ----- Stage curves -----
      // Camera / wrapper tilt: starts above-the-blade, settles horizontal
      const cam = ease(clamp((p - 0.0) / 0.45));
      const rotX = lerp(-14, 0, cam); // looking down → flat
      const rotY = lerp(14, 0, cam);

      // Unsheathe (0.40 → 0.85)
      const u = ease(clamp((p - 0.4) / 0.45));
      const bladeX = lerp(0, 32, u); // % to the LEFT visually = blade slides out toward left tip
      const sayaX = lerp(0, -14, u);
      const rollZ = lerp(-4, 2, u); // shared roll

      // Idle breathing (independent of scroll)
      const breatheY = Math.sin(t * 0.6) * 1.5;
      const breatheT = Math.sin(t * 0.8) * 4;

      // Glow under the junction fades 0.55 → 0.85
      const glowP = 1 - ease(clamp((p - 0.55) / 0.3));

      // Highlight sheen sweeps with unsheathe
      const sheenX = lerp(-40, 120, u);

      if (wrapRef.current) {
        wrapRef.current.style.transform = `translate3d(0, ${breatheT}px, 0) rotateX(${rotX + breatheY}deg) rotateY(${rotY}deg)`;
      }
      if (bladeRef.current) {
        // blade exits to the LEFT (handle stays in center, blade tip leads)
        bladeRef.current.style.transform = `translate3d(${-bladeX}%, 0, 24px) rotateZ(${rollZ}deg) scale(${lerp(1, 1.04, cam)})`;
      }
      if (sayaRef.current) {
        sayaRef.current.style.transform = `translate3d(${-sayaX}%, 0, 0) rotateZ(${rollZ}deg)`;
      }
      if (glowRef.current) {
        glowRef.current.style.opacity = String(glowP * 0.85);
      }
      if (sheenRef.current) {
        sheenRef.current.style.transform = `translateX(${sheenX}%)`;
        sheenRef.current.style.opacity = String(u * 0.6);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progressRef]);

  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div
        ref={wrapRef}
        className="relative w-[92%] max-w-[1400px]"
        style={{
          perspective: "1400px",
          transformStyle: "preserve-3d",
          willChange: "transform",
          aspectRatio: "21 / 9",
        }}
      >
        {/* ember glow behind junction */}
        <div
          ref={glowRef}
          className="absolute left-1/2 top-1/2 h-[55%] w-[40%] -translate-x-1/2 -translate-y-1/2"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(255,90,40,0.65) 0%, rgba(255,40,20,0.25) 35%, transparent 70%)",
            filter: "blur(28px)",
            opacity: 0,
            willChange: "opacity",
          }}
        />

        {/* SAYA — behind */}
        <img
          ref={sayaRef}
          src={sayaAsset.url}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain"
          style={{
            transformStyle: "preserve-3d",
            willChange: "transform",
            filter: "drop-shadow(0 30px 35px rgba(0,0,0,0.55))",
          }}
        />

        {/* BLADE — front */}
        <img
          ref={bladeRef}
          src={bladeAsset.url}
          alt="Katana"
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain"
          style={{
            transformStyle: "preserve-3d",
            willChange: "transform",
            filter:
              "drop-shadow(0 25px 30px rgba(0,0,0,0.7)) drop-shadow(0 0 18px rgba(180,210,255,0.08))",
          }}
        />

        {/* light sheen swept across the blade */}
        <div
          ref={sheenRef}
          className="absolute left-0 top-[38%] h-[24%] w-[18%]"
          style={{
            background:
              "linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)",
            mixBlendMode: "screen",
            filter: "blur(8px)",
            opacity: 0,
            willChange: "transform, opacity",
          }}
        />
      </div>
    </div>
  );
}
