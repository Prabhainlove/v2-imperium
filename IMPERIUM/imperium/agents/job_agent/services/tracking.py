from __future__ import annotations

import asyncio
import logging
from dataclasses import asdict, dataclass
from typing import Any
from uuid import uuid4

from core.memory.memory import CareerMemoryStore

from ..models import (
    ApplicationPackage,
    ApplicationRecord,
    ApplicationStatus,
    CandidateProfile,
    JobListing,
    MatchResult,
    NotificationChannel,
    NotificationEvent,
    RecruiterEvent,
    utc_now_iso,
    today_iso,
)
from ..storage.database import JobAgentDatabase
from .gateway import ImperiumAgentGateway
from .llm_client import OpenAICompatibleLLMClient


logger = logging.getLogger(__name__)


class ApplicationTracker:
    """Tracks submission lifecycle and status transitions in persistent storage."""

    def __init__(self, database: JobAgentDatabase) -> None:
        self.database = database

    def record_submission(
        self,
        *,
        listing: JobListing,
        match: MatchResult,
        package: ApplicationPackage,
        submission_result: dict[str, Any],
    ) -> ApplicationRecord:
        status = self._status_from_submission(submission_result)
        notes = str(submission_result.get("details", "")).strip()

        record = ApplicationRecord(
            application_id=str(uuid4()),
            listing_id=listing.listing_id,
            company=listing.company,
            job_title=listing.title,
            date_applied=today_iso(),
            status=status,
            match_score=match.score,
            resume_path=package.resume.path,
            cover_letter_path=package.cover_letter.path,
            notes=notes,
            metadata={
                "submission_result": submission_result,
                "match_breakdown": asdict(match.breakdown),
            },
        )
        self.database.save_application(record)
        return record

    def apply_recruiter_events(self, events: list[RecruiterEvent]) -> list[dict[str, Any]]:
        updates: list[dict[str, Any]] = []
        applications = self.database.list_applications(limit=1000)

        for event in events:
            target = self._match_event_to_application(event, applications)
            if target is None:
                continue

            mapped_status = self._map_status_hint(event.status_hint)
            if mapped_status is None:
                continue

            self.database.update_application_status(
                application_id=target.application_id,
                status=mapped_status,
                notes=f"Auto-updated from recruiter event {event.event_id}",
            )
            updates.append(
                {
                    "application_id": target.application_id,
                    "company": target.company,
                    "job_title": target.job_title,
                    "new_status": mapped_status,
                    "event_id": event.event_id,
                }
            )

        return updates

    def dashboard(self) -> dict[str, Any]:
        return {
            "metrics": self.database.get_application_metrics(),
            "recent_applications": [asdict(item) for item in self.database.list_applications(limit=50)],
            "recent_recruiter_events": [
                asdict(item) for item in self.database.list_recent_recruiter_events(lookback_hours=168)
            ],
        }

    @staticmethod
    def _status_from_submission(submission_result: dict[str, Any]) -> str:
        status = str(submission_result.get("status", "")).strip().lower()
        if status == "submitted":
            return ApplicationStatus.APPLIED.value
        if status == "pending_manual_review":
            return ApplicationStatus.MANUAL_REVIEW.value
        if status == "queued":
            return ApplicationStatus.MANUAL_REVIEW.value
        return ApplicationStatus.MANUAL_REVIEW.value

    @staticmethod
    def _map_status_hint(hint: str) -> str | None:
        normalized = hint.strip().lower()
        if not normalized:
            return None
        if "interview" in normalized:
            return ApplicationStatus.INTERVIEW_SCHEDULED.value
        if "offer" in normalized:
            return ApplicationStatus.OFFER_RECEIVED.value
        if "reject" in normalized or "decline" in normalized:
            return ApplicationStatus.REJECTED.value
        if "review" in normalized or "screen" in normalized:
            return ApplicationStatus.UNDER_REVIEW.value
        return None

    @staticmethod
    def _match_event_to_application(
        event: RecruiterEvent,
        applications: list[ApplicationRecord],
    ) -> ApplicationRecord | None:
        target_company = event.company.strip().lower()
        target_title = event.job_title.strip().lower()

        for item in applications:
            company_match = target_company and item.company.strip().lower() == target_company
            title_match = target_title and item.job_title.strip().lower() == target_title
            if company_match and (title_match or not target_title):
                return item

        for item in applications:
            if target_company and item.company.strip().lower() == target_company:
                return item

        return None


