from __future__ import annotations

from pathlib import Path
from typing import Any

try:
    from .orchestrator import ImperiumWorkflowAgent, WorkflowAgentConfig
except ImportError:  # pragma: no cover - compatibility fallback
    from orchestrator import ImperiumWorkflowAgent, WorkflowAgentConfig


class WorkflowAgent:
    """IMPERIUM adapter entrypoint for the workflow intelligence stack."""

    def __init__(
        self,
        workspace_root: str | Path | None = None,
        config: WorkflowAgentConfig | None = None,
        agent_clients: dict[str, Any] | None = None,
    ) -> None:
        self._agent = ImperiumWorkflowAgent(
            workspace_root=workspace_root,
            config=config,
            agent_clients=agent_clients,
        )

    async def execute(self, task: dict[str, Any]) -> dict[str, Any]:
        return await self._agent.execute(task)

    async def conduct_council_meeting(self, task: dict[str, Any]) -> dict[str, Any]:
        return await self._agent.conduct_council_meeting(task)

    async def broadcast(
        self,
        *,
        message_type: str,
        payload: dict[str, Any] | None = None,
        task_id: str | None = None,
        step_id: str = "COUNCIL",
        receivers: list[str] | None = None,
        timeout_seconds: int = 30,
    ) -> list[dict[str, Any]]:
        return await self._agent.broadcast(
            message_type=message_type,
            payload=payload,
            task_id=task_id,
            step_id=step_id,
            receivers=receivers,
            timeout_seconds=timeout_seconds,
        )

    def register_agent(self, name: str, client: Any) -> None:
        self._agent.register_agent(name, client)

    def register_event_listener(self, listener: Any) -> None:
        self._agent.register_event_listener(listener)

    def get_capabilities(self) -> dict[str, Any]:
        return self._agent.get_capabilities()
