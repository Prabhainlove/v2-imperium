from __future__ import annotations

import asyncio
import inspect
from time import perf_counter
from typing import Any, Callable

from core.common import WorkflowStep

DispatchCallable = Callable[[str | None, dict[str, Any]], Any]


class StepExecutor:
    def __init__(self, dispatch_callable: DispatchCallable | None = None) -> None:
        self._dispatch = dispatch_callable

    def execute(self, workflow_id: str, step: WorkflowStep, context: dict[str, Any]) -> dict[str, Any]:
        start = perf_counter()
        
        # Build agent payload - merge input_payload with context for better agent compatibility
        # Agents expect: {"task_id": "...", "query": "...", "description": "...", ...}
        payload = dict(step.input_payload)
        
        # Add workflow metadata
        payload["workflow_id"] = workflow_id
        payload["step_id"] = step.step_id
        payload["action"] = step.action
        
        # Merge context data if available
        if context:
            # If context has a task, merge its fields
            if "task" in context and isinstance(context["task"], dict):
                task_data = context["task"]
                # Only add fields that don't already exist in payload
                for key in ["query", "description", "title", "task_id"]:
                    if key in task_data and key not in payload:
                        payload[key] = task_data[key]
            
            # Add full context for advanced agents that need it
            payload["context"] = dict(context)
        
        # CRITICAL: Normalize query field to ensure agents always get a string
        # This prevents "'dict' object has no attribute 'lower'" errors
        query = payload.get("query")
        if query is not None:
            if isinstance(query, dict):
                # Extract string from dict
                query = query.get("query") or query.get("text") or query.get("description") or str(query)
            query = str(query).strip()
            payload["query"] = query
        
        # Also normalize description field
        description = payload.get("description")
        if description is not None:
            if isinstance(description, dict):
                description = description.get("description") or description.get("text") or str(description)
            payload["description"] = str(description).strip()

        if self._dispatch is None:
            return {
                "status": "success",
                "result": {"note": "No dispatch callable configured", "payload": payload},
                "duration_seconds": round(perf_counter() - start, 4),
            }

        try:
            response = self._dispatch(step.assigned_agent, payload)
            
            # dispatch_to_agent should handle async internally, but just in case
            if inspect.isawaitable(response):
                try:
                    loop = asyncio.get_running_loop()
                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor() as pool:
                        future = pool.submit(asyncio.run, response)
                        response = future.result()
                except RuntimeError:
                    response = asyncio.run(response)

            if not isinstance(response, dict):
                response = {"raw": response}

            normalized = str(response.get("status", "success")).lower()
            status = "success" if normalized in {"success", "completed", "ok"} else "failure"
            return {
                "status": status,
                "result": response,
                "duration_seconds": round(perf_counter() - start, 4),
            }
        except Exception as exc:
            return {
                "status": "failure",
                "error": str(exc),
                "duration_seconds": round(perf_counter() - start, 4),
            }
