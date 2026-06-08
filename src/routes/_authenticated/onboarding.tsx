import { createFileRoute } from "@tanstack/react-router";
import { OnboardingPage } from "@frontend/onboarding/OnboardingPage";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingPage,
});
