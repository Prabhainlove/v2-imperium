import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface CharacterProps {
  position?: [number, number, number];
  scale?: number;
  color?: string;
  iridescence?: number;
  pose?: "stand" | "sit" | "reach" | "walk";
}

// Procedural humanoid built from primitives. No GLBs.
export function Character({
  position = [0, 0, 0],
  scale = 1,
  color = "#1a1a22",
  iridescence = 1,
  pose = "stand",
}: CharacterProps) {
  const root = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!root.current) return;
    const t = state.clock.elapsedTime;
    root.current.position.y = position[1] + Math.sin(t * 0.6) * 0.04;
    root.current.rotation.y = Math.sin(t * 0.2) * 0.1;
  });

  const mat = (
    <meshPhysicalMaterial
      color={color}
      roughness={0.2}
      metalness={0.4}
      iridescence={iridescence}
      iridescenceIOR={1.8}
      transmission={0.08}
      thickness={0.4}
      clearcoat={1}
      clearcoatRoughness={0.2}
    />
  );

  // Pose-driven joint angles
  const armSwing = pose === "walk" ? 0.6 : pose === "reach" ? -1.2 : pose === "sit" ? 0.4 : 0.15;
  const torsoTilt = pose === "sit" ? 0.2 : pose === "reach" ? -0.2 : 0;
  const headTilt = pose === "reach" ? -0.3 : 0.05;

  return (
    <group ref={root} position={position} scale={scale}>
      {/* torso */}
      <mesh position={[0, 1.05, 0]} rotation={[torsoTilt, 0, 0]} castShadow>
        <capsuleGeometry args={[0.22, 0.55, 6, 16]} />
        {mat}
      </mesh>
      {/* head */}
      <mesh position={[0, 1.62, 0]} rotation={[headTilt, 0, 0]} castShadow>
        <sphereGeometry args={[0.18, 24, 24]} />
        {mat}
      </mesh>
      {/* shoulders pivot */}
      <group position={[0, 1.32, 0]}>
        {/* left arm */}
        <group rotation={[armSwing, 0, 0.2]} position={[-0.27, 0, 0]}>
          <mesh position={[0, -0.22, 0]}>
            <capsuleGeometry args={[0.07, 0.32, 4, 12]} />
            {mat}
          </mesh>
          <mesh position={[0, -0.6, 0.05]}>
            <capsuleGeometry args={[0.065, 0.3, 4, 12]} />
            {mat}
          </mesh>
        </group>
        {/* right arm */}
        <group rotation={[-armSwing * 0.8, 0, -0.2]} position={[0.27, 0, 0]}>
          <mesh position={[0, -0.22, 0]}>
            <capsuleGeometry args={[0.07, 0.32, 4, 12]} />
            {mat}
          </mesh>
          <mesh position={[0, -0.6, 0.05]}>
            <capsuleGeometry args={[0.065, 0.3, 4, 12]} />
            {mat}
          </mesh>
        </group>
      </group>
      {/* hips */}
      <group position={[0, 0.7, 0]}>
        {/* left leg */}
        <group rotation={[pose === "sit" ? 1.3 : 0, 0, 0]} position={[-0.12, 0, 0]}>
          <mesh position={[0, -0.28, 0]}>
            <capsuleGeometry args={[0.09, 0.4, 4, 12]} />
            {mat}
          </mesh>
          <mesh position={[0, -0.7, pose === "sit" ? 0.3 : 0]} rotation={[pose === "sit" ? -1.3 : 0, 0, 0]}>
            <capsuleGeometry args={[0.085, 0.38, 4, 12]} />
            {mat}
          </mesh>
        </group>
        {/* right leg */}
        <group rotation={[pose === "sit" ? 1.3 : 0, 0, 0]} position={[0.12, 0, 0]}>
          <mesh position={[0, -0.28, 0]}>
            <capsuleGeometry args={[0.09, 0.4, 4, 12]} />
            {mat}
          </mesh>
          <mesh position={[0, -0.7, pose === "sit" ? 0.3 : 0]} rotation={[pose === "sit" ? -1.3 : 0, 0, 0]}>
            <capsuleGeometry args={[0.085, 0.38, 4, 12]} />
            {mat}
          </mesh>
        </group>
      </group>
    </group>
  );
}
