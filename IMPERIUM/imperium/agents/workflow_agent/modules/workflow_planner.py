from __future__ import annotations

from dataclasses import dataclass

from ..models import TaskAnalysis, WorkflowStep


@dataclass(slots=True)
class TaskDecompositionEngine:
    """Builds structured workflow steps from a high-level task analysis."""

    min_steps_ahead: int = 10

    def decompose(self, analysis: TaskAnalysis) -> list[WorkflowStep]:
        base_steps = self._template_for_domain(analysis.domain)
        if len(base_steps) < self.min_steps_ahead:
            base_steps.extend(self._build_contingency_steps(self.min_steps_ahead - len(base_steps)))

        return self._to_workflow_steps(base_steps, analysis)

    def _template_for_domain(self, domain: str) -> list[tuple[str, str, str, bool, bool]]:
        if domain in {"software_engineering", "workflow_orchestration"}:
            return [
                ("Analyze objective", "Interpret goal, constraints, and acceptance criteria", "research", False, True),
                ("Research dependencies", "Identify APIs, libraries, and technical prerequisites", "research", True, False),
                ("Design architecture", "Define components, interfaces, and execution boundaries", "coding", True, True),
                ("Draft implementation plan", "Create implementation-ready work breakdown", "workflow", False, True),
                ("Generate baseline modules", "Implement foundational code and scaffolding", "coding", True, True),
                ("Configure execution automation", "Set up runtime environment and automation scripts", "automation", True, False),
                ("Run validation checks", "Execute tests, linting, and static analysis", "testing", True, True),
                ("Recover failures", "Debug and patch runtime or test failures", "coding", True, False),
                ("Deploy or stage workflow", "Release to target environment or staged simulation", "automation", False, True),
                ("Monitor and optimize", "Track performance and optimize bottlenecks", "automation", False, True),
                ("Document execution memory", "Store lessons learned and strategy outcomes", "workflow", False, False),
                ("Prepare next-iteration roadmap", "Predict subsequent milestones and future work", "workflow", False, False),
            ]

        return [
            ("Analyze objective", "Interpret mission intent and constraints", "research", False, True),
            ("Collect contextual information", "Gather missing context and assumptions", "research", True, False),
            ("Design execution strategy", "Create actionable strategy variants", "workflow", False, True),
            ("Assign specialist execution", "Allocate work to best-fit agents", "workflow", True, True),
            ("Execute core tasks", "Run primary execution sequence", "automation", True, True),
            ("Validate outputs", "Perform quality and safety validation", "testing", True, True),
            ("Recover and adapt", "Handle errors and adjust approach", "workflow", False, False),
            ("Consolidate results", "Aggregate completed results", "workflow", False, True),
            ("Monitor impact", "Track outcomes and quality indicators", "automation", False, False),
            ("Optimize plan", "Reduce cost and improve reliability", "workflow", False, False),
        ]

    def _build_contingency_steps(self, count: int) -> list[tuple[str, str, str, bool, bool]]:
        contingency: list[tuple[str, str, str, bool, bool]] = []
        for index in range(1, count + 1):
            contingency.append(
                (
                    f"Contingency checkpoint {index}",
                    "Execute fallback validation and adjust downstream plan",
                    "workflow",
                    False,
                    False,
                )
            )
        return contingency

    def _to_workflow_steps(
        self,
        raw_steps: list[tuple[str, str, str, bool, bool]],
        analysis: TaskAnalysis,
    ) -> list[WorkflowStep]:
        steps: list[WorkflowStep] = []
        for index, (title, objective, capability, parallelizable, critical) in enumerate(raw_steps, start=1):
            step_id = f"S{index:03d}"
            dependencies: list[str] = []
            if index > 1:
                dependencies.append(f"S{index - 1:03d}")

            estimated_time = 1.0 + (analysis.complexity_score * 1.6)
            if critical:
                estimated_time += 0.8
            if parallelizable:
                estimated_time *= 0.9

            risk_level = min(0.9, 0.15 + (analysis.complexity_score * 0.45) + (0.08 if critical else 0.0))

            steps.append(
                WorkflowStep(
                    step_id=step_id,
                    title=title,
                    objective=objective,
                    required_capability=capability,
                    dependencies=dependencies,
                    parallelizable=parallelizable,
                    critical=critical,
                    estimated_time_cost=round(estimated_time, 3),
                    risk_level=round(risk_level, 3),
                    resource_usage=0.55 if critical else 0.4,
                )
            )

        return steps
