import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ROOM_X } from "../CameraRig";
import { fogVert, fogFrag } from "../shaders/fog";
import { Character } from "../Character";

export function RoomOutro() {
  const fogRef = useRef<THREE.ShaderMaterial>(null);
  useFrame((s) => {
    if (fogRef.current) fogRef.current.uniforms.uTime.value = s.clock.elapsedTime;
  });

  return (
    <group position={[ROOM_X[5], 0, 0]}>
      {/* warm amber dome */}
      <mesh>
        <sphereGeometry args={[60, 32, 32]} />
        <meshBasicMaterial color="#1d0d05" side={THREE.BackSide} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#0a0500" roughness={0.6} metalness={0.4} />
      </mesh>

      {/* heavy amber fog */}
      <mesh position={[0, 3, -4]}>
        <planeGeometry args={[30, 16]} />
        <shaderMaterial
          ref={fogRef}
          transparent
          depthWrite={false}
          uniforms={{
            uTime: { value: 0 },
            uColor: { value: new THREE.Color("#ffb070") },
            uIntensity: { value: 0.75 },
          }}
          vertexShader={fogVert}
          fragmentShader={fogFrag}
        />
      </mesh>

      <Character position={[0, 0, -1]} scale={1.1} pose="reach" color="#1a0a04" iridescence={0.6} />

      <directionalLight position={[6, 8, 4]} intensity={2.2} color="#ffb070" />
      <pointLight position={[0, 4, 2]} intensity={1.5} color="#ff8030" distance={20} />
      <ambientLight intensity={0.2} color="#3a1a0a" />
    </group>
  );
}
