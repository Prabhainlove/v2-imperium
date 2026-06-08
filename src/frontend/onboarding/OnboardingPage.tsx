import "./onboarding.css";
import { useOnboardingPage } from "./onboarding.logic";

export function OnboardingPage() {
  const { title } = useOnboardingPage();
  return (
    <div className="onboarding-root min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <h1 className="onboarding-title text-3xl font-semibold">{title}</h1>
      <p className="onboarding-subtitle mt-3 text-sm text-muted-foreground">
        This page is part of the new architecture skeleton. UI coming soon.
      </p>
    </div>
  );
}

export default OnboardingPage;
