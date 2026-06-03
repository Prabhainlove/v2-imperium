from __future__ import annotations

from collections import defaultdict
from threading import RLock

from core.common import EventRecord
from core.event_system.event_listener import EventListener


class EventRouter:
    def __init__(self) -> None:
        self._lock = RLock()
        self._type_handlers: dict[str, list[EventListener]] = defaultdict(list)
        self._name_handlers: dict[str, list[EventListener]] = defaultdict(list)

    def route(self, event: EventRecord) -> None:
        with self._lock:
            by_type = list(self._type_handlers.get(event.event_type, []))
            by_name = list(self._name_handlers.get(event.name, []))

        for handler in by_type + by_name:
            handler(event)

    def on_event_type(self, event_type: str, listener: EventListener) -> None:
        normalized = event_type.strip().lower()
        if not normalized:
            raise ValueError("event_type cannot be empty")

        with self._lock:
            if listener not in self._type_handlers[normalized]:
                self._type_handlers[normalized].append(listener)

    def on_event_name(self, event_name: str, listener: EventListener) -> None:
        normalized = event_name.strip()
        if not normalized:
            raise ValueError("event_name cannot be empty")

        with self._lock:
            if listener not in self._name_handlers[normalized]:
                self._name_handlers[normalized].append(listener)
