from __future__ import annotations

import logging
from collections import deque
from dataclasses import asdict
from threading import RLock
from typing import Any

from core.common import EventRecord


class EventLogger:
    def __init__(self, *, name: str = "imperium.core", max_buffer: int = 1000) -> None:
        self._logger = logging.getLogger(name)
        self._buffer: deque[dict[str, Any]] = deque(maxlen=max(100, max_buffer))
        self._lock = RLock()

    def log(self, event: EventRecord) -> None:
        payload = asdict(event)
        with self._lock:
            self._buffer.append(payload)

        self._logger.info(
            "event=%s type=%s source=%s id=%s",
            event.name,
            event.event_type,
            event.source,
            event.event_id,
        )

    def recent(self, limit: int = 100) -> list[dict[str, Any]]:
        count = max(1, limit)
        with self._lock:
            items = list(self._buffer)
        return items[-count:]
