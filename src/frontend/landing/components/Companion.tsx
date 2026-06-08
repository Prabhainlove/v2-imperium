import { useEffect, useRef, useState, type MutableRefObject } from "react";
import sprite from "@frontend/landing/assets/companion_sprite.png";

const LINES: { p: number; text: string }[] = [
  { p: 0.0, text: "Hey there, wanderer 🎮 Welcome to the realm of IMPERIUM — where precision meets mastery." },
  { p: 0.1, text: "Welcome! 👋 I am Oji, watcher of the path. The blade ⚔️ awaits." },
  { p: 0.2, text: "🌩️ Ah, you've finally awoken… your journey begins." },
  { p: 0.35, text: "Animate with elegance — not overhead. Bend the system to your will." },
  { p: 0.5, text: "To master the craft is to master the self." },
  { p: 0.62, text: "Wide range of effects. Effortless initialization. Built for speed." },
  { p: 0.75, text: "Compose, break it apart, extend it. Your tools, your way." },
  { p: 0.88, text: "Native scroll. Native power. The path is clear." },
  { p: 0.97, text: "Ready? Step through the gate." },
];

interface Props {
  progressRef: MutableRefObject<number>;
}

export default function Companion({ progressRef }: Props) {
  const [idx, setIdx] = useState(0);
  const [manualIdx, setManualIdx] = useState<number | null>(null);
  const lastP = useRef(0);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const p = progressRef.current;
      if (Math.abs(p - lastP.current) > 0.005) {
        lastP.current = p;
        let i = 0;
        for (let k = 0; k < LINES.length; k++) if (p >= LINES[k].p) i = k;
        if (manualIdx === null) setIdx(i);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progressRef, manualIdx]);

  const showSkip = idx >= 2 && idx <= 4;
  const current = manualIdx !== null ? manualIdx : idx;
  const line = LINES[current]?.text ?? "";

  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-40 flex items-end gap-2 md:bottom-6 md:right-6">
      <div className="pointer-events-auto max-w-[280px] rounded-2xl bg-black/85 px-4 py-3 text-white backdrop-blur-md ring-1 ring-white/10 md:max-w-[340px]">
        <p className="text-[13px] leading-snug text-white/90">{line}</p>
        <div className="mt-2 flex justify-end">
          <button
            onClick={() => {
              const next = Math.min(LINES.length - 1, current + 1);
              setManualIdx(next === LINES.length - 1 ? null : next);
              if (next !== current) setIdx(next);
            }}
            className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium text-white hover:bg-white/20"
          >
            {showSkip ? "Skip" : "Next"}
          </button>
        </div>
      </div>
      <img src={sprite} alt="companion" className="h-14 w-14 drop-shadow-md md:h-16 md:w-16" style={{ imageRendering: "pixelated" }} />
    </div>
  );
}
