from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from threading import RLock
from typing import Any
from uuid import uuid4

from core.common import utc_now


@dataclass(slots=True)
class TraceSpan:
    span_id: str
    trace_id: str
    name: str
    started_at: str
    ended_at: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


class TraceManager:
    def __init__(self) -> None:
        self._lock = RLock()
        self._traces: dict[str, list[TraceSpan]] = defaultdict(list)

    def start_span(self, trace_id: str, name: str, metadata: dict[str, Any] | None = None) -> TraceSpan:
        span = TraceSpan(
            span_id=str(uuid4()),
            trace_id=trace_id,
            name=name,
            started_at=utc_now().isoformat(),
            metadata=dict(metadata or {}),
        )
        with self._lock:
            self._traces[trace_id].append(span)
        return span

    def end_span(self, span: TraceSpan, metadata: dict[str, Any] | None = None) -> None:
        span.ended_at = utc_now().isoformat()
        if metadata:
            span.metadata.update(metadata)

    def get_trace(self, trace_id: str) -> list[TraceSpan]:
        with self._lock:
            return list(self._traces.get(trace_id, []))
