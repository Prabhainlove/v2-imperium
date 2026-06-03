"""
Safety Controller for validating and restricting dangerous operations.
"""

import logging
from typing import Any
import re

logger = logging.getLogger(__name__)


class SafetyController:
    """
    Safety layer for preventing dangerous operations.
    
    Levels:
    - strict: Block most system-critical operations
    - moderate: Allow with confirmation
    - permissive: Minimal restrictions
    """
    
    # Dangerous commands/paths
    DANGEROUS_COMMANDS = [
        "rm -rf /",
        "del /f /s /q c:\\",
        "format c:",
        "mkfs",
        "dd if=/dev/zero",
    ]
    
    SYSTEM_PATHS = [
        "/system",
        "/bin",
        "/sbin",
        "/usr/bin",
        "C:\\Windows",
        "C:\\Program Files",
    ]
    
    def __init__(self, level: str = "strict"):
        self.level = level
        logger.info(f"Safety controller initialized (level={level})")
    
    async def validate_task(self, task: dict[str, Any]) -> dict[str, Any]:
        """Validate if task is safe to execute."""
        action = task.get("action", "").lower()
        parameters = task.get("parameters", {})
        
        # Check for dangerous commands
        if self._is_dangerous_command(action, parameters):
            return {
                "safe": False,
                "reason": "Potentially dangerous command detected",
                "requires_confirmation": self.level != "strict",
            }
        
        # Check for system file operations
        if self._is_system_file_operation(action, parameters):
            if self.level == "strict":
                return {
                    "safe": False,
                    "reason": "Operation on system files blocked (strict mode)",
                }
            else:
                return {
                    "safe": True,
                    "requires_confirmation": True,
                    "reason": "Operation on system files requires confirmation",
                }
        
        # Check for destructive operations
        if self._is_destructive(action):
            if self.level == "strict":
                return {
                    "safe": True,
                    "requires_confirmation": True,
                    "reason": "Destructive operation requires confirmation",
                }
        
        return {"safe": True}
    
    def _is_dangerous_command(self, action: str, params: dict) -> bool:
        """Check if command is dangerous."""
        command = params.get("command", "")
        
        for dangerous in self.DANGEROUS_COMMANDS:
            if dangerous in command.lower():
                return True
        
        # Check for shell injection patterns
        if "&&" in command or ";" in command or "|" in command:
            if any(bad in command.lower() for bad in ["rm", "del", "format"]):
                return True
        
        return False
    
    def _is_system_file_operation(self, action: str, params: dict) -> bool:
        """Check if operation targets system files."""
        path = params.get("path", "") or params.get("source", "")
        
        for sys_path in self.SYSTEM_PATHS:
            if path.startswith(sys_path):
                return True
        
        return False
    
    def _is_destructive(self, action: str) -> bool:
        """Check if action is destructive."""
        destructive_actions = [
            "delete", "remove", "kill", "terminate", "format",
            "erase", "wipe", "destroy",
        ]
        
        return any(keyword in action.lower() for keyword in destructive_actions)
