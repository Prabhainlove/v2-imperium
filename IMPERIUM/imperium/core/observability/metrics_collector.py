from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from threading import RLock
from time import perf_counter
from typing import Any


@dataclass(slots=True)
class TimerContext:
    metric: str
    start: float


class MetricsCollector:
    def __init__(self) -> None:
        self._lock = RLock()
        self._counters: dict[str, float] = defaultdict(float)
        self._gauges: dict[str, float] = {}
        self._histograms: dict[str, list[float]] = defaultdict(list)

    def increment(self, metric: str, value: float = 1.0) -> None:
        key = metric.strip().lower()
        if not key:
            raise ValueError("metric cannot be empty")

        with self._lock:
            self._counters[key] += float(value)

    def set_gauge(self, metric: str, value: float) -> None:
        key = metric.strip().lower()
        if not key:
            raise ValueError("metric cannot be empty")

        with self._lock:
            self._gauges[key] = float(value)

    def observe(self, metric: str, value: float) -> None:
        key = metric.strip().lower()
        if not key:
            raise ValueError("metric cannot be empty")

        with self._lock:
            self._histograms[key].append(float(value))

    def start_timer(self, metric: str) -> TimerContext:
        return TimerContext(metric=metric, start=perf_counter())

    def stop_timer(self, context: TimerContext) -> float:
        elapsed = perf_counter() - context.start
        self.observe(context.metric, elapsed)
        return elapsed

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            counters = dict(self._counters)
            gauges = dict(self._gauges)
            histograms = {k: list(v) for k, v in self._histograms.items()}

        return {
            "counters": counters,
            "gauges": gauges,
            "histograms": histograms,
        }
