import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import type { ActivityLogEntry } from "@/lib/imperium/types";

/**
 * Auto-advances the user through the workflow as the pipeline reaches
 * each stage. Listens to activity_log entries (passed in by the caller)
 * and navigates once per session — never overriding a manual navigation.
 *
 * Returns a `cancel()` so the caller's UI can disarm it.
 */
export function useWorkflowAutopilot(opts: {
  entries: ActivityLogEntry[] | undefined;
  enabled: boolean;
  /** Path to navigate to once the search has reached the `user_review` stage. */
  reviewPath?: string;
}) {
  const { entries, enabled, reviewPath = "/applications" } = opts;
  const navigate = useNavigate();
  const firedRef = useRef(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!enabled || firedRef.current || cancelledRef.current) return;
    if (!entries || entries.length === 0) return;
    const reached = entries.some(
      (e) =>
        e.action === "user_review" ||
        e.action === "complete" ||
        (e.action === "prepare_application" && (e.status ?? "").toLowerCase() === "success"),
    );
    if (!reached) return;
    firedRef.current = true;
    const id = window.setTimeout(() => {
      if (cancelledRef.current) return;
      toast.message("Auto-advancing to Application Review", {
        description: "Imperium has staged your application packages.",
        action: {
          label: "Stay here",
          onClick: () => {
            cancelledRef.current = true;
          },
        },
      });
      navigate({ to: reviewPath });
    }, 1200);
    return () => window.clearTimeout(id);
  }, [entries, enabled, navigate, reviewPath]);

  return {
    cancel: () => {
      cancelledRef.current = true;
    },
  };
}
