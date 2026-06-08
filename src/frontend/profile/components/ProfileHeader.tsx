import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { HeroIntroVideo } from "./HeroIntroVideo";
import { preloadMclarenModel } from "./McLarenScene";

const McLarenScene = lazy(() => import("./McLarenScene"));

export function ProfileHeader() {
  const [phase, setPhase] = useState<"video" | "model">("video");

  useEffect(() => {
    preloadMclarenModel();
  }, []);

  return (
    <div className="profile-hero-block">
      <div className="profile-hero-model">
        {phase === "video" ? (
          <HeroIntroVideo onFinish={() => setPhase("model")} />
        ) : (
          <ClientOnly fallback={null}>
            <Suspense fallback={null}>
              <McLarenScene />
            </Suspense>
          </ClientOnly>
        )}
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
