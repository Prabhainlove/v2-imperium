import { Suspense, lazy, useEffect, useState } from 'react';

const Spline = lazy(() => import('@splinetool/react-spline'));

interface SplineSceneProps {
  scene: string;
  className?: string;
}

export function SplineScene({ scene, className }: SplineSceneProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className={`flex h-full w-full items-center justify-center ${className ?? ''}`}>
        <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">
          Loading scene…
        </span>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className={`flex h-full w-full items-center justify-center ${className ?? ''}`}>
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">
            Loading scene…
          </span>
        </div>
      }
    >
      <Spline scene={scene} className={className} />
    </Suspense>
  );
}
