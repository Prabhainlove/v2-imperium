from __future__ import annotations

from dataclasses import dataclass

from ..models import WorkflowStep


@dataclass(slots=True)
class WorkflowOptimizationEngine:
    """Optimizes workflow structure, execution order, and post-run recommendations."""

    def optimize_steps(self, steps: list[WorkflowStep]) -> tuple[list[WorkflowStep], list[str]]:
        notes: list[str] = []
        if not steps:
            return [], notes

        deduped: list[WorkflowStep] = []
        seen_signatures: set[str] = set()
        for step in steps:
            signature = f"{step.title.strip().lower()}::{step.objective.strip().lower()}"
            if signature in seen_signatures:
                notes.append(f"Removed duplicate step: {step.step_id} ({step.title})")
                continue
            seen_signatures.add(signature)
            deduped.append(step)

        self._normalize_dependencies(deduped)
        notes.extend(self._improve_parallelism(deduped))

        return deduped, notes

    def post_execution_recommendations(self, steps: list[WorkflowStep]) -> list[str]:
        recommendations: list[str] = []
        failed_steps = [step for step in steps if step.status == "failed"]
        high_retry_steps = [step for step in steps if step.retries > 0]

        if failed_steps:
            recommendations.append(
                "Increase validation depth before critical execution transitions"
            )
        if high_retry_steps:
            recommendations.append(
                "Introduce stronger pre-flight checks on frequently retried steps"
            )

        completed_parallel = sum(1 for step in steps if step.parallelizable and step.status == "completed")
        if completed_parallel >= 2:
            recommendations.append(
                "Parallel branch execution improved throughput; preserve this optimization"
            )

        if not recommendations:
            recommendations.append("Workflow was efficient; maintain current strategy template")

        return recommendations

    def _normalize_dependencies(self, steps: list[WorkflowStep]) -> None:
        for index, step in enumerate(steps):
            if index == 0:
                step.dependencies = []
                continue
            if not step.dependencies:
                step.dependencies = [steps[index - 1].step_id]

    def _improve_parallelism(self, steps: list[WorkflowStep]) -> list[str]:
        notes: list[str] = []
        if len(steps) < 5:
            return notes

        # Create an early parallel branch when safe: S2 and S3 run after S1,
        # then S4 waits for both.
        step_1 = steps[0]
        step_2 = steps[1]
        step_3 = steps[2]
        step_4 = steps[3]

        if step_2.status == "pending" and step_3.status == "pending":
            step_2.dependencies = [step_1.step_id]
            step_3.dependencies = [step_1.step_id]
            step_2.parallelizable = True
            step_3.parallelizable = True
            step_4.dependencies = [step_2.step_id, step_3.step_id]
            notes.append(
                "Optimized plan for parallel execution on early discovery and design steps"
            )

        return notes
