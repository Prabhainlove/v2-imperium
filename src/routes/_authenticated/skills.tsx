import { createFileRoute } from "@tanstack/react-router";
import { SkillsPage } from "@frontend/skills/SkillsPage";

export const Route = createFileRoute("/_authenticated/skills")({
  component: SkillsPage,
});
