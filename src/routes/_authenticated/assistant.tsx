import { createFileRoute } from "@tanstack/react-router";
import { AssistantPage } from "@frontend/assistant/AssistantPage";
export const Route = createFileRoute("/_authenticated/assistant")({ component: AssistantPage });
