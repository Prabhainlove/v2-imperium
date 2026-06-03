from __future__ import annotations

from collections import deque
from threading import RLock
from typing import Any

from core.common import utc_now


class DeadLetterQueue:
    def __init__(self, *, max_items: int = 5000) -> None:
        self._lock = RLock()
        self._items: deque[dict[str, Any]] = deque(maxlen=max(100, max_items))

    def push(self, item_type: str, payload: dict[str, Any], error: str) -> None:
        entry = {
            "type": item_type,
            "payload": dict(payload),
            "error": error,
            "timestamp": utc_now().isoformat(),
        }
        with self._lock:
            self._items.append(entry)

    def recent(self, limit: int = 100) -> list[dict[str, Any]]:
        count = max(1, limit)
        with self._lock:
            items = list(self._items)
        return items[-count:]
