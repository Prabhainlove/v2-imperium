from __future__ import annotations

from typing import Any
from uuid import uuid4

from core.common import WorkflowDefinition, WorkflowStep
from core.event_system import EventStream
from core.workflow_engine.step_executor import DispatchCallable, StepExecutor
from core.workflow_engine.workflow_orchestrator import WorkflowOrchestrator
from core.workflow_engine.workflow_state import WorkflowState


class WorkflowEngine:
    def __init__(
        self,
        *,
        state: WorkflowState | None = None,
        orchestrator: WorkflowOrchestrator | None = None,
        dispatch_callable: DispatchCallable | None = None,
        event_stream: EventStream | None = None,
    ) -> None:
        self.state = state or WorkflowState()
        self.step_executor = StepExecutor(dispatch_callable=dispatch_callable)
        self.orchestrator = orchestrator or WorkflowOrchestrator(
            state=self.state,
            step_executor=self.step_executor,
            event_stream=event_stream,
        )

    def start_workflow(
        self,
        task_id: str,
        steps: list[dict[str, Any]],
        *,
        workflow_id: str | None = None,
        metadata: dict[str, Any] | None = None,
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if not steps:
            raise ValueError("workflow steps cannot be empty")

        normalized_steps = [
            WorkflowStep(
                step_id=str(step.get("step_id") or f"step_{index}"),
                name=str(step.get("name") or f"Step {index}"),
                action=str(step.get("action") or step.get("capability") or "execute"),
                input_payload=dict(step.get("input_payload") or {}),
                assigned_agent=step.get("assigned_agent"),
                dependencies=list(step.get("dependencies") or []),
                retries=int(step.get("retries") or 0),
                status=str(step.get("status") or "pending"),
            )
            for index, step in enumerate(steps, start=1)
        ]

        workflow = WorkflowDefinition(
            workflow_id=workflow_id or str(uuid4()),
            task_id=task_id,
            steps=normalized_steps,
            status="created",
            metadata=dict(metadata or {}),
        )

        return self.orchestrator.start(workflow, context=context)
