from __future__ import annotations

from dataclasses import dataclass

from ..models import RecoveryDecision, WorkflowStep


@dataclass(slots=True)
class FailureRecoverySystem:
    """Determines retry, reassign, or termination actions after step failure."""

    retry_limit: int = 2

    def decide(
        self,
        *,
        step: WorkflowStep,
        error: str | None,
        available_agents: list[str],
    ) -> RecoveryDecision:
        if step.retries < self.retry_limit:
            return RecoveryDecision(
                action="retry",
                reason=f"Retrying step {step.step_id} after failure: {error or 'unknown error'}",
            )

        alternative = self._find_alternative_agent(step.assigned_agent, available_agents)
        if alternative is not None:
            return RecoveryDecision(
                action="reassign",
                reason=f"Retry limit reached; reassigning step {step.step_id} to {alternative}",
                new_agent=alternative,
            )

        if step.critical:
            return RecoveryDecision(
                action="abort",
                reason=f"Critical step {step.step_id} failed after retries; safe termination engaged",
            )

        return RecoveryDecision(
            action="skip",
            reason=f"Non-critical step {step.step_id} skipped after repeated failures",
        )

    def _find_alternative_agent(
        self,
        current_agent: str | None,
        available_agents: list[str],
    ) -> str | None:
        normalized_current = (current_agent or "").strip().lower()
        for agent in available_agents:
            normalized = agent.strip().lower()
            if not normalized:
                continue
            if normalized == normalized_current:
                continue
            return agent
        return None
