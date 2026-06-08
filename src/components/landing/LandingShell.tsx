import { useLenisScroll } from "./useLenisScroll";
import ColdOpen from "./ColdOpen";
import TopChrome from "./chrome/TopChrome";
import SideTicker from "./chrome/SideTicker";
import Companion from "./chrome/Companion";
import KatanaSketchfab from "./KatanaSketchfab";
import HeroSection from "./sections/HeroSection";
import KeepScrollingSection from "./sections/KeepScrollingSection";
import AwakeningSection from "./sections/AwakeningSection";
import BambooSection from "./sections/BambooSection";
import CompassSection from "./sections/CompassSection";
import FeatureSwordSection from "./sections/FeatureSwordSection";
import AndListenSection from "./sections/AndListenSection";
import BentoSection from "./sections/BentoSection";
import AudienceWheelSection from "./sections/AudienceWheelSection";
import ClaritySection from "./sections/ClaritySection";
import FooterCTASection from "./sections/FooterCTASection";

interface Props {
  cta: string;
  ctaLabel: string;
}

export default function LandingShell({ cta, ctaLabel }: Props) {
  const { progressRef, scrollYRef, fpsRef, heroProgressRef } = useLenisScroll();

  return (
    <div className="relative w-full bg-[#f1ece6] text-black overflow-x-hidden">
      <ColdOpen />
      <TopChrome progressRef={progressRef} cta={cta} />
      <SideTicker scrollYRef={scrollYRef} fpsRef={fpsRef} />
      <Companion progressRef={progressRef} />

      {/* Fixed black backdrop + 2D sprite katana visible through transparent Hero/KeepScrolling */}
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
