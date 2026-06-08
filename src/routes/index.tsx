import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const LandingPage = lazy(() => import("@frontend/landing/LandingPage"));

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "IMPERIUM — Master Your Craft" },
      {
        name: "description",
        content:
          "IMPERIUM is the AI job agent. Discover, analyze, optimize, apply and track — orchestrated end-to-end.",
      },
      { property: "og:title", content: "IMPERIUM — Master Your Craft" },
      {
        property: "og:description",
        content: "An AI job agent that orchestrates resumes, applications, and interviews end-to-end.",
      },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Landing,
});

function Fallback() {
  return (
    <div className="fixed inset-0 z-0 grid place-items-center bg-[#f1ece6]">
      <div className="font-mono text-[11px] tracking-[0.4em] text-black/50">
        LOADING IMPERIUM…
      </div>
    </div>
  );
}

function Landing() {
  return (
    <ClientOnly fallback={<Fallback />}>
      <Suspense fallback={<Fallback />}>
        <LandingPage cta="/auth" ctaLabel="Enter Imperium" />
      </Suspense>
    </ClientOnly>
  );
}
