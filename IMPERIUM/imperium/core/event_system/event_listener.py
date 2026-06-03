from __future__ import annotations

from typing import Protocol

from core.common import EventRecord


class EventListener(Protocol):
    def __call__(self, event: EventRecord) -> None:
        ...
