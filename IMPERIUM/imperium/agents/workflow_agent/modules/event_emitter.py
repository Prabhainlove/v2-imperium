from __future__ import annotations

import asyncio
from inspect import iscoroutine
from typing import Any, Callable

from ..models import utc_now_iso


EventListener = Callable[[dict[str, Any]], Any]


class WorkflowEventEmitter:
    """Emits workflow events and optionally notifies async/sync listeners."""

    def __init__(self) -> None:
        self._listeners: list[EventListener] = []
        self._events: list[dict[str, Any]] = []

    def subscribe(self, listener: EventListener) -> None:
        if callable(listener):
            self._listeners.append(listener)

    def clear(self) -> None:
        self._events.clear()

    def events(self) -> list[dict[str, Any]]:
        return list(self._events)

    async def emit(self, event: str, **payload: Any) -> dict[str, Any]:
        item = {
            "event": str(event).strip() or "workflow_event",
            "timestamp": utc_now_iso(),
            **dict(payload),
        }
        self._events.append(item)

        for listener in list(self._listeners):
            try:
                outcome = listener(dict(item))
                if iscoroutine(outcome):
                    await outcome
            except Exception:
                # Event emission should never break workflow execution.
                continue

        return item

    async def emit_bulk(self, events: list[dict[str, Any]]) -> None:
        for event in events:
            name = str(event.get("event", "workflow_event"))
            payload = {key: value for key, value in event.items() if key != "event"}
            await self.emit(name, **payload)


async def maybe_await(value: Any) -> Any:
    if asyncio.isfuture(value) or asyncio.iscoroutine(value):
        return await value
    return value
