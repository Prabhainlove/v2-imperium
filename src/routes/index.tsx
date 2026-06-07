import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const ImperiumExperience = lazy(
  () => import("@/components/imperium/world/ImperiumExperience"),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IMPERIUM — The AI Job Agent" },
      {
        name: "description",
        content:
          "IMPERIUM interfaces with sources, recruiters, and AI to build a transparent job pipeline. Discover. Analyze. Optimize. Apply. Track.",
      },
      { property: "og:title", content: "IMPERIUM — The AI Job Agent" },
      {
        property: "og:description",
        content: "A cinematic, autonomous job agent. Built for the modern career.",
      },
    ],
  }),
  component: LandingPage,
});

function Fallback() {
  return (
    <div className="fixed inset-0 z-0 grid place-items-center bg-black">
      <div className="imp-mono text-[14px] tracking-[0.4em] text-white/40">
        LOADING IMPERIUM…
      </div>
    </div>
  );
}

function LandingPage() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setSignedIn(!!s),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const cta = signedIn ? "/dashboard" : "/auth";
  const ctaLabel = signedIn ? "ENTER CONSOLE" : "ENTER IMPERIUM";

  return (
    <div className="relative min-h-screen w-full bg-black text-white">
      <ClientOnly fallback={<Fallback />}>
        <Suspense fallback={<Fallback />}>
          <ImperiumExperience cta={cta} ctaLabel={ctaLabel} />
        </Suspense>
      </ClientOnly>
    </div>
  );
}
