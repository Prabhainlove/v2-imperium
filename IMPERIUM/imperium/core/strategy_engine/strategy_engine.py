from __future__ import annotations

from typing import Any
from uuid import uuid4

from core.common import AgentDescriptor, StrategyPlan
from core.strategy_engine.agent_selector import AgentSelector
from core.strategy_engine.complexity_estimator import ComplexityEstimator
from core.strategy_engine.execution_planner import ExecutionPlanner
from core.strategy_engine.strategy_analyzer import StrategyAnalyzer


class StrategyEngine:
    def __init__(
        self,
        *,
        complexity_estimator: ComplexityEstimator | None = None,
        analyzer: StrategyAnalyzer | None = None,
        selector: AgentSelector | None = None,
        planner: ExecutionPlanner | None = None,
    ) -> None:
        self.complexity_estimator = complexity_estimator or ComplexityEstimator()
        self.analyzer = analyzer or StrategyAnalyzer()
        self.selector = selector or AgentSelector()
        self.planner = planner or ExecutionPlanner()

    def select_strategy(
        self,
        task: dict[str, Any],
        *,
        available_agents: list[AgentDescriptor],
        agent_performance: dict[str, dict[str, float | int]] | None = None,
    ) -> StrategyPlan:
        task_id = str(task.get("task_id") or uuid4())
        complexity_score = self.complexity_estimator.estimate(task)
        analysis = self.analyzer.analyze(task, complexity_score)

        selected_agents = self.selector.select(
            required_capabilities=analysis["required_capabilities"],
            agents=available_agents,
            agent_performance=agent_performance,
            max_agents=4,
            requested_agents=task.get("requested_agents"),
        )

        plan = self.planner.build_plan(
            task_id=task_id,
            selected_agents=selected_agents,
            execution_mode=analysis["execution_mode"],
            required_capabilities=analysis["required_capabilities"],
        )

        plan["requires_council"] = analysis["requires_council"]

        return StrategyPlan(
            strategy_id=str(uuid4()),
            task_id=task_id,
            complexity_score=complexity_score,
            selected_agents=selected_agents,
            execution_mode=analysis["execution_mode"],
            plan=plan,
        )
