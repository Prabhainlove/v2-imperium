from __future__ import annotations

import json
import logging
import os
import sqlite3
from dataclasses import asdict, dataclass
from pathlib import Path
from threading import RLock
from typing import Any

from core.common import utc_now

from core.memory.agent_memory import AgentMemory
from core.memory.history_manager import HistoryManager
from core.memory.strategy_memory import StrategyMemory
from core.memory.task_memory import TaskMemory

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class CareerMemorySummary:
    db_path: str
    job_history_rows: int
    resume_versions_rows: int
    application_history_rows: int
    feedback_memory_rows: int


class CareerMemoryStore:
    """SQLite-backed persistence for job-search / application career memory.

    Tables:
    - job_history
    - resume_versions
    - application_history
    - feedback_memory
    """

    def __init__(self, *, db_path: str | Path | None = None) -> None:
        self.db_path = Path(db_path) if db_path is not None else _default_career_memory_db_path()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()
        self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self.initialize()

    def initialize(self) -> None:
        with self._lock:
            cur = self._conn.cursor()
            cur.executescript(
                """
            PRAGMA journal_mode=WAL;
            PRAGMA synchronous=NORMAL;

            CREATE TABLE IF NOT EXISTS job_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id TEXT NOT NULL,
                listing_id TEXT,
                company TEXT,
                job_title TEXT,
                score REAL,
                decision TEXT,
                resume_path TEXT,
                status TEXT,
                created_at TEXT NOT NULL,
                metadata TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_job_history_profile_created
                ON job_history(profile_id, created_at);

            CREATE TABLE IF NOT EXISTS resume_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id TEXT NOT NULL,
                listing_id TEXT,
                company TEXT,
                job_title TEXT,
                resume_path TEXT,
                resume_hash TEXT,
                created_at TEXT NOT NULL,
                metadata TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_resume_versions_profile_created
                ON resume_versions(profile_id, created_at);

            CREATE TABLE IF NOT EXISTS application_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id TEXT NOT NULL,
                listing_id TEXT,
                company TEXT,
                job_title TEXT,
                score REAL,
                decision TEXT,
                resume_path TEXT,
                status TEXT,
                mode TEXT,
                reason TEXT,
                created_at TEXT NOT NULL,
                metadata TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_application_history_profile_created
                ON application_history(profile_id, created_at);

            CREATE TABLE IF NOT EXISTS feedback_memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id TEXT NOT NULL,
                listing_id TEXT,
                company TEXT,
                job_title TEXT,
                feedback_type TEXT,
                content TEXT,
                created_at TEXT NOT NULL,
                metadata TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_feedback_memory_profile_created
                ON feedback_memory(profile_id, created_at);
            """
            )
            self._conn.commit()

    def record_job_history(
        self,
        *,
        profile_id: str,
        listing_id: str | None,
        company: str,
        job_title: str,
        score: float | None,
        decision: str,
        resume_path: str = "",
        status: str = "",
        metadata: dict[str, Any] | None = None,
        created_at: str | None = None,
    ) -> int:
        payload = json.dumps(metadata or {}, ensure_ascii=False)
        timestamp = created_at or utc_now().isoformat()
        with self._lock:
            cur = self._conn.cursor()
            cur.execute(
                """
            INSERT INTO job_history(profile_id, listing_id, company, job_title, score, decision, resume_path, status, created_at, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(profile_id),
                str(listing_id) if listing_id else None,
                str(company),
                str(job_title),
                float(score) if score is not None else None,
                str(decision),
                str(resume_path),
                str(status),
                str(timestamp),
                payload,
            ),
            )
            self._conn.commit()
            return int(cur.lastrowid)

    def record_resume_version(
        self,
        *,
        profile_id: str,
        listing_id: str | None,
        company: str,
        job_title: str,
        resume_path: str,
        resume_hash: str = "",
        metadata: dict[str, Any] | None = None,
        created_at: str | None = None,
    ) -> int:
        payload = json.dumps(metadata or {}, ensure_ascii=False)
        timestamp = created_at or utc_now().isoformat()
        with self._lock:
            cur = self._conn.cursor()
            cur.execute(
                """
            INSERT INTO resume_versions(profile_id, listing_id, company, job_title, resume_path, resume_hash, created_at, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(profile_id),
                str(listing_id) if listing_id else None,
                str(company),
                str(job_title),
                str(resume_path),
                str(resume_hash),
                str(timestamp),
                payload,
            ),
            )
            self._conn.commit()
            return int(cur.lastrowid)

    def record_application_history(
        self,
        *,
        profile_id: str,
        listing_id: str | None,
        company: str,
        job_title: str,
        score: float | None,
        decision: str,
        resume_path: str,
        status: str,
        mode: str,
        reason: str,
        metadata: dict[str, Any] | None = None,
        created_at: str | None = None,
    ) -> int:
        payload = json.dumps(metadata or {}, ensure_ascii=False)
        timestamp = created_at or utc_now().isoformat()
        with self._lock:
            cur = self._conn.cursor()
            cur.execute(
                """
            INSERT INTO application_history(profile_id, listing_id, company, job_title, score, decision, resume_path, status, mode, reason, created_at, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(profile_id),
                str(listing_id) if listing_id else None,
                str(company),
                str(job_title),
                float(score) if score is not None else None,
                str(decision),
                str(resume_path),
                str(status),
                str(mode),
                str(reason),
                str(timestamp),
                payload,
            ),
            )
            self._conn.commit()
            return int(cur.lastrowid)

    def record_feedback(
        self,
        *,
        profile_id: str,
        listing_id: str | None,
        company: str,
        job_title: str,
        feedback_type: str,
        content: str,
        metadata: dict[str, Any] | None = None,
        created_at: str | None = None,
    ) -> int:
        payload = json.dumps(metadata or {}, ensure_ascii=False)
        timestamp = created_at or utc_now().isoformat()
        with self._lock:
            cur = self._conn.cursor()
            cur.execute(
                """
            INSERT INTO feedback_memory(profile_id, listing_id, company, job_title, feedback_type, content, created_at, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(profile_id),
                str(listing_id) if listing_id else None,
                str(company),
                str(job_title),
                str(feedback_type),
                str(content),
                str(timestamp),
                payload,
            ),
            )
            self._conn.commit()
            return int(cur.lastrowid)

    def recent(self, table: str, *, profile_id: str | None = None, limit: int = 20) -> list[dict[str, Any]]:
        if table not in {"job_history", "resume_versions", "application_history", "feedback_memory"}:
            raise ValueError(f"Unknown career memory table: {table}")

        query = f"SELECT * FROM {table}"
        params: list[Any] = []
        if profile_id:
            query += " WHERE profile_id = ?"
            params.append(str(profile_id))
        query += " ORDER BY id DESC LIMIT ?"
        params.append(max(1, int(limit)))

        with self._lock:
            cur = self._conn.cursor()
            cur.execute(query, params)
            rows = cur.fetchall()

        results: list[dict[str, Any]] = []
        for row in rows:
            payload = dict(row)
            raw_meta = payload.get("metadata")
            if isinstance(raw_meta, str) and raw_meta:
                try:
                    payload["metadata"] = json.loads(raw_meta)
                except Exception:
                    payload["metadata"] = {"raw": raw_meta}
            results.append(payload)
        return results

    def summary(self) -> CareerMemorySummary:
        with self._lock:
            cur = self._conn.cursor()
            counts: dict[str, int] = {}
            for table in ("job_history", "resume_versions", "application_history", "feedback_memory"):
                cur.execute(f"SELECT COUNT(1) AS count FROM {table}")
                row = cur.fetchone()
                counts[table] = int(row["count"] if row else 0)

        return CareerMemorySummary(
            db_path=str(self.db_path),
            job_history_rows=counts.get("job_history", 0),
            resume_versions_rows=counts.get("resume_versions", 0),
            application_history_rows=counts.get("application_history", 0),
            feedback_memory_rows=counts.get("feedback_memory", 0),
        )


