import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "@backend/database/SupabaseClient";


const LandingShell = lazy(() => import("@frontend/landing/LandingPage"));

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
  component: LandingPage,
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

function LandingPage() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);
  const cta = signedIn ? "/dashboard" : "/auth";
  const ctaLabel = signedIn ? "Enter Console" : "Enter Imperium";
  return (
    <ClientOnly fallback={<Fallback />}>
      <Suspense fallback={<Fallback />}>
        <LandingShell cta={cta} ctaLabel={ctaLabel} />
      </Suspense>
    </ClientOnly>
  );
}
