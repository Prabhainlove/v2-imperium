"""
IMPERIUM Agent Registry - Unified access to all system agents.

This module provides centralized access to all IMPERIUM agents with a consistent interface.
All agents follow the standard IMPERIUM contract: async def execute(task: dict) -> dict
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from agents.research_agent.research_agent import ResearchAgent
    from agents.automation_agent.automation_agent import AutomationAgent
    from agents.coding_agent.coding_agent import CodingAgent
    from agents.workflow_agent.superagi_workflow_agent import WorkflowAgent
    from agents.job_agent.job_agent import JobAgent


class ImperiumAgentRegistry:
    """
    Central registry for all IMPERIUM agents.
    
    Agents:
    - research_agent: High-intelligence research with internet access, academic search, hypothesis testing
    - automation_agent: JARVIS-level system automation (browser, OS, files, workflows)
    - coding_agent: Autonomous software engineering with self-improvement loops
    - workflow_agent: Multi-agent orchestration with council decision-making
    - job_agent: 100x autonomous career operations (job search, application, negotiation)
    """

    def __init__(self, workspace_root: str | Path | None = None) -> None:
        self.workspace_root = Path(workspace_root).resolve() if workspace_root else Path.cwd()
        self._agents: dict[str, Any] = {}

    def get_research_agent(self, config: Any = None) -> ResearchAgent:
        """Get or create the Research Agent instance."""
        if "research" not in self._agents:
            from agents.research_agent.research_agent import ResearchAgent
            self._agents["research"] = ResearchAgent(config=config)
        return self._agents["research"]

    def get_automation_agent(self, config: Any = None) -> AutomationAgent:
        """Get or create the Automation Agent instance."""
        if "automation" not in self._agents:
            from agents.automation_agent.automation_agent import AutomationAgent
            self._agents["automation"] = AutomationAgent(config=config)
        return self._agents["automation"]

    def get_coding_agent(self, config: Any = None) -> CodingAgent:
        """Get or create the Coding Agent instance."""
        if "coding" not in self._agents:
            from agents.coding_agent.coding_agent import CodingAgent
            self._agents["coding"] = CodingAgent(
                workspace_root=self.workspace_root,
                config=config
            )
        return self._agents["coding"]

    def get_workflow_agent(self, config: Any = None, agent_clients: dict[str, Any] | None = None) -> WorkflowAgent:
        """Get or create the Workflow Agent instance."""
        if "workflow" not in self._agents:
            from agents.workflow_agent.superagi_workflow_agent import WorkflowAgent
            self._agents["workflow"] = WorkflowAgent(
                workspace_root=self.workspace_root,
                config=config,
                agent_clients=agent_clients or self._build_agent_clients()
            )
        return self._agents["workflow"]

    def get_job_agent(self, config: Any = None, agent_clients: dict[str, Any] | None = None) -> JobAgent:
        """Get or create the Job Agent instance."""
        if "job" not in self._agents:
            from agents.job_agent.job_agent import JobAgent
            self._agents["job"] = JobAgent(
                workspace_root=self.workspace_root,
                config=config,
                agent_clients=agent_clients or self._build_agent_clients()
            )
        return self._agents["job"]

    def get_all_agents(self) -> dict[str, Any]:
        """Get all initialized agents."""
        return {
            "research_agent": self.get_research_agent(),
            "automation_agent": self.get_automation_agent(),
            "coding_agent": self.get_coding_agent(),
            "workflow_agent": self.get_workflow_agent(),
            "job_agent": self.get_job_agent(),
        }

    def list_capabilities(self) -> dict[str, dict[str, Any]]:
        """List capabilities of all agents."""
        agents = self.get_all_agents()
        capabilities = {}
        
        for name, agent in agents.items():
            if hasattr(agent, 'get_capabilities'):
                capabilities[name] = agent.get_capabilities()
            else:
                capabilities[name] = {
                    "agent_type": name.replace("_agent", ""),
                    "entrypoint": "async execute(task: dict) -> dict"
                }
        
        return capabilities

    def _build_agent_clients(self) -> dict[str, Any]:
        """Build agent client map for inter-agent communication."""
        return {
            "research": self.get_research_agent(),
            "automation": self.get_automation_agent(),
            "coding": self.get_coding_agent(),
        }

    async def execute_task(self, agent_name: str, task: dict[str, Any]) -> dict[str, Any]:
        """
        Execute a task on a specific agent.
        
        Args:
            agent_name: Name of agent (research, automation, coding, workflow, job)
            task: Task dictionary
            
        Returns:
            Execution result dictionary
        """
        agent_map = {
            "research": self.get_research_agent,
            "automation": self.get_automation_agent,
            "coding": self.get_coding_agent,
            "workflow": self.get_workflow_agent,
            "job": self.get_job_agent,
        }
        
        if agent_name not in agent_map:
            return {
                "status": "failure",
                "error": f"Unknown agent: {agent_name}",
                "available_agents": list(agent_map.keys())
            }
        
        agent = agent_map[agent_name]()
        return await agent.execute(task)


# Convenience function for quick access
def get_agent_registry(workspace_root: str | Path | None = None) -> ImperiumAgentRegistry:
    """Get the global IMPERIUM agent registry."""
    return ImperiumAgentRegistry(workspace_root=workspace_root)
