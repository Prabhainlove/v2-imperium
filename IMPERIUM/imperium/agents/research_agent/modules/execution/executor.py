"""Execution Controller"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


class ExecutionController:
    """Controls tool execution with error handling and recovery."""
    
    def __init__(self, tool_registry):
        self.tool_registry = tool_registry
    
    async def execute_tool(
        self,
        tool_name: str,
        tool_input: dict[str, Any],
    ) -> Any:
        """
        Execute a tool with error handling.
        
        Args:
            tool_name: Name of tool to execute
            tool_input: Parameters for the tool
        
        Returns:
            Tool output or error message
        """
        tool = self.tool_registry.get(tool_name)
        
        if not tool:
            logger.error(f"Tool not found: {tool_name}")
            return f"ERROR: Tool '{tool_name}' not found"
        
        try:
            logger.info(f"Executing tool: {tool_name}")
            result = await tool.execute(**tool_input)
            logger.info(f"Tool {tool_name} completed successfully")
            return result
        
        except Exception as e:
            logger.exception(f"Tool {tool_name} failed: {e}")
            return f"ERROR: Tool execution failed - {str(e)}"
