"""
System Controller for OS-level automation.

Provides control over applications, processes, input devices, and system commands.
"""

from __future__ import annotations

import asyncio
import logging
import subprocess
import platform
from typing import Any, Optional

logger = logging.getLogger(__name__)


class SystemController:
    """
    OS automation controller.
    
    Capabilities:
    - Launch/close applications
    - Simulate keyboard input
    - Simulate mouse control
    - Execute shell commands
    - Manage processes
    - Control windows
    """
    
    def __init__(self):
        self.os_type = platform.system()
        self._init_automation_libs()
        logger.info(f"System controller initialized for {self.os_type}")
    
    def _init_automation_libs(self):
        """Initialize automation libraries."""
        try:
            import pyautogui
            self.pyautogui = pyautogui
            pyautogui.FAILSAFE = True  # Move mouse to corner to abort
        except ImportError:
            logger.warning("pyautogui not installed, using simulated mode")
            self.pyautogui = None
        
        try:
            import psutil
            self.psutil = psutil
        except ImportError:
            logger.warning("psutil not installed, process management limited")
            self.psutil = None
    
    async def execute_action(self, action: str, params: dict[str, Any]) -> dict[str, Any]:
        """Execute an OS control action."""
        try:
            if action in ["open_app", "os_open_app", "launch_app"]:
                return await self._open_application(params.get("app") or params.get("name"))
            
            elif action in ["close_app", "os_close_app", "kill_app"]:
                return await self._close_application(params.get("app") or params.get("name"))
            
            elif action in ["run_command", "os_run_command", "execute_command", "shell"]:
                return await self._run_command(
                    params.get("command"),
                    params.get("shell", True),
                    params.get("capture_output", True),
                )
            
            elif action in ["keyboard", "os_keyboard", "type", "press_key"]:
                return await self._keyboard_input(
                    params.get("keys") or params.get("text"),
                    params.get("interval", 0.05),
                )
            
            elif action in ["mouse", "os_mouse", "click_mouse"]:
                return await self._mouse_action(
                    params.get("button", "left"),
                    params.get("x"),
                    params.get("y"),
                    params.get("clicks", 1),
                )
            
            elif action in ["get_processes", "os_get_processes", "list_processes"]:
                return await self._get_processes()
            
            elif action in ["kill_process", "os_kill_process"]:
                return await self._kill_process(params.get("pid") or params.get("name"))
            
            elif action in ["screenshot_desktop", "os_screenshot"]:
                return await self._screenshot_desktop(params.get("path", "desktop_screenshot.png"))
            
            elif action in ["move_mouse", "os_move_mouse"]:
                return await self._move_mouse(params.get("x"), params.get("y"))
            
            elif action in ["hotkey", "os_hotkey", "keyboard_shortcut"]:
                return await self._hotkey(params.get("keys"))
            
            else:
                return {"success": False, "error": f"Unknown OS action: {action}"}
        
        except Exception as e:
            logger.error(f"OS action failed: {e}", exc_info=True)
            return {"success": False, "error": str(e)}
    
    async def _open_application(self, app_name: str) -> dict:
        """Launch an application."""
        try:
            if self.os_type == "Windows":
                # Windows application launching
                subprocess.Popen(["start", app_name], shell=True)
            elif self.os_type == "Darwin":  # macOS
                subprocess.Popen(["open", "-a", app_name])
            else:  # Linux
                subprocess.Popen([app_name])
            
            await asyncio.sleep(1)  # Wait for app to start
            
            return {
                "success": True,
                "result": f"Launched {app_name}",
                "app": app_name,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _close_application(self, app_name: str) -> dict:
        """Close an application."""
        if not self.psutil:
            return {"success": False, "error": "psutil not available"}
        
        killed_count = 0
        for proc in self.psutil.process_iter(['pid', 'name']):
            try:
                if app_name.lower() in proc.info['name'].lower():
                    proc.terminate()
                    killed_count += 1
            except (self.psutil.NoSuchProcess, self.psutil.AccessDenied):
                continue
        
        return {
            "success": killed_count > 0,
            "result": f"Closed {killed_count} instance(s) of {app_name}",
            "count": killed_count,
        }
    
    async def _run_command(self, command: str, shell: bool, capture_output: bool) -> dict:
        """Execute shell command."""
        try:
            if capture_output:
                result = subprocess.run(
                    command,
                    shell=shell,
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
                return {
                    "success": result.returncode == 0,
                    "result": result.stdout,
                    "error": result.stderr if result.returncode != 0 else None,
                    "return_code": result.returncode,
                }
            else:
                subprocess.Popen(command, shell=shell)
                return {"success": True, "result": "Command executed (no output captured)"}
        
        except subprocess.TimeoutExpired:
            return {"success": False, "error": "Command timeout"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _keyboard_input(self, text: str, interval: float) -> dict:
        """Simulate keyboard typing."""
        if not self.pyautogui:
            return {"success": False, "error": "pyautogui not available"}
        
        await asyncio.sleep(0.1)
        self.pyautogui.write(text, interval=interval)
        
        return {
            "success": True,
            "result": f"Typed {len(text)} characters",
            "text_length": len(text),
        }
    
    async def _mouse_action(self, button: str, x: Optional[int], y: Optional[int], clicks: int) -> dict:
        """Simulate mouse action."""
        if not self.pyautogui:
            return {"success": False, "error": "pyautogui not available"}
        
        if x is not None and y is not None:
            self.pyautogui.click(x=x, y=y, clicks=clicks, button=button)
            action = f"Clicked at ({x}, {y})"
        else:
            self.pyautogui.click(clicks=clicks, button=button)
            action = f"Clicked at current position"
        
        return {"success": True, "result": action, "button": button, "clicks": clicks}
    
    async def _move_mouse(self, x: int, y: int) -> dict:
        """Move mouse to position."""
        if not self.pyautogui:
            return {"success": False, "error": "pyautogui not available"}
        
        self.pyautogui.moveTo(x, y)
        return {"success": True, "result": f"Mouse moved to ({x}, {y})"}
    
    async def _hotkey(self, keys: list[str] | str) -> dict:
        """Simulate keyboard shortcut."""
        if not self.pyautogui:
            return {"success": False, "error": "pyautogui not available"}
        
        if isinstance(keys, str):
            keys = keys.split("+")
        
        self.pyautogui.hotkey(*keys)
        return {"success": True, "result": f"Pressed hotkey: {'+'.join(keys)}"}
    
    async def _get_processes(self) -> dict:
        """Get list of running processes."""
        if not self.psutil:
            return {"success": False, "error": "psutil not available"}
        
        processes = []
        for proc in self.psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
            try:
                processes.append({
                    "pid": proc.info['pid'],
                    "name": proc.info['name'],
                    "cpu_percent": proc.info.get('cpu_percent', 0),
                    "memory_percent": proc.info.get('memory_percent', 0),
                })
            except (self.psutil.NoSuchProcess, self.psutil.AccessDenied):
                continue
        
        return {
            "success": True,
            "result": processes,
            "count": len(processes),
        }
    
    async def _kill_process(self, identifier: int | str) -> dict:
        """Kill a process by PID or name."""
        if not self.psutil:
            return {"success": False, "error": "psutil not available"}
        
        try:
            if isinstance(identifier, int):
                # Kill by PID
                proc = self.psutil.Process(identifier)
                proc.terminate()
                return {"success": True, "result": f"Terminated process {identifier}"}
            else:
                # Kill by name
                killed = 0
                for proc in self.psutil.process_iter(['pid', 'name']):
                    if identifier.lower() in proc.info['name'].lower():
                        proc.terminate()
                        killed += 1
                
                return {
                    "success": killed > 0,
                    "result": f"Terminated {killed} process(es) matching '{identifier}'",
                    "count": killed,
                }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _screenshot_desktop(self, path: str) -> dict:
        """Take desktop screenshot."""
        if not self.pyautogui:
            return {"success": False, "error": "pyautogui not available"}
        
        screenshot = self.pyautogui.screenshot()
        screenshot.save(path)
        
        return {
            "success": True,
            "result": f"Desktop screenshot saved to {path}",
            "path": path,
        }
