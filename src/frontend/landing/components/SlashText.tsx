import { useRef, type CSSProperties } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

interface Props {
  text: string;
  className?: string;
  style?: CSSProperties;
  ghosts?: number;
  start?: string;
  end?: string;
}

/**
 * Slash-blur reveal — heavy horizontal motion-blur with ghost copies that
 * collapse into a sharp word as the user scrolls. Used by Hero,
 * KeepScrolling, Awakening, AndListen.
 */
export default function SlashText({
  text,
  className = "",
  style,
  ghosts = 3,
  start = "top 80%",
  end = "top 30%",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const st = { trigger: ref.current, start, end, scrub: true };
      gsap.fromTo(
        ref.current!.querySelector(".slash-main"),
        { filter: "blur(36px)", opacity: 0.2, clipPath: "inset(45% 0 45% 0)", xPercent: -8 },
        { filter: "blur(0px)", opacity: 1, clipPath: "inset(0% 0 0% 0)", xPercent: 0, ease: "none", scrollTrigger: st },
      );
      gsap.fromTo(
        ref.current!.querySelectorAll(".slash-ghost"),
        { xPercent: -20, opacity: 0.5, filter: "blur(24px)" },
        { xPercent: 20, opacity: 0, filter: "blur(48px)", stagger: 0.05, ease: "none", scrollTrigger: st },
      );
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={`relative ${className}`} style={style}>
      {Array.from({ length: ghosts }).map((_, i) => (
        <span
          key={i}
          aria-hidden
          className="slash-ghost pointer-events-none absolute inset-0 select-none whitespace-nowrap"
          style={{ color: "inherit", opacity: 0.4 - i * 0.1 }}
        >
          {text}
        </span>
      ))}
      <span className="slash-main relative block whitespace-nowrap">{text}</span>
    </div>
  );
}
