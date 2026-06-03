from __future__ import annotations

from core.common import TaskStatus


class TaskStateMachine:
    _TRANSITIONS: dict[TaskStatus, set[TaskStatus]] = {
        "created": {"planned", "failed"},
        "planned": {"executing", "failed"},
        "executing": {"completed", "failed"},
        "completed": set(),
        "failed": {"planned", "executing"},
    }

    def can_transition(self, current: TaskStatus, next_state: TaskStatus) -> bool:
        return next_state in self._TRANSITIONS[current]

    def transition(self, current: TaskStatus, next_state: TaskStatus) -> TaskStatus:
        if not self.can_transition(current, next_state):
            raise ValueError(f"Invalid task transition: {current} -> {next_state}")
        return next_state
