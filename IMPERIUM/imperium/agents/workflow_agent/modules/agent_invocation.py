from __future__ import annotations

import asyncio
import importlib.util
from dataclasses import dataclass
from inspect import iscoroutinefunction
from pathlib import Path
from time import perf_counter
from typing import Any


@dataclass(slots=True)
class AgentInvocationResult:
    agent: str
    step_id: str
    status: str
    result: dict[str, Any]
    duration_seconds: float
    error: str | None = None


class ImperiumAgentInvoker:
    """Invokes real Imperium agents with lazy loading and structured output."""

    _ROLE_TO_AGENT = {
        "research": "ResearchAgent",
        "coding": "CodingAgent",
        "automation": "AutomationAgent",
        "testing": "AutomationAgent",
        "workflow": "AutomationAgent",
        "job": "JobAgent",
        "career": "JobAgent",
        "hiring": "JobAgent",
    }

    _BUILTIN_AGENT_SPECS = {
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
        "JobAgent": {
            "file": ("agents", "job_agent", "job_agent.py"),
            "class": "JobAgent",
            "init": "workspace",
        },
    }

    def __init__(self, *, workspace_root: Path) -> None:
        self.workspace_root = workspace_root.resolve()
        self._loaded_clients: dict[str, Any] = {}

    async def invoke(
        self,
        *,
        requested_agent: str,
        capability: str,
        payload: dict[str, Any],
        external_clients: dict[str, Any],
        timeout_seconds: int,
    ) -> AgentInvocationResult:
        agent_name = self._resolve_agent_name(requested_agent=requested_agent, capability=capability)
        client = self._resolve_client(agent_name=agent_name, external_clients=external_clients)

        if client is None:
            return AgentInvocationResult(
                agent=agent_name,
                step_id=str(payload.get("step_id", "unknown-step")),
                status="failed",
                result={},
                duration_seconds=0.0,
                error=f"No executable client resolved for {agent_name}",
            )

        execute_callable = getattr(client, "execute", None)
        if execute_callable is None:
            return AgentInvocationResult(
                agent=agent_name,
                step_id=str(payload.get("step_id", "unknown-step")),
                status="failed",
                result={},
                duration_seconds=0.0,
                error=f"{agent_name} client does not implement execute()",
            )

        start = perf_counter()
        try:
            if iscoroutinefunction(execute_callable):
                response = await asyncio.wait_for(
                    execute_callable(payload),
                    timeout=max(1, timeout_seconds),
                )
            else:
                response = await asyncio.wait_for(
                    asyncio.to_thread(execute_callable, payload),
                    timeout=max(1, timeout_seconds),
                )
            duration_seconds = round(perf_counter() - start, 4)

            if not isinstance(response, dict):
                response = {"raw_response": response}

            normalized = str(response.get("status", "completed")).strip().lower()
            status = "completed" if normalized in {"success", "completed", "ok"} else "failed"
            error = None if status == "completed" else str(response.get("error", "Agent execution failed"))

            return AgentInvocationResult(
                agent=agent_name,
                step_id=str(payload.get("step_id", "unknown-step")),
                status=status,
                result=response,
                duration_seconds=duration_seconds,
                error=error,
            )

        except asyncio.TimeoutError:
            return AgentInvocationResult(
                agent=agent_name,
                step_id=str(payload.get("step_id", "unknown-step")),
                status="failed",
                result={},
                duration_seconds=round(perf_counter() - start, 4),
                error=f"Agent execution timed out after {timeout_seconds}s",
            )
        except Exception as exc:
            return AgentInvocationResult(
                agent=agent_name,
                step_id=str(payload.get("step_id", "unknown-step")),
                status="failed",
                result={},
                duration_seconds=round(perf_counter() - start, 4),
                error=str(exc),
            )

    async def request_strategy_review(
        self,
        *,
        agent_name: str,
        task_id: str,
        payload: dict[str, Any],
        external_clients: dict[str, Any],
        timeout_seconds: int,
    ) -> dict[str, Any]:
        request_payload = {
            "task_id": task_id,
            "step_id": "COUNCIL",
            "message_type": "coordination_message",
            "coordination": "strategy_review",
            "payload": dict(payload),
        }

        result = await self.invoke(
            requested_agent=agent_name,
            capability="workflow",
            payload=request_payload,
            external_clients=external_clients,
            timeout_seconds=timeout_seconds,
        )

        return {
            "agent": result.agent,
            "status": result.status,
            "result": dict(result.result),
            "duration_seconds": result.duration_seconds,
            "error": result.error,
            "preferred_strategy": self._extract_preferred_strategy(result.result),
        }

    def _resolve_agent_name(self, *, requested_agent: str, capability: str) -> str:
        clean_requested = str(requested_agent).strip()
        if clean_requested:
            normalized_requested = clean_requested.lower().replace(" ", "")
            if normalized_requested in {"researchagent", "research"}:
                return "ResearchAgent"
            if normalized_requested in {"codingagent", "coding", "opendevin"}:
                return "CodingAgent"
            if normalized_requested in {"automationagent", "automation"}:
                return "AutomationAgent"
            if normalized_requested in {"jobagent", "job", "career"}:
                return "JobAgent"
            return clean_requested

        normalized_capability = str(capability).strip().lower()
        return self._ROLE_TO_AGENT.get(normalized_capability, "AutomationAgent")

    def _resolve_client(self, *, agent_name: str, external_clients: dict[str, Any]) -> Any | None:
        client = self._match_external(agent_name=agent_name, external_clients=external_clients)
        if client is not None:
            return client

        if agent_name in self._loaded_clients:
            return self._loaded_clients[agent_name]

        client = self._load_builtin_agent(agent_name)
        if client is not None:
            self._loaded_clients[agent_name] = client
        return client

    def _match_external(self, *, agent_name: str, external_clients: dict[str, Any]) -> Any | None:
        if agent_name in external_clients:
            return external_clients[agent_name]

        target = agent_name.strip().lower().replace(" ", "")
        for key, client in external_clients.items():
            normalized = str(key).strip().lower().replace(" ", "")
            if normalized == target:
                return client
        return None

    def _load_builtin_agent(self, agent_name: str) -> Any | None:
        spec_info = self._BUILTIN_AGENT_SPECS.get(agent_name)
        if spec_info is None:
            return None

        file_path = self.workspace_root.joinpath(*spec_info["file"])
        if not file_path.exists():
            return None

        # Ensure workspace root is permanently in sys.path so all absolute
        # imports (agents.xxx.yyy) and relative imports (..models) resolve.
        import sys
        workspace_str = str(self.workspace_root)
        if workspace_str not in sys.path:
            sys.path.insert(0, workspace_str)

        module_name = f"imperium_dynamic_{agent_name.lower()}"
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

    def _extract_preferred_strategy(self, payload: dict[str, Any]) -> str | None:
        candidate_keys = [
            "preferred_strategy",
            "strategy",
            "recommended_strategy",
        ]
        for key in candidate_keys:
            value = payload.get(key)
            if value is None:
                continue
            candidate = str(value).strip().upper()
            if candidate in {"A", "B", "C", "MEMORY"}:
                return candidate

        nested = payload.get("result")
        if isinstance(nested, dict):
            for key in candidate_keys:
                value = nested.get(key)
                if value is None:
                    continue
                candidate = str(value).strip().upper()
                if candidate in {"A", "B", "C", "MEMORY"}:
                    return candidate

        return None
