from __future__ import annotations

from typing import Any

from core.common import EventRecord
from core.event_system import EventStream
from core.observability.event_logger import EventLogger
from core.observability.metrics_collector import MetricsCollector
from core.observability.system_monitor import SystemMonitor
from core.observability.trace_manager import TraceManager


class Observability:
    def __init__(
        self,
        *,
        event_stream: EventStream | None = None,
        event_logger: EventLogger | None = None,
        metrics: MetricsCollector | None = None,
        trace_manager: TraceManager | None = None,
        system_monitor: SystemMonitor | None = None,
    ) -> None:
        self.event_stream = event_stream
        self.event_logger = event_logger or EventLogger()
        self.metrics = metrics or MetricsCollector()
        self.trace_manager = trace_manager or TraceManager()
        self.system_monitor = system_monitor or SystemMonitor()

        self.system_monitor.set_sink(self.record_metric)

    def start(self) -> None:
        self.system_monitor.start()

    def shutdown(self) -> None:
        self.system_monitor.shutdown()

    def log_event(self, event: EventRecord) -> None:
        self.event_logger.log(event)
        self.metrics.increment(f"events.{event.event_type}.{event.name}")

    def record_metric(self, name: str, value: float) -> None:
        self.metrics.set_gauge(name, value)

    def observe(self, name: str, value: float) -> None:
        self.metrics.observe(name, value)

    def attach_to_stream(self) -> None:
        if self.event_stream is None:
            return
        self.event_stream.subscribe(self.log_event)

    def snapshot(self) -> dict[str, Any]:
        return {
            "metrics": self.metrics.snapshot(),
            "recent_events": self.event_logger.recent(100),
        }
