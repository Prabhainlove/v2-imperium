"""
Automation Tool Registry.

Tracks all available automation actions and capabilities.
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)


class AutomationToolRegistry:
    """Registry of all automation tools and actions."""
    
    def __init__(self):
        self.modules = {}
        logger.info("Automation tool registry initialized")
    
    def register_module(self, name: str, module: Any):
        """Register an automation module."""
        self.modules[name] = module
        logger.info(f"Registered automation module: {name}")
    
    def list_actions(self) -> list[str]:
        """List all available actions."""
        actions = []
        
        # Browser actions
        if "browser" in self.modules:
            actions.extend([
                "open_website", "click", "fill_form", "submit", "scrape",
                "screenshot", "execute_js", "wait", "login",
            ])
        
        # OS actions
        if "system" in self.modules:
            actions.extend([
                "open_app", "close_app", "run_command", "keyboard", "mouse",
                "get_processes", "kill_process", "hotkey",
            ])
        
        # File actions
        if "files" in self.modules:
            actions.extend([
                "create_file", "read_file", "write_file", "delete_file",
                "move_file", "copy_file", "create_folder", "list_files",
                "organize_folder", "search_files",
            ])
        
        # API actions
        if "api" in self.modules:
            actions.extend([
                "http_request", "webhook", "call_api",
            ])
        
        # Workflow actions
        if "workflow" in self.modules:
            actions.append("execute_workflow")
        
        # Monitoring actions
        if "monitor" in self.modules:
            actions.extend([
                "check_resources", "get_disk_usage", "get_memory",
            ])
        
        return actions
    
    def get_module(self, name: str) -> Any:
        """Get a registered module."""
        return self.modules.get(name)
