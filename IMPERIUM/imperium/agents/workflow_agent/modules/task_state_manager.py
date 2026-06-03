from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ..models import WorkflowStep, utc_now_iso


@dataclass(slots=True)
class WorkflowStepState:
    step_id: str
    title: str
    agent: str | None
    status: str
    retries: int = 0
    started_at: str | None = None
    finished_at: str | None = None
    error: str | None = None


@dataclass(slots=True)
class WorkflowTaskState:
    task_id: str
    steps_total: int
    steps_completed: int = 0
    current_step: str | None = None
    status: str = "pending"
    started_at: str = field(default_factory=utc_now_iso)
    updated_at: str = field(default_factory=utc_now_iso)
    finished_at: str | None = None


class WorkflowTaskStateManager:
    """Tracks workflow execution state transitions across all steps."""

    def __init__(self) -> None:
        self._task_state: WorkflowTaskState | None = None
        self._steps: dict[str, WorkflowStepState] = {}
        self._timeline: list[dict[str, Any]] = []

    def initialize(self, *, task_id: str, steps: list[WorkflowStep]) -> dict[str, Any]:
        self._task_state = WorkflowTaskState(task_id=task_id, steps_total=len(steps), status="running")
        self._steps = {
            step.step_id: WorkflowStepState(
                step_id=step.step_id,
                title=step.title,
                agent=step.assigned_agent,
                status=step.status,
                retries=step.retries,
                started_at=step.started_at,
                finished_at=step.finished_at,
                error=step.error,
            )
            for step in steps
        }
        self._timeline = []
        self._record("workflow_started", {"task_id": task_id, "steps_total": len(steps)})
        return self.snapshot()

    def mark_assigned(self, *, step: WorkflowStep) -> dict[str, Any]:
        state = self._ensure_step(step)
        state.agent = step.assigned_agent
        state.status = "assigned"
        self._touch(current_step=step.step_id)
        self._record(
            "step_assigned",
            {
                "task_id": self.task_id,
                "step_id": step.step_id,
                "agent": step.assigned_agent,
            },
        )
        return self.snapshot()

    def mark_running(self, *, step: WorkflowStep) -> dict[str, Any]:
        state = self._ensure_step(step)
        state.status = "running"
        state.started_at = step.started_at or utc_now_iso()
        state.retries = step.retries
        self._touch(current_step=step.step_id)
        self._record(
            "step_running",
            {
                "task_id": self.task_id,
                "step_id": step.step_id,
                "agent": step.assigned_agent,
            },
        )
        return self.snapshot()

    def mark_result(self, *, step: WorkflowStep, status: str, error: str | None = None) -> dict[str, Any]:
        normalized = str(status).strip().lower()
        if normalized not in {"completed", "failed", "skipped"}:
            normalized = "failed"

        state = self._ensure_step(step)
        state.status = normalized
        state.retries = step.retries
        state.error = error
        state.finished_at = step.finished_at or utc_now_iso()

        self._touch(current_step=step.step_id)
        self._recount()

        self._record(
            f"step_{normalized}",
            {
                "task_id": self.task_id,
                "step_id": step.step_id,
                "agent": step.assigned_agent,
                "error": error,
                "retries": step.retries,
            },
        )
        return self.snapshot()

    def finalize(self, *, status: str) -> dict[str, Any]:
        normalized = str(status).strip().lower() or "partial"
        if self._task_state is None:
            return {
                "task_id": None,
                "status": normalized,
                "steps": [],
                "timeline": [],
            }

        self._task_state.status = normalized
        self._task_state.finished_at = utc_now_iso()
        self._task_state.updated_at = self._task_state.finished_at

        self._record(
            "workflow_completed",
            {
                "task_id": self.task_id,
                "status": normalized,
                "steps_completed": self._task_state.steps_completed,
                "steps_total": self._task_state.steps_total,
            },
        )
        return self.snapshot()

    def snapshot(self) -> dict[str, Any]:
        state = self._task_state
        if state is None:
            return {
                "task_id": None,
                "status": "uninitialized",
                "steps": [],
                "timeline": list(self._timeline),
            }

        ordered_steps = sorted(self._steps.values(), key=lambda item: item.step_id)
        return {
            "task_id": state.task_id,
            "steps_total": state.steps_total,
            "steps_completed": state.steps_completed,
            "current_step": state.current_step,
            "status": state.status,
            "started_at": state.started_at,
            "updated_at": state.updated_at,
            "finished_at": state.finished_at,
            "steps": [
                {
                    "step_id": item.step_id,
                    "title": item.title,
                    "agent": item.agent,
                    "status": item.status,
                    "retries": item.retries,
                    "started_at": item.started_at,
                    "finished_at": item.finished_at,
                    "error": item.error,
                }
                for item in ordered_steps
            ],
            "timeline": list(self._timeline),
        }

    @property
    def task_id(self) -> str:
        if self._task_state is None:
            return "unknown-task"
        return self._task_state.task_id

    def _ensure_step(self, step: WorkflowStep) -> WorkflowStepState:
        if step.step_id not in self._steps:
            self._steps[step.step_id] = WorkflowStepState(
                step_id=step.step_id,
                title=step.title,
                agent=step.assigned_agent,
                status=step.status,
                retries=step.retries,
            )
        return self._steps[step.step_id]

    def _touch(self, *, current_step: str | None) -> None:
        if self._task_state is None:
            return
        self._task_state.current_step = current_step
        self._task_state.updated_at = utc_now_iso()

    def _recount(self) -> None:
        if self._task_state is None:
            return
        completed = sum(1 for state in self._steps.values() if state.status in {"completed", "skipped"})
        self._task_state.steps_completed = completed

    def _record(self, event: str, payload: dict[str, Any]) -> None:
        self._timeline.append(
            {
                "event": event,
                "timestamp": utc_now_iso(),
                "payload": dict(payload),
            }
        )
