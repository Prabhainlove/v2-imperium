from __future__ import annotations

from dataclasses import dataclass
from queue import Empty, PriorityQueue
from threading import Lock
from time import monotonic

from core.common import BusMessage


@dataclass(slots=True)
class QueuedMessage:
    priority: int
    created_monotonic: float
    index: int
    message: BusMessage

    def as_tuple(self) -> tuple[int, float, int, BusMessage]:
        return (self.priority, self.created_monotonic, self.index, self.message)


class MessageQueue:
    def __init__(self) -> None:
        self._queue: PriorityQueue[tuple[int, float, int, BusMessage]] = PriorityQueue()
        self._index = 0
        self._lock = Lock()

    def enqueue(self, message: BusMessage, priority: int = 5) -> None:
        safe_priority = max(0, min(10, int(priority)))
        with self._lock:
            self._index += 1
            index = self._index

        item = QueuedMessage(
            priority=safe_priority,
            created_monotonic=monotonic(),
            index=index,
            message=message,
        )
        self._queue.put(item.as_tuple())

    def dequeue(self, timeout: float = 0.25) -> BusMessage | None:
        try:
            _, _, _, message = self._queue.get(timeout=timeout)
        except Empty:
            return None
        return message

    def task_done(self) -> None:
        self._queue.task_done()

    def size(self) -> int:
        return self._queue.qsize()
