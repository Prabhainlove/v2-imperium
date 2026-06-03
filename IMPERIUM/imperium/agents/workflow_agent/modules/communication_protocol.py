from __future__ import annotations

from dataclasses import asdict, dataclass, field
from itertools import count
from typing import Any, Literal

from ..models import utc_now_iso


MessageType = Literal[
    "task_assignment",
    "status_update",
    "result_report",
    "failure_event",
    "coordination_message",
    "strategy_review",
]


@dataclass(slots=True)
class AgentMessage:
    message_id: str
    sender: str
    receiver: str
    task_id: str
    step_id: str
    message_type: MessageType
    payload: dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=utc_now_iso)


class AgentCommunicationProtocol:
    """Builds and stores structured workflow-agent communication messages."""

    def __init__(self, sender: str = "WorkflowAgent") -> None:
        self.sender = sender
        self._counter = count(1)
        self._messages: list[AgentMessage] = []

    def send(
        self,
        *,
        receiver: str,
        task_id: str,
        step_id: str,
        message_type: MessageType,
        payload: dict[str, Any] | None = None,
        sender: str | None = None,
    ) -> AgentMessage:
        message = AgentMessage(
            message_id=f"MSG{next(self._counter):04d}",
            sender=(sender or self.sender).strip() or "WorkflowAgent",
            receiver=str(receiver).strip() or "UnknownAgent",
            task_id=str(task_id).strip() or "unknown-task",
            step_id=str(step_id).strip() or "unknown-step",
            message_type=message_type,
            payload=dict(payload or {}),
        )
        self._messages.append(message)
        return message

    def messages(self) -> list[dict[str, Any]]:
        return [asdict(message) for message in self._messages]

    def clear(self) -> None:
        self._messages.clear()

    def latest(self) -> dict[str, Any] | None:
        if not self._messages:
            return None
        return asdict(self._messages[-1])
