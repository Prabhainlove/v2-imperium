import { createFileRoute } from "@tanstack/react-router";
import { ResumePage } from "@frontend/resume/ResumePage";

export const Route = createFileRoute("/_authenticated/resume")({
  component: ResumePage,
});
