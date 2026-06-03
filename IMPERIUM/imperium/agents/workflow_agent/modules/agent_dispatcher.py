from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .agent_invocation import ImperiumAgentInvoker
from .communication_protocol import AgentCommunicationProtocol
from ..models import StepDispatchResult, WorkflowStep, utc_now_iso


_DEFAULT_CAPABILITY_MAP = {
    "research": "ResearchAgent",
    "coding": "CodingAgent",
    "automation": "AutomationAgent",
    "testing": "AutomationAgent",
    "workflow": "AutomationAgent",
}


@dataclass(slots=True)
class AgentAssignmentSystem:
    """Assigns and dispatches workflow steps to available Imperium agents."""

    capability_to_agent: dict[str, str] = field(default_factory=lambda: dict(_DEFAULT_CAPABILITY_MAP))

    def assign_agents(
        self,
        steps: list[WorkflowStep],
        *,
        explicit_mapping: dict[str, str] | None = None,
    ) -> list[WorkflowStep]:
        mapping = dict(self.capability_to_agent)
        if explicit_mapping:
            for capability, agent_name in explicit_mapping.items():
                mapping[str(capability).strip().lower()] = str(agent_name).strip()

        for step in steps:
            capability = step.required_capability.lower().strip()
            step.assigned_agent = mapping.get(capability, "AutomationAgent")
        return steps

    async def dispatch_step(
        self,
        *,
        task_id: str,
        step: WorkflowStep,
        step_number: int,
        protocol: AgentCommunicationProtocol,
        invoker: ImperiumAgentInvoker,
        agent_clients: dict[str, Any],
        timeout_seconds: int,
    ) -> StepDispatchResult:
        assigned_agent = step.assigned_agent or self._agent_for_capability(step.required_capability)

        payload = {
            "task_id": task_id,
            "step": step_number,
            "step_id": step.step_id,
            "goal": step.objective,
            "required_capability": step.required_capability,
            "assigned_agent": assigned_agent,
            "status": "pending",
            "message_type": "task_assignment",
            "context": {
                "title": step.title,
                "dependencies": list(step.dependencies),
                "risk_level": step.risk_level,
                "parallelizable": step.parallelizable,
            },
        }

        assignment_message = protocol.send(
            receiver=assigned_agent,
            task_id=task_id,
            step_id=step.step_id,
            message_type="task_assignment",
            payload=payload,
        )

        started_at = utc_now_iso()
        invocation = await invoker.invoke(
            requested_agent=assigned_agent,
            capability=step.required_capability,
            payload=payload,
            external_clients=agent_clients,
            timeout_seconds=max(1, timeout_seconds),
        )
        finished_at = utc_now_iso()

        message_type = "result_report" if invocation.status == "completed" else "failure_event"
        response_message = protocol.send(
            receiver="WorkflowAgent",
            task_id=task_id,
            step_id=step.step_id,
            message_type=message_type,
            payload={
                "agent": invocation.agent,
                "status": invocation.status,
                "result": dict(invocation.result),
                "duration_seconds": invocation.duration_seconds,
                "error": invocation.error,
            },
            sender=invocation.agent,
        )

        structured_result = {
            "agent": invocation.agent,
            "step_id": step.step_id,
            "status": invocation.status,
            "result": dict(invocation.result),
            "duration_seconds": invocation.duration_seconds,
            "request_message_id": assignment_message.message_id,
            "response_message_id": response_message.message_id,
        }

        if invocation.status != "completed":
            return StepDispatchResult(
                task_id=task_id,
                step_id=step.step_id,
                step=step_number,
                status="failed",
                error=invocation.error or "Agent execution failed",
                result=structured_result,
                started_at=started_at,
                finished_at=finished_at,
            )

        return StepDispatchResult(
            task_id=task_id,
            step_id=step.step_id,
            step=step_number,
            status="completed",
            error=None,
            result=structured_result,
            started_at=started_at,
            finished_at=finished_at,
        )

    def _agent_for_capability(self, capability: str) -> str:
        return self.capability_to_agent.get(str(capability).strip().lower(), "AutomationAgent")

    def _find_client(self, assigned_agent: str, agent_clients: dict[str, Any]) -> Any | None:
        if assigned_agent in agent_clients:
            return agent_clients[assigned_agent]

        normalized = assigned_agent.strip().lower().replace(" ", "_")
        for key, client in agent_clients.items():
            key_norm = str(key).strip().lower().replace(" ", "_")
            if key_norm == normalized:
                return client
        return None
