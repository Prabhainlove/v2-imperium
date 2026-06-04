import { ClientOnly } from '@tanstack/react-router';
import { Suspense, lazy } from 'react';

const Spline = lazy(() => import('@splinetool/react-spline'));

interface SplineSceneProps {
  scene: string;
  className?: string;
}

function Fallback({ className }: { className?: string }) {
  return (
    <div className={`flex h-full w-full items-center justify-center ${className ?? ''}`}>
      <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">
        Loading scene…
      </span>
    </div>
  );
}

export function SplineScene({ scene, className }: SplineSceneProps) {
  return (
    <ClientOnly fallback={<Fallback className={className} />}>
      <Suspense fallback={<Fallback className={className} />}>
        <Spline scene={scene} className={className} />
      </Suspense>
    </ClientOnly>
  );
}
