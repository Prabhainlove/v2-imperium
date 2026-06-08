import { Suspense, lazy } from "react";
import { ClientOnly } from "@tanstack/react-router";

const Spline = lazy(() => import("@splinetool/react-spline"));

interface SplineSceneProps {
  scene: string;
  className?: string;
}

function Fallback() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[color:var(--imp-ember,#ff6b3d)]" />
    </div>
  );
}

export function SplineScene({ scene, className }: SplineSceneProps) {
  return (
    <ClientOnly fallback={<Fallback />}>
      <Suspense fallback={<Fallback />}>
        <Spline scene={scene} className={className} />
      </Suspense>
    </ClientOnly>
  );
}
