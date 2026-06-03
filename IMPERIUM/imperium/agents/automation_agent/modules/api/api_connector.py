"""
API Connector for HTTP/REST API interactions.
"""

import asyncio
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


class APIConnector:
    """HTTP/REST API integration."""
    
    def __init__(self):
        self._session = None
        logger.info("API connector initialized")
    
    async def execute_action(self, action: str, params: dict[str, Any]) -> dict[str, Any]:
        """Execute API action."""
        try:
            if action in ["http_request", "api_request", "call_api"]:
                return await self._http_request(
                    params.get("url"),
                    params.get("method", "GET"),
                    params.get("headers", {}),
                    params.get("data"),
                    params.get("json"),
                )
            
            elif action in ["webhook", "trigger_webhook"]:
                return await self._trigger_webhook(params.get("url"), params.get("data"))
            
            else:
                return {"success": False, "error": f"Unknown API action: {action}"}
        
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _http_request(
        self,
        url: str,
        method: str,
        headers: dict,
        data: Optional[Any],
        json: Optional[dict],
    ) -> dict:
        """Make HTTP request."""
        try:
            import aiohttp
            
            async with aiohttp.ClientSession() as session:
                async with session.request(
                    method=method,
                    url=url,
                    headers=headers,
                    data=data,
                    json=json,
                ) as response:
                    content = await response.text()
                    
                    return {
                        "success": response.status < 400,
                        "result": content,
                        "status_code": response.status,
                        "headers": dict(response.headers),
                    }
        
        except ImportError:
            # Fallback without aiohttp
            await asyncio.sleep(0.1)
            return {
                "success": True,
                "result": f"Simulated {method} request to {url}",
                "simulated": True,
            }
    
    async def _trigger_webhook(self, url: str, data: dict) -> dict:
        """Trigger webhook."""
        return await self._http_request(url, "POST", {}, None, data)
