from __future__ import annotations

from typing import Any


class StrategyAnalyzer:
    _KEYWORD_TO_CAPABILITY = {
        "research": "research",
        "analyze": "research",
        "find": "research",
        "search": "research",
        "what": "research",
        "who": "research",
        "when": "research",
        "where": "research",
        "why": "research",
        "how": "research",
        "code": "coding",
        "build": "coding",
        "develop": "coding",
        "implement": "coding",
        "automate": "automation",
        "workflow": "workflow",
        "orchestrate": "workflow",
        "job": "job search",
        "career": "job search",
    }

    def analyze(self, task: dict[str, Any], complexity: float) -> dict[str, Any]:
        text = " ".join(
            [
                str(task.get("title", "")),
                str(task.get("description", "")),
                str(task.get("query", "")),
                str(task.get("objective", "")),
            ]
        ).lower()

        required_capabilities: set[str] = set()
        for keyword, capability in self._KEYWORD_TO_CAPABILITY.items():
            if keyword in text:
                required_capabilities.add(capability)

        if not required_capabilities:
            required_capabilities.add("research")

        execution_mode = "sequential"
        if complexity >= 0.75:
            execution_mode = "hybrid"
        elif complexity >= 0.45:
            execution_mode = "parallel"

        return {
            "required_capabilities": sorted(required_capabilities),
            "execution_mode": execution_mode,
            "requires_council": complexity >= 0.6 or len(required_capabilities) > 2,
        }
