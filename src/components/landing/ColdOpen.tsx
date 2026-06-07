import { useEffect, useState } from "react";
import glyph from "@/assets/landing/loader_glyph.png";

/**
 * 5-second cold-open: black canvas + centered glyph + corner spinner.
 * Slash-wipes away to reveal the hero.
 */
export default function ColdOpen() {
  const [phase, setPhase] = useState<"in" | "slash" | "gone">("in");

  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase("slash"), 4200);
    const t2 = window.setTimeout(() => setPhase("gone"), 5000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[60] bg-black"
      style={{
        clipPath:
          phase === "slash"
            ? "polygon(0 0, 100% 0, 100% 0, 0 0)"
            : "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
        transition: "clip-path 800ms cubic-bezier(0.7, 0, 0.2, 1)",
      }}
    >
      {/* corner crescent spinner */}
      <div className="absolute right-6 top-6 h-6 w-6">
        <div
          className="h-full w-full rounded-full border-2 border-white/20 border-t-white"
          style={{ animation: "spin 0.8s linear infinite" }}
        />
      </div>

      {/* centered brand glyph */}
      <div className="absolute inset-0 grid place-items-center">
        <img
          src={glyph}
          alt="IMPERIUM"
          className="h-28 w-28 opacity-90"
          style={{ animation: "fadeIn 600ms ease-out both" }}
        />
      </div>

      {/* bottom hairline */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-white/10">
        <div
          className="h-full bg-[#ff3a2a]"
          style={{ animation: "loader-bar 4.2s linear forwards" }}
        />
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 0.9; transform: scale(1); } }
        @keyframes loader-bar { from { width: 0%; } to { width: 100%; } }
      `}</style>
    </div>
  );
}
