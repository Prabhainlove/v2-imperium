import { createFileRoute } from "@tanstack/react-router";
import { SignInPage } from "@frontend/auth/SignInPage";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In — Imperium" },
      { name: "description", content: "Sign in to your Imperium AI job agent." },
    ],
  }),
  component: SignInPage,
});
