import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ROOM_X } from "../CameraRig";
import { Character } from "../Character";

interface RoomArenaProps {
  isMobile: boolean;
}

export function RoomArena({ isMobile }: RoomArenaProps) {
  const count = isMobile ? 500 : 2000;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const seeds = useMemo(() => {
    const arr: { r: number; a: number; y: number; s: number }[] = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        r: 2 + Math.random() * 12,
        a: Math.random() * Math.PI * 2,
        y: -1 + Math.random() * 10,
        s: 0.5 + Math.random() * 1.5,
      });
    }
    return arr;
  }, [count]);

  useEffect(() => {
    if (!meshRef.current) return;
    seeds.forEach((s, i) => {
      dummy.position.set(Math.cos(s.a) * s.r, s.y, Math.sin(s.a) * s.r);
      dummy.scale.setScalar(0.04);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [seeds, dummy]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    seeds.forEach((s, i) => {
      const yy = s.y + Math.sin(t * 0.3 + i * 0.1) * 0.4;
      const aa = s.a + t * 0.04;
      dummy.position.set(Math.cos(aa) * s.r, yy, Math.sin(aa) * s.r);
      dummy.scale.setScalar(0.04 * s.s);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  // Stacked ring tiers
  const tiers = [0, 1, 2, 3, 4, 5];

  return (
    <group position={[ROOM_X[3], 0, 0]}>
      {/* dome */}
      <mesh>
        <sphereGeometry args={[40, 32, 32]} />
        <meshBasicMaterial color="#040408" side={THREE.BackSide} />
      </mesh>

      {/* arena floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[16, 64]} />
        <meshStandardMaterial color="#0a0a14" roughness={0.4} metalness={0.4} />
      </mesh>

      {/* ring tiers */}
      {tiers.map((i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, i * 0.8 + 0.1, 0]}>
          <ringGeometry args={[8 + i * 1.2, 8.4 + i * 1.2, 64]} />
          <meshStandardMaterial color="#10101a" emissive="#1a1a30" emissiveIntensity={0.4} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* vertical light blades */}
      <mesh position={[-3, 4, -2]} rotation={[0, 0.25, 0.15]}>
        <planeGeometry args={[0.5, 14]} />
        <meshBasicMaterial color="#9adfff" transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[3.5, 4, -1]} rotation={[0, -0.25, -0.15]}>
        <planeGeometry args={[0.5, 14]} />
        <meshBasicMaterial color="#ffd5a8" transparent opacity={0.45} side={THREE.DoubleSide} />
      </mesh>

      {/* particles */}
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial color="#cfeaff" />
      </instancedMesh>

      <Character position={[0, 0, 0]} scale={1} pose="stand" color="#0c0c14" />

      <directionalLight position={[0, 10, 0]} intensity={0.6} color="#9ad8ff" />
      <ambientLight intensity={0.05} />
    </group>
  );
}
