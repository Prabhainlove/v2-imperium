import heroImg from "@/assets/dashboard/hero-portrait.png";

type Mode = "image" | "spline" | "three";

interface Props {
  mode?: Mode;
  src?: string;
  alt?: string;
}

/** Abstraction over the center character. Today renders an image;
 *  future modes (spline/three) can be added without touching consumers. */
export function HeroPortrait({ mode = "image", src = heroImg, alt = "Imperium hero" }: Props) {
  return (
    <div className="dash-hero">
      <div className="halo" />
      <div className="dots" aria-hidden />
      {mode === "image" && <img src={src} alt={alt} loading="eager" />}
      {/* future: spline / three.js avatar slots */}
    </div>
  );
}
