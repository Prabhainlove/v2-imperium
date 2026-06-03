from __future__ import annotations

from pathlib import Path
import sys
from typing import Any

_WORKSPACE_ROOT = Path(__file__).resolve().parents[2]
_workspace_root_str = str(_WORKSPACE_ROOT)
if _workspace_root_str not in sys.path:
    sys.path.insert(0, _workspace_root_str)

try:
    from agents.job_agent.orchestrator import ImperiumJobAgent, JobAgentConfig
except Exception:  # pragma: no cover - package compatibility fallback
    from .orchestrator import ImperiumJobAgent, JobAgentConfig


class JobAgent:
    """IMPERIUM adapter entrypoint for the autonomous Job Agent."""

    def __init__(
        self,
        workspace_root: str | Path | None = None,
        config: JobAgentConfig | None = None,
        agent_clients: dict[str, Any] | None = None,
    ) -> None:
        self._agent = ImperiumJobAgent(
            workspace_root=workspace_root,
            config=config,
            agent_clients=agent_clients,
        )

    async def execute(self, task: dict[str, Any]) -> dict[str, Any]:
        return await self._agent.execute(task)

    async def run_forever(self, task: dict[str, Any] | None = None) -> dict[str, Any]:
        return await self._agent.run_forever(task)

    def register_agent(self, name: str, client: Any) -> None:
        self._agent.register_agent(name, client)

    def get_capabilities(self) -> dict[str, Any]:
        return self._agent.get_capabilities()
