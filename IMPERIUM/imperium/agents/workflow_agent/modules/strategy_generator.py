from __future__ import annotations

import copy
from dataclasses import dataclass

from ..models import StrategyLabel, TaskAnalysis, WorkflowStep, WorkflowStrategy


@dataclass(slots=True)
class MultiStrategyPlanningEngine:
    """Creates and scores multiple workflow strategies for the same task."""

    def generate_strategies(
        self,
        analysis: TaskAnalysis,
        base_steps: list[WorkflowStep],
        memory_hint: str | None = None,
    ) -> list[WorkflowStrategy]:
        strategies = [
            self._build_strategy_a(base_steps, analysis),
            self._build_strategy_b(base_steps, analysis),
            self._build_strategy_c(base_steps, analysis),
        ]

        if memory_hint in {"A", "B", "C"}:
            strategies.append(self._build_memory_strategy(base_steps, analysis, memory_hint))

        for strategy in strategies:
            strategy.score = self._score_strategy(strategy)

        strategies.sort(key=lambda item: item.score, reverse=True)
        return strategies

    def select_best_strategy(self, strategies: list[WorkflowStrategy]) -> WorkflowStrategy:
        if not strategies:
            raise ValueError("No strategies available for selection")
        return max(strategies, key=lambda item: item.score)

    def _build_strategy_a(
        self,
        base_steps: list[WorkflowStep],
        analysis: TaskAnalysis,
    ) -> WorkflowStrategy:
        steps = self._clone_steps(base_steps)
        for step in steps:
            if step.parallelizable:
                step.resource_usage = min(1.0, step.resource_usage + 0.2)
            step.estimated_time_cost = round(step.estimated_time_cost * 0.86, 3)
            step.risk_level = round(min(1.0, step.risk_level + 0.12), 3)

        return self._build_strategy(
            strategy_id="STRAT_A",
            label="A",
            description="Fast execution with aggressive parallelism and higher risk profile",
            steps=steps,
            rationale=[
                "Prioritizes delivery speed",
                "Maximizes concurrent execution where possible",
                "Accepts elevated failure probability for faster cycle time",
            ],
            analysis=analysis,
        )

    def _build_strategy_b(
        self,
        base_steps: list[WorkflowStep],
        analysis: TaskAnalysis,
    ) -> WorkflowStrategy:
        steps = self._clone_steps(base_steps)
        for step in steps:
            step.parallelizable = False if step.critical else step.parallelizable
            step.estimated_time_cost = round(step.estimated_time_cost * 1.18, 3)
            step.risk_level = round(max(0.05, step.risk_level - 0.18), 3)
            step.resource_usage = round(max(0.2, step.resource_usage - 0.12), 3)

        return self._build_strategy(
            strategy_id="STRAT_B",
            label="B",
            description="Reliability-first sequencing with conservative risk management",
            steps=steps,
            rationale=[
                "Optimizes for success probability",
                "Reduces parallel contention",
                "Adds deliberate validation pacing",
            ],
            analysis=analysis,
        )

    def _build_strategy_c(
        self,
        base_steps: list[WorkflowStep],
        analysis: TaskAnalysis,
    ) -> WorkflowStrategy:
        steps = self._clone_steps(base_steps)
        for index, step in enumerate(steps, start=1):
            if step.parallelizable and index % 2 == 0:
                step.resource_usage = round(min(1.0, step.resource_usage + 0.08), 3)
                step.risk_level = round(min(1.0, step.risk_level + 0.05), 3)
                step.estimated_time_cost = round(step.estimated_time_cost * 0.92, 3)
            else:
                step.risk_level = round(max(0.05, step.risk_level - 0.06), 3)

        return self._build_strategy(
            strategy_id="STRAT_C",
            label="C",
            description="Hybrid balance between execution speed and reliability",
            steps=steps,
            rationale=[
                "Balances throughput and reliability",
                "Uses selective parallel execution",
                "Maintains resilience under moderate uncertainty",
            ],
            analysis=analysis,
        )

    def _build_memory_strategy(
        self,
        base_steps: list[WorkflowStep],
        analysis: TaskAnalysis,
        memory_hint: str,
    ) -> WorkflowStrategy:
        selector = {
            "A": self._build_strategy_a,
            "B": self._build_strategy_b,
            "C": self._build_strategy_c,
        }[memory_hint]
        strategy = selector(base_steps, analysis)
        strategy.strategy_id = "STRAT_MEMORY"
        strategy.label = "MEMORY"
        strategy.description = (
            f"Memory-primed strategy based on prior successful pattern ({memory_hint})"
        )
        strategy.rationale.append("Prior workflow memory suggested this execution pattern")
        strategy.success_probability = round(min(0.99, strategy.success_probability + 0.04), 4)
        strategy.score = self._score_strategy(strategy)
        return strategy

    def _build_strategy(
        self,
        *,
        strategy_id: str,
        label: StrategyLabel,
        description: str,
        steps: list[WorkflowStep],
        rationale: list[str],
        analysis: TaskAnalysis,
    ) -> WorkflowStrategy:
        estimated_time = round(sum(step.estimated_time_cost for step in steps), 4)
        risk_level = round(sum(step.risk_level for step in steps) / max(1, len(steps)), 4)
        resource_usage = round(sum(step.resource_usage for step in steps) / max(1, len(steps)), 4)

        success_probability = 1.0 - (risk_level * 0.55) + (0.1 * (1 - analysis.complexity_score))
        success_probability = round(max(0.05, min(success_probability, 0.99)), 4)

        return WorkflowStrategy(
            strategy_id=strategy_id,
            label=label,
            description=description,
            steps=steps,
            estimated_time_cost=estimated_time,
            risk_level=risk_level,
            resource_usage=resource_usage,
            success_probability=success_probability,
            rationale=rationale,
        )

    def _score_strategy(self, strategy: WorkflowStrategy) -> float:
        time_factor = max(0.0, 1.0 - (strategy.estimated_time_cost / 60.0))
        risk_factor = max(0.0, 1.0 - strategy.risk_level)
        resource_factor = max(0.0, 1.0 - strategy.resource_usage)

        score = (
            (strategy.success_probability * 0.45)
            + (risk_factor * 0.22)
            + (time_factor * 0.2)
            + (resource_factor * 0.13)
        )
        return round(score, 6)

    def _clone_steps(self, steps: list[WorkflowStep]) -> list[WorkflowStep]:
        return [copy.deepcopy(step) for step in steps]
