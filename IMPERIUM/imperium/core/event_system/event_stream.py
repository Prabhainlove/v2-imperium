from __future__ import annotations

from collections import deque
from threading import RLock
from typing import Any
from uuid import uuid4

from core.common import EventRecord, EventType, utc_now
from core.event_system.event_listener import EventListener


class EventStream:
    def __init__(self, *, max_events: int = 5000) -> None:
        self._lock = RLock()
        self._events: deque[EventRecord] = deque(maxlen=max(100, max_events))
        self._listeners: list[EventListener] = []

    def subscribe(self, listener: EventListener) -> None:
        with self._lock:
            if listener not in self._listeners:
                self._listeners.append(listener)

    def unsubscribe(self, listener: EventListener) -> None:
        with self._lock:
            self._listeners = [entry for entry in self._listeners if entry != listener]

    def publish(
        self,
        *,
        event_type: EventType,
        name: str,
        payload: dict[str, Any],
        source: str,
    ) -> EventRecord:
        event = EventRecord(
            event_id=str(uuid4()),
            event_type=event_type,
            name=name.strip() or "unnamed_event",
            payload=dict(payload),
            timestamp=utc_now(),
            source=source.strip() or "unknown",
        )

        with self._lock:
            self._events.append(event)
            listeners = list(self._listeners)

        for listener in listeners:
            listener(event)

        return event

    def latest(self, limit: int = 100) -> list[EventRecord]:
        count = max(1, limit)
        with self._lock:
            events = list(self._events)
        return events[-count:]
