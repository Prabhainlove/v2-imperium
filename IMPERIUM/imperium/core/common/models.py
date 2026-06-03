from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal


TaskStatus = Literal["created", "planned", "executing", "completed", "failed"]
EventType = Literal["task", "agent", "system"]


@dataclass(slots=True)
class AgentDescriptor:
    name: str
    capabilities: list[str] = field(default_factory=list)
    skills: list[str] = field(default_factory=list)
    status: str = "online"
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class TaskRecord:
    task_id: str
    title: str
    payload: dict[str, Any]
    status: TaskStatus = "created"
    priority: int = 3
    retries: int = 0
    max_retries: int = 2
    assigned_agents: list[str] = field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    error: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ScheduledTask:
    task_id: str
    run_at: datetime
    priority: int = 3


@dataclass(slots=True)
class BusMessage:
    topic: str
    payload: dict[str, Any]
    sender: str
    message_id: str
    timestamp: datetime
    correlation_id: str | None = None


@dataclass(slots=True)
class EventRecord:
    event_id: str
    event_type: EventType
    name: str
    payload: dict[str, Any]
    timestamp: datetime
    source: str


@dataclass(slots=True)
class WorkflowStep:
    step_id: str
    name: str
    action: str
    input_payload: dict[str, Any] = field(default_factory=dict)
    assigned_agent: str | None = None
    dependencies: list[str] = field(default_factory=list)
    retries: int = 0
    status: str = "pending"


@dataclass(slots=True)
class WorkflowDefinition:
    workflow_id: str
    task_id: str
    steps: list[WorkflowStep]
    status: str = "created"
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class StrategyPlan:
    strategy_id: str
    task_id: str
    complexity_score: float
    selected_agents: list[str]
    execution_mode: str
    plan: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class KnowledgeEntity:
    entity_id: str
    entity_type: str
    attributes: dict[str, Any]
    confidence: float
    created_at: datetime
    updated_at: datetime


@dataclass(slots=True)
class KnowledgeRelationship:
    relationship_id: str
    source_entity_id: str
    target_entity_id: str
    relationship_type: str
    confidence: float
    evidence_ids: list[str] = field(default_factory=list)
    created_at: datetime | None = None


@dataclass(slots=True)
class KnowledgeEvidence:
    evidence_id: str
    content: str
    source: str
    confidence: float
    timestamp: datetime
    metadata: dict[str, Any] = field(default_factory=dict)
