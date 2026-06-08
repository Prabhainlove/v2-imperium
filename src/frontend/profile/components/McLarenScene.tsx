import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import mclarenAsset from "@/assets/profile/mclaren-w1.fbx.asset.json";

function Car({ hovered }: { hovered: boolean }) {
  const fbx = useLoader(FBXLoader, mclarenAsset.url);
  const group = useRef<THREE.Group>(null);
  const mixer = useMemo(() => new THREE.AnimationMixer(fbx), [fbx]);
  const actionRef = useRef<THREE.AnimationAction | null>(null);

  const scene = useMemo(() => {
    const clone = fbx;
    // normalize size
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());
    const scale = 3.2 / size;
    clone.position.sub(center).multiplyScalar(scale);
    clone.scale.setScalar(scale);
    clone.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return clone;
  }, [fbx]);

  useEffect(() => {
    if (fbx.animations && fbx.animations.length > 0) {
      const clip =
        fbx.animations.find((c) => /take ?001|take_001/i.test(c.name)) ??
        fbx.animations[0];
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.clampWhenFinished = false;
      actionRef.current = action;
    }
    return () => mixer.stopAllAction();
  }, [fbx, mixer]);

  useEffect(() => {
    const a = actionRef.current;
    if (!a) return;
    if (hovered) {
      a.reset().fadeIn(0.25).play();
    } else {
      a.fadeOut(0.4);
    }
  }, [hovered]);

  useFrame((_, dt) => {
    mixer.update(dt);
    if (group.current && !hovered) {
      group.current.rotation.y += dt * 0.25;
    }
  });

  return <primitive ref={group} object={scene} />;
}

export function McLarenScene() {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ position: "absolute", inset: 0 }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <Canvas
        shadows
        camera={{ position: [3.5, 1.6, 4.5], fov: 35 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.35} />
        <directionalLight position={[5, 8, 4]} intensity={1.2} castShadow />
        <directionalLight position={[-4, 3, -3]} intensity={0.5} color="#b48cff" />
        <spotLight position={[0, 6, 0]} intensity={0.6} angle={0.6} penumbra={1} color="#ffb86b" />
        <Suspense fallback={null}>
          <Car hovered={hovered} />
          <Environment preset="night" />
        </Suspense>
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={false}
          minPolarAngle={Math.PI / 2.6}
          maxPolarAngle={Math.PI / 2.05}
        />
      </Canvas>
    </div>
  );
}

export default McLarenScene;
