import { createFileRoute } from "@tanstack/react-router";
import { AtsPage } from "@frontend/ats/AtsPage";
export const Route = createFileRoute("/_authenticated/ats")({ component: AtsPage });
