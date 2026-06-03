from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import uuid4

from ...modules.agent_invocation import ImperiumAgentInvoker
from .message_protocol import CouncilMessageProtocol
from .proposal_manager import StrategyProposal


@dataclass(slots=True)
class StrategyCritique:
    critique_id: str
    critic_agent: str
    target_proposal_id: str
    target_strategy: str
    content: str
    confidence: float
    impact: float


class CritiqueEngine:
    """Runs cross-agent critique rounds over submitted strategy proposals."""

    def __init__(
        self,
        *,
        protocol: CouncilMessageProtocol,
        invoker: ImperiumAgentInvoker,
    ) -> None:
        self.protocol = protocol
        self.invoker = invoker

    async def collect_critiques(
        self,
        *,
        task_id: str,
        goal: str,
        proposals: list[StrategyProposal],
        participants: list[str],
        external_clients: dict[str, Any],
        timeout_seconds: int,
    ) -> list[StrategyCritique]:
        critiques: list[StrategyCritique] = []

        for critic in participants:
            for proposal in proposals:
                if proposal.agent.strip().lower() == critic.strip().lower():
                    continue

                self.protocol.send(
                    receiver=critic,
                    task_id=task_id,
                    message_type="strategy_critique",
                    content=(
                        f"Critique proposal {proposal.proposal_id} ({proposal.strategy_name}) "
                        f"for task: {goal}"
                    ),
                    confidence=0.55,
                    metadata={
                        "phase": "critique",
                        "target_proposal": {
                            "proposal_id": proposal.proposal_id,
                            "agent": proposal.agent,
                            "strategy_name": proposal.strategy_name,
                            "description": proposal.strategy_description,
                            "success": proposal.estimated_success_probability,
                            "resources": proposal.required_resources,
                            "time": proposal.expected_execution_time,
                            "risk": proposal.risk_level,
                        },
                    },
                )

                invocation = await self.invoker.invoke(
                    requested_agent=critic,
                    capability="workflow",
                    payload={
                        "task_id": task_id,
                        "step_id": "COUNCIL",
                        "message_type": "strategy_critique",
                        "goal": goal,
                        "target_proposal": {
                            "proposal_id": proposal.proposal_id,
                            "agent": proposal.agent,
                            "strategy_name": proposal.strategy_name,
                            "description": proposal.strategy_description,
                            "estimated_success_probability": proposal.estimated_success_probability,
                            "required_resources": proposal.required_resources,
                            "expected_execution_time": proposal.expected_execution_time,
                            "risk_level": proposal.risk_level,
                        },
                    },
                    external_clients=external_clients,
                    timeout_seconds=max(1, timeout_seconds),
                )

                critique = self._parse_or_fallback(
                    critic=critic,
                    proposal=proposal,
                    payload=invocation.result,
                    invocation_status=invocation.status,
                )
                critiques.append(critique)

                self.protocol.send(
                    receiver="AgentCouncil",
                    task_id=task_id,
                    message_type="strategy_critique",
                    content=critique.content,
                    confidence=critique.confidence,
                    sender=critic,
                    metadata={
                        "critique_id": critique.critique_id,
                        "target_proposal_id": critique.target_proposal_id,
                        "impact": critique.impact,
                        "source_status": invocation.status,
                    },
                )

        return critiques

    def _parse_or_fallback(
        self,
        *,
        critic: str,
        proposal: StrategyProposal,
        payload: dict[str, Any],
        invocation_status: str,
    ) -> StrategyCritique:
        data = payload if isinstance(payload, dict) else {}

        content = str(
            data.get("critique")
            or data.get("content")
            or self._fallback_critique(critic=critic, proposal=proposal)
        ).strip()

        confidence = self._clamp_float(
            data.get("confidence", 0.72 if invocation_status == "completed" else 0.5),
            default=0.6,
        )
        impact = self._clamp_impact(
            data.get("impact", self._fallback_impact(critic=critic, proposal=proposal)),
            default=-0.04,
        )

        return StrategyCritique(
            critique_id=f"CRT{uuid4().hex[:8]}",
            critic_agent=critic,
            target_proposal_id=proposal.proposal_id,
            target_strategy=proposal.strategy_name,
            content=content,
            confidence=confidence,
            impact=impact,
        )

    def _fallback_critique(self, *, critic: str, proposal: StrategyProposal) -> str:
        critic_name = critic.strip().lower()

        if "coding" in critic_name and proposal.strategy_name == "B":
            return "Research-first pacing may delay implementation velocity."
        if "research" in critic_name and proposal.strategy_name == "A":
            return "Fast execution may under-sample evidence and raise architecture risk."
        if "automation" in critic_name and proposal.required_resources > 0.7:
            return "Resource load is high; automate pre-checks to reduce runtime pressure."

        return "Balanced proposal, but strengthen verification checkpoints before execution."

    def _fallback_impact(self, *, critic: str, proposal: StrategyProposal) -> float:
        critic_name = critic.strip().lower()
        if "coding" in critic_name and proposal.strategy_name == "B":
            return -0.08
        if "research" in critic_name and proposal.strategy_name == "A":
            return -0.07
        if "automation" in critic_name and proposal.required_resources > 0.7:
            return -0.06
        return -0.03

    def _clamp_float(self, value: Any, *, default: float) -> float:
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            numeric = default
        return round(max(0.0, min(1.0, numeric)), 4)

    def _clamp_impact(self, value: Any, *, default: float) -> float:
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            numeric = default
        return round(max(-1.0, min(1.0, numeric)), 4)
