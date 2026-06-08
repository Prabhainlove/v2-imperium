import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@frontend/shell/AppShell";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
