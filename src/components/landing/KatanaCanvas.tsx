import { Suspense, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";

/**
 * Procedural 3D katana — macro framing of saya cutaway + gold tsuba + ito-wrapped tsuka.
 * No external GLB needed. Real lighting, real depth, emissive red flame core.
 */

function Katana({ progressRef }: { progressRef?: MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    const scroll = progressRef?.current ?? 0;
    group.current.rotation.z = -0.05 + Math.sin(t * 0.4) * 0.015 - scroll * 0.15;
    group.current.position.y = Math.sin(t * 0.5) * 0.02;
  });

  // ito-wrap: alternating white wraps + black diamond menuki, ~10 segments
  const wrapSegments = Array.from({ length: 10 }, (_, i) => i);

  return (
    <group ref={group} rotation={[0, 0, -0.05]} position={[0.3, -0.1, 0]}>
      {/* SAYA — black lacquered sheath, extends to the left */}
      <mesh position={[-2.2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.16, 0.18, 3.4, 32]} />
        <meshPhysicalMaterial
          color="#0a0a0a"
          metalness={0.3}
          roughness={0.25}
          clearcoat={1}
          clearcoatRoughness={0.15}
        />
      </mesh>

      {/* CUTAWAY WINDOW — red emissive flame core visible through a "hole" in saya */}
      <mesh position={[-1.6, 0.05, 0.17]} rotation={[0, 0, 0]}>
        <planeGeometry args={[1.4, 0.22]} />
        <meshStandardMaterial
          color="#ff1a0a"
          emissive="#ff3818"
          emissiveIntensity={2.4}
          toneMapped={false}
        />
      </mesh>

      {/* inner flame glow plane behind the window */}
      <mesh position={[-1.6, 0.05, 0.18]}>
        <planeGeometry args={[1.5, 0.32]} />
        <meshBasicMaterial color="#ff2a14" transparent opacity={0.35} toneMapped={false} />
      </mesh>

      {/* Kanji ベ patch on saya near koiguchi */}
      <mesh position={[-0.55, 0.05, 0.18]}>
        <planeGeometry args={[0.18, 0.18]} />
        <meshStandardMaterial color="#c9a14a" roughness={0.6} />
      </mesh>

      {/* KOIGUCHI — mouth of the saya */}
      <mesh position={[-0.42, 0, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.08, 32]} />
        <meshPhysicalMaterial color="#1a1a1a" metalness={0.5} roughness={0.3} />
      </mesh>

      {/* FUCHI — gold collar between saya and tsuba */}
      <mesh position={[-0.32, 0, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.14, 0.06, 32]} />
        <meshPhysicalMaterial color="#d4a84a" metalness={1} roughness={0.25} />
      </mesh>

      {/* TSUBA — gold floral guard */}
      <mesh position={[-0.22, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.04, 48]} />
        <meshPhysicalMaterial
          color="#b8893a"
          metalness={1}
          roughness={0.35}
          clearcoat={0.6}
        />
      </mesh>

      {/* tsuba inner ring detail */}
      <mesh position={[-0.21, 0, 0.001]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.34, 0.015, 16, 64]} />
        <meshPhysicalMaterial color="#8b6520" metalness={1} roughness={0.4} />
      </mesh>

      {/* TSUKA-GUCHI — gold ferrule after tsuba */}
      <mesh position={[-0.13, 0, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.14, 0.08, 32]} />
        <meshPhysicalMaterial color="#d4a84a" metalness={1} roughness={0.25} />
      </mesh>

      {/* TSUKA — white ito-wrap base */}
      <mesh position={[0.75, 0, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.14, 1.7, 32]} />
        <meshPhysicalMaterial color="#f0ebe2" roughness={0.85} metalness={0} />
      </mesh>

      {/* Diamond menuki pattern — repeated black diamonds along the tsuka */}
      {wrapSegments.map((i) => {
        const x = -0.05 + i * 0.17;
        return (
          <group key={i}>
            <mesh position={[x, 0, 0.14]} rotation={[0, 0, Math.PI / 4]}>
              <planeGeometry args={[0.09, 0.09]} />
              <meshStandardMaterial color="#0a0a0a" roughness={0.7} />
            </mesh>
            <mesh position={[x, 0, -0.14]} rotation={[0, Math.PI, Math.PI / 4]}>
              <planeGeometry args={[0.09, 0.09]} />
              <meshStandardMaterial color="#0a0a0a" roughness={0.7} />
            </mesh>
            {/* tiny gold menuki dot */}
            {i % 3 === 1 && (
              <mesh position={[x, -0.04, 0.141]}>
                <circleGeometry args={[0.012, 16]} />
                <meshPhysicalMaterial color="#d4a84a" metalness={1} roughness={0.3} />
              </mesh>
            )}
          </group>
        );
      })}

      {/* KASHIRA — pommel cap */}
      <mesh position={[1.65, 0, 0]} castShadow>
        <cylinderGeometry args={[0.135, 0.13, 0.08, 32]} />
        <meshPhysicalMaterial color="#d4a84a" metalness={1} roughness={0.3} />
      </mesh>
    </group>
  );
}

interface Props {
  progressRef?: MutableRefObject<number>;
}

export default function KatanaCanvas({ progressRef }: Props) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.6]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0, 2.6], fov: 28 }}
      style={{ width: "100%", height: "100%" }}
    >
      <Suspense fallback={null}>
        {/* warm key light from upper-left */}
        <directionalLight position={[-3, 4, 4]} intensity={2.2} color="#ffe4b5" castShadow />
        {/* cool rim from right */}
        <directionalLight position={[4, 1, 2]} intensity={1.1} color="#b8d4ff" />
        {/* ambient fill */}
        <ambientLight intensity={0.35} />
        {/* red point light INSIDE saya cutaway — volumetric flame glow */}
        <pointLight position={[-1.6, 0.05, 0.4]} intensity={3} color="#ff2a14" distance={1.8} />

        <Katana progressRef={progressRef} />

        <Environment preset="studio" />
      </Suspense>
    </Canvas>
  );
}
