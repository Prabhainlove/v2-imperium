from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Awaitable, Callable

from ..models import StepDispatchResult, WorkflowStep


DispatchCallable = Callable[[WorkflowStep, int], Awaitable[StepDispatchResult]]


@dataclass(slots=True)
class ParallelWorkflowExecution:
    """Finds dependency-ready steps and executes eligible work in parallel."""

    def find_ready_steps(self, steps: list[WorkflowStep]) -> list[WorkflowStep]:
        step_map = {step.step_id: step for step in steps}
        ready: list[WorkflowStep] = []

        for step in steps:
            if step.status != "pending":
                continue
            if self._dependencies_met(step, step_map):
                ready.append(step)

        return ready

    def select_parallel_batch(
        self,
        ready_steps: list[WorkflowStep],
        *,
        max_parallel_steps: int,
    ) -> list[WorkflowStep]:
        if not ready_steps:
            return []

        parallel_candidates = [step for step in ready_steps if step.parallelizable]
        serial_candidates = [step for step in ready_steps if not step.parallelizable]

        batch: list[WorkflowStep] = []
        while parallel_candidates and len(batch) < max_parallel_steps:
            batch.append(parallel_candidates.pop(0))

        if not batch and serial_candidates:
            batch.append(serial_candidates[0])

        if not batch and ready_steps:
            batch.append(ready_steps[0])

        return batch

    async def execute_batch(
        self,
        batch: list[WorkflowStep],
        *,
        dispatch: DispatchCallable,
        step_number_lookup: dict[str, int],
    ) -> list[StepDispatchResult]:
        coroutines = [
            dispatch(step, step_number_lookup.get(step.step_id, 0))
            for step in batch
        ]
        if not coroutines:
            return []
        return await asyncio.gather(*coroutines)

    def _dependencies_met(
        self,
        step: WorkflowStep,
        step_map: dict[str, WorkflowStep],
    ) -> bool:
        for dependency in step.dependencies:
            dependency_step = step_map.get(dependency)
            if dependency_step is None:
                return False
            if dependency_step.status not in {"completed", "skipped"}:
                return False
        return True
