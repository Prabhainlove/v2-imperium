from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from heapq import heappop, heappush
from threading import RLock

from core.common import ScheduledTask
from core.common.time import utc_now


@dataclass(slots=True)
class ScheduledItem:
    run_at: datetime
    priority: int
    task_id: str

    def as_tuple(self) -> tuple[float, int, str]:
        return (self.run_at.timestamp(), self.priority, self.task_id)


class TaskScheduler:
    def __init__(self) -> None:
        self._lock = RLock()
        self._heap: list[tuple[float, int, str]] = []

    def schedule(self, task_id: str, *, run_at: datetime | None = None, priority: int = 3) -> ScheduledTask:
        target = run_at or utc_now()
        item = ScheduledItem(run_at=target, priority=max(1, min(priority, 10)), task_id=task_id)
        with self._lock:
            heappush(self._heap, item.as_tuple())
        return ScheduledTask(task_id=task_id, run_at=target, priority=item.priority)

    def schedule_retry(self, task_id: str, *, retries: int, base_delay_seconds: int = 5, priority: int = 2) -> ScheduledTask:
        delay = max(1, base_delay_seconds) * (2 ** max(0, retries - 1))
        return self.schedule(
            task_id,
            run_at=utc_now() + timedelta(seconds=delay),
            priority=priority,
        )

    def pop_ready(self, *, limit: int = 20) -> list[str]:
        now = utc_now().timestamp()
        ready: list[str] = []

        with self._lock:
            while self._heap and len(ready) < limit:
                run_at, _, task_id = self._heap[0]
                if run_at > now:
                    break
                heappop(self._heap)
                ready.append(task_id)

        return ready

    def queued_count(self) -> int:
        with self._lock:
            return len(self._heap)
