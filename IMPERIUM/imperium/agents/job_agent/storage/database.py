"""Imperium Job Agent — SQLite persistence layer.

Production-grade features:
- WAL journal mode (concurrent reads while writes are happening)
- Proper connection-per-operation to avoid cross-thread issues
- Agent activity log for real-time visibility
- Profile health cache
- PostgreSQL-migration-ready SQL patterns
"""
from __future__ import annotations

import json
import logging
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterator
from uuid import uuid4

from ..models import (
    ApplicationRecord,
    CandidateProfile,
    JobListing,
    NotificationEvent,
    RecruiterEvent,
    StrategySnapshot,
    utc_now_iso,
)

logger = logging.getLogger(__name__)


class JobAgentDatabase:
    """SQLite persistence layer for the Imperium Job Agent."""

    def __init__(self, db_path: str | Path, schema_path: str | Path | None = None) -> None:
        self.db_path = Path(db_path).resolve()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        if schema_path is None:
            schema_path = Path(__file__).resolve().parents[1] / "sql" / "schema.sql"
        self.schema_path = Path(schema_path).resolve()

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path, timeout=30)
        conn.row_factory = sqlite3.Row
        try:
            conn.execute("PRAGMA foreign_keys = ON;")
            conn.execute("PRAGMA journal_mode = WAL;")
            conn.execute("PRAGMA synchronous = NORMAL;")
            conn.execute("PRAGMA temp_store = MEMORY;")
            conn.execute("PRAGMA cache_size = -8000;")
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def initialize(self) -> None:
        if not self.schema_path.exists():
            raise FileNotFoundError(f"Database schema not found: {self.schema_path}")

        schema_sql = self.schema_path.read_text(encoding="utf-8")
        with self.connection() as conn:
            conn.executescript(schema_sql)

    # ----------------------------------------------------------------
    # Candidate Profiles
    # ----------------------------------------------------------------

    def save_candidate_profile(self, profile: CandidateProfile) -> None:
        payload = profile.to_dict()
        with self.connection() as conn:
            conn.execute(
                """
                INSERT INTO candidate_profiles (
                    profile_id, name, contact_json, skills_json, work_experience_json,
                    education_json, projects_json, certifications_json,
                    portfolio_links_json, github_repositories_json, linkedin_profile,
                    preferences_json, created_at, updated_at
                ) VALUES (
                    :profile_id, :name, :contact_json, :skills_json, :work_experience_json,
                    :education_json, :projects_json, :certifications_json,
                    :portfolio_links_json, :github_repositories_json, :linkedin_profile,
                    :preferences_json, :created_at, :updated_at
                )
                ON CONFLICT(profile_id) DO UPDATE SET
                    name=excluded.name,
                    contact_json=excluded.contact_json,
                    skills_json=excluded.skills_json,
                    work_experience_json=excluded.work_experience_json,
                    education_json=excluded.education_json,
                    projects_json=excluded.projects_json,
                    certifications_json=excluded.certifications_json,
                    portfolio_links_json=excluded.portfolio_links_json,
                    github_repositories_json=excluded.github_repositories_json,
                    linkedin_profile=excluded.linkedin_profile,
                    preferences_json=excluded.preferences_json,
                    updated_at=excluded.updated_at
                """,
                {
                    "profile_id": payload["profile_id"],
                    "name": payload["name"],
                    "contact_json": self._json_dumps(payload["contact"]),
                    "skills_json": self._json_dumps(payload["skills"]),
                    "work_experience_json": self._json_dumps(payload["work_experience"]),
                    "education_json": self._json_dumps(payload["education"]),
                    "projects_json": self._json_dumps(payload["projects"]),
                    "certifications_json": self._json_dumps(payload["certifications"]),
                    "portfolio_links_json": self._json_dumps(payload["portfolio_links"]),
                    "github_repositories_json": self._json_dumps(payload["github_repositories"]),
                    "linkedin_profile": payload["linkedin_profile"],
                    "preferences_json": self._json_dumps(payload["preferences"]),
                    "created_at": payload["created_at"],
                    "updated_at": payload["updated_at"],
                },
            )

    def load_latest_candidate_profile(self) -> CandidateProfile | None:
        with self.connection() as conn:
            row = conn.execute(
                "SELECT * FROM candidate_profiles ORDER BY updated_at DESC LIMIT 1"
            ).fetchone()

        if row is None:
            return None

        return CandidateProfile.from_dict({
            "profile_id": row["profile_id"],
            "name": row["name"],
            "contact": self._json_loads(row["contact_json"], {}),
            "skills": self._json_loads(row["skills_json"], []),
            "work_experience": self._json_loads(row["work_experience_json"], []),
            "education": self._json_loads(row["education_json"], []),
            "projects": self._json_loads(row["projects_json"], []),
            "certifications": self._json_loads(row["certifications_json"], []),
            "portfolio_links": self._json_loads(row["portfolio_links_json"], []),
            "github_repositories": self._json_loads(row["github_repositories_json"], []),
            "linkedin_profile": row["linkedin_profile"],
            "preferences": self._json_loads(row["preferences_json"], {}),
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        })

    def save_profile_health(
        self,
        profile_id: str,
        score: float,
        missing: list[str],
    ) -> None:
        with self.connection() as conn:
            conn.execute(
                """
                INSERT INTO profile_health (profile_id, score, missing_json, computed_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(profile_id) DO UPDATE SET
                    score=excluded.score,
                    missing_json=excluded.missing_json,
                    computed_at=excluded.computed_at
                """,
                (profile_id, float(score), self._json_dumps(missing), utc_now_iso()),
            )

    def load_profile_health(self, profile_id: str) -> dict[str, Any] | None:
        with self.connection() as conn:
            row = conn.execute(
                "SELECT * FROM profile_health WHERE profile_id = ?",
                (profile_id,),
            ).fetchone()
        if row is None:
            return None
        return {
            "score": row["score"],
            "missing": self._json_loads(row["missing_json"], []),
            "computed_at": row["computed_at"],
        }

    # ----------------------------------------------------------------
    # Job Listings
    # ----------------------------------------------------------------

    def job_listing_exists(self, source: str, external_id: str) -> bool:
        with self.connection() as conn:
            row = conn.execute(
                "SELECT 1 FROM job_listings WHERE source = ? AND external_id = ? LIMIT 1",
                (source, external_id),
            ).fetchone()
        return row is not None

    def save_job_listing(self, listing: JobListing, match_score: float | None = None) -> bool:
        exists_before = self.job_listing_exists(listing.source, listing.external_id)

        with self.connection() as conn:
            conn.execute(
                """
                INSERT INTO job_listings (
                    listing_id, source, external_id, url, title, company, location,
                    salary_min, salary_max, salary_currency, required_skills_json,
                    experience_years, education_requirements_json, technology_stack_json,
                    description, posted_at, discovered_at, metadata_json, match_score, status
                ) VALUES (
                    :listing_id, :source, :external_id, :url, :title, :company, :location,
                    :salary_min, :salary_max, :salary_currency, :required_skills_json,
                    :experience_years, :education_requirements_json, :technology_stack_json,
                    :description, :posted_at, :discovered_at, :metadata_json, :match_score, :status
                )
                ON CONFLICT(source, external_id) DO UPDATE SET
                    url=excluded.url,
                    title=excluded.title,
                    company=excluded.company,
                    location=excluded.location,
                    salary_min=excluded.salary_min,
                    salary_max=excluded.salary_max,
                    salary_currency=excluded.salary_currency,
                    required_skills_json=excluded.required_skills_json,
                    experience_years=excluded.experience_years,
                    education_requirements_json=excluded.education_requirements_json,
                    technology_stack_json=excluded.technology_stack_json,
                    description=excluded.description,
                    posted_at=excluded.posted_at,
                    discovered_at=excluded.discovered_at,
                    metadata_json=excluded.metadata_json,
                    match_score=COALESCE(excluded.match_score, job_listings.match_score)
                """,
                {
                    "listing_id": listing.listing_id,
                    "source": listing.source,
                    "external_id": listing.external_id,
                    "url": listing.url,
                    "title": listing.title,
                    "company": listing.company,
                    "location": listing.location,
                    "salary_min": listing.salary_min,
                    "salary_max": listing.salary_max,
                    "salary_currency": listing.salary_currency,
                    "required_skills_json": self._json_dumps(listing.required_skills),
                    "experience_years": listing.experience_years,
                    "education_requirements_json": self._json_dumps(listing.education_requirements),
                    "technology_stack_json": self._json_dumps(listing.technology_stack),
                    "description": listing.description,
                    "posted_at": listing.posted_at,
                    "discovered_at": listing.discovered_at,
                    "metadata_json": self._json_dumps(listing.metadata),
                    "match_score": match_score,
                    "status": "discovered",
                },
            )
        return not exists_before

    def list_recent_job_listings(self, limit: int = 500) -> list[JobListing]:
        with self.connection() as conn:
            rows = conn.execute(
                "SELECT * FROM job_listings ORDER BY discovered_at DESC LIMIT ?",
                (max(1, int(limit)),),
            ).fetchall()

        return [self._row_to_listing(row) for row in rows]

    def set_job_match_score(self, listing_id: str, score: float) -> None:
        with self.connection() as conn:
            conn.execute(
                "UPDATE job_listings SET match_score = ?, status = 'qualified' WHERE listing_id = ?",
                (float(score), listing_id),
            )

    # ----------------------------------------------------------------
    # Applications
    # ----------------------------------------------------------------

    def application_exists_for_listing(self, listing_id: str) -> bool:
        with self.connection() as conn:
            row = conn.execute(
                "SELECT 1 FROM applications WHERE listing_id = ? LIMIT 1",
                (listing_id,),
            ).fetchone()
        return row is not None

    def save_application(self, application: ApplicationRecord) -> None:
        with self.connection() as conn:
            conn.execute(
                """
                INSERT INTO applications (
                    application_id, listing_id, company, job_title,
                    date_applied, status, match_score, resume_path,
                    cover_letter_path, last_updated, notes, metadata_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    application.application_id,
                    application.listing_id,
                    application.company,
                    application.job_title,
                    application.date_applied,
                    application.status,
                    float(application.match_score),
                    application.resume_path,
                    application.cover_letter_path,
                    application.last_updated,
                    application.notes,
                    self._json_dumps(application.metadata),
                ),
            )
            conn.execute(
                """
                INSERT INTO application_status_history (application_id, status, updated_at, notes)
                VALUES (?, ?, ?, ?)
                """,
                (
                    application.application_id,
                    application.status,
                    application.last_updated,
                    application.notes,
                ),
            )

    def update_application_status(
        self,
        application_id: str,
        status: str,
        notes: str = "",
    ) -> None:
        now = utc_now_iso()
        with self.connection() as conn:
            conn.execute(
                """
                UPDATE applications SET status = ?, last_updated = ?, notes = ?
                WHERE application_id = ?
                """,
                (status, now, notes, application_id),
            )
            conn.execute(
                """
                INSERT INTO application_status_history (application_id, status, updated_at, notes)
                VALUES (?, ?, ?, ?)
                """,
                (application_id, status, now, notes),
            )

    def list_applications(
        self,
        status: str | None = None,
        limit: int = 500,
    ) -> list[ApplicationRecord]:
        if status:
            sql = "SELECT * FROM applications WHERE status = ? ORDER BY date_applied DESC LIMIT ?"
            params: tuple[Any, ...] = (status, max(1, int(limit)))
        else:
            sql = "SELECT * FROM applications ORDER BY date_applied DESC, last_updated DESC LIMIT ?"
            params = (max(1, int(limit)),)

        with self.connection() as conn:
            rows = conn.execute(sql, params).fetchall()

        return [
            ApplicationRecord(
                application_id=row["application_id"],
                listing_id=row["listing_id"],
                company=row["company"],
                job_title=row["job_title"],
                date_applied=row["date_applied"],
                status=row["status"],
                match_score=float(row["match_score"]),
                resume_path=row["resume_path"],
                cover_letter_path=row["cover_letter_path"],
                last_updated=row["last_updated"],
                notes=row["notes"],
                metadata=dict(self._json_loads(row["metadata_json"], {})),
            )
            for row in rows
        ]

    def count_applications_for_day(self, date_iso: str) -> int:
        with self.connection() as conn:
            row = conn.execute(
                "SELECT COUNT(*) AS total FROM applications WHERE date_applied = ?",
                (date_iso,),
            ).fetchone()
        return int(row["total"] if row else 0)

    # ----------------------------------------------------------------
    # Recruiter Events
    # ----------------------------------------------------------------

    def save_recruiter_event(self, event: RecruiterEvent) -> None:
        with self.connection() as conn:
            conn.execute(
                """
                INSERT INTO recruiter_events (
                    event_id, source, company, job_title,
                    message, status_hint, occurred_at, metadata_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(event_id) DO NOTHING
                """,
                (
                    event.event_id,
                    event.source,
                    event.company,
                    event.job_title,
                    event.message,
                    event.status_hint,
                    event.occurred_at,
                    self._json_dumps(event.metadata),
                ),
            )

    def list_recent_recruiter_events(self, lookback_hours: int = 72) -> list[RecruiterEvent]:
        threshold = datetime.now(timezone.utc) - timedelta(hours=max(1, lookback_hours))
        with self.connection() as conn:
            rows = conn.execute(
                "SELECT * FROM recruiter_events WHERE occurred_at >= ? ORDER BY occurred_at DESC",
                (threshold.isoformat(),),
            ).fetchall()

        return [
            RecruiterEvent(
                event_id=row["event_id"],
                source=row["source"],
                company=row["company"],
                job_title=row["job_title"],
                message=row["message"],
                status_hint=row["status_hint"],
                occurred_at=row["occurred_at"],
                metadata=dict(self._json_loads(row["metadata_json"], {})),
            )
            for row in rows
        ]

    # ----------------------------------------------------------------
    # Notifications
    # ----------------------------------------------------------------

    def save_notification(self, event: NotificationEvent) -> None:
        with self.connection() as conn:
            conn.execute(
                """
                INSERT INTO notifications (
                    notification_id, title, message, channel,
                    priority, created_at, metadata_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(notification_id) DO NOTHING
                """,
                (
                    event.notification_id,
                    event.title,
                    event.message,
                    event.channel,
                    event.priority,
                    event.created_at,
                    self._json_dumps(event.metadata),
                ),
            )

    def list_recent_notifications(self, limit: int = 50) -> list[dict[str, Any]]:
        with self.connection() as conn:
            rows = conn.execute(
                "SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?",
                (max(1, int(limit)),),
            ).fetchall()
        return [
            {
                "notification_id": row["notification_id"],
                "title": row["title"],
                "message": row["message"],
                "channel": row["channel"],
                "priority": row["priority"],
                "created_at": row["created_at"],
                "read_at": row["read_at"],
                "metadata": self._json_loads(row["metadata_json"], {}),
            }
            for row in rows
        ]

    def mark_notification_read(self, notification_id: str) -> None:
        with self.connection() as conn:
            conn.execute(
                "UPDATE notifications SET read_at = ? WHERE notification_id = ? AND read_at IS NULL",
                (utc_now_iso(), notification_id),
            )

    # ----------------------------------------------------------------
    # Strategy History
    # ----------------------------------------------------------------

    def save_strategy_snapshot(
        self,
        snapshot: StrategySnapshot,
        metrics: dict[str, Any],
    ) -> str:
        snapshot_id = str(uuid4())
        with self.connection() as conn:
            conn.execute(
                """
                INSERT INTO strategy_history (
                    snapshot_id, created_at, scan_interval_hours,
                    min_match_threshold, daily_application_limit,
                    target_roles_json, preferred_sources_json,
                    keyword_blacklist_json, keyword_boost_json,
                    metrics_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    snapshot_id,
                    snapshot.last_optimized_at,
                    snapshot.scan_interval_hours,
                    snapshot.min_match_threshold,
                    snapshot.daily_application_limit,
                    self._json_dumps(snapshot.target_roles),
                    self._json_dumps(snapshot.preferred_sources),
                    self._json_dumps(snapshot.keyword_blacklist),
                    self._json_dumps(snapshot.keyword_boost),
                    self._json_dumps(metrics),
                ),
            )
        return snapshot_id

    def load_latest_strategy_snapshot(self) -> tuple[StrategySnapshot | None, dict[str, Any]]:
        with self.connection() as conn:
            row = conn.execute(
                "SELECT * FROM strategy_history ORDER BY created_at DESC LIMIT 1"
            ).fetchone()

        if row is None:
            return None, {}

        snapshot = StrategySnapshot.from_dict({
            "scan_interval_hours": row["scan_interval_hours"],
            "min_match_threshold": row["min_match_threshold"],
            "daily_application_limit": row["daily_application_limit"],
            "target_roles": self._json_loads(row["target_roles_json"], []),
            "preferred_sources": self._json_loads(row["preferred_sources_json"], []),
            "keyword_blacklist": self._json_loads(row["keyword_blacklist_json"], []),
            "keyword_boost": self._json_loads(row["keyword_boost_json"], []),
            "last_optimized_at": row["created_at"],
        })
        return snapshot, dict(self._json_loads(row["metrics_json"], {}))

    # ----------------------------------------------------------------
    # Application Metrics
    # ----------------------------------------------------------------

    def get_application_metrics(self) -> dict[str, Any]:
        with self.connection() as conn:
            total = conn.execute("SELECT COUNT(*) AS n FROM applications").fetchone()
            interviews = conn.execute(
                "SELECT COUNT(*) AS n FROM applications WHERE status = ?",
                ("Interview Scheduled",),
            ).fetchone()
            rejections = conn.execute(
                "SELECT COUNT(*) AS n FROM applications WHERE status = ?",
                ("Rejected",),
            ).fetchone()
            offers = conn.execute(
                "SELECT COUNT(*) AS n FROM applications WHERE status = ?",
                ("Offer Received",),
            ).fetchone()
            under_review = conn.execute(
                "SELECT COUNT(*) AS n FROM applications WHERE status = ?",
                ("Under Review",),
            ).fetchone()
            unread_notifications = conn.execute(
                "SELECT COUNT(*) AS n FROM notifications WHERE read_at IS NULL"
            ).fetchone()

        applications_sent = int(total["n"] if total else 0)
        interviews_received = int(interviews["n"] if interviews else 0)
        rejection_count = int(rejections["n"] if rejections else 0)
        offer_count = int(offers["n"] if offers else 0)
        review_count = int(under_review["n"] if under_review else 0)
        unread = int(unread_notifications["n"] if unread_notifications else 0)

        interview_rate = round(interviews_received / applications_sent, 4) if applications_sent > 0 else 0.0
        offer_rate = round(offer_count / applications_sent, 4) if applications_sent > 0 else 0.0

        return {
            "applications_sent": applications_sent,
            "interviews_received": interviews_received,
            "rejections": rejection_count,
            "offers": offer_count,
            "under_review": review_count,
            "interview_rate": interview_rate,
            "offer_rate": offer_rate,
            "unread_notifications": unread,
        }

    # ----------------------------------------------------------------
    # Agent Activity Log (real-time feed)
    # ----------------------------------------------------------------

    def log_activity(
        self,
        *,
        task_id: str,
        agent: str,
        action: str,
        status: str = "ok",
        detail: str = "",
    ) -> None:
        try:
            with self.connection() as conn:
                conn.execute(
                    """
                    INSERT INTO agent_activity_log (task_id, agent, action, status, detail, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (task_id, agent, action, status, detail[:4096], utc_now_iso()),
                )
        except Exception as exc:
            logger.warning("Failed to log agent activity: %s", exc)

    def recent_activity(self, limit: int = 100, task_id: str | None = None) -> list[dict[str, Any]]:
        if task_id:
            sql = (
                "SELECT * FROM agent_activity_log WHERE task_id = ? "
                "ORDER BY created_at DESC LIMIT ?"
            )
            params: tuple[Any, ...] = (task_id, max(1, int(limit)))
        else:
            sql = "SELECT * FROM agent_activity_log ORDER BY created_at DESC LIMIT ?"
            params = (max(1, int(limit)),)

        with self.connection() as conn:
            rows = conn.execute(sql, params).fetchall()

        return [
            {
                "log_id": row["log_id"],
                "task_id": row["task_id"],
                "agent": row["agent"],
                "action": row["action"],
                "status": row["status"],
                "detail": row["detail"],
                "created_at": row["created_at"],
            }
            for row in rows
        ]

    # ----------------------------------------------------------------
    # Internal helpers
    # ----------------------------------------------------------------

    def _row_to_listing(self, row: sqlite3.Row) -> JobListing:
        return JobListing(
            listing_id=row["listing_id"],
            source=row["source"],
            external_id=row["external_id"],
            url=row["url"],
            title=row["title"],
            company=row["company"],
            location=row["location"],
            salary_min=row["salary_min"],
            salary_max=row["salary_max"],
            salary_currency=row["salary_currency"],
            required_skills=list(self._json_loads(row["required_skills_json"], [])),
            experience_years=row["experience_years"],
            education_requirements=list(self._json_loads(row["education_requirements_json"], [])),
            technology_stack=list(self._json_loads(row["technology_stack_json"], [])),
            description=row["description"],
            posted_at=row["posted_at"],
            discovered_at=row["discovered_at"],
            metadata=dict(self._json_loads(row["metadata_json"], {})),
        )

    @staticmethod
    def _json_dumps(value: Any) -> str:
        return json.dumps(value, ensure_ascii=True, separators=(",", ":"))

    @staticmethod
    def _json_loads(raw: str | None, default: Any) -> Any:
        if raw is None or raw == "":
            return default
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return default
