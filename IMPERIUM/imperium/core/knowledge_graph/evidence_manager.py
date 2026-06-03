from __future__ import annotations

from dataclasses import replace
from threading import RLock
from typing import Any
from uuid import uuid4

from core.common import KnowledgeEvidence, utc_now


class EvidenceManager:
    def __init__(self) -> None:
        self._lock = RLock()
        self._evidence: dict[str, KnowledgeEvidence] = {}

    def add_evidence(
        self,
        *,
        content: str,
        source: str,
        confidence: float,
        metadata: dict[str, Any] | None = None,
        evidence_id: str | None = None,
    ) -> KnowledgeEvidence:
        evidence = KnowledgeEvidence(
            evidence_id=evidence_id or str(uuid4()),
            content=content,
            source=source,
            confidence=max(0.0, min(1.0, float(confidence))),
            timestamp=utc_now(),
            metadata=dict(metadata or {}),
        )

        with self._lock:
            self._evidence[evidence.evidence_id] = evidence

        return replace(evidence)

    def get_evidence(self, evidence_id: str) -> KnowledgeEvidence | None:
        with self._lock:
            item = self._evidence.get(evidence_id)
            return replace(item) if item is not None else None

    def list_evidence(self) -> list[KnowledgeEvidence]:
        with self._lock:
            return [replace(item) for item in self._evidence.values()]
