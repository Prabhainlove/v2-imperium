import { useEffect, useRef } from "react";

interface Props {
  progressRef: React.MutableRefObject<number>;
}

const MODEL_UID = "5fc7bd2b7349419b8b2a467918ebc790";
const VIEWER_SRC = "https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js";

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// Load the Sketchfab Viewer API script once.
let viewerPromise: Promise<unknown> | null = null;
function loadSketchfabViewer(): Promise<unknown> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const w = window as unknown as { Sketchfab?: unknown };
  if (w.Sketchfab) return Promise.resolve(w.Sketchfab);
  if (viewerPromise) return viewerPromise;
  viewerPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = VIEWER_SRC;
    s.async = true;
    s.onload = () => resolve((window as unknown as { Sketchfab?: unknown }).Sketchfab);
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return viewerPromise;
}

/**
 * Sketchfab "REAL Katana" embed driven by page scroll.
 *
 * Axis convention (Sketchfab default, right-handed, Y-up world):
 *   +X right, +Y up, +Z toward viewer.
 *   Camera positions are [x, y, z] in world units; target is the look-at point.
 *
 * Scroll choreography (heroProgress 0 → 1):
 *   0.00  resting wide shot, camera high-right, looking at hilt
 *   0.50  orbits down and dollies in along the blade
 *   1.00  low diagonal hero close-up of the kissaki
 */
export default function KatanaSketchfab({ progressRef }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const apiRef = useRef<{
    setCameraLookAt: (
      eye: [number, number, number],
      target: [number, number, number],
      duration: number,
    ) => void;
    start: () => void;
  } | null>(null);
  const rafRef = useRef(0);
  const lastP = useRef(-1);

  useEffect(() => {
    let cancelled = false;

    loadSketchfabViewer().then((Sketchfab) => {
      if (cancelled || !Sketchfab || !iframeRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = new (Sketchfab as any)(iframeRef.current);
      client.init(MODEL_UID, {
        success: (api: typeof apiRef.current) => {
          api?.start();
          apiRef.current = api;
        },
        error: () => {
          /* Fallback: static iframe stays visible, user can orbit manually. */
        },
        ui_infos: 0,
        ui_controls: 0,
        ui_stop: 0,
        ui_watermark: 0,
        ui_inspector: 0,
        ui_settings: 0,
        ui_vr: 0,
        ui_fullscreen: 0,
        ui_annotations: 0,
        ui_help: 0,
        ui_hint: 0,
        autostart: 1,
        autospin: 0,
        transparent: 1,
        preload: 1,
      });
    });

    // Cinematic camera keyframes — eye + target in Sketchfab world units (Y-up).
    // 0 reveal → 0.25 wide orbit → 0.5 dolly along blade → 0.75 tsuba hero → 1 kissaki strike.
    const keys: Array<{ eye: [number, number, number]; target: [number, number, number] }> = [
      { eye: [1.4, 0.9, 1.5], target: [0.0, 0.05, 0.0] },
      { eye: [1.6, 0.3, 0.9], target: [0.1, 0.0, 0.0] },
      { eye: [0.2, 0.15, 1.1], target: [-0.2, 0.0, 0.0] },
      { eye: [-0.9, 0.2, 0.7], target: [-0.3, 0.0, 0.05] },
      { eye: [-1.2, -0.1, 0.5], target: [-0.5, -0.05, 0.1] },
    ];

    const sampleKeys = (t: number) => {
      const n = keys.length - 1;
      const x = clamp(t) * n;
      const i = Math.min(n - 1, Math.floor(x));
      const f = easeInOut(x - i);
      const a = keys[i];
      const b = keys[i + 1];
      return {
        eye: [
          lerp(a.eye[0], b.eye[0], f),
          lerp(a.eye[1], b.eye[1], f),
          lerp(a.eye[2], b.eye[2], f),
        ] as [number, number, number],
        target: [
          lerp(a.target[0], b.target[0], f),
          lerp(a.target[1], b.target[1], f),
          lerp(a.target[2], b.target[2], f),
        ] as [number, number, number],
      };
    };

    const tick = () => {
      const p = clamp(progressRef.current ?? 0);
      if (apiRef.current && Math.abs(p - lastP.current) > 0.005) {
        lastP.current = p;
        const { eye, target } = sampleKeys(p);
        const duration = p > 0.55 ? 0.4 : 0.8; // snappier near the strike
        apiRef.current.setCameraLookAt(eye, target, duration);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);


    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [progressRef]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <iframe
        ref={iframeRef}
        title="REAL Katana"
        src={`https://sketchfab.com/models/${MODEL_UID}/embed?autostart=1&transparent=1&ui_infos=0&ui_controls=0&ui_stop=0&ui_watermark=0&ui_inspector=0&ui_settings=0&ui_vr=0&ui_fullscreen=0&ui_annotations=0&ui_help=0&ui_hint=0&dnt=1`}
        allow="autoplay; fullscreen; xr-spatial-tracking"
        allowFullScreen
        className="absolute border-0"
        style={{
          background: "transparent",
          left: "-15%",
          top: "-10%",
          width: "130%",
          height: "120%",
        }}
      />
    </div>
  );
}
