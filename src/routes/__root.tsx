import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/imperium/theme-provider";
import { supabase } from "@/integrations/supabase/client";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="imp-surface flex items-center justify-center px-4">
      <span className="imp-tick imp-tick-tl" aria-hidden />
      <span className="imp-tick imp-tick-tr" aria-hidden />
      <span className="imp-tick imp-tick-bl" aria-hidden />
      <span className="imp-tick imp-tick-br" aria-hidden />
      <div className="relative z-10 max-w-md text-center">
        <div className="imp-eyebrow mb-3">Off-grid</div>
        <h1 className="imp-display text-7xl text-[#d8e3f2]" style={{ WebkitTextStroke: "1px rgba(216,227,242,0.35)", color: "transparent" }}>404</h1>
        <h2 className="mt-4 imp-display text-xl text-[#d8e3f2]">Page not found</h2>
        <p className="mt-2 text-sm text-[rgba(216,227,242,0.6)]">
          That route isn't on the Imperium map.
        </p>
        <div className="mt-8">
          <Link to="/" className="imp-ember-btn">Return home</Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="imp-surface flex items-center justify-center px-4">
      <span className="imp-tick imp-tick-tl" aria-hidden />
      <span className="imp-tick imp-tick-tr" aria-hidden />
      <span className="imp-tick imp-tick-bl" aria-hidden />
      <span className="imp-tick imp-tick-br" aria-hidden />
      <div className="relative z-10 max-w-md text-center">
        <div className="imp-eyebrow mb-3">System alert</div>
        <h1 className="imp-display text-xl text-[#d8e3f2]">Imperium hit an error</h1>
        <p className="mt-2 text-sm text-[rgba(216,227,242,0.65)]">{error.message}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="imp-ember-btn"
          >
            Try again
          </button>
          <a href="/" className="imp-ember-btn" style={{ borderColor: "rgba(216,227,242,0.4)" }}>
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Imperium — AI Job Agent" },
      {
        name: "description",
        content:
          "Imperium is a transparent AI-powered job agent platform. Watch every step: discovery, matching, resume optimization, application preparation and tracking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=VT323&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@500;600;700;800&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

const themeBootstrap = `try{var t=localStorage.getItem('imperium-theme');if(t==='dark'){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}`;

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AuthSync() {
  const router = useRouter();
  const qc = useQueryClient();
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      qc.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, qc]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthSync />
        <Outlet />
        <Toaster richColors closeButton />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
