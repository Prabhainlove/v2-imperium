import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import { useScrollProgress } from "./useScrollProgress";
import { CameraRig } from "./CameraRig";
import { PostFX } from "./PostFX";
import { World } from "./World";
import { HtmlOverlay } from "./HtmlOverlay";

interface ImperiumExperienceProps {
  cta: string;
  ctaLabel: string;
}

export default function ImperiumExperience({ cta, ctaLabel }: ImperiumExperienceProps) {
  const progressRef = useScrollProgress();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return (
    <div className="fixed inset-0 z-0 bg-black">
      {/* fixed canvas, never unmounts */}
      <Canvas
        dpr={[1, isMobile ? 1.25 : 1.75]}
        gl={{
          antialias: !isMobile,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
        }}
        camera={{ fov: 55, near: 0.1, far: 600, position: [-4, 1.2, 6] }}
        frameloop="always"
      >
        <color attach="background" args={["#000000"]} />
        <Environment preset="night" />
        <World isMobile={isMobile} />
        <CameraRig progressRef={progressRef} />
        <PostFX progressRef={progressRef} isMobile={isMobile} />
      </Canvas>

      {/* scroll spacer (600vh) */}
      <div className="pointer-events-none" style={{ height: "600vh" }} aria-hidden />

      {/* DOM overlay */}
      <HtmlOverlay progressRef={progressRef} cta={cta} ctaLabel={ctaLabel} />
    </div>
  );
}
