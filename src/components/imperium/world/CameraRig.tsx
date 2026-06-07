import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { MutableRefObject } from "react";

// Six rooms spaced along +X. Each room has a camera anchor and a lookAt anchor.
// Spacing is small relative to fog/scale so transitions feel cinematic.
export const ROOM_X = [0, 60, 120, 180, 240, 300] as const;

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

interface CameraRigProps {
  progressRef: MutableRefObject<number>;
}

export function CameraRig({ progressRef }: CameraRigProps) {
  const { camera } = useThree();
  const tmp = useRef(new THREE.Vector3());
  const tmp2 = useRef(new THREE.Vector3());

  const { posCurve, targetCurve } = useMemo(() => {
    // Camera anchors: 6 rooms — slight Y/Z variation for cinematic motion.
    const positions = [
      new THREE.Vector3(ROOM_X[0] - 4, 1.2, 6),
      new THREE.Vector3(ROOM_X[1] - 2, 2.2, 9),
      new THREE.Vector3(ROOM_X[2] - 1, 1.6, 7),
      new THREE.Vector3(ROOM_X[3] + 0, 3.5, 12),
      new THREE.Vector3(ROOM_X[4] + 1, 1.4, 8),
      new THREE.Vector3(ROOM_X[5] - 2, 1.8, 7),
    ];
    // LookAt anchors aim slightly forward (next room) for continuous motion.
    const targets = [
      new THREE.Vector3(ROOM_X[0] + 4, 1.0, 0),
      new THREE.Vector3(ROOM_X[1] + 6, 1.0, 0),
      new THREE.Vector3(ROOM_X[2] + 6, 1.2, 0),
      new THREE.Vector3(ROOM_X[3] + 4, 0.0, 0),
      new THREE.Vector3(ROOM_X[4] + 6, 1.0, 0),
      new THREE.Vector3(ROOM_X[5] + 4, 1.4, 0),
    ];
    const posCurve = new THREE.CatmullRomCurve3(positions, false, "catmullrom", 0.5);
    const targetCurve = new THREE.CatmullRomCurve3(targets, false, "catmullrom", 0.5);
    return { posCurve, targetCurve };
  }, []);

  useFrame(() => {
    const t = easeInOutCubic(progressRef.current);
    posCurve.getPoint(t, tmp.current);
    targetCurve.getPoint(t, tmp2.current);
    camera.position.lerp(tmp.current, 0.15);
    // smooth lookAt
    const dir = tmp2.current.clone().sub(camera.position).normalize();
    const targetQuat = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().lookAt(camera.position, camera.position.clone().add(dir), camera.up),
    );
    camera.quaternion.slerp(targetQuat, 0.15);
  });

  return null;
}
