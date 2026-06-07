import { useEffect, useRef, type MutableRefObject } from "react";

interface Props {
  scrollYRef: MutableRefObject<number>;
  fpsRef: MutableRefObject<number>;
}

export default function SideTicker({ scrollYRef, fpsRef }: Props) {
  const fpsEl = useRef<HTMLSpanElement>(null);
  const topEl = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (fpsEl.current) fpsEl.current.textContent = String(fpsRef.current).padStart(2, "0");
      if (topEl.current) topEl.current.textContent = String(Math.round(scrollYRef.current));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scrollYRef, fpsRef]);

  return (
    <div className="pointer-events-none fixed left-2 top-1/2 z-40 hidden -translate-y-1/2 md:block">
      <div
        className="font-mono text-[10px] tracking-[0.18em] text-black/55"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        <span className="mr-3">• FPS: <span ref={fpsEl}>60</span></span>
        <span>• TOP: <span ref={topEl}>0</span> PX</span>
      </div>
    </div>
  );
}
