import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ROOM_X } from "../CameraRig";
import { fogVert, fogFrag } from "../shaders/fog";
import { Character } from "../Character";

export function RoomStudio() {
  const fogRef = useRef<THREE.ShaderMaterial>(null);
  useFrame((s) => {
    if (fogRef.current) fogRef.current.uniforms.uTime.value = s.clock.elapsedTime;
  });

  return (
    <group position={[ROOM_X[2], 0, 0]}>
      {/* black studio box */}
      <mesh>
        <boxGeometry args={[30, 18, 30]} />
        <meshStandardMaterial color="#020205" side={THREE.BackSide} roughness={0.8} />
      </mesh>

      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshPhysicalMaterial color="#0a0a10" roughness={0.25} metalness={0.5} clearcoat={1} />
      </mesh>

      {/* iridescent sculpture */}
      <mesh position={[2, 1.3, -1]}>
        <icosahedronGeometry args={[0.7, 1]} />
        <meshPhysicalMaterial
          color="#161620"
          roughness={0.15}
          metalness={0.2}
          transmission={0.4}
          thickness={0.6}
          iridescence={1}
          iridescenceIOR={2.0}
          clearcoat={1}
        />
      </mesh>

      <Character position={[-1, 0, 0]} scale={1} pose="reach" color="#0c0c14" iridescence={1} />

      {/* volumetric fog quad */}
      <mesh position={[0, 2, -4]}>
        <planeGeometry args={[20, 12]} />
        <shaderMaterial
          ref={fogRef}
          transparent
          depthWrite={false}
          uniforms={{
            uTime: { value: 0 },
            uColor: { value: new THREE.Color("#101018") },
            uIntensity: { value: 0.45 },
          }}
          vertexShader={fogVert}
          fragmentShader={fogFrag}
        />
      </mesh>

      <spotLight position={[3, 8, 4]} angle={0.5} penumbra={0.8} intensity={2.5} color="#9ad8ff" castShadow />
      <pointLight position={[-3, 2, 3]} intensity={0.8} color="#ff7a55" distance={10} />
      <ambientLight intensity={0.04} />
    </group>
  );
}
