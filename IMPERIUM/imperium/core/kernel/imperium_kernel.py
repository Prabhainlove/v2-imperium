from __future__ import annotations

import asyncio
import importlib.util
import inspect
import sys
from dataclasses import asdict
from pathlib import Path
from threading import RLock
from time import perf_counter
from typing import Any, Callable

from core.common import AgentDescriptor
from core.event_system import EventRouter, EventStream
from core.knowledge_graph import KnowledgeGraph
from core.memory import Memory
from core.message_bus import MessageBus
from core.message_bus.event_dispatcher import EventDispatcher
from core.observability import Observability
from core.resilience import CircuitBreakerRegistry, DeadLetterQueue
from core.resource_manager import ResourceManager
from core.security import Security
from core.skill_registry import SkillRegistry
from core.strategy_engine import StrategyEngine
from core.task_manager import TaskManager
from core.workflow_engine import WorkflowEngine

AgentFactory = Callable[[], Any]


class ImperiumKernel:
    def __init__(
        self,
        *,
        workspace_root: str | Path | None = None,
        event_stream: EventStream | None = None,
        event_router: EventRouter | None = None,
        observability: Observability | None = None,
        message_bus: MessageBus | None = None,
        task_manager: TaskManager | None = None,
        knowledge_graph: KnowledgeGraph | None = None,
        memory: Memory | None = None,
        strategy_engine: StrategyEngine | None = None,
        workflow_engine: WorkflowEngine | None = None,
        skill_registry: SkillRegistry | None = None,
        resource_manager: ResourceManager | None = None,
        security: Security | None = None,
        circuit_breakers: CircuitBreakerRegistry | None = None,
        dead_letter_queue: DeadLetterQueue | None = None,
    ) -> None:
        self.workspace_root = (
            Path(workspace_root).resolve()
            if workspace_root is not None
            else Path(__file__).resolve().parents[2]
        )

        self.event_stream = event_stream or EventStream()
        self.event_router = event_router or EventRouter()
        self.dead_letter_queue = dead_letter_queue or DeadLetterQueue()
        self.circuit_breakers = circuit_breakers or CircuitBreakerRegistry()

        self.observability = observability or Observability(event_stream=self.event_stream)

        dispatcher = EventDispatcher(failure_hook=self._on_message_dispatch_failure)
        self.message_bus = message_bus or MessageBus(
            dispatcher=dispatcher,
            event_stream=self.event_stream,
        )
        self.task_manager = task_manager or TaskManager(event_stream=self.event_stream)
        self.knowledge_graph = knowledge_graph or KnowledgeGraph()
        self.memory = memory or Memory()
        self.strategy_engine = strategy_engine or StrategyEngine()
        self.skill_registry = skill_registry or SkillRegistry()
        self.resource_manager = resource_manager or ResourceManager()
        self.security = security or Security()
        self.workflow_engine = workflow_engine or WorkflowEngine(
            dispatch_callable=self.dispatch_to_agent,
            event_stream=self.event_stream,
        )

        self._agent_factories: dict[str, AgentFactory] = {}
        self._agent_instances: dict[str, Any] = {}
        self._agent_aliases: dict[str, str] = {}
        self._agents: dict[str, AgentDescriptor] = {}
        self._started = False
        self._lock = RLock()

    def start(self) -> dict[str, Any]:
        with self._lock:
            if self._started:
                return {"status": "already_running", "snapshot": self.snapshot()}

            self.event_stream.subscribe(self.event_router.route)
            self.observability.attach_to_stream()
            self._register_monitoring_probes()

            self._register_default_agents()
            self._seed_permissions()

            self.message_bus.start()
            self.observability.start()

            self._started = True

        self.event_stream.publish(
            event_type="system",
            name="kernel_started",
            payload={
                "workspace_root": str(self.workspace_root),
                "agents": [agent.name for agent in self.list_agents()],
            },
            source="kernel",
        )
        return {"status": "running", "snapshot": self.snapshot()}

    def shutdown(self) -> dict[str, Any]:
        with self._lock:
            if not self._started:
                return {"status": "stopped", "snapshot": self.snapshot()}

            self.event_stream.publish(
                event_type="system",
                name="kernel_shutdown_requested",
                payload={},
                source="kernel",
            )

            self.message_bus.shutdown()
            self.observability.shutdown()
            self.security.shutdown()
            self._started = False

        return {"status": "stopped", "snapshot": self.snapshot()}

    def execute_task(self, task: dict[str, Any]) -> dict[str, Any]:
        if not self._started:
            raise RuntimeError("ImperiumKernel must be started before executing tasks")

        if not isinstance(task, dict):
            raise TypeError("task must be a dictionary")

        task_record = None
        start = perf_counter()

        try:
            title = self._resolve_task_title(task)
            payload = dict(task.get("payload") or {})
            payload.setdefault("description", str(task.get("description") or task.get("query") or ""))

            task_record = self.task_manager.create_task(
                title=title,
                payload=payload,
                priority=int(task.get("priority") or 3),
                max_retries=int(task.get("max_retries") or 2),
                metadata={"origin": "kernel", "source_task": dict(task)},
            )
            self.task_manager.update_status(task_record.task_id, "planned")

            strategy_task = {
                "task_id": task_record.task_id,
                "title": task_record.title,
                "description": payload.get("description", ""),
                "query": str(task.get("query") or task.get("description") or task.get("title") or ""),
                "payload": payload,
                "requested_agents": list(task.get("requested_agents") or []),
            }

            strategy = self.strategy_engine.select_strategy(
                strategy_task,
                available_agents=self.list_agents(),
                agent_performance=self.memory.agent_memory.snapshot(),
            )

            steps = self._build_workflow_steps(strategy.plan, strategy_task)
            if strategy.plan.get("requires_council"):
                steps = self._apply_council_decision(task_record.task_id, strategy_task, steps)

            self.task_manager.update_status(task_record.task_id, "executing")
            trace = self.observability.trace_manager.start_span(
                task_record.task_id,
                "workflow_execution",
                {"strategy_id": strategy.strategy_id},
            )

            workflow_result = self.workflow_engine.start_workflow(
                task_record.task_id,
                steps,
                metadata={"strategy_id": strategy.strategy_id, "complexity": strategy.complexity_score},
                context={"task": strategy_task},
            )

            self.observability.trace_manager.end_span(
                trace,
                {"status": workflow_result.get("status", "unknown")},
            )

            success = workflow_result.get("status") == "completed"
            if success:
                task_record = self.task_manager.update_status(task_record.task_id, "completed")
            else:
                task_record = self.task_manager.update_status(
                    task_record.task_id,
                    "failed",
                    error=str(workflow_result.get("error") or "workflow failed"),
                )

            duration = perf_counter() - start
            self.memory.store_task(task_record.task_id, task_record.title, task_record.payload, task_record.status)
            self.memory.record_strategy_outcome(
                strategy.strategy_id,
                task_record.task_id,
                success=success,
                latency_seconds=duration,
                score=1.0 if success else 0.0,
            )

            self._record_task_knowledge(task_record.task_id, task_record.title, strategy.plan, workflow_result, success)

            self.event_stream.publish(
                event_type="task",
                name="task_execution_finished",
                payload={
                    "task_id": task_record.task_id,
                    "status": task_record.status,
                    "duration_seconds": round(duration, 4),
                },
                source="kernel",
            )

            return {
                "status": "success" if success else "failure",
                "task_id": task_record.task_id,
                "task_status": task_record.status,
                "strategy": asdict(strategy),
                "workflow": workflow_result,
                "duration_seconds": round(duration, 4),
            }

        except Exception as exc:
            if task_record is not None:
                try:
                    self.task_manager.update_status(task_record.task_id, "failed", error=str(exc))
                except Exception:
                    pass

            self.dead_letter_queue.push(
                "task_execution",
                {"task": dict(task), "task_id": getattr(task_record, "task_id", None)},
                str(exc),
            )
            return {
                "status": "failure",
                "error": str(exc),
                "task_id": getattr(task_record, "task_id", None),
            }

    def dispatch_to_agent(self, agent_name: str | None, payload: dict[str, Any]) -> dict[str, Any]:
        normalized = self._resolve_agent_name(agent_name)
        if normalized is None:
            return {"status": "failed", "error": "No agent resolved for workflow step"}

        resource_key = f"agent:{normalized.lower()}"
        if not self.resource_manager.allow(resource_key):
            return {
                "status": "failed",
                "error": f"Resource limit exceeded for {normalized}",
            }

        if not self.circuit_breakers.allow(normalized):
            return {
                "status": "failed",
                "error": f"Circuit breaker open for {normalized}",
            }

        with self.resource_manager.acquire(resource_key):
            start = perf_counter()
            try:
                client = self._get_agent_instance(normalized)
                if client is None:
                    raise RuntimeError(f"Unable to load agent {normalized}")

                execute_callable = getattr(client, "execute", None)
                if execute_callable is None:
                    raise RuntimeError(f"Agent {normalized} does not expose execute()")

                response = execute_callable(payload)
                if inspect.isawaitable(response):
                    # Handle async execution - check if event loop is already running
                    try:
                        loop = asyncio.get_running_loop()
                        # Event loop is running, we need to run in a thread
                        import concurrent.futures
                        with concurrent.futures.ThreadPoolExecutor() as pool:
                            future = pool.submit(asyncio.run, response)
                            response = future.result()
                    except RuntimeError:
                        # No event loop running, safe to use asyncio.run
                        response = asyncio.run(response)

                if not isinstance(response, dict):
                    response = {"raw_response": response}

                normalized_status = str(response.get("status", "success")).lower()
                success = normalized_status in {"success", "completed", "ok"}
                latency = perf_counter() - start

                self.memory.record_agent_performance(
                    normalized,
                    success=success,
                    latency_seconds=latency,
                )

                if success:
                    self.circuit_breakers.record_success(normalized)
                else:
                    self.circuit_breakers.record_failure(normalized)
                    self.dead_letter_queue.push("agent_execution", payload, str(response.get("error", "agent failure")))

                self.event_stream.publish(
                    event_type="agent",
                    name="agent_execution",
                    payload={
                        "agent": normalized,
                        "status": "success" if success else "failed",
                        "latency_seconds": round(latency, 4),
                    },
                    source="kernel",
                )

                return response

            except Exception as exc:
                self.circuit_breakers.record_failure(normalized)
                self.dead_letter_queue.push("agent_execution", payload, str(exc))
                return {"status": "failed", "error": str(exc), "agent": normalized}

    def register_agent(
        self,
        *,
        descriptor: AgentDescriptor,
        factory: AgentFactory,
        aliases: list[str] | None = None,
    ) -> None:
        canonical = descriptor.name.strip()
        if not canonical:
            raise ValueError("descriptor.name cannot be empty")

        with self._lock:
            self._agents[canonical] = descriptor
            self._agent_factories[canonical] = factory
            self._agent_aliases[canonical.lower()] = canonical

            for alias in list(aliases or []):
                normalized_alias = alias.strip().lower()
                if normalized_alias:
                    self._agent_aliases[normalized_alias] = canonical

        for skill in descriptor.skills:
            self.skill_registry.register_skill(skill, category="agent", description=f"Capability for {descriptor.name}")
            self.skill_registry.assign_skill_to_agent(descriptor.name, skill)

    def list_agents(self) -> list[AgentDescriptor]:
        with self._lock:
            return [self._agents[key] for key in sorted(self._agents.keys())]

    def snapshot(self) -> dict[str, Any]:
        return {
            "started": self._started,
            "agents": [asdict(agent) for agent in self.list_agents()],
            "skills": self.skill_registry.snapshot(),
            "memory": self.memory.snapshot(),
            "observability": self.observability.snapshot(),
            "dead_letters": self.dead_letter_queue.recent(50),
        }

    def _register_default_agents(self) -> None:
        defaults = [
            {
                "name": "AutoGPT",
                "aliases": ["researchagent", "research", "autogpt"],
                "capabilities": ["research", "information gathering", "data analysis"],
                "skills": ["web_search", "summarization", "knowledge_extraction"],
                "path": ("agents", "research_agent", "research_agent.py"),
                "class_name": "ResearchAgent",
                "init_mode": "default",
            },
            {
                "name": "OpenDevin",
                "aliases": ["codingagent", "coding", "opendevin"],
                "capabilities": ["coding", "debugging", "software development"],
                "skills": ["python_development", "refactoring", "test_generation"],
                "path": ("agents", "coding_agent", "coding_agent.py"),
                "class_name": "CodingAgent",
                "init_mode": "workspace",
            },
            {
                "name": "OpenClaw",
                "aliases": ["automationagent", "automation", "openclaw"],
                "capabilities": ["automation", "system interaction", "notifications"],
                "skills": ["event_dispatch", "channel_management", "alerting"],
                "path": ("agents", "automation_agent", "automation_agent.py"),
                "class_name": "AutomationAgent",
                "init_mode": "default",
            },
            {
                "name": "SuperAGI",
                "aliases": ["workflowagent", "workflow", "superagi"],
                "capabilities": ["workflow orchestration", "planning", "coordination"],
                "skills": ["pipeline_planning", "execution_monitoring", "council_collaboration"],
                "path": ("agents", "workflow_agent", "superagi_workflow_agent.py"),
                "class_name": "WorkflowAgent",
                "init_mode": "workspace",
            },
            {
                "name": "JobAgent",
                "aliases": ["jobagent", "job", "career", "hiring"],
                "capabilities": ["job search", "resume generation", "application automation"],
                "skills": ["job_scraping", "resume_generation", "application_tracking"],
                "path": ("agents", "job_agent", "job_agent.py"),
                "class_name": "JobAgent",
                "init_mode": "workspace",
            },
        ]

        for item in defaults:
            descriptor = AgentDescriptor(
                name=item["name"],
                capabilities=list(item["capabilities"]),
                skills=list(item["skills"]),
                status="online",
                metadata={"path": "/".join(item["path"]), "class_name": item["class_name"]},
            )

            self.register_agent(
                descriptor=descriptor,
                aliases=list(item["aliases"]),
                factory=self._build_agent_factory(
                    relative_path=tuple(item["path"]),
                    class_name=str(item["class_name"]),
                    init_mode=str(item["init_mode"]),
                ),
            )

    def _seed_permissions(self) -> None:
        self.security.permission_manager.grant("kernel", "*")

        for agent in self.list_agents():
            self.security.permission_manager.grant(agent.name, "execute")

        self.security.policy_engine.register_policy(
            name="require_command",
            predicate=lambda context: bool(str(context.get("command") or "echo kernel")),
            message="Action must include command context",
        )

    def _register_monitoring_probes(self) -> None:
        self.observability.system_monitor.register_probe(
            "message_bus.queue_depth",
            lambda: float(self.message_bus.message_queue.size()),
        )
        self.observability.system_monitor.register_probe(
            "task_manager.scheduled",
            lambda: float(self.task_manager.scheduler.queued_count()),
        )
        self.observability.system_monitor.register_probe(
            "resilience.dead_letters",
            lambda: float(len(self.dead_letter_queue.recent(1000000))),
        )

    def _resolve_task_title(self, task: dict[str, Any]) -> str:
        candidates = [task.get("title"), task.get("query"), task.get("task"), task.get("description")]
        for candidate in candidates:
            value = str(candidate or "").strip()
            if value:
                return value
        return "Untitled task"

    def _build_workflow_steps(self, plan: dict[str, Any], strategy_task: dict[str, Any]) -> list[dict[str, Any]]:
        steps = list(plan.get("steps") or [])
        built: list[dict[str, Any]] = []

        for index, step in enumerate(steps, start=1):
            # Ensure input_payload contains the task information
            input_payload = dict(step.get("input_payload") or {})
            # If input_payload is empty, populate it with task data from strategy_task
            if not input_payload:
                input_payload = {
                    "task_id": strategy_task.get("task_id"),
                    "query": strategy_task.get("query", ""),
                    "description": strategy_task.get("description", ""),
                    "title": strategy_task.get("title", ""),
                }
            
            built.append(
                {
                    "step_id": str(step.get("step_id") or f"step_{index}"),
                    "name": str(step.get("name") or f"Step {index}"),
                    "action": str(step.get("capability") or step.get("action") or "execute"),
                    "input_payload": input_payload,
                    "assigned_agent": step.get("assigned_agent"),
                    "dependencies": list(step.get("dependencies") or []),
                    "retries": int(step.get("retries") or 0),
                    "status": "pending",
                }
            )

        return built

    def _apply_council_decision(
        self,
        task_id: str,
        task_payload: dict[str, Any],
        steps: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        return steps

    def _record_task_knowledge(
        self,
        task_id: str,
        title: str,
        strategy_plan: dict[str, Any],
        workflow_result: dict[str, Any],
        success: bool,
    ) -> None:
        entity = self.knowledge_graph.add_entity(
            "task",
            {
                "task_id": task_id,
                "title": title,
                "status": workflow_result.get("status"),
                "step_count": len(strategy_plan.get("steps", [])),
            },
            confidence=0.9 if success else 0.5,
            entity_id=task_id,
        )

        evidence = self.knowledge_graph.add_evidence(
            content=str(workflow_result),
            source="workflow_engine",
            confidence=0.8 if success else 0.5,
            metadata={"task_id": task_id},
        )

        self.knowledge_graph.add_relationship(
            source_entity_id=entity.entity_id,
            target_entity_id=entity.entity_id,
            relationship_type="executed_with",
            confidence=0.9 if success else 0.4,
            evidence_ids=[evidence.evidence_id],
        )

    def _resolve_agent_name(self, agent_name: str | None) -> str | None:
        if agent_name is None:
            return None

        normalized = str(agent_name).strip().lower()
        if not normalized:
            return None

        with self._lock:
            if normalized in self._agent_aliases:
                return self._agent_aliases[normalized]

        return str(agent_name).strip()

    def _get_agent_instance(self, agent_name: str) -> Any | None:
        with self._lock:
            if agent_name in self._agent_instances:
                return self._agent_instances[agent_name]
            factory = self._agent_factories.get(agent_name)

        if factory is None:
            return None

        instance = factory()
        with self._lock:
            self._agent_instances[agent_name] = instance
        return instance

    def _build_agent_factory(
        self,
        *,
        relative_path: tuple[str, ...],
        class_name: str,
        init_mode: str,
    ) -> AgentFactory:
        module_path = self.workspace_root.joinpath(*relative_path)

        def factory() -> Any:
            if not module_path.exists():
                raise FileNotFoundError(f"Agent module not found: {module_path}")

            module = self._load_module_from_path(module_path)
            cls = getattr(module, class_name, None)
            if cls is None:
                raise RuntimeError(f"Class {class_name} not found in {module_path}")

            if init_mode == "workspace":
                return cls(workspace_root=self.workspace_root)
            return cls()

        return factory

    def _load_module_from_path(self, file_path: Path):
        root = str(self.workspace_root)

        # Only add workspace root to sys.path - do NOT add the parent directory.
        # Adding the parent directory causes relative imports (..models) to fail
        # because modules get loaded under a shorter package path that doesn't
        # have enough parent levels to satisfy the relative import depth.
        if root not in sys.path:
            sys.path.insert(0, root)

        module_name = f"imperium_runtime_{file_path.stem}_{abs(hash(file_path))}"
        spec = importlib.util.spec_from_file_location(module_name, file_path)
        if spec is None or spec.loader is None:
            raise RuntimeError(f"Unable to load module from path {file_path}")

        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def _on_message_dispatch_failure(self, message, exc: Exception) -> None:
        self.dead_letter_queue.push(
            "message_dispatch",
            {"topic": message.topic, "message_id": message.message_id, "payload": message.payload},
            str(exc),
        )
