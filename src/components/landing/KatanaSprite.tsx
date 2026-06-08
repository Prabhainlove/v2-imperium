import { useEffect, useRef } from "react";
import katanaAsset from "@/assets/landing/katana_clean.png.asset.json";

interface Props {
  progressRef: React.MutableRefObject<number>;
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function KatanaSprite({ progressRef }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const p = clamp(progressRef.current ?? 0);

      const breatheY = Math.sin(t * 0.45) * 1.5;
      const driftX = lerp(0, 14, clamp(p));

      if (stageRef.current) {
        stageRef.current.style.transform = `translate3d(${driftX}px, ${breatheY}px, 0)`;
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
          left: "-3%",
          top: "42%",
          width: "min(1120px, 92vw)",
          aspectRatio: "1707 / 281",
          willChange: "transform",
        }}
      >
        <img
          src={katanaAsset.url}
          alt="Katana"
          draggable={false}
          className="absolute inset-0 h-full w-full select-none object-contain"
        />
      </div>
    </div>
  );
}
