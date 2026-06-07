import { Link } from "@tanstack/react-router";
import logo from "@/assets/landing/imperium_logo.png";

interface Props {
  cta: string;
  ctaLabel: string;
}

export default function FooterCTASection({ cta, ctaLabel }: Props) {
  return (
    <section className="relative min-h-[80vh] w-full bg-black px-8 py-32">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-center text-center">
        <img src={logo} alt="" className="h-16 w-16 rounded-2xl" />
        <h2 className="mt-10 font-sans text-[clamp(48px,8vw,120px)] font-medium leading-[0.95] tracking-[-0.03em] text-[#f1ece6]">
          Step through<br />the gate.
        </h2>
        <p className="mt-6 max-w-md text-[15px] leading-snug text-[#f1ece6]/60">
          IMPERIUM is the AI job agent that orchestrates resumes, applications, and interviews — end to end.
        </p>
        <Link
          to={cta as "/auth"}
          className="mt-10 inline-flex items-center gap-3 rounded-full bg-[#ff5a3a] px-8 py-4 text-[15px] font-medium text-white shadow-[0_20px_60px_rgba(255,90,58,0.35)] transition-transform hover:scale-[1.02]"
        >
          {ctaLabel} →
        </Link>

        <div className="mt-24 flex w-full items-center justify-between border-t border-white/10 pt-6 font-mono text-[11px] tracking-[0.2em] text-white/40">
          <span>IMPERIUM©</span>
          <span>hi@imperium.app</span>
          <span>OPEN 2026</span>
        </div>
      </div>
    </section>
  );
}
