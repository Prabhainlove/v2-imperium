from __future__ import annotations

from dataclasses import replace
from threading import RLock
from uuid import uuid4

from core.common import KnowledgeRelationship, utc_now


class RelationshipManager:
    def __init__(self) -> None:
        self._lock = RLock()
        self._relationships: dict[str, KnowledgeRelationship] = {}

    def add_relationship(
        self,
        *,
        source_entity_id: str,
        target_entity_id: str,
        relationship_type: str,
        confidence: float,
        evidence_ids: list[str] | None = None,
        relationship_id: str | None = None,
    ) -> KnowledgeRelationship:
        relationship = KnowledgeRelationship(
            relationship_id=relationship_id or str(uuid4()),
            source_entity_id=source_entity_id,
            target_entity_id=target_entity_id,
            relationship_type=relationship_type.strip().lower(),
            confidence=max(0.0, min(1.0, float(confidence))),
            evidence_ids=list(evidence_ids or []),
            created_at=utc_now(),
        )

        with self._lock:
            self._relationships[relationship.relationship_id] = relationship

        return replace(relationship)

    def list_relationships(self) -> list[KnowledgeRelationship]:
        with self._lock:
            return [replace(item) for item in self._relationships.values()]

    def by_entity(self, entity_id: str) -> list[KnowledgeRelationship]:
        with self._lock:
            return [
                replace(item)
                for item in self._relationships.values()
                if item.source_entity_id == entity_id or item.target_entity_id == entity_id
            ]
