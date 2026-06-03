from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path
from time import perf_counter
from typing import Any, Callable
from uuid import uuid4

from .models import (
    ExecutionEvent,
    ExecutionLimits,
    StepDispatchResult,
    WorkflowStep,
    WorkflowTask,
    utc_now_iso,
)
from .agent_council import AgentCouncil
from .modules.agent_dispatcher import AgentAssignmentSystem
from .modules.agent_invocation import ImperiumAgentInvoker
from .modules.communication_protocol import AgentCommunicationProtocol
from .modules.event_emitter import WorkflowEventEmitter
from .modules.failure_recovery import FailureRecoverySystem
from .modules.future_predictor import FuturePredictionEngine
from .modules.memory_manager import LongTermWorkflowMemory
from .modules.parallel_executor import ParallelWorkflowExecution
from .modules.progress_tracker import ExecutionMonitoringSystem
from .modules.strategy_generator import MultiStrategyPlanningEngine
from .modules.task_analyzer import TaskAnalyzer
from .modules.task_state_manager import WorkflowTaskStateManager
from .modules.workflow_optimizer import WorkflowOptimizationEngine
from .modules.workflow_planner import TaskDecompositionEngine


@dataclass(slots=True)
class WorkflowAgentConfig:
    """Runtime configuration for the Imperium Workflow Agent."""

    execution_limits: ExecutionLimits = field(default_factory=ExecutionLimits)
    memory_file: Path | None = None
    enable_council_default: bool = False
    message_sender: str = "WorkflowAgent"


