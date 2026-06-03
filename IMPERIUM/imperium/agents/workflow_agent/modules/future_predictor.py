from __future__ import annotations

from dataclasses import dataclass

from ..models import FuturePrediction, WorkflowStep, WorkflowStrategy


@dataclass(slots=True)
class FuturePredictionEngine:
    """Predicts at least 10 steps ahead and simulates likely outcomes."""

    min_horizon: int = 10

    def predict(self, strategy: WorkflowStrategy, horizon: int | None = None) -> FuturePrediction:
        horizon_size = max(self.min_horizon, horizon or self.min_horizon)
        actions = [
            f"{step.step_id}: {step.title}"
            for step in strategy.steps[:horizon_size]
        ]

        while len(actions) < horizon_size:
            actions.append(f"F{len(actions) + 1:03d}: Future contingency and optimization cycle")

        branches = [
            {
                "name": "optimistic",
                "expected_completion_time": round(strategy.estimated_time_cost * 0.82, 3),
                "failure_probability": round(max(0.01, strategy.risk_level * 0.45), 4),
                "summary": "Parallel execution succeeds with minimal rework",
            },
            {
                "name": "realistic",
                "expected_completion_time": round(strategy.estimated_time_cost * 1.0, 3),
                "failure_probability": round(max(0.02, strategy.risk_level * 0.75), 4),
                "summary": "Moderate retries required on validation and integration steps",
            },
            {
                "name": "pessimistic",
                "expected_completion_time": round(strategy.estimated_time_cost * 1.42, 3),
                "failure_probability": round(max(0.08, strategy.risk_level * 1.15), 4),
                "summary": "Critical path failure triggers recovery and re-dispatch",
            },
        ]

        confidence = max(0.2, min(0.95, strategy.success_probability - (strategy.risk_level * 0.2)))

        return FuturePrediction(
            actions=actions,
            branches=branches,
            confidence=round(confidence, 4),
        )

    def simulate_outcomes(
        self,
        strategy: WorkflowStrategy,
    ) -> dict[str, float | str]:
        steps = strategy.steps
        critical_steps = sum(1 for step in steps if step.critical)
        parallel_steps = sum(1 for step in steps if step.parallelizable)

        bottleneck_risk = min(1.0, (critical_steps / max(1, len(steps))) + (strategy.risk_level * 0.5))
        recovery_pressure = min(1.0, bottleneck_risk * 0.7 + (parallel_steps / max(1, len(steps))) * 0.2)

        throughput_index = max(0.05, 1.0 - (strategy.estimated_time_cost / 100.0) + (parallel_steps * 0.02))

        return {
            "expected_completion_ratio": round(strategy.success_probability, 4),
            "throughput_index": round(min(1.0, throughput_index), 4),
            "bottleneck_risk": round(bottleneck_risk, 4),
            "recovery_pressure": round(recovery_pressure, 4),
            "dominant_execution_mode": self._execution_mode(steps),
        }

    def _execution_mode(self, steps: list[WorkflowStep]) -> str:
        if not steps:
            return "idle"
        parallel_count = sum(1 for step in steps if step.parallelizable)
        if parallel_count >= len(steps) * 0.5:
            return "parallel-heavy"
        if parallel_count >= len(steps) * 0.25:
            return "hybrid"
        return "sequential-heavy"
