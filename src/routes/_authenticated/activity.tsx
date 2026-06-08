import { createFileRoute } from "@tanstack/react-router";
import { ActivityPage } from "@frontend/activity/ActivityPage";

export const Route = createFileRoute("/_authenticated/activity")({
  component: ActivityPage,
});
