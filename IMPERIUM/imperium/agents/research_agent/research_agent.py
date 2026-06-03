"""
IMPERIUM High-Intelligence Research Agent

Production-ready research system with real internet search capabilities.
Integrates multiple research pipelines for comprehensive investigation.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from agents.research_agent.modules.execution.executor import ExecutionController
from agents.research_agent.modules.memory.semantic_memory import SemanticMemory
from agents.research_agent.modules.planning.planner import ChainOfThoughtPlanner, HierarchicalPlanner
from agents.research_agent.modules.reasoning.react_engine import ReActEngine
from agents.research_agent.modules.reasoning.reflexion import ReflexionEvaluator
from agents.research_agent.modules.reasoning.thinking_engine import ThinkingEngine, ThinkingLevel
from agents.research_agent.modules.reasoning.advanced_reasoning import (
    AdvancedReasoningEngine,
    ReasoningStrategy,
)
from agents.research_agent.modules.research.research_director import ResearchDirector
from agents.research_agent.modules.research.web_research import WebResearchPipeline
from agents.research_agent.modules.research.academic_research import AcademicResearchPipeline
from agents.research_agent.modules.research.code_dataset_research import CodeResearchPipeline, DatasetResearchPipeline
from agents.research_agent.modules.research.query_hypothesis_synthesis import (
    QueryExpansionEngine,
    HypothesisEngine,
    KnowledgeSynthesizer,
)
from agents.research_agent.modules.research.evidence_graph import EvidenceGraph
from agents.research_agent.modules.tools.tool_registry import ToolRegistry
from agents.research_agent.modules.validation.validator import TaskValidator

logger = logging.getLogger(__name__)


class ResearchAgentConfig:
    """Configuration for the High-Intelligence Research Agent."""
    
    def __init__(
        self,
        max_iterations: int = 20,
        max_tool_calls_per_step: int = 5,
        enable_reflexion: bool = True,
        enable_memory: bool = True,
        enable_validation: bool = True,
        enable_thinking: bool = True,
        enable_advanced_reasoning: bool = True,
        enable_internet_research: bool = True,
        enable_evidence_tracking: bool = True,
        enable_hypothesis_testing: bool = True,
        max_concurrent_searches: int = 5,
        temperature: float = 0.7,
        model: str = "gpt-4",
    ):
        self.max_iterations = max_iterations
        self.max_tool_calls_per_step = max_tool_calls_per_step
        self.enable_reflexion = enable_reflexion
        self.enable_memory = enable_memory
        self.enable_validation = enable_validation
        self.enable_thinking = enable_thinking
        self.enable_advanced_reasoning = enable_advanced_reasoning
        self.enable_internet_research = enable_internet_research
        self.enable_evidence_tracking = enable_evidence_tracking
        self.enable_hypothesis_testing = enable_hypothesis_testing
        self.max_concurrent_searches = max_concurrent_searches
        self.temperature = temperature
        self.model = model


class ResearchAgent:
    """
    IMPERIUM High-Intelligence Research Agent - Native integration with IMPERIUM orchestration.
    
    This is an extremely powerful research intelligence system capable of:
    - Human-like thinking with internal monologue and metacognition
    - Multi-paradigm reasoning (ReAct, Tree-of-Thought, Hypothesis Testing)
    - Deep internet research across multiple sources and strategies
    - Evidence-based reasoning with contradiction detection
    - Source credibility assessment and cross-verification
    - Hierarchical planning with dynamic adaptation
    - Strategy switching when progress stalls
    - Comprehensive structured output with citations
    
    This agent does NOT run independently. It is invoked by IMPERIUM's Execution Controller
    through the execute() method.
    """
    
    def __init__(self, config: Optional[ResearchAgentConfig] = None):
        self.config = config or ResearchAgentConfig()
        self.agent_id = str(uuid4())
        
        # Initialize research pipelines
        self.web_researcher = WebResearchPipeline()
        self.academic_researcher = AcademicResearchPipeline()
        self.code_researcher = CodeResearchPipeline()
        self.dataset_researcher = DatasetResearchPipeline()
        
        # Initialize intelligence systems
        self.query_expander = QueryExpansionEngine()
        self.hypothesis_engine = HypothesisEngine() if self.config.enable_hypothesis_testing else None
        self.knowledge_synthesizer = KnowledgeSynthesizer()
        self.evidence_graph = EvidenceGraph() if self.config.enable_evidence_tracking else None
        
        # Initialize research director
        self.research_director = ResearchDirector(
            web_researcher=self.web_researcher,
            academic_researcher=self.academic_researcher,
            code_researcher=self.code_researcher,
            dataset_researcher=self.dataset_researcher,
            hypothesis_engine=self.hypothesis_engine,
            evidence_graph=self.evidence_graph,
            query_expander=self.query_expander,
            knowledge_synthesizer=self.knowledge_synthesizer,
        )
        
        # Core intelligence modules (legacy but enhanced)
        self.thinking_engine = ThinkingEngine() if self.config.enable_thinking else None
        self.advanced_reasoning = AdvancedReasoningEngine() if self.config.enable_advanced_reasoning else None
        
        # Legacy systems
        self.tool_registry = ToolRegistry()
        self.memory = SemanticMemory() if self.config.enable_memory else None
        self.validator = TaskValidator() if self.config.enable_validation else None
        self.planner = HierarchicalPlanner()
        self.react_engine = ReActEngine(
            tool_registry=self.tool_registry,
            model=self.config.model,
            temperature=self.config.temperature,
        )
        self.reflexion = ReflexionEvaluator() if self.config.enable_reflexion else None
        self.executor = ExecutionController(tool_registry=self.tool_registry)
        
        logger.info(f"High-Intelligence Research Agent initialized: {self.agent_id}")
        logger.info(f"Research pipelines: Web, Academic, Code, Dataset")
    
    
    async def execute(self, task: dict[str, Any]) -> dict[str, Any]:
        """
        IMPERIUM ENTRYPOINT - High-Intelligence Research Execution.
        
        Args:
            task: Task specification from IMPERIUM
                - task_id: Unique task identifier
                - query: Natural language task description
                - context: Additional context/parameters
                - priority: Task priority (1-5)
        
        Returns:
            Comprehensive result dictionary with:
                - status: success/failure/partial
                - final_conclusion: Research conclusion
                - supporting_evidence: List of evidence with citations
                - source_citations: Ranked source list
                - confidence_score: Overall confidence (0.0-1.0)
                - contradictions_found: Detected contradictions
                - reasoning_trace: Full reasoning chain with thinking
                - research_strategies_used: Applied strategies
                - hypotheses_tested: If hypothesis testing was used
                - tool_calls: Tools used
                - metadata: Additional information
        """
        start_time = datetime.now(timezone.utc)
        task_id = task.get("task_id", str(uuid4()))
        
        # Handle query - extract from various possible locations
        query = ""
        
        # Try direct query field
        if "query" in task and task["query"]:
            query = task["query"]
        
        # Try description field
        elif "description" in task and task["description"]:
            query = task["description"]
        
        # Try title field
        elif "title" in task and task["title"]:
            query = task["title"]
        
        # Try nested in context.task
        elif "context" in task and isinstance(task["context"], dict):
            context_task = task["context"].get("task", {})
            if isinstance(context_task, dict):
                query = context_task.get("description", "") or context_task.get("title", "") or context_task.get("query", "")
        
        # Try nested in input
        elif "input" in task and isinstance(task["input"], dict):
            query = task["input"].get("description", "") or task["input"].get("query", "")
        
        # Ensure query is a string
        if isinstance(query, dict):
            query = query.get("query", "") or query.get("description", "") or query.get("title", "") or str(query)
        
        query = str(query).strip() if query else ""
        
        if not query:
            return {
                "status": "failure",
                "error": "No query provided in task",
                "task_id": task_id,
                "agent_id": self.agent_id,
                "final_answer": "No query to research.",
                "confidence_score": 0.0,
            }
        
        context = task.get("context", {})
        
        logger.info(f"[{task_id}] High-Intelligence Research Agent executing: {query}")
        
        try:
            # ===== PHASE 1: Strategic Thinking =====
            if self.thinking_engine:
                strategic_thinking = await self.thinking_engine.think(
                    context={"task": query, **context},
                    level=ThinkingLevel.STRATEGIC,
                )
                logger.info(f"[{task_id}] Strategic thinking complete")
            else:
                strategic_thinking = {}
            
            # ===== PHASE 2: Validation =====
            if self.validator:
                validation_result = await self.validator.validate(task)
                if not validation_result.is_valid:
                    return {
                        "status": "failure",
                        "error": f"Task validation failed: {validation_result.reason}",
                        "task_id": task_id,
                    }
            
            # ===== PHASE 3: Memory Retrieval =====
            relevant_memories = []
            if self.memory:
                relevant_memories = await self.memory.retrieve(query, top_k=5)
                logger.info(f"[{task_id}] Retrieved {len(relevant_memories)} memories")
            
            # ===== PHASE 4: Hierarchical Planning =====
            plan = await self.planner.create_plan(
                query=query,
                context=context,
                memories=relevant_memories,
            )
            logger.info(f"[{task_id}] Created hierarchical plan with {len(plan.steps)} steps")
            
            # ===== PHASE 5: Conduct Research via Research Director =====
            research_results = await self.research_director.conduct_research(
                query=query,
                context=context,
            )
            logger.info(f"[{task_id}] Research complete: {len(research_results.supporting_sources)} sources")
            
            # Transform research results to match expected format
            final_answer = research_results.final_answer
            supporting_sources = research_results.supporting_sources
            confidence_score = research_results.confidence_score
            contradictions = research_results.contradictions_found
            reasoning_trace = research_results.reasoning_trace
            strategies_used = research_results.strategies_used
            
            # ===== PHASE 6: Store in Memory =====
            if self.memory:
                await self.memory.store(
                    query=query,
                    result=final_answer,
                    metadata={
                        "task_id": task_id,
                        "timestamp": start_time.isoformat(),
                        "sources_used": len(supporting_sources),
                        "confidence": confidence_score,
                        "strategies": strategies_used,
                    },
                )
            
            # ===== PHASE 7: Construct Output =====
            end_time = datetime.now(timezone.utc)
            duration = (end_time - start_time).total_seconds()
            
            # Get thinking trace if available
            thought_stream = self.thinking_engine.get_thought_stream() if self.thinking_engine else None
            
            return {
                "status": "success",
                "task_id": task_id,
                "agent_id": self.agent_id,
                
                # Main outputs
                "final_answer": final_answer,
                "confidence_score": confidence_score,
                
                # Evidence and sources
                "supporting_sources": supporting_sources,
                "source_citations": supporting_sources[:15],  # Top 15
                "total_sources_analyzed": len(supporting_sources),
                "contradictions_found": contradictions,
                "evidence_summary": research_results.evidence_summary,
                
                # Reasoning
                "reasoning_trace": reasoning_trace,
                "thinking_process": {
                    "thoughts": thought_stream.thoughts if thought_stream else [],
                    "questions": thought_stream.questions if thought_stream else [],
                    "uncertainties": thought_stream.uncertainties if thought_stream else [],
                    "insights": thought_stream.insights if thought_stream else [],
                } if thought_stream else {},
                
                # Research details
                "research_strategies_used": strategies_used,
                "execution_time_seconds": duration,
                
                # Metadata
                "metadata": {
                    "agent_version": "2.0.0-production-research",
                    "research_pipelines": ["web", "academic", "code", "dataset"],
                    "capabilities_used": {
                        "internet_research": True,
                        "academic_search": True,
                        "code_search": True,
                        "dataset_search": True,
                        "hypothesis_testing": self.config.enable_hypothesis_testing,
                        "evidence_tracking": self.config.enable_evidence_tracking,
                    },
                },
            }
        
        except Exception as e:
            logger.error(f"[{task_id}] Research execution failed: {str(e)}", exc_info=True)
            return {
                "status": "failure",
                "task_id": task_id,
                "agent_id": self.agent_id,
                "error": str(e),
                "error_type": type(e).__name__,
                "final_answer": "Research execution failed due to an internal error.",
                "confidence_score": 0.0,
            }
    
    def get_capabilities(self) -> dict[str, Any]:
        """Return agent capabilities for IMPERIUM."""
        return {
            "agent_type": "research",
            "agent_id": self.agent_id,
            "version": "2.0.0-production-research",
            "description": "High-intelligence research system with internet, academic, code, and dataset search",
            "capabilities": {
                "research_pipelines": {
                    "web_search": True,
                    "academic_search": True,
                    "code_search": True,
                    "dataset_search": True,
                },
                "intelligence_features": {
                    "hypothesis_testing": self.config.enable_hypothesis_testing,
                    "evidence_tracking": self.config.enable_evidence_tracking,
                    "query_expansion": True,
                    "knowledge_synthesis": True,
                    "contradiction_detection": self.config.enable_evidence_tracking,
                    "source_ranking": True,
                },
                "reasoning": {
                    "thinking_engine": self.config.enable_thinking,
                    "advanced_reasoning": self.config.enable_advanced_reasoning,
                    "hierarchical_planning": True,
                },
                "parallel_execution": True,
                "async_support": True,
            },
            "supported_apis": {
                "web": ["Google Custom Search", "Bing Search", "Brave Search", "DuckDuckGo"],
                "academic": ["arXiv", "Semantic Scholar", "PubMed", "CrossRef"],
                "code": ["GitHub", "GitLab"],
                "datasets": ["Kaggle", "Hugging Face"],
            },
            "output_format": {
                "fields": [
                    "final_answer",
                    "supporting_sources",
                    "confidence_score",
                    "contradictions_found",
                    "reasoning_trace",
                    "evidence_summary",
                    "research_strategies_used",
                ],
            },
        }
