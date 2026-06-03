"""
ReAct (Reasoning + Acting) Engine

Implements the ReAct paradigm:
1. Thought: Reason about current state
2. Action: Select and execute tool
3. Observation: Process result
4. Repeat until task complete

Enhanced with:
- Chain-of-Thought prompting
- Self-criticism
- Dynamic tool selection
- Error recovery
"""

from __future__ import annotations

import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


class ReActEngine:
    """
    ReAct reasoning engine for research agent.
    
    Combines reasoning and acting in an iterative loop,
    generating thoughts before each action.
    """
    
    def __init__(
        self,
        tool_registry,
        model: str = "gpt-4",
        temperature: float = 0.7,
    ):
        self.tool_registry = tool_registry
        self.model = model
        self.temperature = temperature
    
    async def reason(self, state: dict[str, Any]) -> dict[str, Any]:
        """
        Generate reasoning step and select next action.
        
        Args:
            state: Current agent state with query, plan, observations
        
        Returns:
            Reasoning step with:
                - thought: Current reasoning
                - reasoning: Justification
                - self_criticism: Critical evaluation
                - action: Tool to use (or FINISH)
                - action_input: Tool parameters
                - confidence: 0.0-1.0
        """
        query = state["query"]
        plan = state["plan"]
        observations = state.get("observations", [])
        reflection = state.get("reflection")
        
        # Build ReAct prompt
        prompt = self._build_react_prompt(
            query=query,
            plan=plan,
            observations=observations,
            reflection=reflection,
        )
        
        # Get LLM response (simulated for now - integrate with actual LLM)
        response = await self._call_llm(prompt)
        
        # Parse ReAct response
        reasoning_step = self._parse_response(response)
        
        return reasoning_step
    
    def _build_react_prompt(
        self,
        query: str,
        plan: Any,
        observations: list[Any],
        reflection: Optional[str],
    ) -> str:
        """Build ReAct prompt with Chain-of-Thought structure."""
        
        available_tools = self.tool_registry.list_tools()
        tools_desc = "\n".join([
            f"- {tool['name']}: {tool['description']}"
            for tool in available_tools
        ])
        
        observation_text = "\n".join([
            f"Step {i+1}: {obs}"
            for i, obs in enumerate(observations)
        ]) if observations else "No observations yet."
        
        prompt = f"""You are an intelligent research agent using the ReAct framework.

TASK: {query}

PLAN:
{plan.to_text() if hasattr(plan, 'to_text') else str(plan)}

AVAILABLE TOOLS:
{tools_desc}

PREVIOUS OBSERVATIONS:
{observation_text}

{"REFLECTION FROM PREVIOUS ATTEMPT: " + reflection if reflection else ""}

Instructions:
1. Think carefully about the current state
2. Reason about what information you need next
3. Critically evaluate your approach
4. Select the most appropriate tool to use (or FINISH if task is complete)
5. Provide parameters for the tool

Respond in this exact format:

Thought: [Your current thinking about the task]
Reasoning: [Why you chose this approach]
Self-Criticism: [What could go wrong? What are you uncertain about?]
Action: [Tool name or FINISH]
Action Input: [JSON parameters for the tool, or final answer if FINISH]
Confidence: [0.0 to 1.0]

Be thorough but concise. Focus on making progress toward the goal.
"""
        
        return prompt
    
    async def _call_llm(self, prompt: str) -> str:
        """
        Call LLM with ReAct prompt.
        TODO: Integrate with actual LLM provider (OpenAI, Anthropic, etc.)
        """
        # Placeholder - will be replaced with actual LLM call
        return """Thought: I need to search for information about the query.
Reasoning: Web search will provide current and relevant information.
Self-Criticism: Search results may need filtering for relevance.
Action: web_search
Action Input: {"query": "research topic"}
Confidence: 0.8"""
    
    def _parse_response(self, response: str) -> dict[str, Any]:
        """Parse LLM response into structured reasoning step."""
        
        lines = response.strip().split("\n")
        result = {
            "thought": "",
            "reasoning": "",
            "self_criticism": "",
            "action": "",
            "action_input": {},
            "confidence": 0.7,
        }
        
        current_key = None
        for line in lines:
            line = line.strip()
            if line.startswith("Thought:"):
                current_key = "thought"
                result["thought"] = line.replace("Thought:", "").strip()
            elif line.startswith("Reasoning:"):
                current_key = "reasoning"
                result["reasoning"] = line.replace("Reasoning:", "").strip()
            elif line.startswith("Self-Criticism:"):
                current_key = "self_criticism"
                result["self_criticism"] = line.replace("Self-Criticism:", "").strip()
            elif line.startswith("Action:"):
                current_key = "action"
                result["action"] = line.replace("Action:", "").strip()
            elif line.startswith("Action Input:"):
                current_key = "action_input"
                input_str = line.replace("Action Input:", "").strip()
                try:
                    import json
                    result["action_input"] = json.loads(input_str)
                except:
                    result["action_input"] = {"raw": input_str}
            elif line.startswith("Confidence:"):
                try:
                    result["confidence"] = float(line.replace("Confidence:", "").strip())
                except:
                    result["confidence"] = 0.7
            elif current_key and line:
                # Continue previous field
                result[current_key] += " " + line
        
        return result
