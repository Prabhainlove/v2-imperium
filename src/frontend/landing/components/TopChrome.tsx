import { useEffect, useRef, type MutableRefObject } from "react";
import { Link } from "@tanstack/react-router";
import logo from "@frontend/landing/assets/imperium_logo.png";

interface Props {
  progressRef: MutableRefObject<number>;
  cta: string;
}

export default function TopChrome({ progressRef, cta }: Props) {
  const pctRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (pctRef.current) {
        pctRef.current.textContent = `${Math.round(progressRef.current * 100)}%`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progressRef]);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-center justify-between px-4 py-4 md:px-8 md:py-6">
      {/* TL: logo glyph + red katana chip */}
      <div className="pointer-events-auto flex items-center gap-2">
        <img
          src={logo}
          alt="IMPERIUM"
          className="h-10 w-10 rounded-xl md:h-11 md:w-11"
        />
        <span className="hidden text-[13px] font-medium tracking-tight text-white/80 md:inline">
          <sup className="text-[9px] opacity-60">®</sup>
        </span>
        {/* red katana chip */}
        <div className="ml-1 grid h-9 w-12 place-items-center rounded-xl bg-[#ff3a2a] shadow-[0_6px_18px_rgba(255,58,42,0.35)]">
          <span className="font-serif text-[13px] font-bold text-white">ベ</span>
        </div>
      </div>

      {/* TC: nav pills */}
      <nav className="pointer-events-auto flex items-center gap-1 rounded-full bg-white/[0.06] p-1 backdrop-blur-md ring-1 ring-white/10">
        <button
          aria-label="info"
          className="grid h-9 w-9 place-items-center rounded-full text-[12px] font-serif italic text-white/75 hover:bg-white/10"
        >
          i
        </button>
        <Link
          to="/"
          className="rounded-full px-4 py-2 text-[13px] font-medium text-white/85 hover:bg-white/10 md:px-5"
        >
          Home
        </Link>
      </nav>

      {/* TR: progress */}
      <div className="pointer-events-auto min-w-[3rem] text-right">
        <span ref={pctRef} className="font-mono text-[12px] tabular-nums text-white/70">
          0%
        </span>
      </div>
    </header>
  );
}
