from __future__ import annotations

from dataclasses import asdict
from typing import Any

from ...modules.agent_invocation import ImperiumAgentInvoker
from .message_protocol import CouncilMessageProtocol
from .strategy_evaluator import EvaluatedStrategy


class DecisionEngine:
    """Runs decision voting and final strategy selection for Agent Council."""

    def __init__(
        self,
        *,
        protocol: CouncilMessageProtocol,
        invoker: ImperiumAgentInvoker,
    ) -> None:
        self.protocol = protocol
        self.invoker = invoker

    async def decide(
        self,
        *,
        task_id: str,
        goal: str,
        evaluated: list[EvaluatedStrategy],
        participants: list[str],
        external_clients: dict[str, Any],
        timeout_seconds: int,
    ) -> dict[str, Any]:
        if not evaluated:
            return {
                "selected_strategy": None,
                "chosen_strategy": "",
                "chosen_strategy_label": None,
                "confidence": 0.0,
                "reasoning_summary": "No evaluated strategies available.",
                "votes": [],
            }

        top_label = evaluated[0].strategy_name
        weighted_votes: dict[str, float] = {}
        vote_records: list[dict[str, Any]] = []

        for participant in participants:
            self.protocol.send(
                receiver=participant,
                task_id=task_id,
                message_type="decision_vote",
                content=f"Cast vote for the best strategy to solve: {goal}",
                confidence=0.6,
                metadata={
                    "phase": "decision_vote",
                    "evaluated_strategies": [asdict(item) for item in evaluated[:5]],
                },
            )

            invocation = await self.invoker.invoke(
                requested_agent=participant,
                capability="workflow",
                payload={
                    "task_id": task_id,
                    "step_id": "COUNCIL",
                    "message_type": "decision_vote",
                    "goal": goal,
                    "evaluated_strategies": [asdict(item) for item in evaluated],
                },
                external_clients=external_clients,
                timeout_seconds=max(1, timeout_seconds),
            )

            response = invocation.result if isinstance(invocation.result, dict) else {}
            voted_label = self._extract_vote(response, fallback=top_label)
            vote_confidence = self._clamp_float(
                response.get("confidence", 0.7 if invocation.status == "completed" else 0.45),
                default=0.5,
            )

            weighted_votes[voted_label] = weighted_votes.get(voted_label, 0.0) + vote_confidence

            vote_record = {
                "agent": participant,
                "voted_strategy": voted_label,
                "confidence": vote_confidence,
                "status": invocation.status,
            }
            vote_records.append(vote_record)

            self.protocol.send(
                receiver="AgentCouncil",
                task_id=task_id,
                message_type="decision_vote",
                content=f"{participant} voted for {voted_label}",
                confidence=vote_confidence,
                sender=participant,
                metadata=vote_record,
            )

        total_vote_weight = sum(weighted_votes.values())
        ranked: list[dict[str, Any]] = []
        for strategy in evaluated:
            vote_weight = weighted_votes.get(strategy.strategy_name, 0.0)
            vote_share = vote_weight / total_vote_weight if total_vote_weight > 0 else 0.0
            final_score = round((0.85 * strategy.score) + (0.15 * vote_share), 6)
            ranked.append(
                {
                    "strategy": strategy,
                    "vote_weight": round(vote_weight, 4),
                    "vote_share": round(vote_share, 4),
                    "final_score": final_score,
                }
            )

        ranked.sort(key=lambda item: item["final_score"], reverse=True)
        selected = ranked[0]["strategy"]
        selected_score = ranked[0]["final_score"]

        confidence = round(max(0.0, min(0.99, (selected_score * 0.9) + 0.05)), 4)
        summary = (
            f"Imperium selected strategy {selected.strategy_name} with confidence {confidence:.2f}; "
            f"evaluation score {selected.score:.3f} and vote-adjusted score {selected_score:.3f}."
        )

        self.protocol.send(
            receiver="WorkflowAgent",
            task_id=task_id,
            message_type="final_decision",
            content=summary,
            confidence=confidence,
            sender="ImperiumHead",
            metadata={
                "selected_strategy": selected.strategy_name,
                "score": selected_score,
                "votes": vote_records,
            },
        )

        return {
            "selected_strategy": asdict(selected),
            "chosen_strategy": selected.strategy_description,
            "chosen_strategy_label": selected.strategy_name,
            "confidence": confidence,
            "reasoning_summary": summary,
            "votes": vote_records,
            "ranked_scores": [
                {
                    "strategy_name": item["strategy"].strategy_name,
                    "proposal_id": item["strategy"].proposal_id,
                    "base_score": item["strategy"].score,
                    "vote_share": item["vote_share"],
                    "final_score": item["final_score"],
                }
                for item in ranked
            ],
        }

    def _extract_vote(self, payload: dict[str, Any], *, fallback: str) -> str:
        candidate = str(
            payload.get("vote")
            or payload.get("selected_strategy")
            or payload.get("preferred_strategy")
            or fallback
        ).strip().upper()
        return candidate or fallback

    def _clamp_float(self, value: Any, *, default: float) -> float:
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            numeric = default
        return round(max(0.0, min(1.0, numeric)), 4)
