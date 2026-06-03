from __future__ import annotations

from collections import defaultdict
from threading import RLock
from typing import Callable

from core.common import BusMessage

MessageHandler = Callable[[BusMessage], None]


class TopicRegistry:
    def __init__(self) -> None:
        self._lock = RLock()
        self._handlers: dict[str, list[MessageHandler]] = defaultdict(list)

    def subscribe(self, topic: str, handler: MessageHandler) -> None:
        normalized_topic = topic.strip().lower()
        if not normalized_topic:
            raise ValueError("topic cannot be empty")

        with self._lock:
            if handler not in self._handlers[normalized_topic]:
                self._handlers[normalized_topic].append(handler)

    def unsubscribe(self, topic: str, handler: MessageHandler) -> None:
        normalized_topic = topic.strip().lower()
        if not normalized_topic:
            return

        with self._lock:
            existing = self._handlers.get(normalized_topic, [])
            self._handlers[normalized_topic] = [item for item in existing if item != handler]

    def get_handlers(self, topic: str) -> list[MessageHandler]:
        normalized_topic = topic.strip().lower()
        with self._lock:
            return list(self._handlers.get(normalized_topic, []))

    def topics(self) -> list[str]:
        with self._lock:
            return sorted(self._handlers.keys())
