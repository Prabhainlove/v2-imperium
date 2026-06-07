import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { ROOM_X } from "../CameraRig";
import { fogVert, fogFrag } from "../shaders/fog";
import { Character } from "../Character";

export function RoomIntro() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  useFrame((s) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = s.clock.elapsedTime;
  });

  return (
    <group position={[ROOM_X[0], 0, 0]}>
      {/* black void cube */}
      <mesh>
        <boxGeometry args={[40, 30, 40]} />
        <meshBasicMaterial color="#000000" side={THREE.BackSide} />
      </mesh>

      {/* fog plane in front of camera */}
      <mesh position={[6, 1.5, -6]} rotation={[0, -0.4, 0]}>
        <planeGeometry args={[18, 12]} />
        <shaderMaterial
          ref={matRef}
          transparent
          depthWrite={false}
          uniforms={{
            uTime: { value: 0 },
            uColor: { value: new THREE.Color("#1a1410") },
            uIntensity: { value: 0.55 },
          }}
          vertexShader={fogVert}
          fragmentShader={fogFrag}
        />
      </mesh>

      {/* wordmark */}
      <Html
        position={[8, 1.8, -2]}
        transform
        distanceFactor={6}
        style={{ pointerEvents: "none", whiteSpace: "nowrap" }}
      >
        <div className="imp-mono text-center" style={{ color: "#f5e9d4" }}>
          <div style={{ fontSize: 64, letterSpacing: "0.18em", textShadow: "0 0 28px rgba(255,170,90,0.4)" }}>
            IMPERIUM
          </div>
          <div style={{ fontSize: 12, letterSpacing: "0.4em", opacity: 0.55, marginTop: 8 }}>
            AN AI JOB AGENT
          </div>
        </div>
      </Html>

      <Character position={[10, 0, -3]} scale={0.9} pose="stand" color="#0a0a10" />
      <ambientLight intensity={0.05} />
    </group>
  );
}
