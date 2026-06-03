"""
System Monitor for resource tracking.
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)


class SystemMonitor:
    """System resource monitoring."""
    
    def __init__(self):
        try:
            import psutil
            self.psutil = psutil
        except ImportError:
            self.psutil = None
        logger.info("System monitor initialized")
    
    async def execute_action(self, action: str, params: dict[str, Any]) -> dict[str, Any]:
        """Execute monitoring action."""
        if not self.psutil:
            return {"success": False, "error": "psutil not available"}
        
        try:
            if action in ["check_resources", "get_resources", "monitor_resources"]:
                return await self._get_resources()
            
            elif action in ["check_disk", "get_disk_usage"]:
                return await self._get_disk_usage()
            
            elif action in ["check_memory", "get_memory"]:
                return await self._get_memory()
            
            else:
                return {"success": False, "error": f"Unknown monitoring action: {action}"}
        
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _get_resources(self) -> dict:
        """Get system resource usage."""
        return {
            "success": True,
            "result": {
                "cpu_percent": self.psutil.cpu_percent(interval=1),
                "memory_percent": self.psutil.virtual_memory().percent,
                "disk_percent": self.psutil.disk_usage('/').percent,
            },
        }
    
    async def _get_disk_usage(self) -> dict:
        """Get disk usage."""
        disk = self.psutil.disk_usage('/')
        return {
            "success": True,
            "result": {
                "total": disk.total,
                "used": disk.used,
                "free": disk.free,
                "percent": disk.percent,
            },
        }
    
    async def _get_memory(self) -> dict:
        """Get memory usage."""
        mem = self.psutil.virtual_memory()
        return {
            "success": True,
            "result": {
                "total": mem.total,
                "available": mem.available,
                "used": mem.used,
                "percent": mem.percent,
            },
        }
