from __future__ import annotations

from typing import Any


class ComplexityEstimator:
    def estimate(self, task: dict[str, Any]) -> float:
        score = 0.1
        payload = task.get("payload", {})
        description = str(task.get("description", ""))

        if isinstance(payload, dict):
            score += min(0.4, len(payload) * 0.02)
            nested_depth = self._estimate_depth(payload)
            score += min(0.2, nested_depth * 0.05)

        token_count = len(description.split())
        score += min(0.2, token_count / 250)

        requested_agents = task.get("requested_agents", [])
        if isinstance(requested_agents, list):
            score += min(0.1, len(requested_agents) * 0.03)

        return max(0.0, min(1.0, round(score, 4)))

    def _estimate_depth(self, value: dict[str, Any], current_depth: int = 1) -> int:
        max_depth = current_depth
        for item in value.values():
            if isinstance(item, dict):
                max_depth = max(max_depth, self._estimate_depth(item, current_depth + 1))
        return max_depth
