from __future__ import annotations

from dataclasses import asdict, dataclass
from itertools import count
from typing import Any, Literal

from ...models import utc_now_iso


CouncilMessageType = Literal[
    "strategy_proposal",
    "strategy_critique",
    "evidence_submission",
    "decision_vote",
    "final_decision",
]


@dataclass(slots=True)
class CouncilMessage:
    message_id: str
    sender: str
    receiver: str
    task_id: str
    message_type: CouncilMessageType
    content: str
    confidence: float
    timestamp: str
    metadata: dict[str, Any]


class CouncilMessageProtocol:
    """Structured council message protocol for multi-agent debate rounds."""

    def __init__(self, sender: str = "AgentCouncil") -> None:
        self.sender = sender
        self._counter = count(1)
        self._messages: list[CouncilMessage] = []

    def send(
        self,
        *,
        receiver: str,
        task_id: str,
        message_type: CouncilMessageType,
        content: str,
        confidence: float = 0.5,
        sender: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> CouncilMessage:
        message = CouncilMessage(
            message_id=f"MSG{next(self._counter):04d}",
            sender=(sender or self.sender).strip() or "AgentCouncil",
            receiver=str(receiver).strip() or "UnknownReceiver",
            task_id=str(task_id).strip() or "unknown-task",
            message_type=message_type,
            content=str(content).strip(),
            confidence=round(max(0.0, min(1.0, float(confidence))), 4),
            timestamp=utc_now_iso(),
            metadata=dict(metadata or {}),
        )
        self._messages.append(message)
        return message

    def messages(self) -> list[dict[str, Any]]:
        return [asdict(message) for message in self._messages]

    def clear(self) -> None:
        self._messages.clear()
