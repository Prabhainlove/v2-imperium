import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@frontend/profile/ProfilePage";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});
