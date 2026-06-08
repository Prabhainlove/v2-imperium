import { useEffect, useRef } from "react";
import videoAsset from "@/assets/profile/f1-race.mp4.asset.json";

const START = 3;
const END = 40;
const RATE = 1.5;

export function HeroIntroVideo({ onFinish }: { onFinish: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onFinish();
  };

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
      if (v.currentTime >= END) finish();
    };
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", finish);
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", finish);
    };
  }, []);

  return (
    <video
      ref={ref}
      src={videoAsset.url}
      muted
      autoPlay
      playsInline
      preload="auto"
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
    />
  );
}

export default HeroIntroVideo;
