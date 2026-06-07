import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import katanaAsset from "@/assets/landing/katana.glb.asset.json";

/**
 * Scroll-driven 3D katana — real GLB model.
 * The model has 4 primitives by material:
 *   Grey_Dark  → blade
 *   White      → tsuka wrap (handle)
 *   Yellow.Brass → tsuba + fittings
 *   Black      → saya (sheath)
 *
 * On unsheathe, blade+tsuka+tsuba slide one way, saya recoils the other.
 *
 * Timeline:
 *  p 0.00–0.15 : macro close-up of tsuba area, sheathed
 *  p 0.15–0.45 : camera dollies back, group rotates to horizontal
 *  p 0.40–0.85 : blade group slides out of saya
 *  p 0.55–0.80 : red ember light fades
 */

const MODEL_URL = katanaAsset.url;
useGLTF.preload(MODEL_URL);

const lerp = (a: number, b: number, t: number) =>
  a + (b - a) * Math.max(0, Math.min(1, t));
const range = (p: number, a: number, b: number) =>
  Math.max(0, Math.min(1, (p - a) / (b - a)));
const ease = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function Rig({ progressRef }: { progressRef?: MutableRefObject<number> }) {
  const { camera } = useThree();
  useFrame(() => {
    const p = progressRef?.current ?? 0;
    const dolly = ease(range(p, 0.05, 0.45));
    const settle = ease(range(p, 0.45, 1));
    const z = lerp(2.4, 5.6, dolly);
    const z2 = lerp(z, 5.2, settle);
    camera.position.z = z2;
    camera.position.y = lerp(-0.1, 0.2, dolly);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function KatanaModel({ progressRef }: { progressRef?: MutableRefObject<number> }) {
  const { scene } = useGLTF(MODEL_URL) as unknown as { scene: THREE.Group };
  const rootRef = useRef<THREE.Group>(null);
  const bladeRef = useRef<THREE.Group>(null);
  const sayaRef = useRef<THREE.Group>(null);
  const emberRef = useRef<THREE.PointLight>(null);

  // Split the loaded mesh into blade-group (blade+tsuka+tsuba) and saya-group.
  const { bladeMeshes, sayaMeshes } = useMemo(() => {
    const blade: THREE.Mesh[] = [];
    const saya: THREE.Mesh[] = [];
    scene.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      const mat = mesh.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
      const matName = Array.isArray(mat) ? mat[0]?.name : mat?.name;
      const isSaya = /black/i.test(matName ?? "");
      // upgrade materials so they react to lights nicely
      const upgrade = (m: THREE.Material) => {
        const std = m as THREE.MeshStandardMaterial;
        if (std.isMaterial) {
          if (/grey|gray/i.test(std.name)) {
            std.metalness = 1;
            std.roughness = 0.18;
            std.color = new THREE.Color("#dfe6ee");
          } else if (/yellow|brass/i.test(std.name)) {
            std.metalness = 1;
            std.roughness = 0.32;
            std.color = new THREE.Color("#caa14a");
          } else if (/white/i.test(std.name)) {
            std.metalness = 0;
            std.roughness = 0.85;
            std.color = new THREE.Color("#efe8da");
          } else if (/black/i.test(std.name)) {
            std.metalness = 0.4;
            std.roughness = 0.35;
            std.color = new THREE.Color("#0a0a0a");
            std.emissive = new THREE.Color("#3a0a04");
            std.emissiveIntensity = 0.25;
          }
          std.needsUpdate = true;
        }
      };
      if (Array.isArray(mat)) mat.forEach(upgrade);
      else if (mat) upgrade(mat);

      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Re-parent later; for now mark which bucket
      (isSaya ? saya : blade).push(mesh);
    });
    return { bladeMeshes: blade, sayaMeshes: saya };
  }, [scene]);

  // Re-parent the meshes under our two animated groups exactly once.
  useEffect(() => {
    if (!bladeRef.current || !sayaRef.current) return;
    bladeMeshes.forEach((m) => bladeRef.current!.attach(m));
    sayaMeshes.forEach((m) => sayaRef.current!.attach(m));
  }, [bladeMeshes, sayaMeshes]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const p = progressRef?.current ?? 0;

    const dolly = ease(range(p, 0.05, 0.45));
    const unsheath = ease(range(p, 0.4, 0.85));
    const emberFade = ease(range(p, 0.55, 0.8));

    if (rootRef.current) {
      rootRef.current.position.x = lerp(0.45, 0, dolly);
      rootRef.current.position.y = lerp(-0.1, 0, dolly) + Math.sin(t * 0.5) * 0.02;
      // rotate from sheathed angle to horizontal display
      rootRef.current.rotation.z =
        lerp(-0.15, -0.28, dolly) + Math.sin(t * 0.4) * 0.01;
      rootRef.current.rotation.y = lerp(0.35, 0, dolly) + Math.sin(t * 0.3) * 0.02;
    }

    if (bladeRef.current) {
      bladeRef.current.position.x = lerp(0, 1.7, unsheath);
    }
    if (sayaRef.current) {
      sayaRef.current.position.x = lerp(0, -0.5, unsheath);
    }
    if (emberRef.current) {
      emberRef.current.intensity = lerp(2.6, 0, emberFade);
    }
  });

  // Auto-scale & center the loaded model so timeline math is consistent.
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const targetLength = 3.6; // world units we want the katana to be long
    const scale = targetLength / maxDim;
    return { scale, center };
  }, [scene]);

  return (
    <group
      ref={rootRef}
      scale={fit.scale}
      position={[-fit.center.x * fit.scale, -fit.center.y * fit.scale, 0]}
    >
      <group ref={bladeRef} />
      <group ref={sayaRef} />
      {/* warm ember light tucked at the tsuba area for the flame beat */}
      <pointLight
        ref={emberRef}
        position={[0, 0, 0.4]}
        intensity={2.6}
        color="#ff3a14"
        distance={3}
        decay={2}
      />
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
      camera={{ position: [0, 0, 2.4], fov: 30 }}
      style={{ width: "100%", height: "100%" }}
    >
      <Suspense fallback={null}>
        <directionalLight
          position={[-3, 4, 4]}
          intensity={2.4}
          color="#ffe4b5"
          castShadow
        />
        <directionalLight position={[4, 1, 2]} intensity={1.2} color="#b8d4ff" />
        <directionalLight position={[0, -3, 2]} intensity={0.6} color="#ff8a5a" />
        <ambientLight intensity={0.35} />
        <Rig progressRef={progressRef} />
        <KatanaModel progressRef={progressRef} />
        <Environment preset="warehouse" />
      </Suspense>
    </Canvas>
  );
}
