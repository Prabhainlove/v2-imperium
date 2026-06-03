from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .models import PlanStep


@dataclass(slots=True)
class TaskPlanner:
    """Builds an implementation plan for autonomous software engineering."""

    def create_plan(self, task: dict[str, Any], architecture: dict[str, Any]) -> list[PlanStep]:
        custom_steps = task.get("steps")
        if isinstance(custom_steps, list) and custom_steps:
            planned = self._from_custom_steps(custom_steps)
            if planned:
                return planned

        query = str(task.get("query", "")).strip()
        plan = [
            PlanStep(
                step_id="step_1_repository_analysis",
                title="Analyze Repository",
                objective="Map repository structure and identify impacted modules",
                subsystem="Task Planner",
                metadata={"query": query},
            ),
            PlanStep(
                step_id="step_2_architecture",
                title="Architect Solution",
                objective="Define module boundaries, interfaces, and dependencies",
                subsystem="Code Architect",
                metadata={"architecture_summary": architecture.get("architecture", {})},
            ),
            PlanStep(
                step_id="step_3_generate_or_modify",
                title="Generate or Modify Code",
                objective="Implement requested changes across the target files",
                subsystem="Code Generator",
            ),
            PlanStep(
                step_id="step_4_static_analysis",
                title="Run Static Analysis",
                objective="Detect syntax, quality, security, and performance issues",
                subsystem="Static Analyzer",
            ),
            PlanStep(
                step_id="step_5_sandbox_execution",
                title="Execute in Sandbox",
                objective="Run validation commands and collect runtime diagnostics",
                subsystem="Execution Sandbox",
            ),
            PlanStep(
                step_id="step_6_debug_and_refine",
                title="Debug and Refine",
                objective="Fix failures iteratively until code is stable",
                subsystem="Self-Improvement Loop",
            ),
            PlanStep(
                step_id="step_7_refactor",
                title="Refactor and Optimize",
                objective="Improve maintainability and remove low-value complexity",
                subsystem="Refactor Engine",
            ),
        ]
        return plan

    def _from_custom_steps(self, custom_steps: list[Any]) -> list[PlanStep]:
        planned: list[PlanStep] = []
        for index, raw_step in enumerate(custom_steps, start=1):
            if not isinstance(raw_step, dict):
                continue
            title = str(raw_step.get("title", f"Custom Step {index}")).strip()
            objective = str(raw_step.get("objective", title)).strip()
            subsystem = str(raw_step.get("subsystem", "Code Generator")).strip()
            step_id = str(raw_step.get("step_id", f"custom_step_{index}")).strip()
            metadata = raw_step.get("metadata", {})
            if not isinstance(metadata, dict):
                metadata = {}
            planned.append(
                PlanStep(
                    step_id=step_id,
                    title=title,
                    objective=objective,
                    subsystem=subsystem,
                    metadata=metadata,
                )
            )
        return planned
