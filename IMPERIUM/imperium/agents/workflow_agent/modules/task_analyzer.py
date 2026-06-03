from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from ..models import TaskAnalysis, WorkflowTask


_CAPABILITY_KEYWORDS: dict[str, list[str]] = {
    "research": ["research", "discover", "investigate", "analyze", "compare"],
    "coding": ["build", "code", "implement", "develop", "refactor", "debug"],
    "automation": ["deploy", "install", "execute", "monitor", "orchestrate", "pipeline"],
    "testing": ["test", "validate", "qa", "verification", "simulation"],
    "data": ["data", "dataset", "ingest", "etl", "transform", "warehouse"],
}


@dataclass(slots=True)
class TaskAnalyzer:
    """Extracts domain, complexity, and capability needs from task payloads."""

    def analyze(self, task: WorkflowTask) -> TaskAnalysis:
        goal = task.goal.strip()
        lowered = goal.lower()

        keywords = self._extract_keywords(lowered)
        required_capabilities = self._infer_capabilities(lowered)
        complexity_score = self._estimate_complexity(lowered, task.constraints, task.context)
        domain = self._infer_domain(lowered)

        return TaskAnalysis(
            task_id=task.task_id,
            goal=goal,
            complexity_score=complexity_score,
            domain=domain,
            keywords=keywords,
            required_capabilities=required_capabilities,
            constraints=dict(task.constraints),
            context=dict(task.context),
        )

    def _extract_keywords(self, goal: str) -> list[str]:
        tokens = re.findall(r"[a-zA-Z0-9_\-]{3,}", goal)
        stop_words = {
            "with",
            "from",
            "that",
            "this",
            "into",
            "your",
            "agent",
            "workflow",
            "system",
            "task",
            "build",
            "make",
            "create",
        }
        filtered: list[str] = []
        seen: set[str] = set()
        for token in tokens:
            if token in stop_words:
                continue
            if token in seen:
                continue
            seen.add(token)
            filtered.append(token)
        return filtered[:20]

    def _infer_capabilities(self, goal: str) -> list[str]:
        capabilities: list[str] = []
        for capability, terms in _CAPABILITY_KEYWORDS.items():
            if any(term in goal for term in terms):
                capabilities.append(capability)

        if not capabilities:
            capabilities = ["research", "coding", "automation"]

        if "testing" not in capabilities:
            capabilities.append("testing")

        return capabilities

    def _estimate_complexity(
        self,
        goal: str,
        constraints: dict[str, Any],
        context: dict[str, Any],
    ) -> float:
        score = 0.35

        score += min(goal.count(" and ") * 0.08, 0.2)
        score += min(goal.count(",") * 0.03, 0.12)
        score += min(len(goal.split()) / 80.0, 0.2)

        if constraints:
            score += min(len(constraints) * 0.04, 0.15)

        if context:
            score += min(len(context) * 0.03, 0.15)

        strategic_terms = ["multi-agent", "parallel", "optimize", "long-running", "autonomous"]
        if any(term in goal for term in strategic_terms):
            score += 0.12

        return max(0.1, min(score, 1.0))

    def _infer_domain(self, goal: str) -> str:
        if any(term in goal for term in ["bot", "api", "service", "application", "software"]):
            return "software_engineering"
        if any(term in goal for term in ["workflow", "orchestration", "pipeline"]):
            return "workflow_orchestration"
        if any(term in goal for term in ["research", "analysis", "report"]):
            return "knowledge_work"
        return "general"
