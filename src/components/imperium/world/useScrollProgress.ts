import { useEffect, useRef } from "react";
import Lenis from "lenis";

export function useScrollProgress() {
  const ref = useRef(0);

  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.08,
      smoothWheel: true,
      wheelMultiplier: 1,
    });

    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      ref.current = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };

    lenis.on("scroll", onScroll);
    onScroll();

    let raf = 0;
    const tick = (t: number) => {
      lenis.raf(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return ref;
}
