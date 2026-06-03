"""
Research Director - Main Research Process Controller

Orchestrates the entire research process including strategy selection,
hypothesis generation, and evidence synthesis.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from enum import Enum

logger = logging.getLogger(__name__)


class ResearchStrategy(Enum):
    """Available research strategies."""
    WEB_SEARCH = "web_search"
    ACADEMIC_SEARCH = "academic_search"
    CODE_SEARCH = "code_search"
    DATASET_SEARCH = "dataset_search"
    HYBRID = "hybrid"


class ResearchComplexity(Enum):
    """Research complexity levels."""
    SIMPLE = "simple"  # Single strategy
    MODERATE = "moderate"  # 2-3 strategies
    COMPLEX = "complex"  # Multiple strategies with hypothesis testing


@dataclass
class ResearchTask:
    """Research task specification."""
    query: str
    context: Dict[str, Any]
    strategies: List[ResearchStrategy]
    max_sources: int = 50
    require_academic: bool = False
    require_code: bool = False
    depth: str = "moderate"  # shallow, moderate, deep


@dataclass
class ResearchResult:
    """Complete research result."""
    query: str
    final_answer: str
    supporting_sources: List[Dict[str, Any]]
    evidence_summary: Dict[str, Any]
    contradictions_found: List[Dict[str, Any]]
    confidence_score: float
    reasoning_trace: List[Dict[str, Any]]
    strategies_used: List[str]
    execution_time: float


class ResearchDirector:
    """
    Main research process controller.
    
    Analyzes queries, selects appropriate strategies, coordinates
    multiple research pipelines, and synthesizes final results.
    """
    
    def __init__(
        self,
        web_researcher=None,
        academic_researcher=None,
        code_researcher=None,
        dataset_researcher=None,
        hypothesis_engine=None,
        evidence_graph=None,
        query_expander=None,
        knowledge_synthesizer=None,
    ):
        self.web_researcher = web_researcher
        self.academic_researcher = academic_researcher
        self.code_researcher = code_researcher
        self.dataset_researcher = dataset_researcher
        self.hypothesis_engine = hypothesis_engine
        self.evidence_graph = evidence_graph
        self.query_expander = query_expander
        self.knowledge_synthesizer = knowledge_synthesizer
        
        self.research_memory: Dict[str, Any] = {}
    
    async def conduct_research(
        self,
        query: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> ResearchResult:
        """
        Conduct comprehensive research on a query.
        
        Args:
            query: Research question
            context: Additional context
        
        Returns:
            Complete research result
        """
        import time
        start_time = time.time()
        
        context = context or {}
        reasoning_trace = []
        
        # Step 1: Analyze query and determine complexity
        complexity = self._analyze_complexity(query)
        reasoning_trace.append({
            "step": "analysis",
            "complexity": complexity.value,
            "reasoning": f"Query complexity determined as {complexity.value}",
        })
        
        # Step 2: Select research strategies
        strategies = self._select_strategies(query, context, complexity)
        reasoning_trace.append({
            "step": "strategy_selection",
            "strategies": [s.value for s in strategies],
            "reasoning": f"Selected {len(strategies)} research strategies",
        })
        
        # Step 3: Expand query (generate multiple search queries)
        expanded_queries = await self._expand_query(query, strategies)
        reasoning_trace.append({
            "step": "query_expansion",
            "queries": expanded_queries,
            "count": len(expanded_queries),
        })
        
        # Step 4: Generate hypotheses for complex queries
        hypotheses = []
        if complexity == ResearchComplexity.COMPLEX and self.hypothesis_engine:
            hypotheses = await self.hypothesis_engine.generate_hypotheses(query, context)
            reasoning_trace.append({
                "step": "hypothesis_generation",
                "hypotheses": [h.statement for h in hypotheses],
                "count": len(hypotheses),
            })
        
        # Step 5: Execute parallel research across strategies
        all_sources = await self._execute_parallel_research(
            expanded_queries,
            strategies,
            context,
        )
        reasoning_trace.append({
            "step": "research_execution",
            "sources_found": len(all_sources),
            "strategies_used": [s.value for s in strategies],
        })
        
        # Step 6: Build evidence graph
        if self.evidence_graph:
            for source in all_sources:
                await self.evidence_graph.add_source(source)
            
            # Detect contradictions
            contradictions = await self.evidence_graph.detect_contradictions()
            reasoning_trace.append({
                "step": "contradiction_detection",
                "contradictions_found": len(contradictions),
            })
        else:
            contradictions = []
        
        # Step 7: Test hypotheses if generated
        if hypotheses and self.hypothesis_engine:
            for hypothesis in hypotheses:
                await self.hypothesis_engine.test_hypothesis(
                    hypothesis,
                    all_sources,
                )
            reasoning_trace.append({
                "step": "hypothesis_testing",
                "results": [
                    {
                        "hypothesis": h.statement,
                        "confidence": h.confidence,
                        "status": h.status,
                    }
                    for h in hypotheses
                ],
            })
        
        # Step 8: Synthesize knowledge
        if self.knowledge_synthesizer:
            synthesis = await self.knowledge_synthesizer.synthesize(
                query=query,
                sources=all_sources,
                hypotheses=hypotheses,
                contradictions=contradictions,
            )
            final_answer = synthesis.get("conclusion", "")
            evidence_summary = synthesis.get("evidence_summary", {})
            confidence_score = synthesis.get("confidence", 0.5)
        else:
            # Use simple researcher as fallback
            from .simple_research import SimpleResearcher
            simple_researcher = SimpleResearcher()
            simple_result = simple_researcher.research(query)
            
            final_answer = simple_result['final_answer']
            evidence_summary = simple_result['evidence_summary']
            confidence_score = simple_result['confidence_score']
            
            # Add simple research sources to all_sources
            if simple_result['supporting_sources']:
                all_sources.extend(simple_result['supporting_sources'])
        
        reasoning_trace.append({
            "step": "synthesis",
            "confidence": confidence_score,
            "sources_used": len(all_sources),
        })
        
        # Step 9: Store successful strategy for learning
        self._store_research_memory(query, strategies, len(all_sources), confidence_score)
        
        end_time = time.time()
        
        return ResearchResult(
            query=query,
            final_answer=final_answer,
            supporting_sources=all_sources[:20],  # Top 20 sources
            evidence_summary=evidence_summary,
            contradictions_found=contradictions,
            confidence_score=confidence_score,
            reasoning_trace=reasoning_trace,
            strategies_used=[s.value for s in strategies],
            execution_time=end_time - start_time,
        )
    
    def _analyze_complexity(self, query: str) -> ResearchComplexity:
        """Analyze query complexity."""
        query_lower = query.lower()
        word_count = len(query.split())
        
        # Complex indicators
        complex_keywords = [
            "analyze", "compare", "evaluate", "synthesize",
            "comprehensive", "detailed", "investigate", "assess",
        ]
        
        # Check for multiple questions
        has_multiple_questions = query.count("?") > 1 or " and " in query_lower
        
        # Check complexity indicators
        complex_count = sum(1 for kw in complex_keywords if kw in query_lower)
        
        if word_count > 20 or complex_count >= 2 or has_multiple_questions:
            return ResearchComplexity.COMPLEX
        elif word_count > 10 or complex_count >= 1:
            return ResearchComplexity.MODERATE
        else:
            return ResearchComplexity.SIMPLE
    
    def _select_strategies(
        self,
        query: str,
        context: Dict[str, Any],
        complexity: ResearchComplexity,
    ) -> List[ResearchStrategy]:
        """Select appropriate research strategies based on query analysis."""
        strategies = []
        query_lower = query.lower()
        
        # Always include web search as baseline
        strategies.append(ResearchStrategy.WEB_SEARCH)
        
        # Academic search indicators
        academic_keywords = [
            "research", "study", "paper", "scientific", "theory",
            "evidence", "peer-reviewed", "journal", "academic",
        ]
        if any(kw in query_lower for kw in academic_keywords):
            strategies.append(ResearchStrategy.ACADEMIC_SEARCH)
        
        # Code search indicators
        code_keywords = [
            "code", "implementation", "algorithm", "library",
            "api", "github", "programming", "function", "package",
        ]
        if any(kw in query_lower for kw in code_keywords):
            strategies.append(ResearchStrategy.CODE_SEARCH)
        
        # Dataset search indicators
        dataset_keywords = [
            "dataset", "data", "statistics", "benchmark",
            "corpus", "database", "collection",
        ]
        if any(kw in query_lower for kw in dataset_keywords):
            strategies.append(ResearchStrategy.DATASET_SEARCH)
        
        # For complex queries, use multiple strategies
        if complexity == ResearchComplexity.COMPLEX and len(strategies) == 1:
            strategies.append(ResearchStrategy.ACADEMIC_SEARCH)
        
        # Check memory for successful strategies
        if query_lower in self.research_memory:
            past_strategies = self.research_memory[query_lower].get("strategies", [])
            for strategy in past_strategies:
                if strategy not in strategies:
                    strategies.append(strategy)
        
        return strategies[:4]  # Maximum 4 strategies
    
    async def _expand_query(
        self,
        query: str,
        strategies: List[ResearchStrategy],
    ) -> List[str]:
        """Expand query into multiple search queries."""
        if self.query_expander:
            return await self.query_expander.expand(query, strategies)
        else:
            # Basic expansion
            return [
                query,
                f"{query} latest",
                f"{query} research",
                f"{query} examples",
            ]
    
    async def _execute_parallel_research(
        self,
        queries: List[str],
        strategies: List[ResearchStrategy],
        context: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """Execute research across all strategies in parallel."""
        tasks = []
        
        for strategy in strategies:
            if strategy == ResearchStrategy.WEB_SEARCH and self.web_researcher:
                for query in queries[:3]:  # Top 3 queries for web
                    tasks.append(self.web_researcher.search(query, context))
            
            elif strategy == ResearchStrategy.ACADEMIC_SEARCH and self.academic_researcher:
                for query in queries[:2]:  # Top 2 for academic
                    tasks.append(self.academic_researcher.search(query, context))
            
            elif strategy == ResearchStrategy.CODE_SEARCH and self.code_researcher:
                for query in queries[:2]:  # Top 2 for code
                    tasks.append(self.code_researcher.search(query, context))
            
            elif strategy == ResearchStrategy.DATASET_SEARCH and self.dataset_researcher:
                tasks.append(self.dataset_researcher.search(queries[0], context))
        
        # Execute all searches in parallel
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Flatten and filter results
            all_sources = []
            for result in results:
                if isinstance(result, Exception):
                    logger.error(f"Research task failed: {result}")
                    continue
                if isinstance(result, list):
                    all_sources.extend(result)
                elif isinstance(result, dict) and "sources" in result:
                    all_sources.extend(result["sources"])
            
            return all_sources
        
        return []
    
    def _store_research_memory(
        self,
        query: str,
        strategies: List[ResearchStrategy],
        sources_found: int,
        confidence: float,
    ) -> None:
        """Store successful research strategy for future use."""
        query_key = query.lower()[:100]  # Limit key length
        
        if confidence > 0.7 and sources_found > 5:
            self.research_memory[query_key] = {
                "strategies": strategies,
                "sources_count": sources_found,
                "confidence": confidence,
            }
