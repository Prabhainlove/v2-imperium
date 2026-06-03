"""Task Validator"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    """Result of task validation."""
    is_valid: bool
    reason: str
    confidence: float


class TaskValidator:
    """Validates tasks before execution."""
    
    async def validate(self, task: dict[str, Any]) -> ValidationResult:
        """
        Validate a task specification.
        
        Args:
            task: Task dictionary with query, context, etc.
        
        Returns:
            Validation result
        """
        query = task.get("query", "")
        
        # Check if query is non-empty
        if not query or len(query.strip()) == 0:
            return ValidationResult(
                is_valid=False,
                reason="Query is empty",
                confidence=1.0,
            )
        
        # Check if query is too short
        if len(query) < 5:
            return ValidationResult(
                is_valid=False,
                reason="Query is too short to be meaningful",
                confidence=0.9,
            )
        
        # Check for harmful content (basic check)
        harmful_keywords = ["hack", "exploit", "malicious"]
        if any(word in query.lower() for word in harmful_keywords):
            return ValidationResult(
                is_valid=False,
                reason="Query may contain harmful intent",
                confidence=0.8,
            )
        
        # Valid task
        return ValidationResult(
            is_valid=True,
            reason="Task is valid",
            confidence=0.95,
        )
