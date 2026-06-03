from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ..models import WorkflowStrategy, utc_now_iso


@dataclass(slots=True)
class LongTermWorkflowMemory:
    """Stores and recalls prior workflow outcomes for strategy reuse."""

    memory_file: Path
    history_file: Path | None = None
    knowledge_file: Path | None = None

    def __post_init__(self) -> None:
        self.memory_file = self.memory_file.resolve()
        self.memory_file.parent.mkdir(parents=True, exist_ok=True)
        if not self.memory_file.exists():
            self._save({"version": 1, "entries": []})

        if self.history_file is None:
            self.history_file = self.memory_file.with_name("workflow_history.json")
        if self.knowledge_file is None:
            self.knowledge_file = self.memory_file.with_name("workflow_knowledge.json")

        self.history_file = self.history_file.resolve()
        self.knowledge_file = self.knowledge_file.resolve()

        if not self.history_file.exists():
            self._save_json(self.history_file, {"version": 1, "history": []})
        if not self.knowledge_file.exists():
            self._save_json(self.knowledge_file, {"version": 1, "workflows": {}})

    def suggest_strategy(self, goal: str, workflow_type: str | None = None) -> str | None:
        if workflow_type:
            preferred = self.preferred_strategy_for_workflow(workflow_type)
            if preferred is not None:
                return preferred

        entries = self._load().get("entries", [])
        if not isinstance(entries, list) or not entries:
            return None

        goal_signature = self._goal_signature(goal)
        scored: list[tuple[float, dict[str, Any]]] = []

        for entry in entries:
            if not isinstance(entry, dict):
                continue
            signature = str(entry.get("goal_signature", "")).strip()
            if not signature:
                continue
            similarity = self._signature_similarity(goal_signature, signature)
            if similarity <= 0.0:
                continue
            scored.append((similarity, entry))

        if not scored:
            return None

        scored.sort(key=lambda item: (item[0], float(item[1].get("success_score", 0.0))), reverse=True)
        best_entry = scored[0][1]
        suggested = str(best_entry.get("strategy_label", "")).strip().upper()
        if suggested in {"A", "B", "C"}:
            return suggested
        return None

    def preferred_strategy_for_workflow(self, workflow_type: str) -> str | None:
        payload = self._load_json(self.knowledge_file, {"version": 1, "workflows": {}})
        workflows = payload.get("workflows", {})
        if not isinstance(workflows, dict):
            return None

        key = str(workflow_type).strip().lower()
        if not key:
            return None

        entry = workflows.get(key)
        if not isinstance(entry, dict):
            return None

        preferred = str(entry.get("preferred_strategy", "")).strip().upper()
        if preferred in {"A", "B", "C", "MEMORY"}:
            return preferred
        return None

    def record(
        self,
        *,
        task_id: str,
        goal: str,
        selected_strategy: WorkflowStrategy,
        status: str,
        execution_seconds: float,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        payload = self._load()
        entries = payload.get("entries", [])
        if not isinstance(entries, list):
            entries = []

        success_score = 1.0 if status.lower() == "success" else 0.45 if status.lower() == "partial" else 0.1
        record = {
            "task_id": task_id,
            "timestamp": utc_now_iso(),
            "goal": goal,
            "goal_signature": self._goal_signature(goal),
            "strategy_id": selected_strategy.strategy_id,
            "strategy_label": selected_strategy.label,
            "strategy_score": selected_strategy.score,
            "status": status,
            "success_score": success_score,
            "execution_seconds": round(max(0.0, execution_seconds), 4),
            "metadata": metadata or {},
        }

        entries.append(record)
        payload["entries"] = entries[-500:]
        self._save(payload)

        return {
            "memory_file": str(self.memory_file),
            "stored": True,
            "entries": len(payload["entries"]),
            "strategy_label": selected_strategy.label,
        }

    def record_workflow_history(
        self,
        *,
        task_id: str,
        workflow_type: str,
        best_strategy: str,
        selected_strategy_label: str,
        status: str,
        execution_seconds: float,
        success_rate: float,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        payload = self._load_json(self.history_file, {"version": 1, "history": []})
        history = payload.get("history", [])
        if not isinstance(history, list):
            history = []

        record = {
            "task_id": task_id,
            "timestamp": utc_now_iso(),
            "workflow_type": str(workflow_type).strip().lower() or "general",
            "best_strategy": str(best_strategy).strip(),
            "selected_strategy_label": str(selected_strategy_label).strip().upper(),
            "status": str(status).strip().lower(),
            "execution_seconds": round(max(0.0, execution_seconds), 4),
            "success_rate": round(min(1.0, max(0.0, success_rate)), 4),
            "metadata": dict(metadata or {}),
        }

        history.append(record)
        payload["history"] = history[-2000:]
        self._save_json(self.history_file, payload)

        self._update_knowledge(payload["history"])

        return {
            "history_file": str(self.history_file),
            "stored": True,
            "entries": len(payload["history"]),
            "workflow_type": record["workflow_type"],
        }

    def _load(self) -> dict[str, Any]:
        try:
            return json.loads(self.memory_file.read_text(encoding="utf-8"))
        except Exception:
            return {"version": 1, "entries": []}

    def _save(self, payload: dict[str, Any]) -> None:
        self.memory_file.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def _load_json(self, path: Path, fallback: dict[str, Any]) -> dict[str, Any]:
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return dict(fallback)

    def _save_json(self, path: Path, payload: dict[str, Any]) -> None:
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def _update_knowledge(self, history_entries: list[dict[str, Any]]) -> None:
        grouped: dict[str, dict[str, Any]] = {}

        for entry in history_entries:
            if not isinstance(entry, dict):
                continue
            workflow_type = str(entry.get("workflow_type", "general")).strip().lower() or "general"
            strategy = str(entry.get("selected_strategy_label", "")).strip().upper()
            if strategy not in {"A", "B", "C", "MEMORY"}:
                continue

            item = grouped.setdefault(
                workflow_type,
                {
                    "count": 0,
                    "total_success": 0.0,
                    "strategy_success": {},
                },
            )
            item["count"] += 1

            success_rate = float(entry.get("success_rate", 0.0) or 0.0)
            success_rate = max(0.0, min(1.0, success_rate))
            item["total_success"] += success_rate

            strategy_bucket = item["strategy_success"].setdefault(
                strategy,
                {"count": 0, "total_success": 0.0},
            )
            strategy_bucket["count"] += 1
            strategy_bucket["total_success"] += success_rate

        workflows: dict[str, Any] = {}
        for workflow_type, item in grouped.items():
            strategy_success = item["strategy_success"]

            preferred_strategy = ""
            preferred_score = -1.0
            strategy_table: dict[str, float] = {}
            for label, bucket in strategy_success.items():
                count = int(bucket.get("count", 0))
                total_success = float(bucket.get("total_success", 0.0))
                avg_success = total_success / max(1, count)
                strategy_table[label] = round(avg_success, 4)
                if avg_success > preferred_score:
                    preferred_score = avg_success
                    preferred_strategy = label

            workflows[workflow_type] = {
                "count": item["count"],
                "success_rate": round(item["total_success"] / max(1, item["count"]), 4),
                "preferred_strategy": preferred_strategy,
                "strategy_success_rates": strategy_table,
                "updated_at": utc_now_iso(),
            }

        self._save_json(self.knowledge_file, {"version": 1, "workflows": workflows})

    def _goal_signature(self, goal: str) -> str:
        words = [item.strip().lower() for item in goal.split() if item.strip()]
        filtered = [item for item in words if len(item) > 2]
        unique_ordered: list[str] = []
        seen: set[str] = set()
        for item in filtered:
            if item in seen:
                continue
            seen.add(item)
            unique_ordered.append(item)
        return " ".join(unique_ordered[:20])

    def _signature_similarity(self, left: str, right: str) -> float:
        left_set = set(left.split())
        right_set = set(right.split())
        if not left_set or not right_set:
            return 0.0
        overlap = len(left_set.intersection(right_set))
        union = len(left_set.union(right_set))
        return overlap / max(1, union)