class RecruiterResponseMonitor:
    """Monitors inbox/portal communications and extracts recruiter events."""

    def __init__(self, gateway: ImperiumAgentGateway) -> None:
        self.gateway = gateway

    async def poll(
        self,
        *,
        profile: CandidateProfile,
        lookback_hours: int = 24,
        extra_messages: list[dict[str, Any]] | None = None,
    ) -> list[RecruiterEvent]:
        events: list[RecruiterEvent] = []

        payload = {
            "task_id": f"monitor-{uuid4().hex[:8]}",
            "action": "collect_recruiter_messages",
            "parameters": {
                "candidate_email": profile.contact.email,
                "lookback_hours": max(1, int(lookback_hours)),
                "sources": ["email", "job_portals", "recruiter_messages"],
            },
        }

        automation_result = await self.gateway.automate_application(payload)
        if automation_result.status == "completed":
            events.extend(self._extract_events(automation_result.payload))

        if extra_messages:
            events.extend(self._extract_events({"messages": extra_messages}))

        deduped: list[RecruiterEvent] = []
        seen: set[str] = set()
        for event in events:
            if event.event_id in seen:
                continue
            seen.add(event.event_id)
            deduped.append(event)

        return deduped

    def _extract_events(self, payload: dict[str, Any]) -> list[RecruiterEvent]:
        message_nodes: list[dict[str, Any]] = []

        direct = payload.get("messages")
        if isinstance(direct, list):
            message_nodes.extend([item for item in direct if isinstance(item, dict)])

        nested = payload.get("result")
        if isinstance(nested, dict):
            nested_messages = nested.get("messages")
            if isinstance(nested_messages, list):
                message_nodes.extend([item for item in nested_messages if isinstance(item, dict)])

        events: list[RecruiterEvent] = []
        for node in message_nodes:
            message = str(node.get("message", node.get("body", ""))).strip()
            if not message:
                continue
            status_hint = self._detect_status(message)
            events.append(
                RecruiterEvent(
                    event_id=str(node.get("event_id") or uuid4()),
                    source=str(node.get("source", "email")).strip(),
                    company=str(node.get("company", "Unknown Company")).strip(),
                    job_title=str(node.get("job_title", "")).strip(),
                    message=message,
                    status_hint=status_hint,
                    occurred_at=str(node.get("occurred_at", utc_now_iso())),
                    metadata={"raw": node},
                )
            )
        return events

    @staticmethod
    def _detect_status(message: str) -> str:
        lowered = message.lower()
        if any(keyword in lowered for keyword in ["interview", "meet with", "schedule a call"]):
            return "Interview Scheduled"
        if any(keyword in lowered for keyword in ["offer", "compensation package", "congratulations"]):
            return "Offer Received"
        if any(keyword in lowered for keyword in ["regret", "unfortunately", "not moving forward", "rejected"]):
            return "Rejected"
        if any(keyword in lowered for keyword in ["under review", "reviewing your application", "screening"]):
            return "Under Review"
        return "Update"


@dataclass(slots=True)
class NotificationConfig:
    channels: tuple[str, ...] = (
        NotificationChannel.IMPERIUM_DASHBOARD.value,
        NotificationChannel.EMAIL.value,
    )


