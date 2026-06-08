import { createFileRoute } from "@tanstack/react-router";
import { SignUpPage } from "@frontend/auth/SignUpPage";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Join Imperium — Create your account" },
      { name: "description", content: "Forge your Imperium account to orchestrate resumes, applications, and interviews end-to-end." },
    ],
  }),
  component: SignUpPage,
});
