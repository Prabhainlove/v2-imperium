"""
Query Expansion Engine

Generates multiple search queries from a single question to increase
research coverage and find diverse sources.
"""

import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class QueryExpansionEngine:
    """
    Expands queries into multiple search variations.
    
    Uses various techniques:
    - Synonym expansion
    - Related terms
    - Specific/general variations
    - Different phrasings
    - Domain-specific queries
    """
    
    def __init__(self):
        self.expansion_cache: Dict[str, List[str]] = {}
    
    async def expand(
        self,
        query: str,
        strategies: List[Any],
    ) -> List[str]:
        """
        Expand query into multiple search queries.
        
        Args:
            query: Original query
            strategies: Research strategies being used
        
        Returns:
            List of expanded queries
        """
        # Check cache
        cache_key = query.lower()[:100]
        if cache_key in self.expansion_cache:
            return self.expansion_cache[cache_key]
        
        expanded = [query]  # Always include original
        
        # Add variations
        expanded.extend(self._create_variations(query))
        
        # Add strategy-specific queries
        for strategy in strategies:
            expanded.extend(self._strategy_specific_queries(query, strategy))
        
        # Add temporal variations
        expanded.extend(self._add_temporal_variations(query))
        
        # Remove duplicates while preserving order
        seen = set()
        unique_expanded = []
        for q in expanded:
            q_lower = q.lower()
            if q_lower not in seen:
                seen.add(q_lower)
                unique_expanded.append(q)
        
        # Cache results
        self.expansion_cache[cache_key] = unique_expanded[:10]  # Max 10 queries
        
        return unique_expanded[:10]
    
    def _create_variations(self, query: str) -> List[str]:
        """Create query variations."""
        variations = []
        
        # Add question variations
        if "?" not in query:
            variations.append(f"what is {query}")
            variations.append(f"how does {query} work")
        
        # Add specificity variations
        variations.append(f"{query} overview")
        variations.append(f"{query} detailed explanation")
        variations.append(f"{query} examples")
        variations.append(f"{query} tutorial")
        
        # Add comparison variations
        variations.append(f"{query} comparison")
        variations.append(f"{query} vs alternatives")
        
        return variations
    
    def _strategy_specific_queries(self, query: str, strategy: Any) -> List[str]:
        """Generate strategy-specific queries."""
        strategy_queries = []
        strategy_name = strategy.value if hasattr(strategy, "value") else str(strategy)
        
        if "academic" in strategy_name.lower():
            strategy_queries.extend([
                f"{query} research paper",
                f"{query} scientific study",
                f"{query} peer reviewed",
            ])
        
        elif "code" in strategy_name.lower():
            strategy_queries.extend([
                f"{query} implementation",
                f"{query} github",
                f"{query} code example",
                f"{query} library",
            ])
        
        elif "dataset" in strategy_name.lower():
            strategy_queries.extend([
                f"{query} dataset",
                f"{query} data collection",
                f"{query} benchmark",
            ])
        
        elif "web" in strategy_name.lower():
            strategy_queries.extend([
                f"{query} guide",
                f"{query} documentation",
            ])
        
        return strategy_queries
    
    def _add_temporal_variations(self, query: str) -> List[str]:
        """Add temporal variations to query."""
        temporal = []
        
        # Recent information
        temporal.append(f"{query} latest")
        temporal.append(f"{query} 2024")
        temporal.append(f"{query} recent")
        temporal.append(f"{query} current")
        
        return temporal


class HypothesisEngine:
    """
    Generates and tests hypotheses for complex research questions.
    """
    
    def __init__(self):
        self.hypothesis_history: List[Dict[str, Any]] = []
    
    async def generate_hypotheses(
        self,
        query: str,
        context: Dict[str, Any],
    ) -> List[Any]:
        """
        Generate multiple hypotheses for a query.
        
        Args:
            query: Research question
            context: Additional context
        
        Returns:
            List of Hypothesis objects
        """
        from modules.reasoning.advanced_reasoning import Hypothesis
        from uuid import uuid4
        
        hypotheses = []
        
        # Hypothesis 1: Direct answer
        hypotheses.append(Hypothesis(
            hypothesis_id=str(uuid4()),
            statement=f"{query} - affirmative hypothesis",
            confidence=0.5,
            status="active",
        ))
        
        # Hypothesis 2: Alternative explanation
        hypotheses.append(Hypothesis(
            hypothesis_id=str(uuid4()),
            statement=f"{query} - alternative explanation",
            confidence=0.5,
            status="active",
        ))
        
        # Hypothesis 3: Null hypothesis
        hypotheses.append(Hypothesis(
            hypothesis_id=str(uuid4()),
            statement=f"{query} - null hypothesis (no significant effect)",
            confidence=0.5,
            status="active",
        ))
        
        logger.info(f"Generated {len(hypotheses)} hypotheses for: {query[:50]}")
        
        return hypotheses
    
    async def test_hypothesis(
        self,
        hypothesis: Any,
        sources: List[Dict[str, Any]],
    ) -> None:
        """
        Test hypothesis against sources.
        
        Args:
            hypothesis: Hypothesis to test
            sources: Available sources
        """
        supporting = 0
        contradicting = 0
        
        # Simple keyword matching (would use NLP in production)
        hyp_words = set(hypothesis.statement.lower().split())
        
        for source in sources[:20]:  # Test against top 20 sources
            content = (
                source.get("snippet", "") + " " +
                source.get("abstract", "") + " " +
                source.get("description", "")
            ).lower()
            
            content_words = set(content.split())
            overlap = len(hyp_words & content_words)
            
            if overlap > len(hyp_words) / 2:
                supporting += 1
                hypothesis.supporting_evidence.append(source)
            elif "not" in content or "no" in content:
                contradicting += 1
                hypothesis.contradicting_evidence.append(source)
        
        # Update confidence based on evidence
        if supporting + contradicting > 0:
            ratio = supporting / (supporting + contradicting)
            hypothesis.confidence = ratio
            
            if ratio > 0.7:
                hypothesis.status = "validated"
            elif ratio < 0.3:
                hypothesis.status = "refuted"
            else:
                hypothesis.status = "uncertain"
        
        logger.info(f"Tested hypothesis: {hypothesis.statement[:50]} - "
                   f"Support: {supporting}, Contradict: {contradicting}, "
                   f"Confidence: {hypothesis.confidence:.2f}")


