from __future__ import annotations

from dataclasses import dataclass, field
from threading import RLock
from typing import Any

from core.common import utc_now


@dataclass(slots=True)
class TaskMemoryItem:
    task_id: str
    title: str
    payload: dict[str, Any]
    outcome: str
    created_at: str = field(default_factory=lambda: utc_now().isoformat())


class TaskMemory:
    def __init__(self) -> None:
        self._lock = RLock()
        self._items: dict[str, TaskMemoryItem] = {}

    def store(self, task_id: str, title: str, payload: dict[str, Any], outcome: str) -> TaskMemoryItem:
        item = TaskMemoryItem(
            task_id=task_id,
            title=title,
            payload=dict(payload),
            outcome=outcome,
        )

        with self._lock:
            self._items[task_id] = item

        return item

    def retrieve_similar(self, query: str, *, limit: int = 10) -> list[TaskMemoryItem]:
        normalized_query = set(query.strip().lower().split())
        if not normalized_query:
            return []

        scored: list[tuple[float, TaskMemoryItem]] = []
        with self._lock:
            items = list(self._items.values())

        for item in items:
            haystack = f"{item.title} {item.payload}".lower()
            tokens = set(haystack.split())
            overlap = len(normalized_query.intersection(tokens))
            if overlap == 0:
                continue
            score = overlap / max(1, len(normalized_query))
            scored.append((score, item))

        scored.sort(key=lambda pair: pair[0], reverse=True)
        return [item for _, item in scored[: max(1, limit)]]
