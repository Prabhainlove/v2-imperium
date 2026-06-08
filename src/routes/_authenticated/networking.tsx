import { createFileRoute } from "@tanstack/react-router";
import { NetworkingPage } from "@frontend/networking/NetworkingPage";
export const Route = createFileRoute("/_authenticated/networking")({ component: NetworkingPage });
