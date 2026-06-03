from __future__ import annotations

from dataclasses import replace
from datetime import datetime
from threading import RLock
from typing import Any
from uuid import uuid4

from core.common import TaskRecord, TaskStatus, utc_now
from core.event_system import EventStream
from core.task_manager.task_scheduler import TaskScheduler
from core.task_manager.task_state_machine import TaskStateMachine


class TaskManager:
    def __init__(
        self,
        *,
        scheduler: TaskScheduler | None = None,
        state_machine: TaskStateMachine | None = None,
        event_stream: EventStream | None = None,
    ) -> None:
        self.scheduler = scheduler or TaskScheduler()
        self.state_machine = state_machine or TaskStateMachine()
        self.event_stream = event_stream
        self._lock = RLock()
        self._tasks: dict[str, TaskRecord] = {}

    def create_task(
        self,
        title: str,
        payload: dict[str, Any],
        *,
        priority: int = 3,
        max_retries: int = 2,
        run_at: datetime | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> TaskRecord:
        normalized_title = title.strip()
        if not normalized_title:
            raise ValueError("title cannot be empty")

        now = utc_now()
        task = TaskRecord(
            task_id=str(uuid4()),
            title=normalized_title,
            payload=dict(payload),
            status="created",
            priority=max(1, min(priority, 10)),
            retries=0,
            max_retries=max(0, int(max_retries)),
            created_at=now,
            updated_at=now,
            metadata=dict(metadata or {}),
        )

        with self._lock:
            self._tasks[task.task_id] = task

        self.scheduler.schedule(task.task_id, run_at=run_at or now, priority=task.priority)
        self._emit("task_created", {"task_id": task.task_id, "title": task.title})
        return replace(task)

    def update_status(self, task_id: str, status: TaskStatus, *, error: str | None = None) -> TaskRecord:
        with self._lock:
            task = self._tasks.get(task_id)
            if task is None:
                raise KeyError(f"Unknown task_id: {task_id}")

            task.status = self.state_machine.transition(task.status, status)
            task.updated_at = utc_now()

            if status == "executing":
                task.started_at = task.started_at or task.updated_at
            if status == "completed":
                task.completed_at = task.updated_at
                task.error = None
            if status == "failed":
                task.error = error or "Task failed"

                if task.retries < task.max_retries:
                    task.retries += 1
                    task.status = "planned"
                    self.scheduler.schedule_retry(task_id, retries=task.retries)

            snapshot = replace(task)

        self._emit(
            "task_status_updated",
            {
                "task_id": task_id,
                "status": snapshot.status,
                "retries": snapshot.retries,
                "error": snapshot.error,
            },
        )
        return snapshot

    def get_task(self, task_id: str) -> TaskRecord | None:
        with self._lock:
            task = self._tasks.get(task_id)
            return replace(task) if task is not None else None

    def pop_schedulable_tasks(self, *, limit: int = 10) -> list[TaskRecord]:
        task_ids = self.scheduler.pop_ready(limit=limit)
        ready: list[TaskRecord] = []

        with self._lock:
            for task_id in task_ids:
                task = self._tasks.get(task_id)
                if task is None:
                    continue
                if task.status in {"created", "planned"}:
                    ready.append(replace(task))

        return ready

    def list_tasks(self, *, status: TaskStatus | None = None) -> list[TaskRecord]:
        with self._lock:
            tasks = [replace(task) for task in self._tasks.values()]

        if status is None:
            return sorted(tasks, key=lambda item: item.created_at or utc_now())
        return [task for task in tasks if task.status == status]

    def _emit(self, event_name: str, payload: dict[str, Any]) -> None:
        if self.event_stream is None:
            return

        self.event_stream.publish(
            event_type="task",
            name=event_name,
            payload=payload,
            source="task_manager",
        )
