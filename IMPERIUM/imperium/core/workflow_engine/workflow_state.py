from __future__ import annotations

from dataclasses import replace
from threading import RLock

from core.common import WorkflowDefinition, WorkflowStep
from core.common.time import utc_now


class WorkflowState:
    def __init__(self) -> None:
        self._lock = RLock()
        self._workflows: dict[str, WorkflowDefinition] = {}

    def create(self, workflow: WorkflowDefinition) -> WorkflowDefinition:
        with self._lock:
            self._workflows[workflow.workflow_id] = workflow
        return replace(workflow)

    def get(self, workflow_id: str) -> WorkflowDefinition | None:
        with self._lock:
            workflow = self._workflows.get(workflow_id)
            return replace(workflow) if workflow is not None else None

    def update_workflow_status(self, workflow_id: str, status: str) -> None:
        with self._lock:
            workflow = self._workflows.get(workflow_id)
            if workflow is None:
                return
            workflow.status = status
            workflow.metadata["updated_at"] = utc_now().isoformat()

    def update_step(self, workflow_id: str, step_id: str, *, status: str, retries: int | None = None) -> None:
        with self._lock:
            workflow = self._workflows.get(workflow_id)
            if workflow is None:
                return

            for step in workflow.steps:
                if step.step_id != step_id:
                    continue
                step.status = status
                if retries is not None:
                    step.retries = retries
                break

    def list_steps(self, workflow_id: str) -> list[WorkflowStep]:
        with self._lock:
            workflow = self._workflows.get(workflow_id)
            if workflow is None:
                return []
            return [replace(step) for step in workflow.steps]
