"""
Reflexion Self-Evaluation Module

Implements Reflexion: agents that reflect on their own mistakes
and improve through self-evaluation.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class EvaluationResult:
    """Result of self-evaluation."""
    needs_improvement: bool
    confidence_score: float
    feedback: str
    suggested_improvements: list[str]


class ReflexionEvaluator:
    """
    Self-evaluation system using Reflexion methodology.
    
    Evaluates agent performance and provides feedback for improvement.
    """
    
    async def evaluate(
        self,
        task: str,
        result: Any,
        reasoning_trace: list[dict[str, Any]],
    ) -> EvaluationResult:
        """
        Evaluate the agent's performance on a task.
        
        Args:
            task: Original task description
            result: Final result produced
            reasoning_trace: Full reasoning chain
        
        Returns:
            Evaluation with feedback and improvement suggestions
        """
        
        # Analyze reasoning quality
        reasoning_quality = self._analyze_reasoning(reasoning_trace)
        
        # Check result completeness
        completeness = self._check_completeness(task, result)
        
        # Identify potential issues
        issues = self._identify_issues(reasoning_trace)
        
        # Determine if retry is needed
        needs_improvement = (
            reasoning_quality < 0.7 or
            completeness < 0.8 or
            len(issues) > 2
        )
        
        confidence = (reasoning_quality + completeness) / 2
        
        feedback = self._generate_feedback(
            reasoning_quality=reasoning_quality,
            completeness=completeness,
            issues=issues,
        )
        
        suggestions = self._generate_improvements(issues, reasoning_trace)
        
        return EvaluationResult(
            needs_improvement=needs_improvement,
            confidence_score=confidence,
            feedback=feedback,
            suggested_improvements=suggestions,
        )
    
    def _analyze_reasoning(self, trace: list[dict[str, Any]]) -> float:
        """Analyze quality of reasoning steps."""
        if not trace:
            return 0.5
        
        quality_score = 0.0
        for step in trace:
            # Check for self-criticism
            if step.get("self_criticism"):
                quality_score += 0.2
            # Check for clear reasoning
            if len(step.get("reasoning", "")) > 20:
                quality_score += 0.2
            # Check for actionable thoughts
            if step.get("thought"):
                quality_score += 0.1
        
        return min(quality_score / len(trace), 1.0)
    
    def _check_completeness(self, task: str, result: Any) -> float:
        """Check if result addresses the task."""
        if not result or result == "No result generated":
            return 0.3
        
        result_str = str(result).lower()
        task_words = set(task.lower().split())
        result_words = set(result_str.split())
        
        overlap = len(task_words & result_words) / max(len(task_words), 1)
        return min(overlap + 0.3, 1.0)
    
    def _identify_issues(self, trace: list[dict[str, Any]]) -> list[str]:
        """Identify issues in reasoning trace."""
        issues = []
        
        # Check for repeated actions
        actions = [step.get("action") for step in trace]
        if len(actions) != len(set(actions)):
            issues.append("Repeated actions detected")
        
        # Check for error patterns
        for step in trace:
            if "ERROR" in str(step.get("action_input", "")):
                issues.append("Tool execution errors")
                break
        
        # Check for lack of progress
        if len(trace) > 5:
            recent_thoughts = [step.get("thought", "") for step in trace[-3:]]
            if len(set(recent_thoughts)) == 1:
                issues.append("Circular reasoning - no progress")
        
        return issues
    
    def _generate_feedback(
        self,
        reasoning_quality: float,
        completeness: float,
        issues: list[str],
    ) -> str:
        """Generate feedback message."""
        feedback_parts = []
        
        if reasoning_quality < 0.7:
            feedback_parts.append("Reasoning could be more thorough and critical.")
        
        if completeness < 0.8:
            feedback_parts.append("Result may not fully address the task.")
        
        if issues:
            feedback_parts.append(f"Issues detected: {', '.join(issues)}")
        
        if not feedback_parts:
            feedback_parts.append("Performance looks good overall.")
        
        return " ".join(feedback_parts)
    
    def _generate_improvements(
        self,
        issues: list[str],
        trace: list[dict[str, Any]],
    ) -> list[str]:
        """Generate specific improvement suggestions."""
        suggestions = []
        
        if "Repeated actions" in issues:
            suggestions.append("Try different tools or approaches")
        
        if "Tool execution errors" in issues:
            suggestions.append("Validate tool parameters before execution")
        
        if "Circular reasoning" in issues:
            suggestions.append("Break down the problem differently")
        
        if len(trace) > 10:
            suggestions.append("Consider simplifying the approach")
        
        return suggestions or ["Refine reasoning and try again"]
