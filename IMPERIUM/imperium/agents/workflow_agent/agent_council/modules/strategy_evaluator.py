from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from .critique_engine import StrategyCritique
from .proposal_manager import StrategyProposal


@dataclass(slots=True)
class EvaluatedStrategy:
    proposal_id: str
    agent: str
    strategy_name: str
    strategy_description: str
    score: float
    metrics: dict[str, float]
    critique_summary: dict[str, Any]
    reasoning: list[str]


class StrategyEvaluator:
    """Scores proposals with risk/time/resource/success criteria and critique signals."""

    def evaluate(
        self,
        *,
        proposals: list[StrategyProposal],
        critiques: list[StrategyCritique],
    ) -> list[EvaluatedStrategy]:
        if not proposals:
            return []

        max_time = max(max(proposal.expected_execution_time, 0.1) for proposal in proposals)

        evaluated: list[EvaluatedStrategy] = []
        for proposal in proposals:
            proposal_critiques = [
                critique
                for critique in critiques
                if critique.target_proposal_id == proposal.proposal_id
            ]

            positive_impact = sum(max(0.0, critique.impact) for critique in proposal_critiques)
            negative_impact = sum(abs(min(0.0, critique.impact)) for critique in proposal_critiques)
            critique_count = max(1, len(proposal_critiques))
            critique_bonus = positive_impact / critique_count
            critique_penalty = negative_impact / critique_count

            success_factor = proposal.estimated_success_probability
            time_factor = 1.0 - min(1.0, proposal.expected_execution_time / max(0.1, max_time))
            resource_factor = 1.0 - proposal.required_resources
            risk_factor = 1.0 - proposal.risk_level
            confidence_factor = proposal.confidence

            raw_score = (
                (0.42 * success_factor)
                + (0.18 * time_factor)
                + (0.15 * resource_factor)
                + (0.18 * risk_factor)
                + (0.07 * confidence_factor)
                + (0.06 * critique_bonus)
                - (0.10 * critique_penalty)
            )
            score = round(max(0.0, min(1.0, raw_score)), 6)

            reasoning = [
                f"Success factor: {success_factor:.3f}",
                f"Time factor: {time_factor:.3f}",
                f"Resource factor: {resource_factor:.3f}",
                f"Risk factor: {risk_factor:.3f}",
                f"Critique bonus/penalty: +{critique_bonus:.3f} / -{critique_penalty:.3f}",
            ]

            evaluated.append(
                EvaluatedStrategy(
                    proposal_id=proposal.proposal_id,
                    agent=proposal.agent,
                    strategy_name=proposal.strategy_name,
                    strategy_description=proposal.strategy_description,
                    score=score,
                    metrics={
                        "success_factor": round(success_factor, 4),
                        "time_factor": round(time_factor, 4),
                        "resource_factor": round(resource_factor, 4),
                        "risk_factor": round(risk_factor, 4),
                        "confidence_factor": round(confidence_factor, 4),
                        "critique_bonus": round(critique_bonus, 4),
                        "critique_penalty": round(critique_penalty, 4),
                    },
                    critique_summary={
                        "count": len(proposal_critiques),
                        "items": [asdict(item) for item in proposal_critiques],
                    },
                    reasoning=reasoning,
                )
            )

        evaluated.sort(key=lambda item: item.score, reverse=True)
        return evaluated
