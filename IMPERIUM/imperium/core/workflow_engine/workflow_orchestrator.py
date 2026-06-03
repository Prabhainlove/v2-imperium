from __future__ import annotations

from typing import Any

from core.common import WorkflowDefinition
from core.event_system import EventStream
from core.workflow_engine.step_executor import StepExecutor
from core.workflow_engine.workflow_state import WorkflowState


class WorkflowOrchestrator:
    def __init__(
        self,
        *,
        state: WorkflowState | None = None,
        step_executor: StepExecutor | None = None,
        event_stream: EventStream | None = None,
    ) -> None:
        self.state = state or WorkflowState()
        self.step_executor = step_executor or StepExecutor()
        self.event_stream = event_stream

    def start(self, workflow: WorkflowDefinition, context: dict[str, Any] | None = None) -> dict[str, Any]:
        self.state.create(workflow)
        self.state.update_workflow_status(workflow.workflow_id, "executing")
        self._emit("workflow_started", {"workflow_id": workflow.workflow_id, "task_id": workflow.task_id})

        context_payload = dict(context or {})
        step_results: list[dict[str, Any]] = []

        while True:
            steps = self.state.list_steps(workflow.workflow_id)
            pending = [step for step in steps if step.status == "pending"]
            if not pending:
                break

            progress_made = False
            for step in pending:
                if not self._dependencies_satisfied(step, steps):
                    continue

                self.state.update_step(workflow.workflow_id, step.step_id, status="executing")
                self._emit(
                    "workflow_step_started",
                    {
                        "workflow_id": workflow.workflow_id,
                        "step_id": step.step_id,
                        "agent": step.assigned_agent,
                    },
                )

                result = self.step_executor.execute(workflow.workflow_id, step, context_payload)
                step_results.append({"step_id": step.step_id, **result})

                if result["status"] == "success":
                    self.state.update_step(workflow.workflow_id, step.step_id, status="completed")
                    self._emit(
                        "workflow_step_completed",
                        {
                            "workflow_id": workflow.workflow_id,
                            "step_id": step.step_id,
                            "duration_seconds": result.get("duration_seconds", 0.0),
                        },
                    )
                else:
                    self.state.update_step(workflow.workflow_id, step.step_id, status="failed")
                    self.state.update_workflow_status(workflow.workflow_id, "failed")
                    self._emit(
                        "workflow_step_failed",
                        {
                            "workflow_id": workflow.workflow_id,
                            "step_id": step.step_id,
                            "error": result.get("error", "Unknown step failure"),
                        },
                    )
                    return {
                        "status": "failed",
                        "workflow_id": workflow.workflow_id,
                        "task_id": workflow.task_id,
                        "steps": step_results,
                    }

                progress_made = True

            if not progress_made:
                self.state.update_workflow_status(workflow.workflow_id, "failed")
                return {
                    "status": "failed",
                    "workflow_id": workflow.workflow_id,
                    "task_id": workflow.task_id,
                    "steps": step_results,
                    "error": "Workflow deadlock detected due to unmet dependencies",
                }

        self.state.update_workflow_status(workflow.workflow_id, "completed")
        self._emit("workflow_completed", {"workflow_id": workflow.workflow_id, "task_id": workflow.task_id})
        return {
            "status": "completed",
            "workflow_id": workflow.workflow_id,
            "task_id": workflow.task_id,
            "steps": step_results,
        }

    def _dependencies_satisfied(self, step, steps) -> bool:
        if not step.dependencies:
            return True

        completed = {candidate.step_id for candidate in steps if candidate.status == "completed"}
        return all(dependency in completed for dependency in step.dependencies)

    def _emit(self, name: str, payload: dict[str, Any]) -> None:
        if self.event_stream is None:
            return
        self.event_stream.publish(
            event_type="task",
            name=name,
            payload=payload,
            source="workflow_engine",
        )
