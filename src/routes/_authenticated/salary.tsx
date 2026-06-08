import { createFileRoute } from "@tanstack/react-router";
import { SalaryPage } from "@frontend/salary/SalaryPage";
export const Route = createFileRoute("/_authenticated/salary")({ component: SalaryPage });
