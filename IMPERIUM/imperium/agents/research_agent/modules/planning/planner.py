"""
Chain-of-Thought and Hierarchical Planning

Creates structured execution plans using Chain-of-Thought reasoning
with hierarchical decomposition and dynamic updates.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class PlanStep:
    """Single step in execution plan."""
    step_id: int
    description: str
    required_tools: list[str]
    success_criteria: str
    dependencies: list[int] = field(default_factory=list)
    status: str = "pending"  # pending, in_progress, completed, failed
    sub_steps: list['PlanStep'] = field(default_factory=list)  # Hierarchical sub-steps


@dataclass
class ExecutionPlan:
    """Complete execution plan with steps."""
    plan_id: str
    goal: str
    steps: list[PlanStep]
    created_at: str
    plan_type: str = "linear"  # linear or hierarchical
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "plan_id": self.plan_id,
            "goal": self.goal,
            "plan_type": self.plan_type,
            "steps": [
                {
                    "step_id": step.step_id,
                    "description": step.description,
                    "required_tools": step.required_tools,
                    "success_criteria": step.success_criteria,
                    "dependencies": step.dependencies,
                    "status": step.status,
                    "sub_steps": [
                        {
                            "step_id": sub.step_id,
                            "description": sub.description,
                            "required_tools": sub.required_tools,
                        }
                        for sub in step.sub_steps
                    ] if step.sub_steps else [],
                }
                for step in self.steps
            ],
            "created_at": self.created_at,
        }
    
    def to_text(self) -> str:
        """Convert to human-readable text."""
        lines = [f"Goal: {self.goal}", f"Plan Type: {self.plan_type}", ""]
        for step in self.steps:
            deps = f" (depends on: {step.dependencies})" if step.dependencies else ""
            lines.append(f"{step.step_id}. {step.description}{deps}")
            lines.append(f"   Tools: {', '.join(step.required_tools)}")
            lines.append(f"   Success: {step.success_criteria}")
            if step.sub_steps:
                lines.append(f"   Sub-steps:")
                for sub in step.sub_steps:
                    lines.append(f"     {sub.step_id}. {sub.description}")
        return "\n".join(lines)


class ChainOfThoughtPlanner:
    """
    Creates execution plans using Chain-of-Thought decomposition.
    
    Breaks complex tasks into smaller, manageable steps with clear
    success criteria and dependencies.
    """
    
    async def create_plan(
        self,
        query: str,
        context: dict[str, Any],
        memories: Optional[list[Any]] = None,
    ) -> ExecutionPlan:
        """
        Create execution plan for a query.
        
        Args:
            query: Task description
            context: Additional context
            memories: Relevant past experiences
        
        Returns:
            Structured execution plan
        """
        from datetime import datetime, timezone
        from uuid import uuid4
        
        # Analyze query to determine task type
        task_type = self._classify_task(query)
        
        # Generate steps based on task type
        steps = self._generate_steps(query, task_type, context)
        
        # Optimize plan based on past experiences
        if memories:
            steps = self._optimize_with_memory(steps, memories)
        
        plan = ExecutionPlan(
            plan_id=str(uuid4()),
            goal=query,
            steps=steps,
            created_at=datetime.now(timezone.utc).isoformat(),
            plan_type="linear",
        )
        
        logger.info(f"Created plan with {len(steps)} steps for: {query[:50]}")
        return plan


class HierarchicalPlanner(ChainOfThoughtPlanner):
    """
    Hierarchical planner with dynamic plan updates.
    
    Extends ChainOfThoughtPlanner with:
    - Multi-level decomposition
    - Dynamic plan updates based on progress
    - Adaptive re-planning
    """
    
    async def create_plan(
        self,
        query: str,
        context: dict[str, Any],
        memories: Optional[list[Any]] = None,
    ) -> ExecutionPlan:
        """
        Create hierarchical execution plan.
        
        Args:
            query: Task description
            context: Additional context
            memories: Relevant past experiences
        
        Returns:
            Hierarchical execution plan
        """
        from datetime import datetime, timezone
        from uuid import uuid4
        
        # Analyze query complexity
        task_type = self._classify_task(query)
        is_complex = len(query.split()) > 15 or task_type in ["research", "analysis"]
        
        # Generate high-level steps
        high_level_steps = self._generate_steps(query, task_type, context)
        
        # Decompose complex steps into sub-steps
        if is_complex:
            for step in high_level_steps:
                if self._should_decompose_step(step):
                    step.sub_steps = self._decompose_step(step, context)
        
        # Add memory-informed optimizations
        if memories:
            high_level_steps = self._optimize_with_memory(high_level_steps, memories)
        
        plan = ExecutionPlan(
            plan_id=str(uuid4()),
            goal=query,
            steps=high_level_steps,
            created_at=datetime.now(timezone.utc).isoformat(),
            plan_type="hierarchical" if is_complex else "linear",
        )
        
        logger.info(f"Created {'hierarchical' if is_complex else 'linear'} plan with {len(high_level_steps)} top-level steps")
        return plan
    
    async def update_plan(
        self,
        plan: ExecutionPlan,
        progress: dict[str, Any],
        new_information: Optional[dict[str, Any]] = None,
    ) -> ExecutionPlan:
        """
        Dynamically update plan based on progress and new information.
        
        Args:
            plan: Current execution plan
            progress: Execution progress
            new_information: New information discovered
        
        Returns:
            Updated plan
        """
        
        # Mark completed steps
        completed_steps = progress.get("completed_steps", [])
        for step_id in completed_steps:
            for step in plan.steps:
                if step.step_id == step_id:
                    step.status = "completed"
        
        # Check if plan needs revision
        if new_information and new_information.get("requires_replanning"):
            # Add new steps or modify existing ones
            logger.info("New information requires plan revision")
            
            # Generate additional steps
            additional_steps = self._generate_adaptive_steps(
                plan.goal,
                new_information,
            )
            
            # Append to plan
            plan.steps.extend(additional_steps)
        
        return plan
    
    def _should_decompose_step(self, step: PlanStep) -> bool:
        """Determine if a step should be decomposed into sub-steps."""
        # Decompose if description is complex or mentions multiple actions
        action_words = ["and", "then", "after", "before", "also"]
        return any(word in step.description.lower() for word in action_words)
    
    def _decompose_step(
        self,
        step: PlanStep,
        context: dict[str, Any],
    ) -> list[PlanStep]:
        """Decompose a step into sub-steps."""
        
        # Generate 2-4 sub-steps based on the main step
        sub_steps = []
        
        if "research" in step.description.lower():
            sub_steps = [
                PlanStep(
                    step_id=1,
                    description="Identify key search terms and queries",
                    required_tools=["analysis"],
                    success_criteria="Search terms identified",
                ),
                PlanStep(
                    step_id=2,
                    description="Execute parallel searches across strategies",
                    required_tools=["web_search"],
                    success_criteria="Search results obtained",
                ),
                PlanStep(
                    step_id=3,
                    description="Extract and rank sources",
                    required_tools=["extraction", "ranking"],
                    success_criteria="Sources ranked by credibility",
                ),
            ]
        elif "analyze" in step.description.lower():
            sub_steps = [
                PlanStep(
                    step_id=1,
                    description="Collect all relevant data",
                    required_tools=["data_collection"],
                    success_criteria="Data collected",
                ),
                PlanStep(
                    step_id=2,
                    description="Apply analysis methods",
                    required_tools=["analysis"],
                    success_criteria="Analysis complete",
                ),
                PlanStep(
                    step_id=3,
                    description="Validate findings",
                    required_tools=["validation"],
                    success_criteria="Findings validated",
                ),
            ]
        
        return sub_steps
    
    def _generate_adaptive_steps(
        self,
        goal: str,
        new_information: dict[str, Any],
    ) -> list[PlanStep]:
        """Generate new steps based on newly discovered information."""
        
        adaptive_steps = []
        
        # Example: If contradictions found, add verification step
        if new_information.get("contradictions_found"):
            adaptive_steps.append(PlanStep(
                step_id=len(adaptive_steps) + 100,  # Offset to avoid ID conflicts
                description="Resolve contradictions through additional research",
                required_tools=["web_search", "verification"],
                success_criteria="Contradictions resolved",
            ))
        
        # Example: If low confidence, add evidence gathering
        if new_information.get("confidence", 1.0) < 0.6:
            adaptive_steps.append(PlanStep(
                step_id=len(adaptive_steps) + 100,
                description="Gather additional evidence to increase confidence",
                required_tools=["research", "verification"],
                success_criteria="Confidence above 0.7",
            ))
        
        return adaptive_steps
    
    def _classify_task(self, query: str) -> str:
        """Classify task type for appropriate planning strategy."""
        query_lower = query.lower()
        
        if any(word in query_lower for word in ["research", "find", "search", "discover", "investigate"]):
            return "research"
        elif any(word in query_lower for word in ["analyze", "evaluate", "compare", "assess"]):
            return "analysis"
        elif any(word in query_lower for word in ["create", "generate", "write", "build", "make"]):
            return "creation"
        elif any(word in query_lower for word in ["fix", "debug", "solve", "resolve"]):
            return "problem_solving"
        else:
            return "general"
    
    def _generate_steps(
        self,
        query: str,
        task_type: str,
        context: dict[str, Any],
    ) -> list[PlanStep]:
        """Generate execution steps based on task type."""
        
        if task_type == "research":
            return self._research_plan(query)
        elif task_type == "analysis":
            return self._analysis_plan(query)
        elif task_type == "creation":
            return self._creation_plan(query)
        elif task_type == "problem_solving":
            return self._problem_solving_plan(query)
        else:
            return self._general_plan(query)
    
    def _research_plan(self, query: str) -> list[PlanStep]:
        """Create plan for research tasks."""
        return [
            PlanStep(
                step_id=1,
                description="Identify key information needs and search terms",
                required_tools=["text_analysis"],
                success_criteria="Clear search terms identified",
            ),
            PlanStep(
                step_id=2,
                description="Conduct web search for relevant information",
                required_tools=["web_search"],
                success_criteria="Relevant sources found",
                dependencies=[1],
            ),
            PlanStep(
                step_id=3,
                description="Extract and synthesize key findings",
                required_tools=["text_extraction", "summarization"],
                success_criteria="Key information extracted and organized",
                dependencies=[2],
            ),
            PlanStep(
                step_id=4,
                description="Verify information quality and sources",
                required_tools=["validation"],
                success_criteria="Information validated",
                dependencies=[3],
            ),
            PlanStep(
                step_id=5,
                description="Compile final research report",
                required_tools=["text_generation"],
                success_criteria="Comprehensive report completed",
                dependencies=[4],
            ),
        ]
    
    def _analysis_plan(self, query: str) -> list[PlanStep]:
        """Create plan for analysis tasks."""
        return [
            PlanStep(
                step_id=1,
                description="Gather data and information for analysis",
                required_tools=["data_collection"],
                success_criteria="All relevant data collected",
            ),
            PlanStep(
                step_id=2,
                description="Identify patterns and relationships",
                required_tools=["data_analysis"],
                success_criteria="Key patterns identified",
                dependencies=[1],
            ),
            PlanStep(
                step_id=3,
                description="Generate insights and conclusions",
                required_tools=["reasoning"],
                success_criteria="Meaningful insights derived",
                dependencies=[2],
            ),
        ]
    
    def _creation_plan(self, query: str) -> list[PlanStep]:
        """Create plan for content creation tasks."""
        return [
            PlanStep(
                step_id=1,
                description="Define requirements and specifications",
                required_tools=["planning"],
                success_criteria="Clear requirements defined",
            ),
            PlanStep(
                step_id=2,
                description="Create initial draft/prototype",
                required_tools=["generation"],
                success_criteria="Initial version created",
                dependencies=[1],
            ),
            PlanStep(
                step_id=3,
                description="Review and refine output",
                required_tools=["validation", "refinement"],
                success_criteria="High-quality output produced",
                dependencies=[2],
            ),
        ]
    
    def _problem_solving_plan(self, query: str) -> list[PlanStep]:
        """Create plan for problem-solving tasks."""
        return [
            PlanStep(
                step_id=1,
                description="Understand the problem and identify root causes",
                required_tools=["analysis"],
                success_criteria="Problem clearly defined",
            ),
            PlanStep(
                step_id=2,
                description="Generate potential solutions",
                required_tools=["brainstorming", "research"],
                success_criteria="Multiple solutions identified",
                dependencies=[1],
            ),
            PlanStep(
                step_id=3,
                description="Evaluate and select best solution",
                required_tools=["evaluation"],
                success_criteria="Best solution selected",
                dependencies=[2],
            ),
            PlanStep(
                step_id=4,
                description="Implement solution",
                required_tools=["execution"],
                success_criteria="Solution implemented",
                dependencies=[3],
            ),
            PlanStep(
                step_id=5,
                description="Verify solution effectiveness",
                required_tools=["testing", "validation"],
                success_criteria="Problem solved",
                dependencies=[4],
            ),
        ]
    
    def _general_plan(self, query: str) -> list[PlanStep]:
        """Create general-purpose plan."""
        return [
            PlanStep(
                step_id=1,
                description="Analyze task requirements",
                required_tools=["analysis"],
                success_criteria="Task understood",
            ),
            PlanStep(
                step_id=2,
                description="Execute task using appropriate tools",
                required_tools=["execution"],
                success_criteria="Task completed",
                dependencies=[1],
            ),
            PlanStep(
                step_id=3,
                description="Validate results",
                required_tools=["validation"],
                success_criteria="Results validated",
                dependencies=[2],
            ),
        ]
    
    def _optimize_with_memory(
        self,
        steps: list[PlanStep],
        memories: list[Any],
    ) -> list[PlanStep]:
        """Optimize plan based on past experiences."""
        # For now, return steps as-is
        # TODO: Analyze memories to remove unnecessary steps or add optimizations
        return steps
