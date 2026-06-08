import { createFileRoute } from "@tanstack/react-router";
import { InterviewsPage } from "@frontend/interviews/InterviewsPage";

export const Route = createFileRoute("/_authenticated/interviews")({
  component: InterviewsPage,
});
