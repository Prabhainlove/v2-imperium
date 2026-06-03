from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from threading import RLock


@dataclass(slots=True)
class AgentPerformance:
    executions: int = 0
    successes: int = 0
    failures: int = 0
    total_latency_seconds: float = 0.0

    @property
    def success_rate(self) -> float:
        if self.executions == 0:
            return 0.0
        return self.successes / self.executions

    @property
    def average_latency(self) -> float:
        if self.executions == 0:
            return 0.0
        return self.total_latency_seconds / self.executions


class AgentMemory:
    def __init__(self) -> None:
        self._lock = RLock()
        self._performance: dict[str, AgentPerformance] = defaultdict(AgentPerformance)

    def record(self, agent_name: str, *, success: bool, latency_seconds: float) -> None:
        key = agent_name.strip().lower()
        if not key:
            raise ValueError("agent_name cannot be empty")

        with self._lock:
            perf = self._performance[key]
            perf.executions += 1
            perf.total_latency_seconds += max(0.0, float(latency_seconds))
            if success:
                perf.successes += 1
            else:
                perf.failures += 1

    def get(self, agent_name: str) -> AgentPerformance:
        key = agent_name.strip().lower()
        with self._lock:
            perf = self._performance.get(key, AgentPerformance())
            return AgentPerformance(
                executions=perf.executions,
                successes=perf.successes,
                failures=perf.failures,
                total_latency_seconds=perf.total_latency_seconds,
            )

    def snapshot(self) -> dict[str, dict[str, float | int]]:
        with self._lock:
            items = {
                key: AgentPerformance(
                    executions=value.executions,
                    successes=value.successes,
                    failures=value.failures,
                    total_latency_seconds=value.total_latency_seconds,
                )
                for key, value in self._performance.items()
            }

        return {
            key: {
                "executions": item.executions,
                "successes": item.successes,
                "failures": item.failures,
                "success_rate": round(item.success_rate, 4),
                "average_latency": round(item.average_latency, 4),
            }
            for key, item in items.items()
        }
