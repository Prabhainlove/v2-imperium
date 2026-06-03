"""Tool Registry and Management"""

from __future__ import annotations

import logging
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


class Tool:
    """Represents an executable tool."""
    
    def __init__(
        self,
        name: str,
        description: str,
        handler: Callable,
        parameters: dict[str, Any],
        category: str = "general",
    ):
        self.name = name
        self.description = description
        self.handler = handler
        self.parameters = parameters
        self.category = category
    
    async def execute(self, **kwargs) -> Any:
        """Execute the tool with given parameters."""
        return await self.handler(**kwargs) if callable(self.handler) else None


class ToolRegistry:
    """Registry of available tools for the research agent."""
    
    def __init__(self):
        self.tools: dict[str, Tool] = {}
        self._register_builtin_tools()
    
    def register(self, tool: Tool) -> None:
        """Register a new tool."""
        self.tools[tool.name] = tool
        logger.info(f"Registered tool: {tool.name}")
    
    def get(self, name: str) -> Optional[Tool]:
        """Get tool by name."""
        return self.tools.get(name)
    
    def list_tools(self) -> list[dict[str, Any]]:
        """List all available tools."""
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "category": tool.category,
                "parameters": tool.parameters,
            }
            for tool in self.tools.values()
        ]
    
    def _register_builtin_tools(self) -> None:
        """Register built-in tools."""
        
        # Web search tool
        self.register(Tool(
            name="web_search",
            description="Search the web for information",
            handler=self._web_search,
            parameters={"query": {"type": "string", "required": True}},
            category="research",
        ))
        
        # Data analysis tool
        self.register(Tool(
            name="data_analysis",
            description="Analyze data and identify patterns",
            handler=self._data_analysis,
            parameters={"data": {"type": "string", "required": True}},
            category="analysis",
        ))
        
        # Text generation tool
        self.register(Tool(
            name="text_generation",
            description="Generate text content",
            handler=self._text_generation,
            parameters={"prompt": {"type": "string", "required": True}},
            category="creation",
        ))
        
        # Validation tool
        self.register(Tool(
            name="validation",
            description="Validate information or results",
            handler=self._validation,
            parameters={"content": {"type": "string", "required": True}},
            category="verification",
        ))
        
        # Code execution tool
        self.register(Tool(
            name="code_execution",
            description="Execute code safely",
            handler=self._code_execution,
            parameters={"code": {"type": "string", "required": True}, "language": {"type": "string", "required": False}},
            category="execution",
        ))
    
    async def _web_search(self, query: str) -> dict[str, Any]:
        """Web search implementation (placeholder)."""
        return {
            "results": [
                f"Search result 1 for: {query}",
                f"Search result 2 for: {query}",
            ],
            "count": 2,
        }
    
    async def _data_analysis(self, data: str) -> dict[str, Any]:
        """Data analysis implementation (placeholder)."""
        return {
            "analysis": f"Analysis of data: {data[:100]}...",
            "patterns": ["pattern1", "pattern2"],
        }
    
    async def _text_generation(self, prompt: str) -> str:
        """Text generation implementation (placeholder)."""
        return f"Generated text based on: {prompt}"
    
    async def _validation(self, content: str) -> dict[str, Any]:
        """Validation implementation (placeholder)."""
        return {
            "valid": True,
            "confidence": 0.85,
            "issues": [],
        }
    
    async def _code_execution(self, code: str, language: str = "python") -> dict[str, Any]:
        """Code execution implementation (placeholder)."""
        return {
            "output": f"Executed {language} code",
            "success": True,
        }
