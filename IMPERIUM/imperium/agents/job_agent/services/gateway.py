from __future__ import annotations

import asyncio
import importlib.util
from dataclasses import dataclass
from inspect import iscoroutinefunction
from pathlib import Path
from time import perf_counter
from typing import Any


@dataclass(slots=True)
class AgentCallResult:
    agent: str
    status: str
    payload: dict[str, Any]
    duration_seconds: float
    error: str | None = None


class ImperiumAgentGateway:
    """Unified communication interface to Imperium specialized agents."""

    _BUILTIN_SPECS = {
        "ResearchAgent": {
            "file": ("agents", "research_agent", "research_agent.py"),
            "class": "ResearchAgent",
            "init": "default",
        },
        "CodingAgent": {
            "file": ("agents", "coding_agent", "coding_agent.py"),
            "class": "CodingAgent",
            "init": "workspace",
        },
        "AutomationAgent": {
            "file": ("agents", "automation_agent", "automation_agent.py"),
            "class": "AutomationAgent",
            "init": "default",
        },
        "WorkflowAgent": {
            "file": ("agents", "workflow_agent", "superagi_workflow_agent.py"),
            "class": "WorkflowAgent",
            "init": "workspace",
        },
    }

    def __init__(
        self,
        *,
        workspace_root: Path,
        external_clients: dict[str, Any] | None = None,
    ) -> None:
        self.workspace_root = workspace_root.resolve()
        self.external_clients = dict(external_clients or {})
        self._loaded_clients: dict[str, Any] = {}

    def register_agent(self, name: str, client: Any) -> None:
        cleaned = str(name).strip()
        if not cleaned:
            raise ValueError("Agent name cannot be empty.")
        self.external_clients[cleaned] = client

    async def invoke(
        self,
        *,
        agent_name: str,
        payload: dict[str, Any],
        timeout_seconds: int = 120,
    ) -> AgentCallResult:
        resolved_name = self._normalize_name(agent_name)
        client = self._resolve_client(resolved_name)

        if client is None:
            return AgentCallResult(
                agent=resolved_name,
                status="failed",
                payload={},
                duration_seconds=0.0,
                error=f"No agent client available for {resolved_name}",
            )

        execute_callable = getattr(client, "execute", None)
        if execute_callable is None:
            return AgentCallResult(
                agent=resolved_name,
                status="failed",
                payload={},
                duration_seconds=0.0,
                error=f"{resolved_name} does not expose execute(task)",
            )

        start = perf_counter()
        try:
            if iscoroutinefunction(execute_callable):
                response = await asyncio.wait_for(
                    execute_callable(payload),
                    timeout=max(1, int(timeout_seconds)),
                )
            else:
                response = await asyncio.wait_for(
                    asyncio.to_thread(execute_callable, payload),
                    timeout=max(1, int(timeout_seconds)),
                )
        except asyncio.TimeoutError:
            return AgentCallResult(
                agent=resolved_name,
                status="failed",
                payload={},
                duration_seconds=round(perf_counter() - start, 4),
                error=f"{resolved_name} timed out after {timeout_seconds}s",
            )
        except Exception as exc:  # pragma: no cover - runtime safety path
            return AgentCallResult(
                agent=resolved_name,
                status="failed",
                payload={},
                duration_seconds=round(perf_counter() - start, 4),
                error=str(exc),
            )

        if not isinstance(response, dict):
            response = {"raw_response": response}

        raw_status = str(response.get("status", "success")).strip().lower()
        normalized_status = "completed" if raw_status in {"success", "completed", "ok"} else "failed"
        return AgentCallResult(
            agent=resolved_name,
            status=normalized_status,
            payload=response,
            duration_seconds=round(perf_counter() - start, 4),
            error=None if normalized_status == "completed" else str(response.get("error", "Agent call failed")),
        )

    async def discover_jobs(self, query: str, context: dict[str, Any]) -> AgentCallResult:
        return await self.invoke(
            agent_name="ResearchAgent",
            payload={"query": query, "context": context, "task_id": context.get("task_id", "")},
            timeout_seconds=180,
        )

    async def automate_application(self, payload: dict[str, Any]) -> AgentCallResult:
        return await self.invoke(
            agent_name="AutomationAgent",
            payload=payload,
            timeout_seconds=180,
        )

    async def generate_portfolio_project(self, payload: dict[str, Any]) -> AgentCallResult:
        return await self.invoke(
            agent_name="CodingAgent",
            payload=payload,
            timeout_seconds=180,
        )

    async def orchestrate_pipeline(self, payload: dict[str, Any]) -> AgentCallResult:
        return await self.invoke(
            agent_name="WorkflowAgent",
            payload=payload,
            timeout_seconds=240,
        )

    def _resolve_client(self, name: str) -> Any | None:
        external = self._resolve_external(name)
        if external is not None:
            return external

        if name in self._loaded_clients:
            return self._loaded_clients[name]

        client = self._load_builtin(name)
        if client is not None:
            self._loaded_clients[name] = client
        return client

    def _resolve_external(self, name: str) -> Any | None:
        if name in self.external_clients:
            return self.external_clients[name]

        target = name.strip().lower().replace(" ", "")
        aliases = self._agent_aliases(name)
        aliases.add(target)

        for key, client in self.external_clients.items():
            normalized = str(key).strip().lower().replace(" ", "")
            if normalized in aliases:
                return client
        return None

    def _load_builtin(self, name: str) -> Any | None:
        spec_info = self._BUILTIN_SPECS.get(name)
        if spec_info is None:
            return None

        file_path = self.workspace_root.joinpath(*spec_info["file"])
        if not file_path.exists():
            return None

        module_name = f"imperium_dynamic_{name.lower()}"
        spec = importlib.util.spec_from_file_location(module_name, file_path)
        if spec is None or spec.loader is None:
            return None

        module = importlib.util.module_from_spec(spec)
        try:
            spec.loader.exec_module(module)
        except Exception:
            return None

        cls = getattr(module, spec_info["class"], None)
        if cls is None:
            return None

        try:
            if spec_info["init"] == "workspace":
                return cls(workspace_root=self.workspace_root)
            return cls()
        except Exception:
            return None

    @staticmethod
    def _normalize_name(name: str) -> str:
        cleaned = str(name).strip().lower().replace(" ", "")
        if cleaned in {"research", "researchagent", "autogpt"}:
            return "ResearchAgent"
        if cleaned in {"coding", "codingagent", "opendevin"}:
            return "CodingAgent"
        if cleaned in {"automation", "automationagent", "openclaw"}:
            return "AutomationAgent"
        if cleaned in {"workflow", "workflowagent", "superagi"}:
            return "WorkflowAgent"
        if cleaned in {"job", "jobagent"}:
            return "JobAgent"
        return str(name).strip() or "AutomationAgent"

    @staticmethod
    def _agent_aliases(name: str) -> set[str]:
        normalized = name.strip().lower().replace(" ", "")
        aliases = {normalized}
        if normalized == "researchagent":
            aliases.update({"research", "autogpt"})
        elif normalized == "codingagent":
            aliases.update({"coding", "opendevin"})
        elif normalized == "automationagent":
            aliases.update({"automation", "openclaw"})
        elif normalized == "workflowagent":
            aliases.update({"workflow", "superagi"})
        return aliases
