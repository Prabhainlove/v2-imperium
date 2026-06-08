import { useEffect, useRef, useState } from "react";

interface Props {
  progressRef: React.MutableRefObject<number>;
}

const MODEL_UID = "5fc7bd2b7349419b8b2a467918ebc790";
const VIEWER_SRC = "https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js";

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

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
    s.onload = () =>
      resolve((window as unknown as { Sketchfab?: unknown }).Sketchfab);
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return viewerPromise;
}

/**
 * Sketchfab "REAL Katana" — director's-cut scroll choreography.
 *
 * Beats (heroProgress 0 → 1):
 *   0.00–0.15  REVEAL  : wide shot, katana floats in, soft halo
 *   0.15–0.45  ORBIT   : slow pan tsuka → kissaki, dolly in
 *   0.45–0.70  TENSION : pull back + tilt, vignette tightens
 *   0.70–0.85  STRIKE  : fast diagonal swipe, white flash, screen shake
 *   0.85–1.00  REST    : settle into hero composition, flash fades
 *
 * Camera frames stay framed so the blade always reads against the dark backdrop;
 * keyframes were picked to keep the katana centered on-screen (never clipped).
 */
export default function KatanaSketchfab({ progressRef }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const vignetteRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<{
    setCameraLookAt: (
      eye: [number, number, number],
      target: [number, number, number],
      duration: number,
    ) => void;
    start: () => void;
    getAnimations?: (cb: (err: unknown, anims: Array<[string, string, ...unknown[]]>) => void) => void;
    setCurrentAnimationByUID?: (uid: string, cb?: (err: unknown) => void) => void;
    seekTo?: (time: number, cb?: (err: unknown) => void) => void;
    pause?: (cb?: (err: unknown) => void) => void;
    play?: (cb?: (err: unknown) => void) => void;
    setCycleMode?: (mode: "one" | "loop" | "none", cb?: (err: unknown) => void) => void;
  } | null>(null);
  const animRef = useRef<{ uid: string; duration: number } | null>(null);
  const rafRef = useRef(0);
  const lastP = useRef(-1);
  const [ready, setReady] = useState(false);

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
          setReady(true);

          // Discover the model's built-in animations and pick the "strike"
          // (or the longest one as a fallback). Sketchfab returns an array
          // of [uid, name, ...meta] tuples where meta[3] is duration (seconds).
          api?.getAnimations?.((err, anims) => {
            if (err || !anims || !anims.length) return;
            const named = anims.map((a) => ({
              uid: a[0] as string,
              name: String(a[1] ?? "").toLowerCase(),
              // duration is commonly at index 3
              duration: Number((a as unknown as unknown[])[3] ?? 0) || 2,
            }));
            const strike =
              named.find((a) => /strike|attack|slash|swing|cut/.test(a.name)) ??
              named.reduce((p, c) => (c.duration > p.duration ? c : p), named[0]);
            animRef.current = { uid: strike.uid, duration: strike.duration };
            api.setCurrentAnimationByUID?.(strike.uid, () => {
              api.setCycleMode?.("none");
              // Pause and hold at frame 0 — scroll will scrub through it.
              api.pause?.();
              api.seekTo?.(0);
            });
          });
        },
        error: () => {
          /* Fallback: static iframe still visible. */
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
        ui_general_controls: 0,
        autostart: 1,
        autospin: 0,
        transparent: 1,
        preload: 1,
        scrollwheel: 0,
        double_click: 0,
      });
    });

    // Beat boundaries and camera frames per beat.
    // [eye xyz, target xyz] kept tight so the katana stays centered & unclipped.
    // Beat frames — STRIKE pulled back so the FULL sword stays in frame and
    // arcs diagonally across the viewport instead of going close-up.
    const beats = [
      { p: 0.00, eye: [1.8, 1.0, 1.8], target: [0.0, 0.05, 0.0] },   // REVEAL wide
      { p: 0.15, eye: [1.6, 0.5, 1.4], target: [0.0, 0.05, 0.0] },   // ease-in
      { p: 0.45, eye: [0.2, 0.25, 1.3], target: [-0.15, 0.0, 0.0] }, // ORBIT end
      { p: 0.65, eye: [-1.4, 0.6, 1.7], target: [0.1, 0.1, 0.0] },   // TENSION wind-up (camera lifts, full sword in view)
      { p: 0.80, eye: [1.6, -0.6, 1.6], target: [-0.2, 0.05, 0.0] }, // STRIKE apex — diagonal swipe across, full blade visible
      { p: 1.00, eye: [1.2, 0.2, 1.6], target: [0.0, 0.0, 0.0] },    // REST — settle, full sword centered
    ] as const;

    const sampleBeats = (t: number) => {
      const x = clamp(t);
      let i = 0;
      for (let k = 0; k < beats.length - 1; k++) {
        if (x >= beats[k].p && x <= beats[k + 1].p) {
          i = k;
          break;
        }
      }
      const a = beats[i];
      const b = beats[i + 1] ?? beats[beats.length - 1];
      const span = b.p - a.p || 1;
      const local = (x - a.p) / span;
      // STRIKE beat (0.65 → 0.80) uses exponential snap for crisp impact.
      const f = a.p === 0.65 ? easeOutExpo(local) : easeInOut(local);
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
        beatIndex: i,
      };
    };

    const tick = () => {
      const p = clamp(progressRef.current ?? 0);

      if (apiRef.current && Math.abs(p - lastP.current) > 0.003) {
        lastP.current = p;
        const { eye, target } = sampleBeats(p);
        // Scroll-locked timing. Strike beat (0.65→0.80) uses very short
        // duration so the camera SNAPS across — that's the visible strike.
        const inStrike = p >= 0.65 && p <= 0.82;
        const duration = inStrike ? 0.12 : 0.35;
        apiRef.current.setCameraLookAt(eye, target, duration);
      }

      // Scrub the model's built-in STRIKE animation by scroll progress.
      // Map 0→1 of heroProgress to 0→duration of the animation timeline.
      if (apiRef.current && animRef.current) {
        const t = clamp(p) * animRef.current.duration;
        apiRef.current.seekTo?.(t);
      }


      // STRIKE flash — kept brief & late so the sword stays visible.
      // Fires AFTER the camera swipe peaks (0.78 → 0.86), so user sees the
      // arc first, then the impact burst.
      if (flashRef.current) {
        let flashOp = 0;
        if (p > 0.78 && p < 0.88) {
          const u = (p - 0.78) / 0.1;
          flashOp = u < 0.25 ? easeOutExpo(u / 0.25) * 0.7 : (1 - (u - 0.25) / 0.75) * 0.7;
        }
        flashRef.current.style.opacity = String(Math.max(0, flashOp));
      }

      // HALO rim glow peaks during TENSION → STRIKE so the blade reads.
      if (haloRef.current) {
        let haloOp = 0.25;
        if (p > 0.45) haloOp = 0.25 + Math.min(1, (p - 0.45) / 0.35) * 0.6;
        if (p > 0.85) haloOp = 0.85 * (1 - Math.min(1, (p - 0.85) / 0.15));
        haloRef.current.style.opacity = String(haloOp);
      }

      // VIGNETTE tightens during tension, releases after strike.
      if (vignetteRef.current) {
        const tighten = clamp((p - 0.3) / 0.35);
        const release = clamp((p - 0.82) / 0.18);
        const v = tighten * (1 - release);
        vignetteRef.current.style.opacity = String(0.3 + v * 0.4);
      }

      // SCREEN SHAKE just after strike apex (0.78 → 0.86).
      if (wrapRef.current) {
        let shakeX = 0;
        let shakeY = 0;
        if (p > 0.78 && p < 0.86) {
          const u = (p - 0.78) / 0.08;
          const amp = (1 - u) * 10;
          shakeX = Math.sin(performance.now() * 0.06) * amp;
          shakeY = Math.cos(performance.now() * 0.05) * amp * 0.6;
        }
        wrapRef.current.style.transform = `translate3d(${shakeX}px, ${shakeY}px, 0)`;
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
    <div ref={wrapRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Rim halo / soft fill behind katana so it never falls into shadow */}
      <div
        ref={haloRef}
        className="absolute inset-0"
        style={{
          opacity: 0.25,
          background:
            "radial-gradient(50% 55% at 50% 55%, rgba(255,220,170,0.35) 0%, rgba(255,150,90,0.18) 35%, rgba(0,0,0,0) 70%)",
          mixBlendMode: "screen",
        }}
      />

      <iframe
        ref={iframeRef}
        title="REAL Katana"
        src={`https://sketchfab.com/models/${MODEL_UID}/embed?autostart=1&transparent=1&ui_infos=0&ui_controls=0&ui_stop=0&ui_watermark=0&ui_inspector=0&ui_settings=0&ui_vr=0&ui_fullscreen=0&ui_annotations=0&ui_help=0&ui_hint=0&ui_general_controls=0&dnt=1&scrollwheel=0&double_click=0`}
        allow="autoplay; fullscreen; xr-spatial-tracking"
        allowFullScreen
        className="absolute border-0"
        style={{
          background: "transparent",
          left: "-15%",
          top: "-10%",
          width: "130%",
          height: "120%",
          opacity: ready ? 1 : 0.85,
          transition: "opacity 600ms ease-out",
        }}
      />

      {/* Vignette: tightens during tension build-up, opens after strike */}
      <div
        ref={vignetteRef}
        className="absolute inset-0"
        style={{
          opacity: 0.3,
          background:
            "radial-gradient(75% 75% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.85) 100%)",
        }}
      />

      {/* STRIKE flash */}
      <div
        ref={flashRef}
        className="absolute inset-0"
        style={{
          opacity: 0,
          background:
            "radial-gradient(60% 60% at 50% 50%, rgba(255,255,255,1) 0%, rgba(255,240,210,0.8) 40%, rgba(0,0,0,0) 80%)",
          mixBlendMode: "screen",
        }}
      />
    </div>
  );
}
