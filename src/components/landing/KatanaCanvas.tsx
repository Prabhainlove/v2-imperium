import { Suspense, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";

/**
 * Scroll-driven 3D katana.
 * progressRef is a 0→1 value across Hero + KeepScrolling stage.
 *
 * Timeline:
 *  - p 0.00–0.15 : macro close-up of saya+tsuba, sheathed, offset right
 *  - p 0.15–0.45 : camera dollies back, group rotates to horizontal, centers
 *  - p 0.40–0.85 : blade unsheathes — bladeGroup slides right, saya recoils left
 *  - p 0.55–0.80 : red flame core fades out
 */

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}
function range(p: number, a: number, b: number) {
  return Math.max(0, Math.min(1, (p - a) / (b - a)));
}
function ease(t: number) {
  // easeInOutCubic
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function Rig({ progressRef }: { progressRef?: MutableRefObject<number> }) {
  const { camera } = useThree();
  useFrame(() => {
    const p = progressRef?.current ?? 0;
    const dolly = ease(range(p, 0.05, 0.45));
    const settle = ease(range(p, 0.45, 1));
    const z = lerp(2.6, 5.2, dolly);
    const z2 = lerp(z, 4.8, settle);
    camera.position.z = z2;
    camera.position.y = lerp(0, 0.15, dolly);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function Katana({ progressRef }: { progressRef?: MutableRefObject<number> }) {
  const root = useRef<THREE.Group>(null);
  const saya = useRef<THREE.Group>(null);
  const blade = useRef<THREE.Group>(null);
  const flame = useRef<THREE.MeshStandardMaterial>(null);
  const flameGlow = useRef<THREE.MeshBasicMaterial>(null);
  const flamePoint = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const p = progressRef?.current ?? 0;

    const dolly = ease(range(p, 0.05, 0.45));
    const unsheath = ease(range(p, 0.4, 0.85));
    const flameFade = ease(range(p, 0.55, 0.8));

    if (root.current) {
      // start offset right (macro), center as camera pulls back
      root.current.position.x = lerp(0.55, 0, dolly);
      root.current.position.y = lerp(-0.05, 0, dolly) + Math.sin(t * 0.5) * 0.015;
      // start slightly diagonal, rotate to horizontal then a tiny tilt down
      root.current.rotation.z =
        lerp(-0.05, -0.32, dolly) + Math.sin(t * 0.4) * 0.008;
      root.current.rotation.y = lerp(0.18, 0, dolly);
    }

    if (saya.current) {
      saya.current.position.x = lerp(0, -0.45, unsheath);
    }
    if (blade.current) {
      blade.current.position.x = lerp(0, 1.9, unsheath);
    }

    const flameI = lerp(1, 0, flameFade);
    if (flame.current) flame.current.emissiveIntensity = 2.4 * flameI;
    if (flameGlow.current) flameGlow.current.opacity = 0.35 * flameI;
    if (flamePoint.current) flamePoint.current.intensity = 3 * flameI;
  });

  const wrapSegments = Array.from({ length: 10 }, (_, i) => i);

  return (
    <group ref={root} rotation={[0, 0, -0.05]}>
      {/* ===== BLADE GROUP — slides right on unsheathe ===== */}
      <group ref={blade}>
        {/* main blade — long thin curved steel */}
        <mesh position={[-2.0, 0.0, 0]} castShadow>
          <boxGeometry args={[3.2, 0.07, 0.018]} />
          <meshPhysicalMaterial
            color="#e8eef4"
            metalness={1}
            roughness={0.12}
            clearcoat={1}
            clearcoatRoughness={0.08}
          />
        </mesh>
        {/* hamon temper line — faint warm strip */}
        <mesh position={[-2.0, -0.015, 0.0095]}>
          <planeGeometry args={[3.1, 0.012]} />
          <meshBasicMaterial color="#fff4d8" transparent opacity={0.45} />
        </mesh>
        {/* blade tip */}
        <mesh position={[-3.62, 0.0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.035, 0.18, 16]} />
          <meshPhysicalMaterial color="#e8eef4" metalness={1} roughness={0.12} />
        </mesh>
        {/* habaki — small collar at blade base */}
        <mesh position={[-0.4, 0, 0]} castShadow>
          <boxGeometry args={[0.12, 0.11, 0.05]} />
          <meshPhysicalMaterial color="#d4a84a" metalness={1} roughness={0.3} />
        </mesh>
      </group>

      {/* ===== SAYA GROUP — recoils left on unsheathe ===== */}
      <group ref={saya}>
        <mesh position={[-2.2, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
          <cylinderGeometry args={[0.16, 0.18, 3.4, 32]} />
          <meshPhysicalMaterial
            color="#0a0a0a"
            metalness={0.3}
            roughness={0.25}
            clearcoat={1}
            clearcoatRoughness={0.15}
          />
        </mesh>
        {/* cutaway window — red emissive flame core */}
        <mesh position={[-1.6, 0.05, 0.17]}>
          <planeGeometry args={[1.4, 0.22]} />
          <meshStandardMaterial
            ref={flame}
            color="#ff1a0a"
            emissive="#ff3818"
            emissiveIntensity={2.4}
            toneMapped={false}
          />
        </mesh>
        {/* outer flame glow */}
        <mesh position={[-1.6, 0.05, 0.18]}>
          <planeGeometry args={[1.5, 0.32]} />
          <meshBasicMaterial
            ref={flameGlow}
            color="#ff2a14"
            transparent
            opacity={0.35}
            toneMapped={false}
          />
        </mesh>
        {/* kanji patch */}
        <mesh position={[-0.55, 0.05, 0.18]}>
          <planeGeometry args={[0.18, 0.18]} />
          <meshStandardMaterial color="#c9a14a" roughness={0.6} />
        </mesh>
        {/* koiguchi */}
        <mesh position={[-0.42, 0, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.18, 0.08, 32]} />
          <meshPhysicalMaterial color="#1a1a1a" metalness={0.5} roughness={0.3} />
        </mesh>
        {/* inner red point light */}
        <pointLight
          ref={flamePoint}
          position={[-1.6, 0.05, 0.4]}
          intensity={3}
          color="#ff2a14"
          distance={1.8}
        />
      </group>

      {/* ===== HILT — stays with tsuka, anchored at origin (does not move on unsheathe) ===== */}
      {/* fuchi */}
      <mesh position={[-0.32, 0, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.14, 0.06, 32]} />
        <meshPhysicalMaterial color="#d4a84a" metalness={1} roughness={0.25} />
      </mesh>
      {/* tsuba — gold guard */}
      <mesh position={[-0.22, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.04, 48]} />
        <meshPhysicalMaterial
          color="#b8893a"
          metalness={1}
          roughness={0.35}
          clearcoat={0.6}
        />
      </mesh>
      <mesh position={[-0.21, 0, 0.001]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.34, 0.015, 16, 64]} />
        <meshPhysicalMaterial color="#8b6520" metalness={1} roughness={0.4} />
      </mesh>
      {/* tsuka ferrule */}
      <mesh position={[-0.13, 0, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.14, 0.08, 32]} />
        <meshPhysicalMaterial color="#d4a84a" metalness={1} roughness={0.25} />
      </mesh>
      {/* tsuka body */}
      <mesh position={[0.75, 0, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.14, 1.7, 32]} />
        <meshPhysicalMaterial color="#f0ebe2" roughness={0.85} metalness={0} />
      </mesh>
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
            {i % 3 === 1 && (
              <mesh position={[x, -0.04, 0.141]}>
                <circleGeometry args={[0.012, 16]} />
                <meshPhysicalMaterial color="#d4a84a" metalness={1} roughness={0.3} />
              </mesh>
            )}
          </group>
        );
      })}
      {/* kashira */}
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
        <directionalLight position={[-3, 4, 4]} intensity={2.2} color="#ffe4b5" castShadow />
        <directionalLight position={[4, 1, 2]} intensity={1.1} color="#b8d4ff" />
        <ambientLight intensity={0.35} />
        <Rig progressRef={progressRef} />
        <Katana progressRef={progressRef} />
        <Environment preset="studio" />
      </Suspense>
    </Canvas>
  );
}
