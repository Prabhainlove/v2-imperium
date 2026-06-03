"""
Evidence Graph System

Tracks evidence, sources, and relationships for research.
Detects contradictions and computes confidence scores.
"""

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class EvidenceGraph:
    """
    Graph-based evidence tracking system.
    
    Stores sources, claims, and their relationships.
    Detects contradictions and validates cross-references.
    """
    
    def __init__(self):
        self.sources: Dict[str, Dict[str, Any]] = {}
        self.claims: Dict[str, Dict[str, Any]] = {}
        self.edges: List[Dict[str, Any]] = []  # Relationships
    
    async def add_source(self, source: Dict[str, Any]) -> str:
        """
        Add a source to the evidence graph.
        
        Args:
            source: Source dictionary
        
        Returns:
            Source ID
        """
        source_id = source.get("url", str(len(self.sources)))
        
        if source_id not in self.sources:
            self.sources[source_id] = {
                "id": source_id,
                "title": source.get("title", ""),
                "url": source.get("url", ""),
                "snippet": source.get("snippet", ""),
                "source_type": source.get("content_type", "web"),
                "relevance_score": source.get("relevance_score", 0.5),
                "metadata": source.get("metadata", {}),
            }
            
            logger.debug(f"Added source: {source.get('title', 'Unknown')[:50]}")
        
        return source_id
    
    async def add_claim(
        self,
        claim: str,
        supported_by: Optional[List[str]] = None,
    ) -> str:
        """
        Add a claim to the graph.
        
        Args:
            claim: Claim statement
            supported_by: List of source IDs
        
        Returns:
            Claim ID
        """
        import hashlib
        claim_id = hashlib.md5(claim.lower().encode()).hexdigest()[:16]
        
        if claim_id not in self.claims:
            self.claims[claim_id] = {
                "id": claim_id,
                "statement": claim,
                "supporting_sources": supported_by or [],
                "contradicting_sources": [],
                "confidence": 0.5,
            }
        
        return claim_id
    
    async def detect_contradictions(self) -> List[Dict[str, Any]]:
        """
        Detect contradictory information across sources.
        
        Returns:
            List of detected contradictions
        """
        contradictions = []
        
        # Look for opposing keywords in snippets
        opposing_pairs = [
            ("yes", "no"),
            ("true", "false"),
            ("increase", "decrease"),
            ("positive", "negative"),
            ("effective", "ineffective"),
            ("safe", "unsafe"),
            ("proven", "unproven"),
        ]
        
        # Group sources by similarity
        snippets = [
            (sid, s.get("snippet", "").lower())
            for sid, s in self.sources.items()
        ]
        
        for i, (sid1, snippet1) in enumerate(snippets):
            for sid2, snippet2 in snippets[i+1:]:
                # Check for opposing terms
                for term1, term2 in opposing_pairs:
                    if term1 in snippet1 and term2 in snippet2:
                        contradictions.append({
                            "source1": sid1,
                            "source2": sid2,
                            "source1_title": self.sources[sid1].get("title", ""),
                            "source2_title": self.sources[sid2].get("title", ""),
                            "opposing_terms": (term1, term2),
                            "snippet1": snippet1[:100],
                            "snippet2": snippet2[:100],
                        })
                        logger.info(f"Detected contradiction: {term1} vs {term2}")
                        break
        
        return contradictions[:10]  # Limit to 10 contradictions
    
    def get_summary(self) -> Dict[str, Any]:
        """Get summary statistics."""
        return {
            "total_sources": len(self.sources),
            "total_claims": len(self.claims),
            "source_types": self._count_source_types(),
            "avg_relevance": self._calculate_avg_relevance(),
        }
    
    def _count_source_types(self) -> Dict[str, int]:
        """Count sources by type."""
        types = {}
        for source in self.sources.values():
            source_type = source.get("source_type", "unknown")
            types[source_type] = types.get(source_type, 0) + 1
        return types
    
    def _calculate_avg_relevance(self) -> float:
        """Calculate average relevance score."""
        if not self.sources:
            return 0.0
        
        total = sum(s.get("relevance_score", 0) for s in self.sources.values())
        return total / len(self.sources)
