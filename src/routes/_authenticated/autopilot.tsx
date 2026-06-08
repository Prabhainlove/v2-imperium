import { createFileRoute } from "@tanstack/react-router";
import { AutopilotPage } from "@frontend/autopilot/AutopilotPage";

export const Route = createFileRoute("/_authenticated/autopilot")({
  component: AutopilotPage,
});
