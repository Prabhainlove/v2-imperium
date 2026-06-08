import { useEffect, useRef } from "react";
import videoAsset from "@/assets/profile/f1-race.mp4.asset.json";

const START = 6;
const END = 40;
const RATE = 1.5;

export function HeroIntroVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const onMeta = () => {
      try {
        v.currentTime = START;
        v.playbackRate = RATE;
        v.play().catch(() => {});
      } catch {}
    };
    const onTime = () => {
      if (v.currentTime >= END) {
        v.currentTime = START;
        v.play().catch(() => {});
      }
    };
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("timeupdate", onTime);
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("timeupdate", onTime);
    };
  }, []);

  return (
    <video
      ref={ref}
      src={videoAsset.url}
      muted
      autoPlay
      playsInline
      loop
      preload="auto"
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
    />
  );
}

export default HeroIntroVideo;