class UserNotificationService:
    """Sends high-priority events to user channels and stores audit logs."""

    def __init__(
        self,
        *,
        database: JobAgentDatabase,
        gateway: ImperiumAgentGateway,
        config: NotificationConfig | None = None,
    ) -> None:
        self.database = database
        self.gateway = gateway
        self.config = config or NotificationConfig()

    async def notify(
        self,
        *,
        title: str,
        message: str,
        priority: str = "normal",
        metadata: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        responses: list[dict[str, Any]] = []

        for channel in self.config.channels:
            event = NotificationEvent(
                notification_id=str(uuid4()),
                title=title,
                message=message,
                channel=channel,
                priority=priority,
                metadata=dict(metadata or {}),
            )
            self.database.save_notification(event)

            if channel == NotificationChannel.IMPERIUM_DASHBOARD.value:
                responses.append(
                    {
                        "channel": channel,
                        "status": "stored",
                        "notification_id": event.notification_id,
                    }
                )
                continue

            payload = {
                "task_id": f"notify-{event.notification_id[:8]}",
                "action": "send_notification",
                "parameters": {
                    "channel": channel,
                    "title": title,
                    "message": message,
                    "priority": priority,
                    "metadata": event.metadata,
                },
            }
            result = await self.gateway.automate_application(payload)
            responses.append(
                {
                    "channel": channel,
                    "status": result.status,
                    "error": result.error,
                    "agent_response": result.payload,
                }
            )

        return responses


class InterviewPreparationSystem:
    """Builds interview prep packets when interview signals are detected."""

    def __init__(self, gateway: ImperiumAgentGateway) -> None:
        self.gateway = gateway

    async def prepare(
        self,
        *,
        profile: CandidateProfile,
        listing: JobListing,
    ) -> dict[str, Any]:
        company_summary = await self._company_research(listing.company, listing.title)

        technical_questions = self._technical_questions(listing)
        role_guide = self._role_preparation_guide(profile, listing)
        mock_session = self._mock_interview_script(listing)

        return {
            "company": listing.company,
            "job_title": listing.title,
            "company_research": company_summary,
            "technical_questions": technical_questions,
            "role_preparation_guide": role_guide,
            "mock_interview": mock_session,
        }

    async def _company_research(self, company: str, role: str) -> dict[str, Any]:
        query = f"{company} company overview, products, mission, and interview tips for {role}"
        result = await self.gateway.discover_jobs(
            query=query,
            context={"domain": "company_research", "company": company, "role": role},
        )

        if result.status != "completed":
            return {
                "status": "unavailable",
                "error": result.error,
                "summary": "Company research unavailable; proceed with direct role preparation.",
            }

        return {
            "status": "completed",
            "summary": result.payload.get("final_answer", "Research completed."),
            "sources": result.payload.get("supporting_sources", []),
        }

    @staticmethod
    def _technical_questions(listing: JobListing) -> list[str]:
        questions: list[str] = []
        for skill in listing.required_skills[:8]:
            questions.append(f"How have you applied {skill} in production systems?")
            questions.append(f"What trade-offs do you evaluate when selecting {skill} solutions?")

        if not questions:
            questions = [
                "Describe a high-impact technical challenge and how you solved it.",
                "How do you balance delivery speed with code quality and reliability?",
            ]

        return questions[:12]

    @staticmethod
    def _role_preparation_guide(profile: CandidateProfile, listing: JobListing) -> list[str]:
        return [
            f"Map your last 3 achievements to {listing.title} responsibilities.",
            f"Prepare quantified examples using skills: {', '.join(listing.required_skills[:6]) or 'core engineering fundamentals'}.",
            "Review system design, debugging, and collaboration stories using STAR format.",
            f"Tailor questions for the hiring manager around team priorities at {listing.company}.",
            f"Align your personal career direction ({profile.preferences.career_direction or 'growth in impact'}) with this role.",
        ]

    @staticmethod
    def _mock_interview_script(listing: JobListing) -> list[dict[str, str]]:
        return [
            {
                "interviewer": "Tell me about yourself and why this role fits your trajectory.",
                "candidate_guidance": "Keep it concise, highlight relevant achievements, and connect to role impact.",
            },
            {
                "interviewer": f"Walk through a project where you used {listing.required_skills[0] if listing.required_skills else 'a core technical stack'}.",
                "candidate_guidance": "Explain context, constraints, decisions, outcomes, and lessons learned.",
            },
            {
                "interviewer": "Describe a difficult incident and your debugging approach.",
                "candidate_guidance": "Focus on structured diagnosis, communication, and prevention improvements.",
            },
        ]


@dataclass(slots=True)
class ReflectionResult:
    summary: str
    insights: list[str]
    next_actions: list[str]
    source: str
    raw: dict[str, Any] | None = None


class ReflectionEngine:
    def __init__(self, *, memory: CareerMemoryStore, llm_client: OpenAICompatibleLLMClient | None = None) -> None:
        self._memory = memory
        self._llm = llm_client or OpenAICompatibleLLMClient()

    async def reflect_on_cycle(
        self,
        *,
        profile: CandidateProfile,
        cycle_summary: dict[str, Any],
        applications: list[dict[str, Any]],
        skipped: list[dict[str, Any]],
    ) -> ReflectionResult:
        if self._llm.enabled:
            try:
                messages = [
                    {
                        "role": "system",
                        "content": "You are a career coach. Return ONLY valid JSON. No markdown.",
                    },
                    {
                        "role": "user",
                        "content": (
                            "Write a short cycle reflection. Output JSON with: summary (string), "
                            "insights (array of strings), next_actions (array of strings).\n\n"
                            f"CANDIDATE: {profile.name}\n"
                            f"CYCLE_SUMMARY: {cycle_summary}\n"
                            f"APPLICATIONS: {applications[:10]}\n"
                            f"SKIPPED: {skipped[:10]}\n"
                        ),
                    },
                ]

                def _call_llm() -> dict[str, Any]:
                    return self._llm.chat_json(messages=messages, max_tokens=320, temperature=0.3)

                payload = await asyncio.to_thread(_call_llm)

                result = ReflectionResult(
                    summary=str(payload.get("summary", "")).strip() or "Cycle reflection generated.",
                    insights=[str(x).strip() for x in payload.get("insights", []) if str(x).strip()][:10],
                    next_actions=[str(x).strip() for x in payload.get("next_actions", []) if str(x).strip()][:10],
                    source="llm",
                    raw=payload,
                )
                self._persist(profile_id=profile.profile_id, result=result)
                return result
            except Exception as exc:
                logger.warning("LLM reflection failed; falling back. error=%s", exc)

        result = self._reflect_with_heuristics(
            profile=profile,
            cycle_summary=cycle_summary,
            applications=applications,
            skipped=skipped,
        )
        self._persist(profile_id=profile.profile_id, result=result)
        return result

    def _reflect_with_heuristics(
        self,
        *,
        profile: CandidateProfile,
        cycle_summary: dict[str, Any],
        applications: list[dict[str, Any]],
        skipped: list[dict[str, Any]],
    ) -> ReflectionResult:
        qualified = int(cycle_summary.get("qualified_matches", 0) or 0)
        attempted = int(cycle_summary.get("applications_attempted", 0) or 0)
        skip_count = int(cycle_summary.get("skipped", 0) or len(skipped))

        insights: list[str] = []
        insights.append(f"Qualified matches: {qualified}; attempted: {attempted}; skipped: {skip_count}.")

        statuses = {}
        for app in applications:
            status = str(app.get("submission", {}).get("status", ""))
            statuses[status] = statuses.get(status, 0) + 1
        if statuses:
            insights.append("Submission statuses: " + ", ".join(f"{k}={v}" for k, v in statuses.items()))

        next_actions = [
            "Review manual-required applications and submit on portals",
            "Improve resume keywords for top skipped roles",
            "Track recruiter responses and follow up after 3-5 days",
        ]

        summary = f"Cycle complete for {profile.name}: {attempted} application packages prepared."
        return ReflectionResult(summary=summary, insights=insights, next_actions=next_actions, source="heuristic")

    def _persist(self, *, profile_id: str, result: ReflectionResult) -> None:
        content = result.summary
        if result.insights:
            content += "\n\nInsights:\n- " + "\n- ".join(result.insights)
        if result.next_actions:
            content += "\n\nNext actions:\n- " + "\n- ".join(result.next_actions)

        self._memory.record_feedback(
            profile_id=profile_id,
            listing_id=None,
            company="",
            job_title="",
            feedback_type="cycle_reflection",
            content=content,
            metadata={"source": result.source},
        )


# ── Portfolio improvement ─────────────────────────────────────

class PortfolioImprovementSystem:
    """Recommends portfolio projects and triggers CodingAgent to generate them."""

    def __init__(self, gateway: ImperiumAgentGateway) -> None:
        self.gateway = gateway

    def recommend_improvements(
        self,
        profile: CandidateProfile,
        match_results: list[MatchResult],
    ) -> list[str]:
        missing_skills: set[str] = set()
        for m in match_results[:10]:
            for skill in m.missing_skills[:6]:
                missing_skills.add(skill.strip().lower())

        recommendations: list[str] = []
        for skill in sorted(missing_skills)[:8]:
            recommendations.append(
                f"Build a portfolio project demonstrating '{skill}' to close this skill gap."
            )

        if not profile.github_repositories:
            recommendations.append(
                "Create a GitHub profile and publish at least one project repository."
            )
        if not profile.portfolio_links:
            recommendations.append(
                "Add at least one portfolio link (GitHub, personal site, or project demo)."
            )

        return recommendations[:8]

    async def trigger_portfolio_generation(
        self,
        *,
        profile: CandidateProfile,
        recommendations: list[str],
        max_projects: int = 2,
    ) -> list[dict]:
        results = []
        for rec in recommendations[:max(1, max_projects)]:
            payload = {
                "task_id": f"portfolio-{uuid4().hex[:8]}",
                "command": "generate_project",
                "description": rec,
                "candidate_profile": {"name": profile.name, "skills": profile.skills},
            }
            result = await self.gateway.generate_portfolio_project(payload)
            results.append({
                "recommendation": rec,
                "status": result.status,
                "payload": result.payload,
            })
        return results
