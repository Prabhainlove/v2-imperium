import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import modelAsset from "@/assets/profile/mclaren-mcl39.glb.asset.json";

export function preloadMclarenModel() {
  if (typeof window === "undefined") return;
  fetch(modelAsset.url, { cache: "force-cache" }).catch(() => {});
}

export function McLarenScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let width = mount.clientWidth || 1;
    let height = mount.clientHeight || 1;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 1000);
    camera.position.set(4, 1.6, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    mount.appendChild(renderer.domElement);

    // Environment for PBR reflections
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const hemi = new THREE.HemisphereLight(0xffffff, 0x222233, 0.6);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(5, 8, 5);
    scene.add(key);

    let model: THREE.Object3D | null = null;
    let rafId = 0;
    let disposed = false;

    const loader = new GLTFLoader();
    loader.load(
      modelAsset.url,
      (gltf) => {
        if (disposed) return;
        model = gltf.scene;

        // Center & scale to fit
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        model.position.sub(center);
        const maxDim = Math.max(size.x, size.y, size.z);
        const targetSize = 4;
        const scale = targetSize / maxDim;
        model.scale.setScalar(scale);

        // Sit on ground baseline
        const box2 = new THREE.Box3().setFromObject(model);
        model.position.y -= box2.min.y;

        // Frame camera
        const fov = (camera.fov * Math.PI) / 180;
        const dist = (targetSize / 2) / Math.tan(fov / 2) * 1.6;
        camera.position.set(dist * 0.7, targetSize * 0.45, dist);
        camera.lookAt(0, targetSize * 0.3, 0);

        scene.add(model);
      },
      undefined,
      (err) => console.error("[McLarenScene] GLB load failed", err)
    );

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      if (model) model.rotation.y += 0.0025;
      renderer.render(scene, camera);
    };
    animate();

    const ro = new ResizeObserver(() => {
      width = mount.clientWidth || 1;
      height = mount.clientHeight || 1;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      });
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}

export default McLarenScene;
