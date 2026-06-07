import { useEffect, useRef } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function useLenisScroll() {
  const progressRef = useRef(0);
  const scrollYRef = useRef(0);
  const fpsRef = useRef(60);

  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.08,
      smoothWheel: true,
      wheelMultiplier: 1,
    });

    lenis.on("scroll", ScrollTrigger.update);

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrollYRef.current = window.scrollY;
      progressRef.current = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };
    lenis.on("scroll", onScroll);
    onScroll();

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let frames = 0;
    const tick = (t: number) => {
      lenis.raf(t);
      const dt = t - last;
      last = t;
      acc += dt;
      frames++;
      if (acc >= 500) {
        fpsRef.current = Math.round((frames * 1000) / acc);
        acc = 0;
        frames = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    ScrollTrigger.refresh();

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return { progressRef, scrollYRef, fpsRef };
}
