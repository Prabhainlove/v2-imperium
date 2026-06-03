from __future__ import annotations

from statistics import fmean

from core.common import KnowledgeEvidence, KnowledgeRelationship


class ConfidenceEngine:
    def combine(
        self,
        *,
        base_confidence: float,
        relationship_confidences: list[KnowledgeRelationship],
        evidence_items: list[KnowledgeEvidence],
    ) -> float:
        scores: list[float] = [max(0.0, min(1.0, float(base_confidence)))]
        scores.extend(item.confidence for item in relationship_confidences)
        scores.extend(item.confidence for item in evidence_items)

        if not scores:
            return 0.0

        return max(0.0, min(1.0, float(fmean(scores))))
