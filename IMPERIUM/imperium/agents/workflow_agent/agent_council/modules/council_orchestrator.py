from __future__ import annotations

from dataclasses import asdict
from time import perf_counter
from typing import Any
from uuid import uuid4

from ...modules.agent_invocation import ImperiumAgentInvoker
from .critique_engine import CritiqueEngine
from .decision_engine import DecisionEngine
from .message_protocol import CouncilMessageProtocol
from .proposal_manager import ProposalManager, StrategyProposal
from .strategy_evaluator import StrategyEvaluator


class AgentCouncil:
    """End-to-end multi-agent strategy meeting orchestrator for IMPERIUM."""

    def __init__(
        self,
        *,
        invoker: ImperiumAgentInvoker,
        protocol: CouncilMessageProtocol | None = None,
    ) -> None:
        self.protocol = protocol or CouncilMessageProtocol(sender="AgentCouncil")
        self.invoker = invoker
        self.proposal_manager = ProposalManager(protocol=self.protocol, invoker=self.invoker)
        self.critique_engine = CritiqueEngine(protocol=self.protocol, invoker=self.invoker)
        self.strategy_evaluator = StrategyEvaluator()
        self.decision_engine = DecisionEngine(protocol=self.protocol, invoker=self.invoker)

    async def conduct_council_meeting(self, task: dict[str, Any]) -> dict[str, Any]:
        """Run proposal -> critique -> evaluate -> vote -> final decision phases."""
        start = perf_counter()
        self.protocol.clear()

        if not isinstance(task, dict):
            return {
                "chosen_strategy": "",
                "reasoning_summary": "Council meeting failed: task payload must be a dictionary.",
                "confidence": 0.0,
                "messages": [],
            }

        task_id = str(task.get("task_id") or uuid4())
        goal = str(task.get("goal") or task.get("objective") or "Resolve task objective").strip()

        participants = self._participants(task)
        strategy_options = self._strategy_options(task)
        external_clients = task.get("external_clients", {})
        if not isinstance(external_clients, dict):
            external_clients = {}

        timeout_seconds = int(task.get("timeout_seconds", 30) or 30)
        timeout_seconds = max(5, timeout_seconds)

        proposals = await self.proposal_manager.collect_proposals(
            task_id=task_id,
            goal=goal,
            strategy_options=strategy_options,
            participants=participants,
            external_clients=external_clients,
            timeout_seconds=timeout_seconds,
        )

        critiques = await self.critique_engine.collect_critiques(
            task_id=task_id,
            goal=goal,
            proposals=proposals,
            participants=participants,
            external_clients=external_clients,
            timeout_seconds=timeout_seconds,
        )

        evaluated = self.strategy_evaluator.evaluate(
            proposals=proposals,
            critiques=critiques,
        )

        decision = await self.decision_engine.decide(
            task_id=task_id,
            goal=goal,
            evaluated=evaluated,
            participants=participants,
            external_clients=external_clients,
            timeout_seconds=timeout_seconds,
        )

        elapsed = round(perf_counter() - start, 4)
        return {
            "task_id": task_id,
            "chosen_strategy": decision.get("chosen_strategy", ""),
            "chosen_strategy_label": decision.get("chosen_strategy_label"),
            "reasoning_summary": decision.get("reasoning_summary", ""),
            "confidence": decision.get("confidence", 0.0),
            "participants": participants,
            "proposals": [self._serialize_proposal(item) for item in proposals],
            "critiques": [asdict(item) for item in critiques],
            "evaluated_strategies": [asdict(item) for item in evaluated],
            "votes": decision.get("votes", []),
            "ranked_scores": decision.get("ranked_scores", []),
            "messages": self.protocol.messages(),
            "execution_seconds": elapsed,
            "decision_authority": "ImperiumHead",
        }

    def _participants(self, task: dict[str, Any]) -> list[str]:
        raw = task.get("participants")
        if isinstance(raw, list):
            normalized = [str(item).strip() for item in raw if str(item).strip()]
            if normalized:
                return self._dedupe(normalized)

        return ["ResearchAgent", "CodingAgent", "AutomationAgent"]

    def _strategy_options(self, task: dict[str, Any]) -> list[dict[str, Any]]:
        raw = task.get("strategy_options")
        options: list[dict[str, Any]] = []

        if isinstance(raw, list):
            for item in raw:
                if not isinstance(item, dict):
                    continue
                options.append(
                    {
                        "label": str(item.get("label", item.get("strategy_name", "A"))).strip().upper(),
                        "strategy_name": str(item.get("strategy_name", item.get("label", "A"))).strip().upper(),
                        "description": str(item.get("description", item.get("strategy_description", ""))).strip(),
                        "estimated_success_probability": self._clamp_float(
                            item.get("estimated_success_probability", item.get("success_probability", 0.75)),
                            default=0.75,
                        ),
                        "required_resources": self._clamp_float(
                            item.get("required_resources", item.get("resource_usage", 0.5)),
                            default=0.5,
                        ),
                        "expected_execution_time": max(
                            0.1,
                            float(item.get("expected_execution_time", item.get("estimated_time_cost", 5.0)) or 5.0),
                        ),
                        "risk_level": self._clamp_float(item.get("risk_level", 0.4), default=0.4),
                    }
                )

        if options:
            return options

        return [
            {
                "label": "A",
                "strategy_name": "A",
                "description": "Research -> Code -> Test -> Deploy",
                "estimated_success_probability": 0.82,
                "required_resources": 0.55,
                "expected_execution_time": 6.0,
                "risk_level": 0.28,
            },
            {
                "label": "B",
                "strategy_name": "B",
                "description": "Code-first sprint with deferred validation",
                "estimated_success_probability": 0.74,
                "required_resources": 0.48,
                "expected_execution_time": 4.8,
                "risk_level": 0.42,
            },
            {
                "label": "C",
                "strategy_name": "C",
                "description": "Automated discovery and iterative implementation",
                "estimated_success_probability": 0.78,
                "required_resources": 0.52,
                "expected_execution_time": 5.2,
                "risk_level": 0.34,
            },
        ]

    def _serialize_proposal(self, proposal: StrategyProposal) -> dict[str, Any]:
        return {
            "proposal_id": proposal.proposal_id,
            "agent": proposal.agent,
            "strategy_name": proposal.strategy_name,
            "strategy_description": proposal.strategy_description,
            "estimated_success_probability": proposal.estimated_success_probability,
            "required_resources": proposal.required_resources,
            "expected_execution_time": proposal.expected_execution_time,
            "risk_level": proposal.risk_level,
            "confidence": proposal.confidence,
            "evidence": list(proposal.evidence),
            "source": proposal.source,
        }

    def _clamp_float(self, value: Any, *, default: float) -> float:
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            numeric = default
        return round(max(0.0, min(1.0, numeric)), 4)

    def _dedupe(self, values: list[str]) -> list[str]:
        deduped: list[str] = []
        seen: set[str] = set()
        for value in values:
            key = value.strip().lower()
            if not key or key in seen:
                continue
            seen.add(key)
            deduped.append(value.strip())
        return deduped
