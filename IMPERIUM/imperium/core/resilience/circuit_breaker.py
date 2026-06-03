from __future__ import annotations

from dataclasses import dataclass
from threading import RLock
from time import monotonic


@dataclass(slots=True)
class CircuitState:
    failures: int = 0
    opened_at: float | None = None


class CircuitBreakerRegistry:
    def __init__(self, *, failure_threshold: int = 5, recovery_timeout_seconds: float = 30.0) -> None:
        self.failure_threshold = max(1, int(failure_threshold))
        self.recovery_timeout_seconds = max(1.0, float(recovery_timeout_seconds))
        self._states: dict[str, CircuitState] = {}
        self._lock = RLock()

    def allow(self, key: str) -> bool:
        normalized = key.strip().lower()
        if not normalized:
            return False

        with self._lock:
            state = self._states.get(normalized)
            if state is None:
                return True

            if state.opened_at is None:
                return True

            elapsed = monotonic() - state.opened_at
            if elapsed >= self.recovery_timeout_seconds:
                state.failures = 0
                state.opened_at = None
                return True

            return False

    def record_success(self, key: str) -> None:
        normalized = key.strip().lower()
        if not normalized:
            return

        with self._lock:
            self._states[normalized] = CircuitState(failures=0, opened_at=None)

    def record_failure(self, key: str) -> None:
        normalized = key.strip().lower()
        if not normalized:
            return

        with self._lock:
            state = self._states.get(normalized, CircuitState())
            state.failures += 1
            if state.failures >= self.failure_threshold:
                state.opened_at = monotonic()
            self._states[normalized] = state
