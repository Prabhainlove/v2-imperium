from __future__ import annotations

from typing import Any

from core.common import KnowledgeEntity, KnowledgeEvidence, KnowledgeRelationship
from core.knowledge_graph.confidence_engine import ConfidenceEngine
from core.knowledge_graph.entity_store import EntityStore
from core.knowledge_graph.evidence_manager import EvidenceManager
from core.knowledge_graph.query_engine import QueryEngine
from core.knowledge_graph.relationship_manager import RelationshipManager


class KnowledgeGraph:
    def __init__(
        self,
        *,
        entity_store: EntityStore | None = None,
        relationship_manager: RelationshipManager | None = None,
        evidence_manager: EvidenceManager | None = None,
        confidence_engine: ConfidenceEngine | None = None,
        query_engine: QueryEngine | None = None,
    ) -> None:
        self.entity_store = entity_store or EntityStore()
        self.relationship_manager = relationship_manager or RelationshipManager()
        self.evidence_manager = evidence_manager or EvidenceManager()
        self.confidence_engine = confidence_engine or ConfidenceEngine()
        self.query_engine = query_engine or QueryEngine()

    def add_entity(
        self,
        entity_type: str,
        attributes: dict[str, Any],
        *,
        confidence: float = 0.5,
        entity_id: str | None = None,
    ) -> KnowledgeEntity:
        return self.entity_store.add_entity(
            entity_type=entity_type,
            attributes=attributes,
            confidence=confidence,
            entity_id=entity_id,
        )

    def add_relationship(
        self,
        source_entity_id: str,
        target_entity_id: str,
        relationship_type: str,
        *,
        confidence: float = 0.5,
        evidence_ids: list[str] | None = None,
        relationship_id: str | None = None,
    ) -> KnowledgeRelationship:
        return self.relationship_manager.add_relationship(
            source_entity_id=source_entity_id,
            target_entity_id=target_entity_id,
            relationship_type=relationship_type,
            confidence=confidence,
            evidence_ids=evidence_ids,
            relationship_id=relationship_id,
        )

    def add_evidence(
        self,
        content: str,
        source: str,
        *,
        confidence: float = 0.5,
        metadata: dict[str, Any] | None = None,
        evidence_id: str | None = None,
    ) -> KnowledgeEvidence:
        return self.evidence_manager.add_evidence(
            content=content,
            source=source,
            confidence=confidence,
            metadata=metadata,
            evidence_id=evidence_id,
        )

    def query(
        self,
        *,
        entity_type: str | None = None,
        min_confidence: float = 0.0,
        text: str | None = None,
    ) -> dict[str, list[dict[str, object]]]:
        return self.query_engine.query(
            entities=self.entity_store.list_entities(),
            relationships=self.relationship_manager.list_relationships(),
            evidence_items=self.evidence_manager.list_evidence(),
            entity_type=entity_type,
            min_confidence=min_confidence,
            text=text,
        )

    def refresh_entity_confidence(self, entity_id: str) -> float:
        entity = self.entity_store.get_entity(entity_id)
        if entity is None:
            raise KeyError(f"Unknown entity_id: {entity_id}")

        relations = self.relationship_manager.by_entity(entity_id)
        evidence_items = [
            evidence
            for relation in relations
            for evidence_id in relation.evidence_ids
            for evidence in [self.evidence_manager.get_evidence(evidence_id)]
            if evidence is not None
        ]

        confidence = self.confidence_engine.combine(
            base_confidence=entity.confidence,
            relationship_confidences=relations,
            evidence_items=evidence_items,
        )
        self.entity_store.update_confidence(entity_id, confidence)
        return confidence