class ImperiumWorkflowAgent:
    """SuperAGI-powered workflow orchestrator for IMPERIUM AOS."""

    def __init__(
        self,
        workspace_root: str | Path | None = None,
        config: WorkflowAgentConfig | None = None,
        agent_clients: dict[str, Any] | None = None,
    ) -> None:
        self.workspace_root = (
            Path(workspace_root).resolve()
            if workspace_root is not None
            else Path(__file__).resolve().parents[3]
        )
        self.config = config or WorkflowAgentConfig()

        memory_file = self.config.memory_file
        if memory_file is None:
            memory_file = (
                self.workspace_root
                / "agents"
                / "superagi"
                / "workflow_agent"
                / "workflow_memory.json"
            )

        self.task_analyzer = TaskAnalyzer()
        self.decomposition_engine = TaskDecompositionEngine()
        self.strategy_engine = MultiStrategyPlanningEngine()
        self.future_prediction = FuturePredictionEngine()
        self.assignment_system = AgentAssignmentSystem()
        self.parallel_execution = ParallelWorkflowExecution()
        self.failure_recovery = FailureRecoverySystem(
            retry_limit=self.config.execution_limits.retry_limit
        )
        self.optimizer = WorkflowOptimizationEngine()
        self.memory = LongTermWorkflowMemory(memory_file=Path(memory_file))

        self.agent_clients: dict[str, Any] = dict(agent_clients or {})

        self.protocol = AgentCommunicationProtocol(sender=self.config.message_sender)
        self.event_emitter = WorkflowEventEmitter()
        self.invoker = ImperiumAgentInvoker(workspace_root=self.workspace_root)
        self.council = AgentCouncil(invoker=self.invoker)

    async def execute(self, task: dict[str, Any]) -> dict[str, Any]:
        """IMPERIUM entrypoint: async execute(task: dict) -> dict."""
        execution_start = perf_counter()
        self.protocol.clear()
        self.event_emitter.clear()

        if not isinstance(task, dict):
            return {
                "status": "failure",
                "error": "Task payload must be a dictionary",
                "error_type": "TypeError",
            }

        workflow_task = self._normalize_task(task)
        limits = self._resolve_limits(task)
        self.failure_recovery.retry_limit = limits.retry_limit

        try:
            analysis = self.task_analyzer.analyze(workflow_task)
            workflow_type = self._workflow_type(task=task, analysis_domain=analysis.domain)

            planned_steps = self.decomposition_engine.decompose(analysis)
            planned_steps, optimization_notes = self.optimizer.optimize_steps(planned_steps)

            if len(planned_steps) > limits.max_steps:
                planned_steps = planned_steps[: limits.max_steps]

            memory_hint = self.memory.suggest_strategy(
                analysis.goal,
                workflow_type=workflow_type,
            )
            strategies = self.strategy_engine.generate_strategies(
                analysis,
                planned_steps,
                memory_hint=memory_hint,
            )

            for strategy in strategies:
                strategy.prediction = self.future_prediction.predict(
                    strategy,
                    horizon=limits.prediction_horizon,
                )
                strategy.simulation = self.future_prediction.simulate_outcomes(strategy)

            explicit_mapping = self._coerce_mapping(
                task.get("agent_mapping")
                or task.get("agent_assignments")
                or task.get("agents")
            )
            for strategy in strategies:
                self.assignment_system.assign_agents(
                    strategy.steps,
                    explicit_mapping=explicit_mapping,
                )

            council_enabled = self._is_council_enabled(task)
            if council_enabled:
                council_report = await self.council.conduct_council_meeting(
                    {
                        "task_id": workflow_task.task_id,
                        "goal": workflow_task.goal,
                        "participants": self._resolve_council_participants(task),
                        "strategy_options": self._build_council_strategy_options(strategies),
                        "external_clients": self.agent_clients,
                        "timeout_seconds": max(
                            15,
                            limits.max_runtime_seconds // max(1, limits.max_steps),
                        ),
                    }
                )
            else:
                council_report = {
                    "task_id": workflow_task.task_id,
                    "chosen_strategy": "",
                    "chosen_strategy_label": None,
                    "reasoning_summary": "Council disabled for this task.",
                    "confidence": 0.0,
                    "participants": [],
                    "proposals": [],
                    "critiques": [],
                    "evaluated_strategies": [],
                    "votes": [],
                    "ranked_scores": [],
                    "messages": [],
                    "execution_seconds": 0.0,
                    "decision_authority": "ImperiumHead",
                }

            selected_strategy = self._select_strategy_from_council(
                strategies=strategies,
                council_report=council_report,
            )

            execution = await self._run_strategy(
                task=workflow_task,
                steps=selected_strategy.steps,
                limits=limits,
            )

            duration_seconds = perf_counter() - execution_start
            recommendations = self.optimizer.post_execution_recommendations(
                selected_strategy.steps
            )

            memory_record = self.memory.record(
                task_id=workflow_task.task_id,
                goal=workflow_task.goal,
                selected_strategy=selected_strategy,
                status=execution["status"],
                execution_seconds=duration_seconds,
                metadata={
                    "completed_steps": execution["summary"]["completed_steps"],
                    "failed_steps": execution["summary"]["failed_steps"],
                    "skipped_steps": execution["summary"]["skipped_steps"],
                    "workflow_type": workflow_type,
                },
            )

            success_rate = self._success_rate(execution["summary"])
            strategy_path = self._strategy_path(selected_strategy.steps)
            history_record = self.memory.record_workflow_history(
                task_id=workflow_task.task_id,
                workflow_type=workflow_type,
                best_strategy=strategy_path,
                selected_strategy_label=selected_strategy.label,
                status=execution["status"],
                execution_seconds=duration_seconds,
                success_rate=success_rate,
                metadata={
                    "council_enabled": council_enabled,
                    "council_decision": council_report.get("chosen_strategy_label"),
                    "workflow_graph_nodes": len(selected_strategy.steps),
                },
            )

            workflow_messages = self.protocol.messages()
            council_messages = council_report.get("messages", [])
            combined_messages = list(workflow_messages)
            if isinstance(council_messages, list):
                combined_messages.extend(council_messages)

            return {
                "status": execution["status"],
                "task_id": workflow_task.task_id,
                "goal": workflow_task.goal,
                "workflow_type": workflow_type,
                "analysis": asdict(analysis),
                "selected_strategy": self._strategy_summary(selected_strategy),
                "strategies_evaluated": [
                    self._strategy_summary(strategy)
                    for strategy in strategies
                ],
                "ten_step_forecast": selected_strategy.prediction.actions[:10]
                if selected_strategy.prediction
                else [],
                "future_prediction": asdict(selected_strategy.prediction)
                if selected_strategy.prediction
                else {},
                "simulation": dict(selected_strategy.simulation),
                "execution": execution,
                "optimization": {
                    "planning_notes": optimization_notes,
                    "post_execution_recommendations": recommendations,
                },
                "council": council_report,
                "communication": {
                    "messages": combined_messages,
                    "workflow_messages": workflow_messages,
                    "council_messages": council_messages if isinstance(council_messages, list) else [],
                    "total_messages": len(combined_messages),
                },
                "event_stream": self.event_emitter.events(),
                "visualization": {
                    "workflow_graph": self._build_workflow_graph(selected_strategy.steps),
                },
                "memory": memory_record,
                "workflow_history": history_record,
                "limits": asdict(limits),
                "duration_seconds": round(duration_seconds, 4),
                "capabilities": self.get_capabilities(),
            }

        except Exception as exc:
            messages = self.protocol.messages()
            return {
                "status": "failure",
                "task_id": workflow_task.task_id,
                "goal": workflow_task.goal,
                "error": str(exc),
                "error_type": type(exc).__name__,
                "communication": {
                    "messages": messages,
                    "total_messages": len(messages),
                },
                "event_stream": self.event_emitter.events(),
                "capabilities": self.get_capabilities(),
            }

    async def broadcast(
        self,
        *,
        message_type: str,
        payload: dict[str, Any] | None = None,
        task_id: str | None = None,
        step_id: str = "COUNCIL",
        receivers: list[str] | None = None,
        timeout_seconds: int = 30,
    ) -> list[dict[str, Any]]:
        """Broadcast coordination messages to multiple agents."""
        target_task_id = str(task_id).strip() if task_id else f"broadcast-{uuid4().hex[:8]}"
        target_receivers = receivers or self._available_agents()
        results: list[dict[str, Any]] = []

        for receiver in target_receivers:
            assignment_message = self.protocol.send(
                receiver=receiver,
                task_id=target_task_id,
                step_id=step_id,
                message_type="coordination_message",
                payload={
                    "message_type": str(message_type).strip() or "coordination_message",
                    "payload": dict(payload or {}),
                },
            )

            invocation = await self.invoker.invoke(
                requested_agent=receiver,
                capability="workflow",
                payload={
                    "task_id": target_task_id,
                    "step_id": step_id,
                    "message_type": message_type,
                    "payload": dict(payload or {}),
                },
                external_clients=self.agent_clients,
                timeout_seconds=max(1, timeout_seconds),
            )

            response_type = "result_report" if invocation.status == "completed" else "failure_event"
            response_message = self.protocol.send(
                receiver="WorkflowAgent",
                task_id=target_task_id,
                step_id=step_id,
                message_type=response_type,
                payload={
                    "agent": invocation.agent,
                    "status": invocation.status,
                    "result": dict(invocation.result),
                    "duration_seconds": invocation.duration_seconds,
                    "error": invocation.error,
                },
                sender=invocation.agent,
            )

            results.append(
                {
                    "agent": invocation.agent,
                    "status": invocation.status,
                    "result": dict(invocation.result),
                    "duration_seconds": invocation.duration_seconds,
                    "error": invocation.error,
                    "request_message_id": assignment_message.message_id,
                    "response_message_id": response_message.message_id,
                }
            )

        return results

    async def conduct_council_meeting(self, task: dict[str, Any]) -> dict[str, Any]:
        """Public council interface: async conduct_council_meeting(task: dict) -> dict."""
        payload = dict(task) if isinstance(task, dict) else {}
        payload.setdefault("external_clients", self.agent_clients)
        return await self.council.conduct_council_meeting(payload)

    def register_agent(self, name: str, client: Any) -> None:
        agent_name = str(name).strip()
        if not agent_name:
            raise ValueError("Agent name cannot be empty")
        self.agent_clients[agent_name] = client

    def register_event_listener(self, listener: Callable[[dict[str, Any]], Any]) -> None:
        self.event_emitter.subscribe(listener)

    def get_capabilities(self) -> dict[str, Any]:
        limits = asdict(self.config.execution_limits)
        return {
            "interface": "async execute(task: dict) -> dict",
            "task_decomposition": True,
            "multi_strategy_planning": ["A", "B", "C", "MEMORY"],
            "future_prediction_steps": max(10, limits.get("prediction_horizon", 10)),
            "agent_assignment": ["ResearchAgent", "CodingAgent", "AutomationAgent"],
            "real_agent_invocation": True,
            "communication_protocol": [
                "task_assignment",
                "status_update",
                "result_report",
                "failure_event",
                "coordination_message",
            ],
            "execution_monitoring": True,
            "failure_recovery": ["retry", "reassign", "skip", "abort"],
            "parallel_execution": True,
            "workflow_optimization": True,
            "long_term_memory": True,
            "shared_knowledge_memory": True,
            "event_streaming": True,
            "council_collaboration": True,
            "safety_limits": limits,
        }

    async def _run_strategy(
        self,
        *,
        task: WorkflowTask,
        steps: list[WorkflowStep],
        limits: ExecutionLimits,
    ) -> dict[str, Any]:
        monitor = ExecutionMonitoringSystem()
        state_manager = WorkflowTaskStateManager()
        state_manager.initialize(task_id=task.task_id, steps=steps)

        step_map = {step.step_id: step for step in steps}
        step_order = {step.step_id: index for index, step in enumerate(steps, start=1)}

        dispatch_results: list[StepDispatchResult] = []
        events: list[ExecutionEvent] = []

        started = perf_counter()
        abort_reason: str | None = None

        await self._emit_event(
            events,
            "workflow_started",
            "Workflow execution started",
            {
                "task_id": task.task_id,
                "steps": len(steps),
            },
        )
        monitor.snapshot(task_id=task.task_id, steps=steps, next_step=self._next_step(steps))

        while True:
            if self._all_terminal(steps):
                break

            elapsed = perf_counter() - started
            if elapsed > limits.max_runtime_seconds:
                abort_reason = "Execution aborted: max runtime exceeded"
                await self._emit_event(
                    events,
                    "limit_abort",
                    abort_reason,
                    {
                        "task_id": task.task_id,
                        "max_runtime_seconds": limits.max_runtime_seconds,
                    },
                )
                break

            if len(dispatch_results) >= limits.max_steps:
                abort_reason = "Execution aborted: max step-attempt limit reached"
                await self._emit_event(
                    events,
                    "limit_abort",
                    abort_reason,
                    {
                        "task_id": task.task_id,
                        "max_steps": limits.max_steps,
                    },
                )
                break

            ready_steps = self.parallel_execution.find_ready_steps(steps)
            if not ready_steps:
                skipped = self._skip_unreachable_steps(steps, step_map)
                if skipped > 0:
                    for step in steps:
                        if step.status == "skipped":
                            state_manager.mark_result(step=step, status="skipped", error=step.error)

                    await self._emit_event(
                        events,
                        "blocked_dependency_skip",
                        f"Skipped {skipped} blocked steps due failed or missing dependencies",
                        {"task_id": task.task_id, "skipped_steps": skipped},
                    )
                    monitor.snapshot(
                        task_id=task.task_id,
                        steps=steps,
                        next_step=self._next_step(steps),
                    )
                    continue

                abort_reason = "Execution deadlock detected: no dependency-ready steps"
                await self._emit_event(
                    events,
                    "deadlock_abort",
                    abort_reason,
                    {"task_id": task.task_id},
                )
                break

            batch = self.parallel_execution.select_parallel_batch(
                ready_steps,
                max_parallel_steps=max(1, limits.max_parallel_steps),
            )
            if not batch:
                abort_reason = "Execution aborted: unable to build executable batch"
                await self._emit_event(
                    events,
                    "batch_abort",
                    abort_reason,
                    {"task_id": task.task_id},
                )
                break

            for step in batch:
                state_manager.mark_assigned(step=step)
                await self._emit_event(
                    events,
                    "step_assigned",
                    f"Assigned {step.step_id} to {step.assigned_agent}",
                    {
                        "task_id": task.task_id,
                        "step_id": step.step_id,
                        "agent": step.assigned_agent,
                    },
                )

                step.status = "running"
                step.started_at = utc_now_iso()
                state_manager.mark_running(step=step)

            await self._emit_event(
                events,
                "batch_started",
                "Dispatching execution batch",
                {
                    "task_id": task.task_id,
                    "batch": [step.step_id for step in batch],
                    "max_parallel_steps": limits.max_parallel_steps,
                },
            )

            monitor.snapshot(task_id=task.task_id, steps=steps, next_step=self._next_step(steps))

            async def _dispatch(step: WorkflowStep, step_number: int) -> StepDispatchResult:
                return await self.assignment_system.dispatch_step(
                    task_id=task.task_id,
                    step=step,
                    step_number=step_number,
                    protocol=self.protocol,
                    invoker=self.invoker,
                    agent_clients=self.agent_clients,
                    timeout_seconds=max(
                        15,
                        limits.max_runtime_seconds // max(1, limits.max_steps),
                    ),
                )

            batch_results = await self.parallel_execution.execute_batch(
                batch,
                dispatch=_dispatch,
                step_number_lookup=step_order,
            )

            for result in batch_results:
                dispatch_results.append(result)
                step = step_map.get(result.step_id)
                if step is None:
                    continue

                step.finished_at = result.finished_at
                step.output = dict(result.result)

                duration_seconds = float(step.output.get("duration_seconds", 0.0) or 0.0)
                event_agent = str(step.output.get("agent") or step.assigned_agent or "UnknownAgent")

                if result.status == "completed":
                    step.status = "completed"
                    step.error = None
                    state_manager.mark_result(step=step, status="completed")

                    await self._emit_event(
                        events,
                        "step_completed",
                        f"Completed {step.step_id} ({step.title})",
                        {
                            "task_id": task.task_id,
                            "step_id": step.step_id,
                            "agent": event_agent,
                            "duration": duration_seconds,
                        },
                    )
                    continue

                step.status = "failed"
                step.error = result.error or "Agent execution failed"
                state_manager.mark_result(step=step, status="failed", error=step.error)

                await self._emit_event(
                    events,
                    "step_failed",
                    f"Failed {step.step_id} ({step.title})",
                    {
                        "task_id": task.task_id,
                        "step_id": step.step_id,
                        "agent": event_agent,
                        "duration": duration_seconds,
                        "error": step.error,
                    },
                )

                decision = self.failure_recovery.decide(
                    step=step,
                    error=step.error,
                    available_agents=self._available_agents(),
                )

                if decision.action == "retry":
                    step.retries += 1
                    step.status = "pending"
                    await self._emit_event(
                        events,
                        "step_retry",
                        decision.reason,
                        {
                            "task_id": task.task_id,
                            "step_id": step.step_id,
                            "retries": step.retries,
                        },
                    )
                elif decision.action == "reassign":
                    step.retries += 1
                    if decision.new_agent:
                        step.assigned_agent = decision.new_agent
                    step.status = "pending"
                    await self._emit_event(
                        events,
                        "step_reassigned",
                        decision.reason,
                        {
                            "task_id": task.task_id,
                            "step_id": step.step_id,
                            "new_agent": step.assigned_agent,
                            "retries": step.retries,
                        },
                    )
                elif decision.action == "skip":
                    step.status = "skipped"
                    state_manager.mark_result(step=step, status="skipped", error=step.error)
                    await self._emit_event(
                        events,
                        "step_skipped",
                        decision.reason,
                        {
                            "task_id": task.task_id,
                            "step_id": step.step_id,
                        },
                    )
                else:
                    abort_reason = decision.reason
                    await self._emit_event(
                        events,
                        "recovery_abort",
                        abort_reason,
                        {
                            "task_id": task.task_id,
                            "step_id": step.step_id,
                            "critical": step.critical,
                        },
                    )
                    break

            monitor.snapshot(task_id=task.task_id, steps=steps, next_step=self._next_step(steps))

            if abort_reason:
                break

        if abort_reason:
            self._safe_terminate_remaining(steps, abort_reason)
            for step in steps:
                if step.status in {"skipped", "failed"}:
                    state_manager.mark_result(step=step, status=step.status, error=step.error)

            await self._emit_event(
                events,
                "safe_termination",
                abort_reason,
                {
                    "task_id": task.task_id,
                },
            )

        completed = sum(1 for step in steps if step.status == "completed")
        failed = sum(1 for step in steps if step.status == "failed")
        skipped = sum(1 for step in steps if step.status == "skipped")
        running = sum(1 for step in steps if step.status == "running")
        pending = sum(1 for step in steps if step.status == "pending")

        final_status = self._final_status(
            abort_reason=abort_reason,
            completed=completed,
            failed=failed,
            pending=pending,
            running=running,
        )
        task_state = state_manager.finalize(status=final_status)

        await self._emit_event(
            events,
            "workflow_completed",
            "Workflow execution completed",
            {
                "task_id": task.task_id,
                "status": final_status,
                "completed_steps": completed,
                "failed_steps": failed,
                "skipped_steps": skipped,
                "execution_seconds": round(perf_counter() - started, 4),
            },
        )

        return {
            "status": final_status,
            "summary": {
                "task_id": task.task_id,
                "total_steps": len(steps),
                "completed_steps": completed,
                "failed_steps": failed,
                "skipped_steps": skipped,
                "pending_steps": pending,
                "running_steps": running,
                "abort_reason": abort_reason,
                "execution_seconds": round(perf_counter() - started, 4),
            },
            "steps": [self._step_summary(step) for step in steps],
            "step_results": [asdict(result) for result in dispatch_results],
            "events": [asdict(event) for event in events],
            "progress_summary": monitor.summarize(),
            "snapshots": [asdict(snapshot) for snapshot in monitor.snapshots[-25:]],
            "task_state": task_state,
        }

    def _normalize_task(self, payload: dict[str, Any]) -> WorkflowTask:
        task_id = str(
            payload.get("task_id")
            or payload.get("id")
            or uuid4()
        )

        goal = str(
            payload.get("goal")
            or payload.get("objective")
            or payload.get("query")
            or payload.get("description")
            or "Execute workflow objective"
        ).strip()

        constraints = payload.get("constraints")
        context = payload.get("context")

        return WorkflowTask(
            task_id=task_id,
            goal=goal,
            constraints=constraints if isinstance(constraints, dict) else {},
            context=context if isinstance(context, dict) else {},
        )

    def _resolve_limits(self, payload: dict[str, Any]) -> ExecutionLimits:
        base = asdict(self.config.execution_limits)

        override = payload.get("execution_limits")
        if override is None:
            override = payload.get("limits")

        if isinstance(override, dict):
            for key in [
                "max_steps",
                "max_parallel_steps",
                "retry_limit",
                "max_runtime_seconds",
                "prediction_horizon",
            ]:
                value = override.get(key)
                if isinstance(value, int) and value > 0:
                    base[key] = value

        return ExecutionLimits(**base)

    def _coerce_mapping(self, raw_mapping: Any) -> dict[str, str] | None:
        if not isinstance(raw_mapping, dict):
            return None

        mapping: dict[str, str] = {}
        for key, value in raw_mapping.items():
            if key is None or value is None:
                continue
            capability = str(key).strip().lower()
            agent_name = str(value).strip()
            if not capability or not agent_name:
                continue
            mapping[capability] = agent_name
        return mapping or None

    def _available_agents(self) -> list[str]:
        values = list(self.agent_clients.keys()) + list(
            self.assignment_system.capability_to_agent.values()
        )

        unique: list[str] = []
        seen: set[str] = set()
        for value in values:
            item = str(value).strip()
            if not item:
                continue
            normalized = item.lower()
            if normalized in seen:
                continue
            seen.add(normalized)
            unique.append(item)
        return unique

    async def _emit_event(
        self,
        events: list[ExecutionEvent],
        event_type: str,
        detail: str,
        payload: dict[str, Any],
    ) -> None:
        events.append(
            ExecutionEvent(
                event_type=event_type,
                detail=detail,
                payload=payload,
            )
        )

        await self.event_emitter.emit(
            event_type,
            detail=detail,
            **payload,
        )

    def _all_terminal(self, steps: list[WorkflowStep]) -> bool:
        return all(step.status in {"completed", "failed", "skipped"} for step in steps)

    def _next_step(self, steps: list[WorkflowStep]) -> str | None:
        for step in steps:
            if step.status == "pending":
                return f"{step.step_id}: {step.title}"
        for step in steps:
            if step.status == "running":
                return f"{step.step_id}: {step.title}"
        return None

    def _skip_unreachable_steps(
        self,
        steps: list[WorkflowStep],
        step_map: dict[str, WorkflowStep],
    ) -> int:
        skipped = 0
        for step in steps:
            if step.status != "pending":
                continue

            blocked_reason: str | None = None
            for dependency in step.dependencies:
                dependency_step = step_map.get(dependency)
                if dependency_step is None:
                    blocked_reason = f"Missing dependency {dependency}"
                    break
                if dependency_step.status == "failed":
                    blocked_reason = f"Dependency {dependency} failed"
                    break

            if blocked_reason is None:
                continue

            step.status = "skipped"
            step.finished_at = utc_now_iso()
            step.error = blocked_reason
            skipped += 1

        return skipped

    def _safe_terminate_remaining(self, steps: list[WorkflowStep], reason: str) -> None:
        for step in steps:
            if step.status in {"pending", "running"}:
                step.status = "skipped"
                step.finished_at = utc_now_iso()
                if not step.error:
                    step.error = reason

    def _final_status(
        self,
        *,
        abort_reason: str | None,
        completed: int,
        failed: int,
        pending: int,
        running: int,
    ) -> str:
        if abort_reason:
            return "partial" if completed > 0 else "failure"

        if failed > 0:
            return "partial" if completed > 0 else "failure"

        if pending > 0 or running > 0:
            return "partial"

        return "success"

    def _strategy_summary(self, strategy: Any) -> dict[str, Any]:
        return {
            "strategy_id": strategy.strategy_id,
            "label": strategy.label,
            "description": strategy.description,
            "score": strategy.score,
            "estimated_time_cost": strategy.estimated_time_cost,
            "risk_level": strategy.risk_level,
            "resource_usage": strategy.resource_usage,
            "success_probability": strategy.success_probability,
            "step_count": len(strategy.steps),
            "rationale": list(strategy.rationale),
            "prediction_confidence": strategy.prediction.confidence
            if strategy.prediction
            else None,
        }

    def _build_council_strategy_options(self, strategies: list[Any]) -> list[dict[str, Any]]:
        options: list[dict[str, Any]] = []
        for strategy in strategies:
            options.append(
                {
                    "label": strategy.label,
                    "strategy_name": strategy.label,
                    "description": strategy.description,
                    "estimated_success_probability": strategy.success_probability,
                    "required_resources": strategy.resource_usage,
                    "expected_execution_time": strategy.estimated_time_cost,
                    "risk_level": strategy.risk_level,
                    "score": strategy.score,
                }
            )
        return options

    def _resolve_council_participants(self, task: dict[str, Any]) -> list[str]:
        council_payload = task.get("council")
        if isinstance(council_payload, dict):
            raw = council_payload.get("participants")
            if isinstance(raw, list):
                participants = [str(item).strip() for item in raw if str(item).strip()]
                if participants:
                    return participants

        return ["ResearchAgent", "CodingAgent", "AutomationAgent"]

    def _select_strategy_from_council(
        self,
        *,
        strategies: list[Any],
        council_report: dict[str, Any],
    ) -> Any:
        chosen = str(council_report.get("chosen_strategy_label", "")).strip().upper()
        if chosen:
            for strategy in strategies:
                if str(strategy.label).strip().upper() == chosen:
                    return strategy
        return self.strategy_engine.select_best_strategy(strategies)

    def _step_summary(self, step: WorkflowStep) -> dict[str, Any]:
        return {
            "step_id": step.step_id,
            "title": step.title,
            "objective": step.objective,
            "required_capability": step.required_capability,
            "assigned_agent": step.assigned_agent,
            "dependencies": list(step.dependencies),
            "parallelizable": step.parallelizable,
            "critical": step.critical,
            "status": step.status,
            "retries": step.retries,
            "estimated_time_cost": step.estimated_time_cost,
            "risk_level": step.risk_level,
            "resource_usage": step.resource_usage,
            "started_at": step.started_at,
            "finished_at": step.finished_at,
            "error": step.error,
            "output": dict(step.output),
        }

    def _is_council_enabled(self, payload: dict[str, Any]) -> bool:
        council_payload = payload.get("council")
        if isinstance(council_payload, dict):
            explicit = council_payload.get("enabled")
            if isinstance(explicit, bool):
                return explicit

        explicit_top = payload.get("enable_council")
        if isinstance(explicit_top, bool):
            return explicit_top

        return self.config.enable_council_default

    def _workflow_type(self, *, task: dict[str, Any], analysis_domain: str) -> str:
        explicit = task.get("workflow_type")
        if explicit is not None:
            normalized = str(explicit).strip().lower()
            if normalized:
                return normalized

        category = task.get("category")
        if category is not None:
            normalized = str(category).strip().lower()
            if normalized:
                return normalized

        return str(analysis_domain).strip().lower() or "general"

    def _strategy_path(self, steps: list[WorkflowStep]) -> str:
        capabilities = [step.required_capability for step in steps if step.required_capability]
        if not capabilities:
            return "workflow"

        normalized: list[str] = []
        seen: set[str] = set()
        for capability in capabilities:
            item = capability.strip().lower()
            if item in seen:
                continue
            seen.add(item)
            normalized.append(item)
        return " -> ".join(normalized)

    def _success_rate(self, summary: dict[str, Any]) -> float:
        total = int(summary.get("total_steps", 0) or 0)
        completed = int(summary.get("completed_steps", 0) or 0)
        skipped = int(summary.get("skipped_steps", 0) or 0)
        if total <= 0:
            return 0.0
        return round((completed + skipped) / total, 4)

    def _build_workflow_graph(self, steps: list[WorkflowStep]) -> list[dict[str, Any]]:
        return [
            {
                "step": step.step_id,
                "title": step.title,
                "agent": step.assigned_agent,
                "status": step.status,
                "dependencies": list(step.dependencies),
                "parallelizable": step.parallelizable,
                "estimated_time_cost": step.estimated_time_cost,
            }
            for step in steps
        ]


class WorkflowAgent(ImperiumWorkflowAgent):
    """Alias class for IMPERIUM convention-friendly imports."""

    pass
