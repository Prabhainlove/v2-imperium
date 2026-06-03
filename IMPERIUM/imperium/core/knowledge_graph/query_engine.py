from __future__ import annotations

from core.common import KnowledgeEntity, KnowledgeEvidence, KnowledgeRelationship


class QueryEngine:
    def query(
        self,
        *,
        entities: list[KnowledgeEntity],
        relationships: list[KnowledgeRelationship],
        evidence_items: list[KnowledgeEvidence],
        entity_type: str | None = None,
        min_confidence: float = 0.0,
        text: str | None = None,
    ) -> dict[str, list[dict[str, object]]]:
        normalized_type = entity_type.strip().lower() if entity_type else None
        min_score = max(0.0, min(1.0, float(min_confidence)))
        needle = text.strip().lower() if text else None

        entity_rows: list[dict[str, object]] = []
        for entity in entities:
            if normalized_type and entity.entity_type != normalized_type:
                continue
            if entity.confidence < min_score:
                continue
            if needle and needle not in str(entity.attributes).lower():
                continue
            entity_rows.append(
                {
                    "entity_id": entity.entity_id,
                    "entity_type": entity.entity_type,
                    "attributes": dict(entity.attributes),
                    "confidence": entity.confidence,
                    "created_at": entity.created_at.isoformat(),
                    "updated_at": entity.updated_at.isoformat(),
                }
            )

        relationship_rows = [
            {
                "relationship_id": relation.relationship_id,
                "source_entity_id": relation.source_entity_id,
                "target_entity_id": relation.target_entity_id,
                "relationship_type": relation.relationship_type,
                "confidence": relation.confidence,
                "evidence_ids": list(relation.evidence_ids),
                "created_at": relation.created_at.isoformat() if relation.created_at else None,
            }
            for relation in relationships
            if relation.confidence >= min_score
        ]

        evidence_rows = [
            {
                "evidence_id": evidence.evidence_id,
                "content": evidence.content,
                "source": evidence.source,
                "confidence": evidence.confidence,
                "timestamp": evidence.timestamp.isoformat(),
                "metadata": dict(evidence.metadata),
            }
            for evidence in evidence_items
            if evidence.confidence >= min_score
        ]

        return {
            "entities": entity_rows,
            "relationships": relationship_rows,
            "evidence": evidence_rows,
        }
