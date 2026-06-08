import { ClientOnly } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HeroIntroVideo } from "./HeroIntroVideo";
import { McLarenScene, preloadMclarenModel } from "./McLarenScene";

export function ProfileHeader() {
  const [phase, setPhase] = useState<"video" | "model">("video");

  useEffect(() => {
    preloadMclarenModel();
  }, []);

  return (
    <div className="profile-hero-block">
      <div className="profile-hero-model">
        {phase === "video" && (
          <HeroIntroVideo onFinish={() => setPhase("model")} />
        )}
        {/* Mount the 3D scene during video phase as well so the GLB loads in
            parallel and is fully visible the instant the video ends. */}
        <ClientOnly fallback={null}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: phase === "model" ? 1 : 0,
              pointerEvents: phase === "model" ? "auto" : "none",
              transition: "opacity 200ms ease",
            }}
          >
            <McLarenScene />
          </div>
        </ClientOnly>
      </div>
      <div className="profile-hero-text">
        <p className="profile-hero-eyebrow">
          <span aria-hidden>🏁</span> Imperium · Career Grand Prix
        </p>
        <h1 className="profile-hero-tagline">
          Life is a race. Your career is the <em>championship</em>.
        </h1>
        <p className="profile-hero-sub">
          Navigate like a champion, accelerate through opportunities, and chase glory. <span aria-hidden>🏆✨</span>
        </p>
      </div>
    </div>
  );
}
