import { useLenisScroll } from "./landing.logic";
import ColdOpen from "./components/ColdOpen";
import TopChrome from "./components/TopChrome";
import SideTicker from "./components/SideTicker";
import Companion from "./components/Companion";
import KatanaSketchfab from "./components/KatanaSketchfab";
import HeroSection from "./components/HeroSection";
import KeepScrollingSection from "./components/KeepScrollingSection";
import AwakeningSection from "./components/AwakeningSection";
import BambooSection from "./components/BambooSection";
import CompassSection from "./components/CompassSection";
import FeatureSwordSection from "./components/FeatureSwordSection";
import AndListenSection from "./components/AndListenSection";
import BentoSection from "./components/BentoSection";
import AudienceWheelSection from "./components/AudienceWheelSection";
import ClaritySection from "./components/ClaritySection";
import FooterCTASection from "./components/FooterCTASection";

interface Props {
  cta: string;
  ctaLabel: string;
}

export default function LandingPage({ cta, ctaLabel }: Props) {
  const { progressRef, scrollYRef, fpsRef, heroProgressRef } = useLenisScroll();

  return (
    <div className="relative w-full bg-[#f1ece6] text-black overflow-x-hidden">
      <ColdOpen />
      <TopChrome progressRef={progressRef} cta={cta} />
      <SideTicker scrollYRef={scrollYRef} fpsRef={fpsRef} />
      <Companion progressRef={progressRef} />

      {/* Fixed black backdrop — Sketchfab katana floats on top, fully visible */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-black" />
      <div className="fixed inset-0 z-[1] h-screen w-screen">
        <KatanaSketchfab progressRef={heroProgressRef} />
      </div>

      <main className="relative z-10">
        <HeroSection heroProgressRef={heroProgressRef} />
        <KeepScrollingSection />
        <AwakeningSection />
        <BambooSection />
        <CompassSection />
        <FeatureSwordSection />
        <AndListenSection />
        <BentoSection />
        <AudienceWheelSection />
        <ClaritySection />
        <FooterCTASection cta={cta} ctaLabel={ctaLabel} />
      </main>
    </div>
  );
}
