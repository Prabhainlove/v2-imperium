import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@frontend/dashboard/DashboardPage";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});