def _default_career_memory_db_path() -> Path:
    override = os.getenv("IMPERIUM_CAREER_MEMORY_DB")
    if override:
        return Path(override)
    imperium_root = Path(__file__).resolve().parents[2]
    return imperium_root / "imperium_data" / "career_memory.db"


class Memory:
    def __init__(
        self,
        *,
        task_memory: TaskMemory | None = None,
        strategy_memory: StrategyMemory | None = None,
        agent_memory: AgentMemory | None = None,
        history_manager: HistoryManager | None = None,
        career_memory: CareerMemoryStore | None = None,
    ) -> None:
        self.task_memory = task_memory or TaskMemory()
        self.strategy_memory = strategy_memory or StrategyMemory()
        self.agent_memory = agent_memory or AgentMemory()
        self.history_manager = history_manager or HistoryManager()

        # Persistent career memory (SQLite). If initialization fails, the rest of
        # the Memory system still works.
        try:
            self.career_memory = career_memory or CareerMemoryStore()
            self._reload_career_memory()
        except Exception as exc:  # pragma: no cover - runtime safety
            self.career_memory = None
            logger.warning("CareerMemoryStore disabled: %s", exc)

    def _reload_career_memory(self) -> None:
        if not self.career_memory:
            return
        summary = self.career_memory.summary()
        self.history_manager.append(
            "career_memory_loaded",
            {
                "db_path": summary.db_path,
                "job_history_rows": summary.job_history_rows,
                "resume_versions_rows": summary.resume_versions_rows,
                "application_history_rows": summary.application_history_rows,
                "feedback_memory_rows": summary.feedback_memory_rows,
            },
        )

        # Load a small slice for demo visibility.
        for table in ("job_history", "application_history", "feedback_memory"):
            for row in reversed(self.career_memory.recent(table, limit=10)):
                self.history_manager.append(f"career_memory.{table}", row)

    def store_task(self, task_id: str, title: str, payload: dict[str, Any], outcome: str) -> None:
        self.task_memory.store(task_id, title, payload, outcome)
        self.history_manager.append(
            "task_memory",
            {"task_id": task_id, "title": title, "outcome": outcome},
        )

    def retrieve_similar_tasks(self, query: str, *, limit: int = 10) -> list[dict[str, Any]]:
        items = self.task_memory.retrieve_similar(query, limit=limit)
        return [
            {
                "task_id": item.task_id,
                "title": item.title,
                "payload": dict(item.payload),
                "outcome": item.outcome,
                "created_at": item.created_at,
            }
            for item in items
        ]

    def record_strategy_outcome(
        self,
        strategy_id: str,
        task_id: str,
        *,
        success: bool,
        latency_seconds: float,
        score: float,
    ) -> None:
        outcome = self.strategy_memory.record(
            strategy_id,
            task_id,
            success,
            latency_seconds,
            score,
        )
        self.history_manager.append(
            "strategy_outcome",
            {
                "strategy_id": outcome.strategy_id,
                "task_id": outcome.task_id,
                "success": outcome.success,
                "latency_seconds": outcome.latency_seconds,
                "score": outcome.score,
            },
        )

    def record_agent_performance(self, agent_name: str, *, success: bool, latency_seconds: float) -> None:
        self.agent_memory.record(agent_name, success=success, latency_seconds=latency_seconds)
        self.history_manager.append(
            "agent_performance",
            {
                "agent_name": agent_name,
                "success": success,
                "latency_seconds": latency_seconds,
            },
        )

    def snapshot(self) -> dict[str, Any]:
        career_summary = None
        if getattr(self, "career_memory", None):
            try:
                career_summary = asdict(self.career_memory.summary())
            except Exception:
                career_summary = None
        return {
            "best_strategies": self.strategy_memory.best_strategies(),
            "agent_performance": self.agent_memory.snapshot(),
            "recent_history": self.history_manager.recent(200),
            "career_memory": career_summary,
        }
