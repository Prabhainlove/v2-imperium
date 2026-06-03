"""
IMPERIUM Automation Agent - JARVIS-Level System Automation

Production-ready automation engine for complete system control.
Handles browser, OS, files, applications, workflows, and scheduling.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from agents.automation_agent.modules.browser.browser_engine import BrowserAutomation
from agents.automation_agent.modules.os_control.system_controller import SystemController
from agents.automation_agent.modules.file_system.file_manager import FileSystemManager
from agents.automation_agent.modules.applications.app_automation import ApplicationAutomation
from agents.automation_agent.modules.api.api_connector import APIConnector
from agents.automation_agent.modules.workflows.workflow_engine import WorkflowEngine
from agents.automation_agent.modules.scheduler.task_scheduler import TaskScheduler
from agents.automation_agent.modules.monitoring.system_monitor import SystemMonitor
from agents.automation_agent.modules.safety.safety_controller import SafetyController
from agents.automation_agent.modules.vision.vision_engine import VisionEngine
from agents.automation_agent.tools.tool_registry import AutomationToolRegistry

logger = logging.getLogger(__name__)


class AutomationAgentConfig:
    """Configuration for the Automation Agent."""
    
    def __init__(
        self,
        enable_browser: bool = True,
        enable_os_control: bool = True,
        enable_file_operations: bool = True,
        enable_app_automation: bool = True,
        enable_api: bool = True,
        enable_workflows: bool = True,
        enable_scheduler: bool = True,
        enable_monitoring: bool = True,
        enable_vision: bool = True,
        headless_browser: bool = False,
        safety_level: str = "strict",  # strict, moderate, permissive
        max_concurrent_tasks: int = 5,
        timeout_seconds: int = 300,
    ):
        self.enable_browser = enable_browser
        self.enable_os_control = enable_os_control
        self.enable_file_operations = enable_file_operations
        self.enable_app_automation = enable_app_automation
        self.enable_api = enable_api
        self.enable_workflows = enable_workflows
        self.enable_scheduler = enable_scheduler
        self.enable_monitoring = enable_monitoring
        self.enable_vision = enable_vision
        self.headless_browser = headless_browser
        self.safety_level = safety_level
        self.max_concurrent_tasks = max_concurrent_tasks
        self.timeout_seconds = timeout_seconds


class AutomationAgent:
    """
    JARVIS-Level Automation Agent for IMPERIUM.
    
    Capabilities:
    - Browser automation (Playwright)
    - OS control (PyAutoGUI, psutil)
    - File system operations
    - Application automation
    - API integration
    - Workflow orchestration
    - Task scheduling
    - System monitoring
    - Vision/OCR
    """
    
    def __init__(self, config: Optional[AutomationAgentConfig] = None):
        self.config = config or AutomationAgentConfig()
        self.agent_id = str(uuid4())
        
        # Initialize core modules
        self.browser = BrowserAutomation(
            headless=self.config.headless_browser
        ) if self.config.enable_browser else None
        
        self.system_controller = SystemController() if self.config.enable_os_control else None
        self.file_manager = FileSystemManager() if self.config.enable_file_operations else None
        self.app_automation = ApplicationAutomation() if self.config.enable_app_automation else None
        self.api_connector = APIConnector() if self.config.enable_api else None
        self.workflow_engine = WorkflowEngine(
            max_concurrent=self.config.max_concurrent_tasks
        ) if self.config.enable_workflows else None
        self.scheduler = TaskScheduler() if self.config.enable_scheduler else None
        self.monitor = SystemMonitor() if self.config.enable_monitoring else None
        self.vision = VisionEngine() if self.config.enable_vision else None
        
        # Safety layer (always enabled)
        self.safety = SafetyController(level=self.config.safety_level)
        
        # Tool registry
        self.tools = AutomationToolRegistry()
        self._register_tools()
        
        logger.info(f"Automation Agent initialized: {self.agent_id}")
        logger.info(f"Capabilities: Browser={self.config.enable_browser}, "
                   f"OS={self.config.enable_os_control}, Files={self.config.enable_file_operations}")
    
    def _register_tools(self):
        """Register all automation tools."""
        if self.browser:
            self.tools.register_module("browser", self.browser)
        if self.system_controller:
            self.tools.register_module("system", self.system_controller)
        if self.file_manager:
            self.tools.register_module("files", self.file_manager)
        if self.app_automation:
            self.tools.register_module("apps", self.app_automation)
        if self.api_connector:
            self.tools.register_module("api", self.api_connector)
        if self.workflow_engine:
            self.tools.register_module("workflow", self.workflow_engine)
        if self.monitor:
            self.tools.register_module("monitor", self.monitor)
        if self.vision:
            self.tools.register_module("vision", self.vision)
    
    async def execute(self, task: dict[str, Any]) -> dict[str, Any]:
        """
        IMPERIUM ENTRYPOINT - Execute automation task.
        
        Args:
            task: Task specification from IMPERIUM
                - task_id: Unique task identifier
                - action: Automation action to perform
                - parameters: Action parameters
                - workflow: Optional workflow definition
                - safety_override: Optional safety bypass (requires confirmation)
        
        Returns:
            Result dictionary with:
                - status: success/failure/partial
                - result: Action result
                - output: Detailed output
                - actions_taken: List of actions performed
                - duration_seconds: Execution time
                - metadata: Additional information
        """
        start_time = datetime.now(timezone.utc)
        task_id = task.get("task_id", str(uuid4()))
        action = task.get("action", "")
        parameters = task.get("parameters", {})
        workflow_def = task.get("workflow")
        
        logger.info(f"[{task_id}] Automation Agent executing: {action}")
        
        try:
            # Safety check
            safety_check = await self.safety.validate_task(task)
            if not safety_check["safe"]:
                return {
                    "status": "blocked",
                    "task_id": task_id,
                    "agent_id": self.agent_id,
                    "error": f"Safety validation failed: {safety_check['reason']}",
                    "requires_confirmation": safety_check.get("requires_confirmation", False),
                }
            
            # Execute workflow if provided
            if workflow_def:
                result = await self._execute_workflow(task_id, workflow_def, parameters)
            else:
                # Execute single action
                result = await self._execute_action(task_id, action, parameters)
            
            # Calculate duration
            end_time = datetime.now(timezone.utc)
            duration = (end_time - start_time).total_seconds()
            
            return {
                "status": "success" if result.get("success") else "failure",
                "task_id": task_id,
                "agent_id": self.agent_id,
                "result": result.get("result"),
                "output": result.get("output", ""),
                "actions_taken": result.get("actions_taken", []),
                "duration_seconds": duration,
                "metadata": {
                    "agent_version": "1.0.0-jarvis",
                    "capabilities_used": result.get("capabilities_used", []),
                    "safety_level": self.config.safety_level,
                },
            }
        
        except Exception as e:
            logger.error(f"[{task_id}] Automation execution failed: {str(e)}", exc_info=True)
            return {
                "status": "failure",
                "task_id": task_id,
                "agent_id": self.agent_id,
                "error": str(e),
                "error_type": type(e).__name__,
            }
    
    async def _execute_action(
        self,
        task_id: str,
        action: str,
        parameters: dict[str, Any]
    ) -> dict[str, Any]:
        """Execute a single automation action."""
        action_lower = action.lower().replace(" ", "_")
        
        # Browser actions
        if action_lower.startswith("browser_") or action_lower in ["open_website", "click", "fill_form", "scrape"]:
            if not self.browser:
                return {"success": False, "error": "Browser automation disabled"}
            return await self._execute_browser_action(task_id, action_lower, parameters)
        
        # OS control actions
        elif action_lower.startswith("os_") or action_lower in ["open_app", "close_app", "run_command", "keyboard", "mouse"]:
            if not self.system_controller:
                return {"success": False, "error": "OS control disabled"}
            return await self._execute_os_action(task_id, action_lower, parameters)
        
        # File system actions
        elif action_lower.startswith("file_") or action_lower in ["create_file", "delete_file", "move_file", "organize_folder"]:
            if not self.file_manager:
                return {"success": False, "error": "File operations disabled"}
            return await self._execute_file_action(task_id, action_lower, parameters)
        
        # Application actions
        elif action_lower.startswith("app_") or action_lower in ["excel", "pdf", "email"]:
            if not self.app_automation:
                return {"success": False, "error": "App automation disabled"}
            return await self._execute_app_action(task_id, action_lower, parameters)
        
        # API actions
        elif action_lower.startswith("api_") or action_lower in ["http_request", "webhook", "call_api"]:
            if not self.api_connector:
                return {"success": False, "error": "API integration disabled"}
            return await self._execute_api_action(task_id, action_lower, parameters)
        
        # Monitoring actions
        elif action_lower.startswith("monitor_") or action_lower in ["check_resources", "get_processes"]:
            if not self.monitor:
                return {"success": False, "error": "Monitoring disabled"}
            return await self._execute_monitor_action(task_id, action_lower, parameters)
        
        # Vision actions
        elif action_lower.startswith("vision_") or action_lower in ["screenshot", "ocr", "find_image"]:
            if not self.vision:
                return {"success": False, "error": "Vision disabled"}
            return await self._execute_vision_action(task_id, action_lower, parameters)
        
        else:
            return {
                "success": False,
                "error": f"Unknown action: {action}",
                "available_actions": self.tools.list_actions(),
            }
    
    async def _execute_workflow(
        self,
        task_id: str,
        workflow_def: dict[str, Any],
        parameters: dict[str, Any]
    ) -> dict[str, Any]:
        """Execute a multi-step workflow."""
        if not self.workflow_engine:
            return {"success": False, "error": "Workflow engine disabled"}
        
        return await self.workflow_engine.execute_workflow(
            workflow_def=workflow_def,
            parameters=parameters,
            task_id=task_id,
        )
    
    async def _execute_browser_action(self, task_id: str, action: str, params: dict) -> dict:
        """Execute browser automation action."""
        return await self.browser.execute_action(action, params)
    
    async def _execute_os_action(self, task_id: str, action: str, params: dict) -> dict:
        """Execute OS control action."""
        return await self.system_controller.execute_action(action, params)
    
    async def _execute_file_action(self, task_id: str, action: str, params: dict) -> dict:
        """Execute file system action."""
        return await self.file_manager.execute_action(action, params)
    
    async def _execute_app_action(self, task_id: str, action: str, params: dict) -> dict:
        """Execute application automation action."""
        return await self.app_automation.execute_action(action, params)
    
    async def _execute_api_action(self, task_id: str, action: str, params: dict) -> dict:
        """Execute API integration action."""
        return await self.api_connector.execute_action(action, params)
    
    async def _execute_monitor_action(self, task_id: str, action: str, params: dict) -> dict:
        """Execute monitoring action."""
        return await self.monitor.execute_action(action, params)
    
    async def _execute_vision_action(self, task_id: str, action: str, params: dict) -> dict:
        """Execute vision/OCR action."""
        return await self.vision.execute_action(action, params)
    
    def get_capabilities(self) -> dict[str, Any]:
        """Return agent capabilities for IMPERIUM."""
        return {
            "agent_type": "automation",
            "agent_id": self.agent_id,
            "version": "1.0.0-jarvis",
            "description": "JARVIS-level automation agent with complete system control",
            "capabilities": {
                "browser_automation": self.config.enable_browser,
                "os_control": self.config.enable_os_control,
                "file_operations": self.config.enable_file_operations,
                "app_automation": self.config.enable_app_automation,
                "api_integration": self.config.enable_api,
                "workflows": self.config.enable_workflows,
                "scheduling": self.config.enable_scheduler,
                "monitoring": self.config.enable_monitoring,
                "vision_ocr": self.config.enable_vision,
            },
            "available_actions": self.tools.list_actions(),
            "safety_level": self.config.safety_level,
            "max_concurrent_tasks": self.config.max_concurrent_tasks,
        }
    
    async def schedule_task(
        self,
        task: dict[str, Any],
        schedule: str,
    ) -> dict[str, Any]:
        """Schedule a recurring automation task."""
        if not self.scheduler:
            return {"success": False, "error": "Scheduler disabled"}
        
        return await self.scheduler.schedule_task(task, schedule)
    
    async def shutdown(self):
        """Cleanup and shutdown agent."""
        logger.info(f"Shutting down Automation Agent: {self.agent_id}")
        
        if self.browser:
            await self.browser.cleanup()
        if self.scheduler:
            await self.scheduler.stop()
        
        logger.info("Automation Agent shutdown complete")
