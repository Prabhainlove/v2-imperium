from __future__ import annotations

from typing import Any


class ExecutionPlanner:
    def build_plan(
        self,
        *,
        task_id: str,
        selected_agents: list[str],
        execution_mode: str,
        required_capabilities: list[str],
    ) -> dict[str, Any]:
        steps: list[dict[str, Any]] = []

        for index, capability in enumerate(required_capabilities, start=1):
            assigned_agent = selected_agents[(index - 1) % max(1, len(selected_agents))] if selected_agents else None
            steps.append(
                {
                    "step_id": f"step_{index}",
                    "name": f"Execute {capability}",
                    "capability": capability,
                    "assigned_agent": assigned_agent,
                    "mode": execution_mode,
                }
            )

        return {
            "task_id": task_id,
            "execution_mode": execution_mode,
            "steps": steps,
            "selected_agents": list(selected_agents),
        }
