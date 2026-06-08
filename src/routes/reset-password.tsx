import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@frontend/auth/AuthPage";

export const Route = createFileRoute("/reset-password")({
  component: AuthPage,
});
