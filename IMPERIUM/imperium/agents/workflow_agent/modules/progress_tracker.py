from __future__ import annotations

from dataclasses import dataclass, field

from ..models import ProgressSnapshot, WorkflowStep, utc_now_iso


@dataclass(slots=True)
class ExecutionMonitoringSystem:
    """Tracks workflow execution progress and provides structured snapshots."""

    snapshots: list[ProgressSnapshot] = field(default_factory=list)

    def snapshot(
        self,
        *,
        task_id: str,
        steps: list[WorkflowStep],
        next_step: str | None,
    ) -> ProgressSnapshot:
        completed = sum(1 for step in steps if step.status == "completed")
        failed = sum(1 for step in steps if step.status == "failed")
        skipped = sum(1 for step in steps if step.status == "skipped")
        running_steps = [step for step in steps if step.status == "running"]
        active_agents = sorted(
            {
                step.assigned_agent
                for step in running_steps
                if step.assigned_agent
            }
        )

        total = max(1, len(steps))
        progress_ratio = (completed + skipped) / total

        snapshot = ProgressSnapshot(
            task_id=task_id,
            total_steps=len(steps),
            completed_steps=completed,
            failed_steps=failed,
            skipped_steps=skipped,
            running_steps=len(running_steps),
            active_agents=active_agents,
            next_step=next_step,
            progress_ratio=round(progress_ratio, 4),
            timestamp=utc_now_iso(),
        )
        self.snapshots.append(snapshot)
        return snapshot

    def summarize(self) -> dict[str, object]:
        if not self.snapshots:
            return {
                "total_snapshots": 0,
                "latest": None,
                "progress_trend": "no-data",
            }

        latest = self.snapshots[-1]
        start_ratio = self.snapshots[0].progress_ratio
        end_ratio = latest.progress_ratio

        if end_ratio > start_ratio:
            trend = "improving"
        elif end_ratio < start_ratio:
            trend = "degrading"
        else:
            trend = "stable"

        return {
            "total_snapshots": len(self.snapshots),
            "latest": {
                "task_id": latest.task_id,
                "progress": f"{latest.completed_steps}/{latest.total_steps}",
                "next_step": latest.next_step,
                "active_agents": latest.active_agents,
                "timestamp": latest.timestamp,
            },
            "progress_trend": trend,
        }
