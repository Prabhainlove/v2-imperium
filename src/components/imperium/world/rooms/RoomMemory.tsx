import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ROOM_X } from "../CameraRig";
import { gridVert, gridFrag } from "../shaders/grid";
import { Character } from "../Character";

export function RoomMemory() {
  const gridRef = useRef<THREE.ShaderMaterial>(null);
  useFrame((s) => {
    if (gridRef.current) gridRef.current.uniforms.uTime.value = s.clock.elapsedTime;
  });

  const cubes = useMemo(() => {
    const arr: { pos: [number, number, number]; scale: number; rot: number }[] = [];
    let seed = 17;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < 30; i++) {
      arr.push({
        pos: [(rand() - 0.5) * 14, 0.5 + rand() * 6, (rand() - 0.5) * 8 - 2],
        scale: 0.15 + rand() * 0.35,
        rot: rand() * Math.PI,
      });
    }
    return arr;
  }, []);

  return (
    <group position={[ROOM_X[4], 0, 0]}>
      {/* grid room interior */}
      <mesh>
        <boxGeometry args={[24, 14, 24]} />
        <shaderMaterial
          ref={gridRef}
          side={THREE.BackSide}
          uniforms={{
            uTime: { value: 0 },
            uColor: { value: new THREE.Color("#0e1a24") },
            uAccent: { value: new THREE.Color("#7ad8ff") },
          }}
          vertexShader={gridVert}
          fragmentShader={gridFrag}
        />
      </mesh>

      {/* floating cubes */}
      {cubes.map((c, i) => (
        <FloatingCube key={i} {...c} />
      ))}

      <Character position={[0, 0, 0]} scale={1} pose="walk" color="#0a0a14" iridescence={1} />
    </group>
  );
}

function FloatingCube({
  pos,
  scale,
  rot,
}: {
  pos: [number, number, number];
  scale: number;
  rot: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (!ref.current) return;
    const t = s.clock.elapsedTime;
    ref.current.position.y = pos[1] + Math.sin(t * 0.5 + rot) * 0.3;
    ref.current.rotation.x = t * 0.1 + rot;
    ref.current.rotation.y = t * 0.15 + rot;
  });
  return (
    <mesh ref={ref} position={pos} scale={scale}>
      <boxGeometry args={[1, 1, 1]} />
      <meshPhysicalMaterial
        color="#13202a"
        emissive="#7ad8ff"
        emissiveIntensity={0.3}
        roughness={0.2}
        metalness={0.7}
        iridescence={1}
        iridescenceIOR={1.6}
      />
    </mesh>
  );
}
