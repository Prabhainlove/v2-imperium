from __future__ import annotations

from pathlib import Path
from typing import Any

try:
    from .orchestrator import ImperiumCodingAgent, CodingAgentConfig
except ImportError:  # pragma: no cover - compatibility fallback
    from orchestrator import ImperiumCodingAgent, CodingAgentConfig


class CodingAgent:
    """IMPERIUM entrypoint adapter for the coding intelligence stack."""

    def __init__(
        self,
        workspace_root: str | Path | None = None,
        config: CodingAgentConfig | None = None,
    ) -> None:
        self._agent = ImperiumCodingAgent(
            workspace_root=workspace_root,
            config=config,
        )

    async def execute(self, task: dict[str, Any]) -> dict[str, Any]:
        return await self._agent.execute(task)

    def get_capabilities(self) -> dict[str, Any]:
        return self._agent.get_capabilities()
