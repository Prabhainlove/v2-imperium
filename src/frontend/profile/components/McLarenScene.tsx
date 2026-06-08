import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import mclarenAsset from "@/assets/profile/mclaren-w1.fbx.asset.json";
import textureMap from "@/assets/profile/mclaren-textures.map.json";

/** Build a LoadingManager that rewrites embedded FBX texture paths to CDN urls. */
function buildManager(): THREE.LoadingManager {
  const mgr = new THREE.LoadingManager();
  const map = textureMap as Record<string, string>;
  mgr.setURLModifier((url) => {
    // FBX embeds absolute/relative paths — pick basename
    const base = url.split(/[\\/]/).pop() ?? url;
    const tries = [base, decodeURIComponent(base), base.replace(/\s+/g, "_")];
    for (const k of tries) if (map[k]) return map[k];
    return url;
  });
  return mgr;
}

function Car({ hovered }: { hovered: boolean }) {
  const manager = useMemo(buildManager, []);
  const fbx = useLoader(FBXLoader, mclarenAsset.url, (loader) => {
    (loader as FBXLoader).manager = manager;
  });
  const group = useRef<THREE.Group>(null);
  const mixer = useMemo(() => new THREE.AnimationMixer(fbx), [fbx]);
  const actionRef = useRef<THREE.AnimationAction | null>(null);

  const scene = useMemo(() => {
    const clone = fbx;
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());
    const scale = 4.2 / size;
    clone.position.sub(center).multiplyScalar(scale);
    clone.scale.setScalar(scale);
    // After centering & scaling, find new bbox and drop to ground (y=0).
    const box2 = new THREE.Box3().setFromObject(clone);
    clone.position.y -= box2.min.y;
    clone.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        const mat = m.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
        const fix = (mm: THREE.Material) => {
          const sm = mm as THREE.MeshStandardMaterial;
          if (sm.map) sm.map.colorSpace = THREE.SRGBColorSpace;
          if (sm.emissiveMap) sm.emissiveMap.colorSpace = THREE.SRGBColorSpace;
          sm.needsUpdate = true;
        };
        if (Array.isArray(mat)) mat.forEach(fix);
        else if (mat) fix(mat);
      }
    });
    return clone;
  }, [fbx]);

  useEffect(() => {
    if (!fbx.animations || fbx.animations.length === 0) return;
    const clip =
      fbx.animations.find((c) => /take[ _]?001/i.test(c.name)) ??
      fbx.animations[0];
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    actionRef.current = action;
    return () => {
      mixer.stopAllAction();
    };
  }, [fbx, mixer]);

  useEffect(() => {
    const a = actionRef.current;
    if (!a) return;
    if (hovered) a.reset().fadeIn(0.25).play();
    else a.fadeOut(0.4);
  }, [hovered]);

  useFrame((_, dt) => mixer.update(dt));
  return <primitive ref={group} object={scene} />;
}

export function McLarenScene() {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ position: "absolute", inset: 0, cursor: "pointer" }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [4.5, 1.8, 5.5], fov: 32 }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
      >
        <ambientLight intensity={0.45} />
        <directionalLight
          position={[6, 9, 5]}
          intensity={1.8}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <directionalLight position={[-5, 4, -4]} intensity={0.7} color="#b8a0ff" />
        <spotLight position={[0, 7, 2]} intensity={0.6} angle={0.5} penumbra={1} color="#ffb86b" />
        <Suspense fallback={null}>
          <Car hovered={hovered} />
          <ContactShadows
            position={[0, 0, 0]}
            opacity={0.6}
            scale={10}
            blur={2.4}
            far={4}
          />
          <Environment preset="city" />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default McLarenScene;
