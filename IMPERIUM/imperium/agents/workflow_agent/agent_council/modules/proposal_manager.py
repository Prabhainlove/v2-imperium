from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import uuid4

from ...modules.agent_invocation import ImperiumAgentInvoker
from .message_protocol import CouncilMessageProtocol


@dataclass(slots=True)
class StrategyProposal:
    proposal_id: str
    agent: str
    strategy_name: str
    strategy_description: str
    estimated_success_probability: float
    required_resources: float
    expected_execution_time: float
    risk_level: float
    confidence: float
    evidence: list[str]
    source: str


class ProposalManager:
    """Collects council strategy proposals from available agents."""

    def __init__(
        self,
        *,
        protocol: CouncilMessageProtocol,
        invoker: ImperiumAgentInvoker,
    ) -> None:
        self.protocol = protocol
        self.invoker = invoker

    async def collect_proposals(
        self,
        *,
        task_id: str,
        goal: str,
        strategy_options: list[dict[str, Any]],
        participants: list[str],
        external_clients: dict[str, Any],
        timeout_seconds: int,
    ) -> list[StrategyProposal]:
        proposals: list[StrategyProposal] = []

        for participant in participants:
            self.protocol.send(
                receiver=participant,
                task_id=task_id,
                message_type="strategy_proposal",
                content=f"Propose a strategy for task: {goal}",
                confidence=0.6,
                metadata={
                    "phase": "proposal",
                    "strategy_options": strategy_options,
                },
            )

            invocation = await self.invoker.invoke(
                requested_agent=participant,
                capability="workflow",
                payload={
                    "task_id": task_id,
                    "step_id": "COUNCIL",
                    "message_type": "strategy_proposal",
                    "goal": goal,
                    "strategy_options": strategy_options,
                },
                external_clients=external_clients,
                timeout_seconds=max(1, timeout_seconds),
            )

            proposal = self._parse_or_fallback(
                participant=participant,
                invocation_payload=invocation.result,
                strategy_options=strategy_options,
                invocation_status=invocation.status,
                invocation_error=invocation.error,
            )
            proposals.append(proposal)

            self.protocol.send(
                receiver="AgentCouncil",
                task_id=task_id,
                message_type="strategy_proposal",
                content=proposal.strategy_description,
                confidence=proposal.confidence,
                sender=participant,
                metadata={
                    "proposal_id": proposal.proposal_id,
                    "strategy_name": proposal.strategy_name,
                    "source": proposal.source,
                    "invocation_error": invocation.error,
                },
            )

            for evidence in proposal.evidence:
                self.protocol.send(
                    receiver="AgentCouncil",
                    task_id=task_id,
                    message_type="evidence_submission",
                    content=evidence,
                    confidence=proposal.confidence,
                    sender=participant,
                    metadata={"proposal_id": proposal.proposal_id},
                )

        return proposals

    def _parse_or_fallback(
        self,
        *,
        participant: str,
        invocation_payload: dict[str, Any],
        strategy_options: list[dict[str, Any]],
        invocation_status: str,
        invocation_error: str | None,
    ) -> StrategyProposal:
        payload = invocation_payload if isinstance(invocation_payload, dict) else {}

        strategy_name = self._extract_strategy_name(payload, strategy_options)
        selected_option = self._find_option(strategy_name, strategy_options)

        description = str(
            payload.get("strategy_description")
            or payload.get("proposal")
            or payload.get("message")
            or self._fallback_description(participant)
        ).strip()

        success_probability = self._clamp_float(
            payload.get("estimated_success_probability", selected_option.get("estimated_success_probability", 0.7)),
            default=0.7,
        )
        required_resources = self._clamp_float(
            payload.get("required_resources", selected_option.get("required_resources", 0.5)),
            default=0.5,
        )
        expected_execution_time = max(
            0.1,
            float(payload.get("expected_execution_time", selected_option.get("expected_execution_time", 5.0)) or 5.0),
        )
        risk_level = self._clamp_float(
            payload.get("risk_level", selected_option.get("risk_level", 0.4)),
            default=0.4,
        )

        confidence = self._clamp_float(
            payload.get("confidence", 0.75 if invocation_status == "completed" else 0.55),
            default=0.6,
        )

        evidence_raw = payload.get("evidence", [])
        evidence: list[str] = []
        if isinstance(evidence_raw, list):
            evidence = [str(item).strip() for item in evidence_raw if str(item).strip()]
        if not evidence:
            evidence = [
                f"{participant} rationale: {description}",
            ]
        if invocation_error:
            evidence.append(f"Invocation note: {invocation_error}")

        source = "agent_response" if invocation_status == "completed" else "fallback"

        return StrategyProposal(
            proposal_id=f"PRO{uuid4().hex[:8]}",
            agent=participant,
            strategy_name=strategy_name,
            strategy_description=description,
            estimated_success_probability=success_probability,
            required_resources=required_resources,
            expected_execution_time=round(expected_execution_time, 4),
            risk_level=risk_level,
            confidence=confidence,
            evidence=evidence,
            source=source,
        )

    def _extract_strategy_name(self, payload: dict[str, Any], options: list[dict[str, Any]]) -> str:
        candidate = str(
            payload.get("strategy_name")
            or payload.get("preferred_strategy")
            or payload.get("strategy")
            or ""
        ).strip().upper()

        labels = {str(option.get("label", "")).strip().upper() for option in options}
        if candidate in labels:
            return candidate

        if options:
            return str(options[0].get("label", "A")).strip().upper() or "A"
        return "A"

    def _find_option(self, strategy_name: str, options: list[dict[str, Any]]) -> dict[str, Any]:
        target = strategy_name.strip().upper()
        for option in options:
            if str(option.get("label", "")).strip().upper() == target:
                return option
        return {}

    def _fallback_description(self, participant: str) -> str:
        name = participant.strip().lower()
        if "research" in name:
            return "Collect research sources and constraints before implementation."
        if "coding" in name:
            return "Implement rapidly with iterative validation checkpoints."
        if "automation" in name:
            return "Automate data gathering, testing, and deployment workflow."
        return "Use a balanced strategy with staged execution and validation."

    def _clamp_float(self, value: Any, *, default: float) -> float:
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            numeric = default
        return round(max(0.0, min(1.0, numeric)), 4)
