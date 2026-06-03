import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/imperium/app-sidebar";
import { HealthBadge } from "@/components/imperium/health-badge";
import { ThemeToggle } from "@/components/imperium/theme-toggle";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    if (location.pathname !== "/onboarding") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarded")
        .eq("id", data.user.id)
        .maybeSingle();
      if (!profile?.onboarded) {
        throw redirect({ to: "/onboarding" });
      }
    }
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[rgba(216,227,242,0.08)] bg-[rgba(11,23,41,0.75)] px-4 backdrop-blur-md">
            <SidebarTrigger />
            <span className="imp-mark-sm" aria-hidden />
            <div className="hidden md:flex flex-col leading-none">
              <span className="imp-eyebrow">Imperium</span>
              <span className="imp-display text-[11px] text-foreground/90">AI Job Agent Console</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <HealthBadge />
              <ThemeToggle />
            </div>
          </header>
          <main className="imp-shell-main flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
