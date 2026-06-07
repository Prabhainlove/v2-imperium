import { useEffect, useRef, type MutableRefObject } from "react";
import { Link } from "@tanstack/react-router";
import logo from "@/assets/landing/imperium_logo.png";

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
      {/* TL: logo + wordmark */}
      <div className="pointer-events-auto flex items-center gap-3">
        <img
          src={logo}
          alt="IMPERIUM"
          className="h-10 w-10 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.08)] md:h-12 md:w-12"
        />
        <span className="hidden text-[15px] font-medium tracking-tight text-black md:inline">
          IMPERIUM<sup className="ml-0.5 text-[9px] opacity-60">©</sup>
        </span>
      </div>

      {/* TC: nav pills */}
      <nav className="pointer-events-auto flex items-center gap-2 rounded-full bg-black/[0.04] p-1 backdrop-blur-md ring-1 ring-black/5">
        <button
          aria-label="info"
          className="grid h-9 w-9 place-items-center rounded-full text-[12px] font-serif italic text-black/70 hover:bg-black/[0.06]"
        >
          i
        </button>
        <Link
          to="/_authenticated/dashboard"
          className="rounded-full px-4 py-2 text-[13px] font-medium text-black hover:bg-black/[0.06] md:px-5"
        >
          Dashboard
        </Link>
        <Link
          to={cta as "/auth"}
          className="rounded-full px-4 py-2 text-[13px] font-medium text-black hover:bg-black/[0.06] md:px-5"
        >
          Console
        </Link>
      </nav>

      {/* TR: progress */}
      <div className="pointer-events-auto min-w-[3rem] text-right">
        <span ref={pctRef} className="font-mono text-[12px] tabular-nums text-black/70">
          0%
        </span>
      </div>
    </header>
  );
}
