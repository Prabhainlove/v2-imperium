from __future__ import annotations

from collections import deque
from threading import RLock
from typing import Any

from core.common import utc_now


class HistoryManager:
    def __init__(self, *, max_items: int = 10000) -> None:
        self._lock = RLock()
        self._records: deque[dict[str, Any]] = deque(maxlen=max(1000, max_items))

    def append(self, record_type: str, payload: dict[str, Any]) -> None:
        entry = {
            "type": record_type,
            "payload": dict(payload),
            "timestamp": utc_now().isoformat(),
        }
        with self._lock:
            self._records.append(entry)

    def recent(self, limit: int = 200) -> list[dict[str, Any]]:
        count = max(1, limit)
        with self._lock:
            records = list(self._records)
        return records[-count:]