class KnowledgeSynthesizer:
    """
    Synthesizes knowledge from multiple sources into coherent conclusions.
    """
    
    async def synthesize(
        self,
        query: str,
        sources: List[Dict[str, Any]],
        hypotheses: List[Any],
        contradictions: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Synthesize research findings.
        
        Args:
            query: Original query
            sources: All sources found
            hypotheses: Tested hypotheses
            contradictions: Detected contradictions
        
        Returns:
            Synthesis result
        """
        # Group sources by type
        by_type = {}
        for source in sources:
            content_type = source.get("content_type", "web")
            if content_type not in by_type:
                by_type[content_type] = []
            by_type[content_type].append(source)
        
        # Calculate confidence based on source diversity and quality
        confidence = self._calculate_confidence(sources, contradictions)
        
        # If no sources found, use simple researcher
        if len(sources) == 0:
            from .simple_research import SimpleResearcher
            simple_researcher = SimpleResearcher()
            simple_result = simple_researcher.research(query)
            
            conclusion = simple_result['final_answer']
            confidence = simple_result['confidence_score']
            
            # Add simple research to sources
            sources = simple_result['supporting_sources']
        else:
            # Build conclusion from actual sources
            conclusion_parts = [
                f"Research findings for: {query}",
                f"\nAnalyzed {len(sources)} sources across {len(by_type)} categories.",
            ]
            
            # Add source type breakdown
            for content_type, type_sources in by_type.items():
                conclusion_parts.append(
                    f"\n{content_type.capitalize()}: {len(type_sources)} sources"
                )
                # Add top source from each type
                if type_sources:
                    top = type_sources[0]
                    conclusion_parts.append(f"  - {top.get('title', 'N/A')[:80]}")
            
            # Add hypothesis results if available
            if hypotheses:
                conclusion_parts.append(f"\nHypothesis testing results:")
                for hyp in hypotheses:
                    conclusion_parts.append(
                        f"  - {hyp.statement[:60]}: "
                        f"{hyp.status} (confidence: {hyp.confidence:.2f})"
                    )
            
            # Add contradiction note if any
            if contradictions:
                conclusion_parts.append(
                    f"\nNote: Found {len(contradictions)} contradictory claims "
                    f"requiring further investigation."
                )
            
            conclusion = "\n".join(conclusion_parts)
        
        # Evidence summary
        evidence_summary = {
            "total_sources": len(sources),
            "source_types": list(by_type.keys()),
            "high_quality_sources": len([
                s for s in sources
                if s.get("relevance_score", 0) > 0.7
            ]),
            "academic_sources": len(by_type.get("academic", [])),
            "code_sources": len(by_type.get("code", [])),
        }
        
        return {
            "conclusion": conclusion,
            "confidence": confidence,
            "evidence_summary": evidence_summary,
        }
    
    def _calculate_confidence(
        self,
        sources: List[Dict[str, Any]],
        contradictions: List[Dict[str, Any]],
    ) -> float:
        """Calculate overall confidence in findings."""
        if not sources:
            return 0.0
        
        # Base confidence on source count
        confidence = min(len(sources) / 20, 1.0) * 0.5
        
        # Boost for source diversity
        source_types = set(s.get("content_type", "web") for s in sources)
        diversity_bonus = len(source_types) * 0.1
        confidence += diversity_bonus
        
        # Boost for high-quality sources
        high_quality = sum(1 for s in sources if s.get("relevance_score", 0) > 0.7)
        quality_bonus = min(high_quality / 10, 1.0) * 0.2
        confidence += quality_bonus
        
        # Penalty for contradictions
        if contradictions:
            contradiction_penalty = min(len(contradictions) * 0.1, 0.3)
            confidence -= contradiction_penalty
        
        return max(0.0, min(1.0, confidence))
