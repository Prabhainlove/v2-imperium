from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal


StepStatus = Literal["pending", "running", "completed", "failed", "skipped"]
StrategyLabel = Literal["A", "B", "C", "MEMORY"]
RecoveryAction = Literal["retry", "reassign", "skip", "abort"]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(slots=True)
class ExecutionLimits:
    max_steps: int = 120
    max_parallel_steps: int = 3
    retry_limit: int = 2
    max_runtime_seconds: int = 3600
    prediction_horizon: int = 10


@dataclass(slots=True)
class WorkflowTask:
    task_id: str
    goal: str
    constraints: dict[str, Any] = field(default_factory=dict)
    context: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class TaskAnalysis:
    task_id: str
    goal: str
    complexity_score: float
    domain: str
    keywords: list[str]
    required_capabilities: list[str]
    constraints: dict[str, Any] = field(default_factory=dict)
    context: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class WorkflowStep:
    step_id: str
    title: str
    objective: str
    required_capability: str
    assigned_agent: str | None = None
    dependencies: list[str] = field(default_factory=list)
    parallelizable: bool = False
    critical: bool = False
    estimated_time_cost: float = 1.0
    risk_level: float = 0.2
    resource_usage: float = 0.5
    status: StepStatus = "pending"
    retries: int = 0
    started_at: str | None = None
    finished_at: str | None = None
    output: dict[str, Any] = field(default_factory=dict)
    error: str | None = None


@dataclass(slots=True)
class FuturePrediction:
    actions: list[str]
    branches: list[dict[str, Any]] = field(default_factory=list)
    confidence: float = 0.0


@dataclass(slots=True)
class WorkflowStrategy:
    strategy_id: str
    label: StrategyLabel
    description: str
    steps: list[WorkflowStep]
    estimated_time_cost: float
    risk_level: float
    resource_usage: float
    success_probability: float
    score: float = 0.0
    rationale: list[str] = field(default_factory=list)
    prediction: FuturePrediction | None = None
    simulation: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class StepDispatchResult:
    task_id: str
    step_id: str
    step: int
    status: str
    result: dict[str, Any] = field(default_factory=dict)
    error: str | None = None
    started_at: str = field(default_factory=utc_now_iso)
    finished_at: str = field(default_factory=utc_now_iso)


@dataclass(slots=True)
class RecoveryDecision:
    action: RecoveryAction
    reason: str
    new_agent: str | None = None


@dataclass(slots=True)
class ProgressSnapshot:
    task_id: str
    total_steps: int
    completed_steps: int
    failed_steps: int
    skipped_steps: int
    running_steps: int
    active_agents: list[str]
    next_step: str | None
    progress_ratio: float
    timestamp: str = field(default_factory=utc_now_iso)


@dataclass(slots=True)
class ExecutionEvent:
    event_type: str
    detail: str
    payload: dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=utc_now_iso)
