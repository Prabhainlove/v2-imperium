import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ROOM_X } from "../CameraRig";
import { skyVert, skyFrag } from "../shaders/sky";
import { wetVert, wetFrag } from "../shaders/wetGround";
import { Character } from "../Character";

export function RoomRooftop() {
  const wetRef = useRef<THREE.ShaderMaterial>(null);
  const skyRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((s) => {
    if (wetRef.current) wetRef.current.uniforms.uTime.value = s.clock.elapsedTime;
    if (skyRef.current) skyRef.current.uniforms.uTime = { value: s.clock.elapsedTime };
  });

  // City silhouettes (instanced boxes)
  const cityMatrices = useMemo(() => {
    const arr: { pos: [number, number, number]; scale: [number, number, number] }[] = [];
    let seed = 1;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < 80; i++) {
      const x = (rand() - 0.5) * 70;
      const z = -20 - rand() * 30;
      const h = 4 + rand() * 14;
      const w = 1.5 + rand() * 3;
      arr.push({ pos: [x, h / 2, z], scale: [w, h, w] });
    }
    return arr;
  }, []);

  return (
    <group position={[ROOM_X[1], 0, 0]}>
      {/* night sky */}
      <mesh>
        <sphereGeometry args={[120, 32, 32]} />
        <shaderMaterial
          ref={skyRef}
          side={THREE.BackSide}
          uniforms={{
            uTop: { value: new THREE.Color("#05060c") },
            uBottom: { value: new THREE.Color("#1a1a26") },
            uGlow: { value: new THREE.Color("#ff8a4a") },
          }}
          vertexShader={skyVert}
          fragmentShader={skyFrag}
        />
      </mesh>

      {/* wet ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[120, 120, 1, 1]} />
        <shaderMaterial
          ref={wetRef}
          uniforms={{
            uTime: { value: 0 },
            uTint: { value: new THREE.Color("#15161e") },
            uSpecular: { value: new THREE.Color("#ffb070") },
          }}
          vertexShader={wetVert}
          fragmentShader={wetFrag}
        />
      </mesh>

      {/* city silhouettes */}
      <group>
        {cityMatrices.map((c, i) => (
          <mesh key={i} position={c.pos} scale={c.scale}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#0a0c14" emissive="#221808" emissiveIntensity={0.4} />
          </mesh>
        ))}
      </group>

      {/* rooftop edge */}
      <mesh position={[0, 0.05, 4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[16, 8]} />
        <meshStandardMaterial color="#08080c" roughness={0.5} metalness={0.3} />
      </mesh>

      <Character position={[3, 0, 0]} scale={1} pose="stand" color="#0c0c14" />

      <directionalLight position={[10, 14, 6]} intensity={1.4} color="#ffa766" />
      <pointLight position={[-5, 4, 2]} intensity={1.2} color="#ff7a3a" distance={20} />
      <ambientLight intensity={0.12} color="#3a2a1a" />
    </group>
  );
}
