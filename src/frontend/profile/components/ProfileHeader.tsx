import { HeroIntroVideo } from "./HeroIntroVideo";

export function ProfileHeader() {
  return (
    <div className="profile-hero-block">
      <div className="profile-hero-model">
        <HeroIntroVideo />
      </div>
      <div className="profile-hero-text">
        <p className="profile-hero-eyebrow">
          <span aria-hidden>🏁</span> Imperium · Career Grand Prix
        </p>
        <h1 className="profile-hero-tagline">
          Life is a race. Your career is the <em>championship</em>.
        </h1>
        <p className="profile-hero-sub">
          Navigate like a champion, accelerate through opportunities, and chase glory. <span aria-hidden>🏆✨</span>
        </p>
      </div>
    </div>
  );
}
