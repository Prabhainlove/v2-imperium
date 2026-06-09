import { createFileRoute } from "@tanstack/react-router";
import { ResetPasswordPage } from "@frontend/auth/ResetPasswordPage";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password — Imperium" },
      { name: "description", content: "Reset your Imperium account password." },
    ],
  }),
  component: ResetPasswordPage,
});
