import { createFileRoute } from "@tanstack/react-router";
import { SearchPage } from "@frontend/search/SearchPage";

export const Route = createFileRoute("/_authenticated/search")({
  component: SearchPage,
});
