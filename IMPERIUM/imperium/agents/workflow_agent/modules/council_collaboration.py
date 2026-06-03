from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from ..models import WorkflowStrategy, WorkflowTask
from .agent_invocation import ImperiumAgentInvoker
from .communication_protocol import AgentCommunicationProtocol


@dataclass(slots=True)
class AgentCouncilCoordinator:
    """Collects optional strategy feedback from specialist agents before execution."""

    protocol: AgentCommunicationProtocol
    invoker: ImperiumAgentInvoker

    async def review_strategies(
        self,
        *,
        task: WorkflowTask,
        strategies: list[WorkflowStrategy],
        external_clients: dict[str, Any],
        timeout_seconds: int,
        enabled: bool,
    ) -> dict[str, Any]:
        if not enabled:
            return {
                "enabled": False,
                "recommendations": [],
                "applied_bias": {},
            }

        review_agents = ["ResearchAgent", "CodingAgent", "AutomationAgent"]
        recommendations: list[dict[str, Any]] = []

        for agent_name in review_agents:
            strategy_payload = {
                "goal": task.goal,
                "strategy_options": [
                    {
                        "label": strategy.label,
                        "score": strategy.score,
                        "risk_level": strategy.risk_level,
                        "estimated_time_cost": strategy.estimated_time_cost,
                        "success_probability": strategy.success_probability,
                    }
                    for strategy in strategies
                ],
                "request": "Provide preferred_strategy (A/B/C/MEMORY) with short rationale",
            }

            self.protocol.send(
                receiver=agent_name,
                task_id=task.task_id,
                step_id="COUNCIL",
                message_type="coordination_message",
                payload={
                    "coordination": "strategy_review",
                    "request_payload": strategy_payload,
                },
            )

            review = await self.invoker.request_strategy_review(
                agent_name=agent_name,
                task_id=task.task_id,
                payload=strategy_payload,
                external_clients=external_clients,
                timeout_seconds=timeout_seconds,
            )
            recommendations.append(review)

            self.protocol.send(
                receiver="WorkflowAgent",
                task_id=task.task_id,
                step_id="COUNCIL",
                message_type="result_report",
                payload={
                    "source_agent": agent_name,
                    "review": review,
                },
                sender=agent_name,
            )

        bias = self._aggregate_bias(recommendations)
        self._apply_bias(strategies, bias)

        return {
            "enabled": True,
            "recommendations": recommendations,
            "applied_bias": bias,
        }

    def _aggregate_bias(self, recommendations: list[dict[str, Any]]) -> dict[str, float]:
        votes: dict[str, float] = {"A": 0.0, "B": 0.0, "C": 0.0, "MEMORY": 0.0}

        for recommendation in recommendations:
            status = str(recommendation.get("status", "")).strip().lower()
            if status != "completed":
                continue

            preferred = recommendation.get("preferred_strategy")
            if preferred is None:
                continue

            label = str(preferred).strip().upper()
            if label not in votes:
                continue

            votes[label] += 1.0

        if not any(votes.values()):
            return {}

        return {label: round(count * 0.03, 4) for label, count in votes.items() if count > 0}

    def _apply_bias(self, strategies: list[WorkflowStrategy], bias: dict[str, float]) -> None:
        if not bias:
            return

        for strategy in strategies:
            bonus = bias.get(strategy.label, 0.0)
            if strategy.label == "MEMORY":
                bonus = max(bonus, bias.get("MEMORY", 0.0))
            if bonus <= 0.0:
                continue
            strategy.score = round(min(0.999999, strategy.score + bonus), 6)

        strategies.sort(key=lambda item: item.score, reverse=True)
