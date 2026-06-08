import { createFileRoute } from "@tanstack/react-router";
import { JobsPage } from "@frontend/jobs/JobsPage";

export const Route = createFileRoute("/_authenticated/jobs")({
  component: JobsPage,
});
