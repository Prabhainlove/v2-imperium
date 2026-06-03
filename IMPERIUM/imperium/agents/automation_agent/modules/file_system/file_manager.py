"""
File System Manager for file and folder automation.

Provides file operations, folder organization, and file monitoring.
"""

from __future__ import annotations

import asyncio
import logging
import os
import shutil
from pathlib import Path
from typing import Any, Optional
import hashlib

logger = logging.getLogger(__name__)


class FileSystemManager:
    """
    File system automation manager.
    
    Capabilities:
    - Create/read/update/delete files
    - Create/organize folders
    - Move/copy files
    - Search files
    - Monitor directories
    - Bulk operations
    """
    
    def __init__(self):
        self.watched_dirs = {}
        logger.info("File system manager initialized")
    
    async def execute_action(self, action: str, params: dict[str, Any]) -> dict[str, Any]:
        """Execute a file system action."""
        try:
            if action in ["create_file", "file_create"]:
                return await self._create_file(params.get("path"), params.get("content", ""))
            
            elif action in ["read_file", "file_read"]:
                return await self._read_file(params.get("path"))
            
            elif action in ["write_file", "file_write"]:
                return await self._write_file(params.get("path"), params.get("content"))
            
            elif action in ["delete_file", "file_delete"]:
                return await self._delete_file(params.get("path"))
            
            elif action in ["move_file", "file_move"]:
                return await self._move_file(params.get("source"), params.get("destination"))
            
            elif action in ["copy_file", "file_copy"]:
                return await self._copy_file(params.get("source"), params.get("destination"))
            
            elif action in ["create_folder", "folder_create", "mkdir"]:
                return await self._create_folder(params.get("path"))
            
            elif action in ["list_files", "file_list", "ls"]:
                return await self._list_files(params.get("path", "."), params.get("pattern"))
            
            elif action in ["organize_folder", "folder_organize"]:
                return await self._organize_folder(params.get("path"), params.get("by", "extension"))
            
            elif action in ["search_files", "file_search"]:
                return await self._search_files(
                    params.get("path", "."),
                    params.get("pattern"),
                    params.get("content"),
                )
            
            elif action in ["get_file_info", "file_info"]:
                return await self._get_file_info(params.get("path"))
            
            elif action in ["rename_file", "file_rename"]:
                return await self._rename_file(params.get("path"), params.get("new_name"))
            
            else:
                return {"success": False, "error": f"Unknown file action: {action}"}
        
        except Exception as e:
            logger.error(f"File action failed: {e}", exc_info=True)
            return {"success": False, "error": str(e)}
    
    async def _create_file(self, path: str, content: str) -> dict:
        """Create a new file."""
        file_path = Path(path)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content)
        
        return {
            "success": True,
            "result": f"File created: {path}",
            "path": str(file_path.absolute()),
            "size": file_path.stat().st_size,
        }
    
    async def _read_file(self, path: str) -> dict:
        """Read file content."""
        file_path = Path(path)
        
        if not file_path.exists():
            return {"success": False, "error": f"File not found: {path}"}
        
        content = file_path.read_text()
        
        return {
            "success": True,
            "result": content,
            "path": str(file_path.absolute()),
            "size": file_path.stat().st_size,
            "lines": len(content.splitlines()),
        }
    
    async def _write_file(self, path: str, content: str) -> dict:
        """Write content to file."""
        file_path = Path(path)
        file_path.write_text(content)
        
        return {
            "success": True,
            "result": f"File written: {path}",
            "path": str(file_path.absolute()),
            "size": file_path.stat().st_size,
        }
    
    async def _delete_file(self, path: str) -> dict:
        """Delete a file."""
        file_path = Path(path)
        
        if not file_path.exists():
            return {"success": False, "error": f"File not found: {path}"}
        
        file_path.unlink()
        
        return {
            "success": True,
            "result": f"File deleted: {path}",
            "path": str(file_path.absolute()),
        }
    
    async def _move_file(self, source: str, destination: str) -> dict:
        """Move file to new location."""
        src_path = Path(source)
        dst_path = Path(destination)
        
        if not src_path.exists():
            return {"success": False, "error": f"Source file not found: {source}"}
        
        dst_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src_path), str(dst_path))
        
        return {
            "success": True,
            "result": f"File moved from {source} to {destination}",
            "source": str(src_path.absolute()),
            "destination": str(dst_path.absolute()),
        }
    
    async def _copy_file(self, source: str, destination: str) -> dict:
        """Copy file to new location."""
        src_path = Path(source)
        dst_path = Path(destination)
        
        if not src_path.exists():
            return {"success": False, "error": f"Source file not found: {source}"}
        
        dst_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(str(src_path), str(dst_path))
        
        return {
            "success": True,
            "result": f"File copied from {source} to {destination}",
            "source": str(src_path.absolute()),
            "destination": str(dst_path.absolute()),
        }
    
    async def _create_folder(self, path: str) -> dict:
        """Create a folder."""
        folder_path = Path(path)
        folder_path.mkdir(parents=True, exist_ok=True)
        
        return {
            "success": True,
            "result": f"Folder created: {path}",
            "path": str(folder_path.absolute()),
        }
    
    async def _list_files(self, path: str, pattern: Optional[str] = None) -> dict:
        """List files in directory."""
        dir_path = Path(path)
        
        if not dir_path.exists():
            return {"success": False, "error": f"Directory not found: {path}"}
        
        if pattern:
            files = list(dir_path.glob(pattern))
        else:
            files = list(dir_path.iterdir())
        
        file_list = [
            {
                "name": f.name,
                "path": str(f.absolute()),
                "is_dir": f.is_dir(),
                "size": f.stat().st_size if f.is_file() else 0,
            }
            for f in files
        ]
        
        return {
            "success": True,
            "result": file_list,
            "count": len(file_list),
            "path": str(dir_path.absolute()),
        }
    
    async def _organize_folder(self, path: str, by: str = "extension") -> dict:
        """Organize files in folder by type or date."""
        dir_path = Path(path)
        
        if not dir_path.exists():
            return {"success": False, "error": f"Directory not found: {path}"}
        
        organized_count = 0
        
        if by == "extension":
            for file_path in dir_path.iterdir():
                if file_path.is_file():
                    ext = file_path.suffix[1:] if file_path.suffix else "no_extension"
                    target_dir = dir_path / ext
                    target_dir.mkdir(exist_ok=True)
                    
                    target_path = target_dir / file_path.name
                    file_path.rename(target_path)
                    organized_count += 1
        
        return {
            "success": True,
            "result": f"Organized {organized_count} files by {by}",
            "count": organized_count,
            "path": str(dir_path.absolute()),
        }
    
    async def _search_files(
        self,
        path: str,
        pattern: Optional[str] = None,
        content: Optional[str] = None,
    ) -> dict:
        """Search for files by name or content."""
        dir_path = Path(path)
        
        if not dir_path.exists():
            return {"success": False, "error": f"Directory not found: {path}"}
        
        results = []
        
        if pattern:
            # Search by filename pattern
            for file_path in dir_path.rglob(pattern):
                results.append({
                    "name": file_path.name,
                    "path": str(file_path.absolute()),
                    "is_dir": file_path.is_dir(),
                })
        
        if content:
            # Search file contents
            for file_path in dir_path.rglob("*"):
                if file_path.is_file():
                    try:
                        if content in file_path.read_text():
                            results.append({
                                "name": file_path.name,
                                "path": str(file_path.absolute()),
                                "match_type": "content",
                            })
                    except (UnicodeDecodeError, PermissionError):
                        continue
        
        return {
            "success": True,
            "result": results,
            "count": len(results),
        }
    
    async def _get_file_info(self, path: str) -> dict:
        """Get detailed file information."""
        file_path = Path(path)
        
        if not file_path.exists():
            return {"success": False, "error": f"File not found: {path}"}
        
        stat = file_path.stat()
        
        return {
            "success": True,
            "result": {
                "name": file_path.name,
                "path": str(file_path.absolute()),
                "size": stat.st_size,
                "is_dir": file_path.is_dir(),
                "created": stat.st_ctime,
                "modified": stat.st_mtime,
                "extension": file_path.suffix,
            },
        }
    
    async def _rename_file(self, path: str, new_name: str) -> dict:
        """Rename a file."""
        file_path = Path(path)
        
        if not file_path.exists():
            return {"success": False, "error": f"File not found: {path}"}
        
        new_path = file_path.parent / new_name
        file_path.rename(new_path)
        
        return {
            "success": True,
            "result": f"File renamed from {file_path.name} to {new_name}",
            "old_path": str(file_path.absolute()),
            "new_path": str(new_path.absolute()),
        }
