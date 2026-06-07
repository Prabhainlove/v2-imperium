import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  EffectComposer,
  Bloom,
  DepthOfField,
  ChromaticAberration,
  Noise,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import type { MutableRefObject } from "react";

interface PostFXProps {
  progressRef: MutableRefObject<number>;
  isMobile: boolean;
}

// Per-room intensities — index aligns with rooms 0..5
const BLOOM = [0.9, 1.0, 0.7, 1.6, 1.1, 2.0];
const CA = [0.0008, 0.0012, 0.0010, 0.0025, 0.0018, 0.0040];
const VIGNETTE = [0.85, 0.5, 0.7, 0.45, 0.6, 0.4];
const FOCUS = [0.02, 0.04, 0.025, 0.06, 0.03, 0.05];

function sampleRoom(p: number, arr: number[]) {
  const f = Math.max(0, Math.min(0.99999, p)) * (arr.length - 1);
  const i = Math.floor(f);
  const t = f - i;
  return arr[i] * (1 - t) + arr[i + 1] * t;
}

export function PostFX({ progressRef, isMobile }: PostFXProps) {
  const bloomRef = useRef<{ intensity: number }>(null);
  const caRef = useRef<{ offset: THREE.Vector2 } | null>(null);
  const vigRef = useRef<{ darkness: number }>(null);
  const dofRef = useRef<{ target?: THREE.Vector3; focusDistance?: number }>(null);

  useFrame(() => {
    const p = progressRef.current;
    if (bloomRef.current) bloomRef.current.intensity = sampleRoom(p, BLOOM) * (isMobile ? 0.6 : 1);
    if (caRef.current && caRef.current.offset) {
      const v = sampleRoom(p, CA);
      caRef.current.offset.set(v, v);
    }
    if (vigRef.current) vigRef.current.darkness = sampleRoom(p, VIGNETTE);
    if (!isMobile && dofRef.current) {
      dofRef.current.focusDistance = sampleRoom(p, FOCUS);
    }
  });

  return (
    <EffectComposer multisampling={isMobile ? 0 : 2}>
      <Bloom
        ref={bloomRef as never}
        intensity={1.0}
        luminanceThreshold={0.2}
        luminanceSmoothing={0.7}
        mipmapBlur
      />
      {!isMobile ? (
        <DepthOfField
          ref={dofRef as never}
          focusDistance={0.03}
          focalLength={0.05}
          bokehScale={3}
        />
      ) : (
        <></>
      )}
      <ChromaticAberration
        ref={caRef as never}
        blendFunction={BlendFunction.NORMAL}
        offset={new THREE.Vector2(0.001, 0.001)}
        radialModulation={false}
        modulationOffset={0}
      />
      <Noise opacity={isMobile ? 0.05 : 0.08} premultiply blendFunction={BlendFunction.ADD} />
      <Vignette ref={vigRef as never} eskil={false} offset={0.2} darkness={0.7} />
    </EffectComposer>
  );
}
