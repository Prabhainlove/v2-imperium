import { createFileRoute } from "@tanstack/react-router";
import { RecruitersPage } from "@frontend/recruiters/RecruitersPage";
export const Route = createFileRoute("/_authenticated/recruiters")({ component: RecruitersPage });
