import { createFileRoute } from "@tanstack/react-router";
import { ApplicationsPage } from "@frontend/applications/ApplicationsPage";

export const Route = createFileRoute("/_authenticated/applications")({
  component: ApplicationsPage,
});
