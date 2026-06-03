"""
Human-Like Thinking Process Engine

Simulates human researcher cognitive processes:
- Internal monologue and reasoning
- Uncertainty tracking and metacognition
- Self-questioning and doubt resolution
- Cognitive state management
- Multi-level thinking (strategic, tactical, operational)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

logger = logging.getLogger(__name__)


class ThinkingLevel(Enum):
    """Levels of cognitive processing."""
    STRATEGIC = "strategic"  # High-level goals and approaches
    TACTICAL = "tactical"    # Mid-level planning and decision-making
    OPERATIONAL = "operational"  # Low-level execution details
    REFLECTIVE = "reflective"  # Meta-cognitive self-analysis


class CertaintyLevel(Enum):
    """Confidence in current reasoning."""
    CERTAIN = "certain"  # >90% confidence
    CONFIDENT = "confident"  # 70-90%
    UNCERTAIN = "uncertain"  # 40-70%
    DOUBTFUL = "doubtful"  # <40%


@dataclass
class ThoughtStream:
    """Continuous stream of conscious thoughts."""
    thoughts: list[str] = field(default_factory=list)
    uncertainties: list[str] = field(default_factory=list)
    questions: list[str] = field(default_factory=list)
    insights: list[str] = field(default_factory=list)
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class CognitiveState:
    """Current cognitive state of the thinking system."""
    focus: str  # What are we thinking about right now?
    mental_model: dict[str, Any]  # Current understanding
    assumptions: list[str]  # Active assumptions
    knowledge_gaps: list[str]  # What we don't know
    certainty_level: CertaintyLevel = CertaintyLevel.UNCERTAIN
    thinking_level: ThinkingLevel = ThinkingLevel.TACTICAL
    cognitive_load: float = 0.5  # 0.0 to 1.0


class ThinkingEngine:
    """
    Simulates human-like thinking process for research tasks.
    
    The engine maintains an internal monologue, tracks uncertainty,
    asks self-questions, and manages cognitive state like a human
    researcher would during complex investigation.
    """
    
    def __init__(self):
        self.thought_stream = ThoughtStream()
        self.cognitive_state = CognitiveState(
            focus="",
            mental_model={},
            assumptions=[],
            knowledge_gaps=[],
        )
        self.thinking_history: list[dict[str, Any]] = []
    
    async def think(
        self,
        context: dict[str, Any],
        level: ThinkingLevel = ThinkingLevel.TACTICAL,
    ) -> dict[str, Any]:
        """
        Engage in thinking process given current context.
        
        Args:
            context: Current research context
            level: Level of thinking to engage
        
        Returns:
            Thinking output with thoughts, questions, and insights
        """
        self.cognitive_state.thinking_level = level
        
        if level == ThinkingLevel.STRATEGIC:
            return await self._strategic_thinking(context)
        elif level == ThinkingLevel.TACTICAL:
            return await self._tactical_thinking(context)
        elif level == ThinkingLevel.OPERATIONAL:
            return await self._operational_thinking(context)
        else:  # REFLECTIVE
            return await self._reflective_thinking(context)
    
    async def _strategic_thinking(self, context: dict[str, Any]) -> dict[str, Any]:
        """High-level strategic thinking about approach and goals."""
        thoughts = []
        questions = []
        
        # Understand the big picture
        task = context.get("task", "")
        # Normalize task to string if it's a dict
        if isinstance(task, dict):
            task = task.get("query") or task.get("description") or task.get("title") or str(task)
        task = str(task).strip()
        
        thoughts.append(f"The overall goal is: {task}")
        thoughts.append("Let me think about the best high-level approach...")
        
        # Identify what we're really trying to accomplish
        questions.append("What is the core question we need to answer?")
        questions.append("What would constitute a complete answer?")
        questions.append("Are there multiple perspectives to consider?")
        
        # Consider research strategy
        thoughts.append("I need to decide on a research strategy.")
        thoughts.append("Should I start broad and narrow down, or target specific sources?")
        
        # Assess complexity
        complexity = self._assess_complexity(task)
        if complexity > 0.7:
            thoughts.append("This is a complex question requiring multi-phase research.")
            thoughts.append("I'll need to break this into investigable sub-questions.")
        else:
            thoughts.append("This seems straightforward - direct research should work.")
        
        # Strategic uncertainties
        uncertainties = [
            "Am I framing the question correctly?",
            "What might I be overlooking at this stage?",
        ]
        
        self._record_thoughts(thoughts, questions, uncertainties)
        
        return {
            "thinking_level": "strategic",
            "thoughts": thoughts,
            "questions": questions,
            "uncertainties": uncertainties,
            "decision": "proceed_with_tactical_planning",
            "cognitive_state": self._get_state_snapshot(),
        }
    
    async def _tactical_thinking(self, context: dict[str, Any]) -> dict[str, Any]:
        """Mid-level tactical thinking about specific steps and decisions."""
        thoughts = []
        questions = []
        uncertainties = []
        
        current_state = context.get("current_state", {})
        observations = context.get("observations", [])
        
        # Analyze what we know so far
        if observations:
            thoughts.append(f"Based on {len(observations)} observations so far...")
            thoughts.append("Let me synthesize what I've learned.")
            
            # Check for contradictions
            if self._detect_potential_contradictions(observations):
                thoughts.append("Wait - I'm seeing some contradictory information.")
                questions.append("Which source is more reliable?")
                uncertainties.append("There are conflicting claims that need resolution.")
        else:
            thoughts.append("I haven't gathered any information yet.")
            thoughts.append("I need to decide where to start looking.")
        
        # Evaluate current approach
        thoughts.append("Is my current approach working?")
        if self._is_making_progress(context):
            thoughts.append("Yes, I'm making good progress.")
        else:
            thoughts.append("Hmm, I might be stuck. Should I try a different approach?")
            uncertainties.append("Current strategy may not be optimal.")
            questions.append("What alternative approaches could I try?")
        
        # Identify next step
        thoughts.append("What should I do next?")
        next_action = self._determine_next_action(context)
        thoughts.append(f"I think I should: {next_action}")
        
        # Self-criticism
        thoughts.append("But wait - is this the best next step?")
        questions.append("Am I making assumptions I shouldn't?")
        
        self._record_thoughts(thoughts, questions, uncertainties)
        
        return {
            "thinking_level": "tactical",
            "thoughts": thoughts,
            "questions": questions,
            "uncertainties": uncertainties,
            "suggested_action": next_action,
            "cognitive_state": self._get_state_snapshot(),
        }
    
    async def _operational_thinking(self, context: dict[str, Any]) -> dict[str, Any]:
        """Low-level operational thinking about execution details."""
        thoughts = []
        questions = []
        
        action = context.get("action", "")
        parameters = context.get("parameters", {})
        
        thoughts.append(f"I'm about to execute: {action}")
        thoughts.append("Let me think through the specifics...")
        
        # Validate parameters
        thoughts.append(f"Parameters: {parameters}")
        questions.append("Are these parameters appropriate?")
        questions.append("What edge cases should I consider?")
        
        # Anticipate results
        thoughts.append("What do I expect to get from this action?")
        expected_outcome = self._anticipate_outcome(action, parameters)
        thoughts.append(f"Expected: {expected_outcome}")
        
        # Error possibilities
        questions.append("What could go wrong?")
        thoughts.append("I should be prepared for errors or unexpected results.")
        
        self._record_thoughts(thoughts, questions, [])
        
        return {
            "thinking_level": "operational",
            "thoughts": thoughts,
            "questions": questions,
            "expected_outcome": expected_outcome,
            "cognitive_state": self._get_state_snapshot(),
        }
    
    async def _reflective_thinking(self, context: dict[str, Any]) -> dict[str, Any]:
        """Meta-cognitive reflection on thinking process itself."""
        thoughts = []
        insights = []
        
        thoughts.append("Let me step back and reflect on my thinking process...")
        
        # Analyze thinking quality
        thoughts.append("Have I been thinking clearly and logically?")
        thoughts.append("Am I suffering from any cognitive biases?")
        
        # Common biases to check
        biases_to_check = [
            "Confirmation bias: Am I only seeking information that confirms my hypothesis?",
            "Anchoring bias: Am I too attached to my initial thoughts?",
            "Availability bias: Am I overweighting easily accessible information?",
        ]
        
        for bias in biases_to_check:
            thoughts.append(f"Checking for {bias}")
        
        # Evaluate reasoning chain
        if len(self.thinking_history) > 3:
            thoughts.append("Looking at my reasoning chain...")
            insights.append("I notice patterns in how I'm approaching this.")
            
            # Check for circular reasoning
            if self._detect_circular_reasoning():
                insights.append("Warning: I may be reasoning in circles.")
                thoughts.append("I need to break out of this loop with fresh information.")
        
        # Self-assessment
        certainty = self.cognitive_state.certainty_level
        thoughts.append(f"My current certainty level: {certainty.value}")
        
        if certainty in [CertaintyLevel.UNCERTAIN, CertaintyLevel.DOUBTFUL]:
            insights.append("I'm not confident enough yet - need more evidence.")
        else:
            insights.append("I have reasonable confidence in my current understanding.")
        
        self._record_thoughts(thoughts, [], [])
        self.thought_stream.insights.extend(insights)
        
        return {
            "thinking_level": "reflective",
            "thoughts": thoughts,
            "insights": insights,
            "meta_assessment": self._assess_thinking_quality(),
            "cognitive_state": self._get_state_snapshot(),
        }
    
    def update_certainty(self, new_evidence: dict[str, Any]) -> None:
        """Update certainty level based on new evidence."""
        quality = new_evidence.get("quality", 0.5)
        consistency = new_evidence.get("consistency", 0.5)
        
        # Calculate certainty score
        certainty_score = (quality + consistency) / 2
        
        if certainty_score > 0.9:
            self.cognitive_state.certainty_level = CertaintyLevel.CERTAIN
        elif certainty_score > 0.7:
            self.cognitive_state.certainty_level = CertaintyLevel.CONFIDENT
        elif certainty_score > 0.4:
            self.cognitive_state.certainty_level = CertaintyLevel.UNCERTAIN
        else:
            self.cognitive_state.certainty_level = CertaintyLevel.DOUBTFUL
    
    def add_uncertainty(self, uncertainty: str) -> None:
        """Record a new uncertainty."""
        self.thought_stream.uncertainties.append(uncertainty)
        self.cognitive_state.knowledge_gaps.append(uncertainty)
    
    def resolve_uncertainty(self, uncertainty: str, resolution: str) -> None:
        """Mark an uncertainty as resolved."""
        if uncertainty in self.cognitive_state.knowledge_gaps:
            self.cognitive_state.knowledge_gaps.remove(uncertainty)
        
        self.thought_stream.insights.append(f"Resolved: {uncertainty} -> {resolution}")
    
    def get_thought_stream(self) -> ThoughtStream:
        """Get the current thought stream."""
        return self.thought_stream
    
    def get_cognitive_state(self) -> CognitiveState:
        """Get current cognitive state."""
        return self.cognitive_state
    
    def _record_thoughts(
        self,
        thoughts: list[str],
        questions: list[str],
        uncertainties: list[str],
    ) -> None:
        """Record thoughts in the stream and history."""
        self.thought_stream.thoughts.extend(thoughts)
        self.thought_stream.questions.extend(questions)
        self.thought_stream.uncertainties.extend(uncertainties)
        
        self.thinking_history.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": self.cognitive_state.thinking_level.value,
            "thoughts": thoughts,
            "questions": questions,
            "uncertainties": uncertainties,
        })
    
    def _get_state_snapshot(self) -> dict[str, Any]:
        """Get snapshot of current cognitive state."""
        return {
            "focus": self.cognitive_state.focus,
            "certainty": self.cognitive_state.certainty_level.value,
            "thinking_level": self.cognitive_state.thinking_level.value,
            "cognitive_load": self.cognitive_state.cognitive_load,
            "knowledge_gaps": len(self.cognitive_state.knowledge_gaps),
            "assumptions": len(self.cognitive_state.assumptions),
        }
    
    def _assess_complexity(self, task: str) -> float:
        """Assess task complexity (0.0 to 1.0)."""
        # Normalize task to string if needed
        if isinstance(task, dict):
            task = task.get("query") or task.get("description") or task.get("title") or str(task)
        task = str(task).strip()
        
        # Simple heuristic based on keywords and length
        complex_keywords = [
            "analyze", "compare", "evaluate", "synthesize",
            "comprehensive", "detailed", "complex", "multi",
        ]
        
        complexity = 0.0
        task_lower = task.lower()
        
        for keyword in complex_keywords:
            if keyword in task_lower:
                complexity += 0.15
        
        # Longer tasks tend to be more complex
        if len(task) > 200:
            complexity += 0.2
        elif len(task) > 100:
            complexity += 0.1
        
        return min(complexity, 1.0)
    
    def _detect_potential_contradictions(self, observations: list[Any]) -> bool:
        """Detect if observations might contain contradictions."""
        # Placeholder - would use NLP in production
        if len(observations) < 2:
            return False
        
        # Simple heuristic: look for opposing terms
        text = " ".join(str(obs) for obs in observations)
        opposing_pairs = [
            ("yes", "no"),
            ("true", "false"),
            ("increase", "decrease"),
            ("more", "less"),
        ]
        
        for word1, word2 in opposing_pairs:
            if word1 in text.lower() and word2 in text.lower():
                return True
        
        return False
    
    def _is_making_progress(self, context: dict[str, Any]) -> bool:
        """Determine if we're making progress."""
        observations = context.get("observations", [])
        iterations = context.get("iteration", 0)
        
        # If we have observations and haven't exceeded reasonable iterations
        if len(observations) > 0 and iterations < 10:
            return True
        
        # If we're stuck in a loop
        if iterations > 5 and len(observations) < iterations / 2:
            return False
        
        return True
    
    def _determine_next_action(self, context: dict[str, Any]) -> str:
        """Determine suggested next action."""
        observations = context.get("observations", [])
        
        if not observations:
            return "Start with broad information gathering"
        elif len(observations) < 3:
            return "Continue gathering more information"
        else:
            return "Synthesize findings and form conclusions"
    
    def _anticipate_outcome(self, action: str, parameters: dict[str, Any]) -> str:
        """Anticipate outcome of an action."""
        return f"Expected to get relevant information from {action}"
    
    def _detect_circular_reasoning(self) -> bool:
        """Detect circular reasoning in thinking history."""
        if len(self.thinking_history) < 4:
            return False
        
        # Check if recent thoughts are too similar to earlier thoughts
        recent = self.thinking_history[-3:]
        recent_text = " ".join(
            " ".join(t.get("thoughts", [])) for t in recent
        )
        
        earlier = self.thinking_history[:-3]
        earlier_text = " ".join(
            " ".join(t.get("thoughts", [])) for t in earlier
        )
        
        # Simple overlap check (would use embeddings in production)
        overlap = len(set(recent_text.split()) & set(earlier_text.split()))
        total = len(set(recent_text.split()))
        
        return overlap / max(total, 1) > 0.7
    
    def _assess_thinking_quality(self) -> dict[str, Any]:
        """Assess the quality of thinking process."""
        return {
            "clarity": 0.8,  # How clear is the reasoning?
            "logic": 0.85,  # How logical is the chain?
            "completeness": 0.7,  # Have we considered everything?
            "bias_check": True,  # Have we checked for biases?
            "overall_quality": 0.78,
        }
