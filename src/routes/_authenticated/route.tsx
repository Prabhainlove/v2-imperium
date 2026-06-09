import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@frontend/shell/AppShell";
import { getSession } from "@frontend/auth/mockAuth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: () => {
    if (!getSession()) {
      throw redirect({ to: "/auth" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
