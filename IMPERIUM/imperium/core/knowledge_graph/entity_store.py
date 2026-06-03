from __future__ import annotations

from dataclasses import replace
from threading import RLock
from typing import Any
from uuid import uuid4

from core.common import KnowledgeEntity, utc_now


class EntityStore:
    def __init__(self) -> None:
        self._lock = RLock()
        self._entities: dict[str, KnowledgeEntity] = {}

    def add_entity(
        self,
        *,
        entity_type: str,
        attributes: dict[str, Any],
        confidence: float,
        entity_id: str | None = None,
    ) -> KnowledgeEntity:
        now = utc_now()
        key = entity_id or str(uuid4())

        entity = KnowledgeEntity(
            entity_id=key,
            entity_type=entity_type.strip().lower(),
            attributes=dict(attributes),
            confidence=max(0.0, min(1.0, float(confidence))),
            created_at=now,
            updated_at=now,
        )

        with self._lock:
            self._entities[entity.entity_id] = entity

        return replace(entity)

    def get_entity(self, entity_id: str) -> KnowledgeEntity | None:
        with self._lock:
            entity = self._entities.get(entity_id)
            return replace(entity) if entity is not None else None

    def list_entities(self) -> list[KnowledgeEntity]:
        with self._lock:
            return [replace(entity) for entity in self._entities.values()]

    def update_confidence(self, entity_id: str, confidence: float) -> None:
        with self._lock:
            entity = self._entities.get(entity_id)
            if entity is None:
                return

            entity.confidence = max(0.0, min(1.0, float(confidence)))
            entity.updated_at = utc_now()
