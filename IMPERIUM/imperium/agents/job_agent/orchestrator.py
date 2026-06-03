from __future__ import annotations

import asyncio
import hashlib
import logging
from dataclasses import asdict, dataclass
from logging.handlers import RotatingFileHandler
from pathlib import Path
from time import perf_counter
from typing import Any

from core.memory.memory import CareerMemoryStore

from .models import (
    ApplicationStatus,
    CandidateProfile,
    JobListing,
    MatchResult,
    NotificationChannel,
    StrategySnapshot,
    utc_now_iso,
)
from .services.analysis import AdvancedReasoningEngine, JobMatchingEngine, JobMatcherConfig, JobParser, JobRanker
from .services.automation import ApplicationAutomationEngine
from .services.discovery import JobDiscoveryConfig, JobDiscoveryEngine
from .services.gateway import ImperiumAgentGateway
from .services.profile import CandidateProfileManager, ProfileValidationError
from .services.resume import ATSResumeGenerator, CoverLetterGenerator, ResumeOptimizer
from .services.strategy import JobSafetyConfig, JobSafetyController, StrategyOptimizationEngine
from .services.tracking import (
    ApplicationTracker,
    InterviewPreparationSystem,
    NotificationConfig,
    PortfolioImprovementSystem,
    RecruiterResponseMonitor,
    ReflectionEngine,
    UserNotificationService,
)
from .storage.database import JobAgentDatabase


logger = logging.getLogger(__name__)


@dataclass(slots=True)
class JobAgentConfig:
    scan_interval_hours: int = 6
    min_match_threshold: float = 0.72
    daily_application_limit: int = 20
    max_jobs_per_cycle: int = 80
    max_applications_per_cycle: int = 10
    auto_apply_default: bool = True
    manual_review_default: bool = False
    monitor_lookback_hours: int = 24
    db_path: Path | None = None
    artifacts_dir: Path | None = None
    notification_channels: tuple[str, ...] = (
        NotificationChannel.IMPERIUM_DASHBOARD.value,
        NotificationChannel.EMAIL.value,
    )


class ImperiumJobAgent:
    """
    100x Autonomous Career Operations Agent for IMPERIUM AOS.
    
    INTELLIGENCE CAPABILITIES:
    - Advanced reasoning with ReAct and Chain-of-Thought
    - Deep NLP analysis of job descriptions and company culture
    - Predictive modeling for interview success probability
    - Career trajectory forecasting
    - Intelligent salary negotiation strategies
    - Multi-agent collaboration via IMPERIUM gateway
    """

    VERSION = "2.0.0-imperium-job-agent-100x"

    def __init__(
        self,
        workspace_root: str | Path | None = None,
        config: JobAgentConfig | None = None,
        agent_clients: dict[str, Any] | None = None,
    ) -> None:
        self.workspace_root = (
            Path(workspace_root).resolve()
            if workspace_root is not None
            else Path(__file__).resolve().parents[2]
        )
        self.config = config or JobAgentConfig()

        data_root = self.workspace_root / "agents" / "job_agent" / "data"
        data_root.mkdir(parents=True, exist_ok=True)

        logs_dir = data_root / "logs"
        logs_dir.mkdir(parents=True, exist_ok=True)
        self._configure_logging(logs_dir)

        db_path = self.config.db_path or (data_root / "job_agent.db")
        artifacts_dir = self.config.artifacts_dir or (data_root / "artifacts")

        self.database = JobAgentDatabase(db_path=db_path)
        self.database.initialize()

        # Persistent career memory (separate from JobAgentDatabase schema)
        self.career_memory = CareerMemoryStore(db_path=data_root / "career_memory.db")

        self.gateway = ImperiumAgentGateway(
            workspace_root=self.workspace_root,
            external_clients=agent_clients,
        )

        # === CORE INTELLIGENCE MODULES === 
        self.reasoning_engine = AdvancedReasoningEngine()
        
        # === EXISTING OPERATIONAL MODULES ===
        self.profile_manager = CandidateProfileManager(self.database)
        self.discovery_engine = JobDiscoveryEngine(
            gateway=self.gateway,
            config=JobDiscoveryConfig(scan_interval_hours=self.config.scan_interval_hours),
        )
        self.parser = JobParser()
        self.matcher = JobMatchingEngine(
            JobMatcherConfig(min_match_threshold=self.config.min_match_threshold)
        )
        self.resume_generator = ATSResumeGenerator()
        self.cover_generator = CoverLetterGenerator()
        self.resume_optimizer = ResumeOptimizer()
        self.job_ranker = JobRanker()
        self.application_engine = ApplicationAutomationEngine(
            gateway=self.gateway,
            artifacts_dir=Path(artifacts_dir),
        )
        self.application_tracker = ApplicationTracker(self.database)
        self.monitor = RecruiterResponseMonitor(self.gateway)
        self.notification_service = UserNotificationService(
            database=self.database,
            gateway=self.gateway,
            config=NotificationConfig(channels=self.config.notification_channels),
        )
        self.strategy_optimizer = StrategyOptimizationEngine()
        self.portfolio_builder = PortfolioImprovementSystem(self.gateway)
        self.interview_preparer = InterviewPreparationSystem(self.gateway)
        self.reflection_engine = ReflectionEngine(memory=self.career_memory)
        self.safety = JobSafetyController(
            database=self.database,
            config=JobSafetyConfig(
                default_daily_limit=self.config.daily_application_limit,
                manual_review_mode=self.config.manual_review_default,
            ),
        )

        self._default_strategy = StrategySnapshot(
            scan_interval_hours=self.config.scan_interval_hours,
            min_match_threshold=self.config.min_match_threshold,
            daily_application_limit=self.config.daily_application_limit,
        )

    async def execute(self, task: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(task, dict):
            return {
                "status": "failure",
                "error": "Task payload must be a dictionary",
                "error_type": "TypeError",
            }

        command = str(task.get("command", "run_cycle")).strip().lower()

        try:
            if command == "update_profile":
                profile_payload = task.get("candidate_profile")
                if not isinstance(profile_payload, dict):
                    raise ProfileValidationError("candidate_profile payload is required for update_profile")
                profile = self.profile_manager.build_and_save(profile_payload)
                return {
                    "status": "success",
                    "command": command,
                    "profile": profile.to_dict(),
                    "profile_health": self.profile_manager.profile_completeness(profile),
                    "agent_version": self.VERSION,
                }

            if command == "get_dashboard":
                return {
                    "status": "success",
                    "command": command,
                    "dashboard": self.application_tracker.dashboard(),
                    "strategy": self._load_strategy({}).to_dict(),
                    "agent_version": self.VERSION,
                }

            if command == "prepare_interview":
                return await self._handle_prepare_interview(task)

            if command == "run_continuous":
                return await self._run_continuous(task)

            return await self._run_single_cycle(task)

        except ProfileValidationError as exc:
            return {
                "status": "failure",
                "error": str(exc),
                "error_type": "ProfileValidationError",
                "agent_version": self.VERSION,
            }
        except Exception as exc:  # pragma: no cover - runtime safety path
            return {
                "status": "failure",
                "error": str(exc),
                "error_type": type(exc).__name__,
                "agent_version": self.VERSION,
            }

    async def run_forever(self, task: dict[str, Any] | None = None) -> dict[str, Any]:
        payload = dict(task or {})
        payload["command"] = "run_continuous"
        payload.setdefault("max_cycles", 0)
        return await self._run_continuous(payload)

    def register_agent(self, name: str, client: Any) -> None:
        self.gateway.register_agent(name, client)

    def get_capabilities(self) -> dict[str, Any]:
        return {
            "agent_type": "job",
            "version": self.VERSION,
            "intelligence_level": "100x_autonomous",
            "entrypoint": "async execute(task: dict) -> dict",
            "core_intelligence": [
                "advanced_reasoning_engine (ReAct, Chain-of-Thought)",
                "nlp_intelligence (Deep description analysis)",
                "predictive_modeling (Interview success, Career trajectory, Negotiation)",
            ],
            "core_modules": [
                "profile_manager",
                "job_discovery_engine",
                "job_parser",
                "job_matcher",
                "resume_generator",
                "cover_letter_generator",
                "application_engine",
                "application_tracker",
                "email_monitor",
                "notification_service",
                "strategy_optimizer",
                "portfolio_builder",
                "interview_preparer",
                "safety_controller",
            ],
            "supported_commands": [
                "run_cycle",
                "run_continuous",
                "update_profile",
                "get_dashboard",
                "prepare_interview",
            ],
            "integrations": ["ResearchAgent", "CodingAgent", "AutomationAgent", "WorkflowAgent"],
        }

    async def _run_single_cycle(self, task: dict[str, Any]) -> dict[str, Any]:
        started = perf_counter()
        task_id = str(task.get("task_id", f"job-cycle-{utc_now_iso()}"))

        profile = self.profile_manager.ensure_profile(task.get("candidate_profile"))
        profile_health = self.profile_manager.profile_completeness(profile)
        strategy = self._load_strategy(task)

        workflow_task = asyncio.create_task(
            self._request_workflow_context(task_id=task_id, profile=profile, strategy=strategy)
        )
        discovery_task = asyncio.create_task(
            self.discovery_engine.discover_jobs(
                profile=profile,
                strategy=strategy,
                task_id=task_id,
            )
        )
        workflow_result, discovery_result = await asyncio.gather(
            workflow_task,
            discovery_task,
            return_exceptions=True,
        )

        if isinstance(workflow_result, Exception):
            logger.warning("Workflow context request failed: %s", workflow_result)
            workflow_context = {
                "status": "failure",
                "error": str(workflow_result),
                "response": {},
            }
        else:
            workflow_context = workflow_result

        if isinstance(discovery_result, Exception):
            logger.warning("Job discovery failed: %s", discovery_result)
            raw_postings = []
        else:
            raw_postings = discovery_result
        parsed_listings = self.parser.parse_postings(raw_postings)

        new_listing_count = 0
        listing_lookup: dict[str, JobListing] = {}
        for listing in parsed_listings[: self.config.max_jobs_per_cycle]:
            created = self.database.save_job_listing(listing)
            if created:
                new_listing_count += 1
            listing_lookup[listing.listing_id] = listing

        ranked_matches = self.matcher.rank_jobs(
            profile=profile,
            listings=list(listing_lookup.values()),
            strategy=strategy,
        )

        qualified_matches = [item for item in ranked_matches if item.passed_threshold]
        for match in ranked_matches:
            self.database.set_job_match_score(match.listing_id, match.score)

        auto_apply = bool(task.get("auto_apply", self.config.auto_apply_default))
        manual_review = bool(task.get("manual_review", self.config.manual_review_default))
        max_applications = int(task.get("max_applications_per_cycle", self.config.max_applications_per_cycle))
        application_mode = task.get("application_mode") or task.get("mode")

        prepared: dict[str, dict[str, Any]] = {}
        decisions_by_listing: dict[str, Any] = {}

        max_reasoning = min(len(qualified_matches), max(20, max_applications * 4))
        reasoning_candidates = qualified_matches[:max_reasoning]

        async def _prepare_match(match: MatchResult) -> dict[str, Any] | None:
            listing = listing_lookup.get(match.listing_id)
            if listing is None:
                return None

            resume_task = asyncio.to_thread(
                lambda: self.resume_generator.generate_resume_text(
                    profile=profile,
                    listing=listing,
                    match=match,
                )
            )
            cover_task = asyncio.to_thread(
                lambda: self.cover_generator.generate_cover_letter(
                    profile=profile,
                    listing=listing,
                    match=match,
                )
            )
            resume_text, cover_text = await asyncio.gather(resume_task, cover_task)

            decision = await self.reasoning_engine.evaluate_application(
                profile=profile,
                listing=listing,
                match=match,
                resume_text=resume_text,
            )

            optimization = await self.resume_optimizer.optimize_resume_text(
                profile=profile,
                listing=listing,
                match=match,
                base_resume_text=resume_text,
                decision=decision,
            )

            return {
                "listing_id": match.listing_id,
                "resume_text": optimization.resume_text,
                "cover_text": cover_text,
                "decision": decision,
                "resume_optimization": {"source": optimization.source, "notes": optimization.notes},
            }

        prepared_results = await asyncio.gather(
            *(_prepare_match(item) for item in reasoning_candidates),
            return_exceptions=True,
        )

        for result in prepared_results:
            if isinstance(result, Exception):
                logger.warning("Reasoning batch item failed: %s", result)
                continue
            if not result:
                continue
            prepared[str(result["listing_id"])] = result
            decision = result.get("decision")
            if decision is not None:
                decisions_by_listing[str(result["listing_id"])] = decision

        # Re-rank qualified matches using reasoning output when available.
        ranked_qualified = self.job_ranker.rank(
            matches=qualified_matches,
            decisions_by_listing=decisions_by_listing,
        )
        qualified_matches = [item.match for item in ranked_qualified]

        submissions: list[dict[str, Any]] = []
        submission_records: list[dict[str, Any]] = []
        skipped: list[dict[str, Any]] = []

        for match in qualified_matches:
            if len(submissions) >= max(1, max_applications):
                skipped.append(
                    {
                        "listing_id": match.listing_id,
                        "company": match.company,
                        "job_title": match.title,
                        "reason": "Cycle application cap reached",
                    }
                )
                continue

            listing = listing_lookup.get(match.listing_id)
            if listing is None:
                continue

            safety = self.safety.evaluate_application(
                listing=listing,
                strategy=strategy,
                task_options={
                    "manual_review": manual_review,
                    "daily_application_limit": strategy.daily_application_limit,
                },
            )
            if not safety.allowed:
                skipped.append(
                    {
                        "listing_id": listing.listing_id,
                        "company": listing.company,
                        "job_title": listing.title,
                        "reason": safety.reason,
                    }
                )
                try:
                    self.career_memory.record_job_history(
                        profile_id=profile.profile_id,
                        listing_id=listing.listing_id,
                        company=listing.company,
                        job_title=listing.title,
                        score=match.score,
                        decision="skip",
                        resume_path="",
                        status=f"safety_blocked: {safety.reason}",
                        metadata={"safety": asdict(safety)},
                    )
                except Exception:
                    pass
                continue

            prepared_item = prepared.get(match.listing_id)
            decision = prepared_item.get("decision") if prepared_item else None

            if decision is not None and not bool(decision.should_apply):
                skipped.append(
                    {
                        "listing_id": listing.listing_id,
                        "company": listing.company,
                        "job_title": listing.title,
                        "reason": str(decision.decision_reason),
                    }
                )
                try:
                    self.career_memory.record_job_history(
                        profile_id=profile.profile_id,
                        listing_id=listing.listing_id,
                        company=listing.company,
                        job_title=listing.title,
                        score=float(decision.score),
                        decision="skip",
                        resume_path="",
                        status="skipped_by_reasoning",
                        metadata={
                            "source": decision.source,
                            "decision_reason": decision.decision_reason,
                            "strengths": decision.strengths,
                            "risks": decision.risks,
                            "missing_skills": decision.missing_skills,
                            "match_score": match.score,
                        },
                    )
                except Exception:
                    pass
                continue

            resume_text = (
                str(prepared_item.get("resume_text"))
                if prepared_item and prepared_item.get("resume_text")
                else self.resume_generator.generate_resume_text(
                    profile=profile,
                    listing=listing,
                    match=match,
                )
            )
            cover_text = (
                str(prepared_item.get("cover_text"))
                if prepared_item and prepared_item.get("cover_text")
                else self.cover_generator.generate_cover_letter(
                    profile=profile,
                    listing=listing,
                    match=match,
                )
            )

            package = await asyncio.to_thread(
                lambda: self.application_engine.build_application_package(
                    listing=listing,
                    resume_text=resume_text,
                    cover_letter_text=cover_text,
                    profile=profile,
                    match=match,
                )
            )

            try:
                resume_hash = hashlib.sha1(resume_text.encode("utf-8")).hexdigest()
                self.career_memory.record_resume_version(
                    profile_id=profile.profile_id,
                    listing_id=listing.listing_id,
                    company=listing.company,
                    job_title=listing.title,
                    resume_path=package.resume.path,
                    resume_hash=resume_hash,
                    metadata={
                        "match_score": match.score,
                        "optimization": prepared_item.get("resume_optimization") if prepared_item else None,
                    },
                )
            except Exception:
                pass

            submission_result = await self.application_engine.submit_application(
                listing=listing,
                profile=profile,
                package=package,
                auto_apply=auto_apply,
                manual_review=safety.requires_manual_review,
                mode=application_mode,
            )

            try:
                status = str(submission_result.get("status", ""))
                mode = str(submission_result.get("mode", ""))
                reason = str(submission_result.get("reason", ""))
                score_value = float(decision.score) if decision is not None else float(match.score)

                self.career_memory.record_job_history(
                    profile_id=profile.profile_id,
                    listing_id=listing.listing_id,
                    company=listing.company,
                    job_title=listing.title,
                    score=score_value,
                    decision="apply",
                    resume_path=package.resume.path,
                    status=status,
                    metadata={
                        "match_score": match.score,
                        "mode": mode,
                        "reason": reason,
                        "decision": {
                            "source": getattr(decision, "source", ""),
                            "should_apply": getattr(decision, "should_apply", True),
                            "score": getattr(decision, "score", match.score),
                            "confidence": getattr(decision, "confidence", None),
                            "decision_reason": getattr(decision, "decision_reason", ""),
                            "strengths": getattr(decision, "strengths", []),
                            "risks": getattr(decision, "risks", []),
                            "missing_skills": getattr(decision, "missing_skills", []),
                        },
                        "safety": asdict(safety),
                    },
                )
                self.career_memory.record_application_history(
                    profile_id=profile.profile_id,
                    listing_id=listing.listing_id,
                    company=listing.company,
                    job_title=listing.title,
                    score=score_value,
                    decision="apply",
                    resume_path=package.resume.path,
                    status=status,
                    mode=mode,
                    reason=reason,
                    metadata={
                        "cover_letter_path": package.cover_letter.path,
                        "match_score": match.score,
                        "optimization": prepared_item.get("resume_optimization") if prepared_item else None,
                    },
                )
            except Exception:
                pass

            record = self.application_tracker.record_submission(
                listing=listing,
                match=match,
                package=package,
                submission_result=submission_result,
            )
            submissions.append(
                {
                    "listing_id": listing.listing_id,
                    "company": listing.company,
                    "job_title": listing.title,
                    "match_score": match.score,
                    "safety": asdict(safety),
                    "reasoning": (
                        {
                            "source": decision.source,
                            "should_apply": decision.should_apply,
                            "score": decision.score,
                            "confidence": decision.confidence,
                            "decision_reason": decision.decision_reason,
                            "strengths": decision.strengths,
                            "risks": decision.risks,
                            "missing_skills": decision.missing_skills,
                            "explanation": decision.explanation,
                            "duration_ms": decision.duration_ms,
                        }
                        if decision is not None
                        else None
                    ),
                    "resume_optimization": prepared_item.get("resume_optimization") if prepared_item else None,
                    "submission": submission_result,
                    "application_id": record.application_id,
                    "resume_path": package.resume.path,
                    "cover_letter_path": package.cover_letter.path,
                }
            )
            submission_records.append(asdict(record))

        recruiter_events = await self.monitor.poll(
            profile=profile,
            lookback_hours=int(task.get("monitor_lookback_hours", self.config.monitor_lookback_hours)),
            extra_messages=task.get("inbox_messages") if isinstance(task.get("inbox_messages"), list) else None,
        )

        for event in recruiter_events:
            self.database.save_recruiter_event(event)

        status_updates = self.application_tracker.apply_recruiter_events(recruiter_events)

        interview_prep_packets: list[dict[str, Any]] = []
        for update in status_updates:
            if update.get("new_status") != ApplicationStatus.INTERVIEW_SCHEDULED.value:
                continue
            listing = self._find_listing_for_update(update, parsed_listings)
            if listing is None:
                continue
            prep = await self.interview_preparer.prepare(profile=profile, listing=listing)
            interview_prep_packets.append(
                {
                    "application_id": update.get("application_id"),
                    "company": update.get("company"),
                    "job_title": update.get("job_title"),
                    "prep": prep,
                }
            )

        notifications = []
        if qualified_matches:
            notifications.extend(
                await self.notification_service.notify(
                    title="New job matches identified",
                    message=(
                        f"{len(qualified_matches)} qualified jobs found in cycle {task_id}. "
                        f"{len(submissions)} applications processed."
                    ),
                    priority="normal",
                    metadata={"task_id": task_id},
                )
            )

        for update in status_updates:
            if update.get("new_status") in {
                ApplicationStatus.INTERVIEW_SCHEDULED.value,
                ApplicationStatus.OFFER_RECEIVED.value,
            }:
                notifications.extend(
                    await self.notification_service.notify(
                        title=f"Application update: {update.get('new_status')}",
                        message=(
                            f"{update.get('company')} - {update.get('job_title')} changed to "
                            f"{update.get('new_status')}"
                        ),
                        priority="high",
                        metadata={"update": update},
                    )
                )

        metrics = self.database.get_application_metrics()
        optimization = self.strategy_optimizer.optimize(
            current_strategy=strategy,
            metrics=metrics,
            recent_matches=ranked_matches,
        )
        self.database.save_strategy_snapshot(optimization.strategy, metrics)

        portfolio_recommendations = self.portfolio_builder.recommend_improvements(
            profile=profile,
            match_results=ranked_matches,
        )
        portfolio_generation = []
        if bool(task.get("auto_build_portfolio", False)):
            portfolio_generation = await self.portfolio_builder.trigger_portfolio_generation(
                profile=profile,
                recommendations=portfolio_recommendations,
                max_projects=int(task.get("max_portfolio_projects", 2)),
            )

        cycle_summary = {
            "raw_postings": len(raw_postings),
            "parsed_listings": len(parsed_listings),
            "new_listings": new_listing_count,
            "qualified_matches": len(qualified_matches),
            "reasoned_matches": len(decisions_by_listing),
            "applications_attempted": len(submissions),
            "skipped": len(skipped),
            "recruiter_events": len(recruiter_events),
            "status_updates": len(status_updates),
        }

        reflection_payload: dict[str, Any] | None = None
        try:
            reflection = await self.reflection_engine.reflect_on_cycle(
                profile=profile,
                cycle_summary=cycle_summary,
                applications=submissions,
                skipped=skipped,
            )
            reflection_payload = asdict(reflection)
        except Exception as exc:
            logger.warning("Reflection engine failed: %s", exc)

        career_memory_summary: dict[str, Any] | None = None
        try:
            career_memory_summary = asdict(self.career_memory.summary())
        except Exception:
            career_memory_summary = None

        duration = round(perf_counter() - started, 4)
        return {
            "status": "success",
            "command": "run_cycle",
            "task_id": task_id,
            "agent_version": self.VERSION,
            "duration_seconds": duration,
            "profile": {
                "name": profile.name,
                "email": profile.contact.email,
                "completeness": profile_health,
            },
            "workflow_context": workflow_context,
            "cycle_summary": cycle_summary,
            "reflection": reflection_payload,
            "career_memory": career_memory_summary,
            "applications": submissions,
            "application_records": submission_records,
            "skipped": skipped,
            "matches": [
                {
                    "listing_id": item.listing_id,
                    "company": item.company,
                    "job_title": item.title,
                    "location": listing_lookup.get(item.listing_id).location if listing_lookup.get(item.listing_id) else "",
                    "source": listing_lookup.get(item.listing_id).source if listing_lookup.get(item.listing_id) else "",
                    "url": listing_lookup.get(item.listing_id).url if listing_lookup.get(item.listing_id) else "",
                    "is_recent": bool(
                        listing_lookup.get(item.listing_id)
                        and listing_lookup[item.listing_id].metadata.get("is_recent")
                    ),
                    "score": item.score,
                    "passed_threshold": item.passed_threshold,
                    "matched_skills": item.matched_skills,
                    "missing_skills": item.missing_skills,
                    "breakdown": asdict(item.breakdown),
                }
                for item in ranked_matches[:100]
            ],
            "recruiter_events": [asdict(item) for item in recruiter_events],
            "status_updates": status_updates,
            "interview_preparation": interview_prep_packets,
            "strategy": {
                "active": strategy.to_dict(),
                "optimized": optimization.strategy.to_dict(),
                "notes": optimization.notes,
                "metrics": metrics,
            },
            "portfolio_improvements": {
                "recommendations": portfolio_recommendations,
                "generated_projects": portfolio_generation,
            },
            "notifications": notifications,
            "capabilities": self.get_capabilities(),
        }

    async def _run_continuous(self, task: dict[str, Any]) -> dict[str, Any]:
        max_cycles = int(task.get("max_cycles", 1))
        interval_hours = float(task.get("scan_interval_hours", self.config.scan_interval_hours))
        interval_seconds = max(1, int(interval_hours * 3600))

        if max_cycles == 0:
            max_cycles = 1

        results: list[dict[str, Any]] = []
        for cycle in range(max_cycles):
            cycle_payload = dict(task)
            cycle_payload["command"] = "run_cycle"
            cycle_payload["task_id"] = f"continuous-{cycle + 1}"
            result = await self._run_single_cycle(cycle_payload)
            results.append(result)
            if cycle < max_cycles - 1:
                await asyncio.sleep(interval_seconds)

        return {
            "status": "success",
            "command": "run_continuous",
            "cycles_requested": max_cycles,
            "cycle_results": results,
            "agent_version": self.VERSION,
        }

    async def _handle_prepare_interview(self, task: dict[str, Any]) -> dict[str, Any]:
        profile = self.profile_manager.ensure_profile(task.get("candidate_profile"))

        listing_payload = task.get("job_listing")
        if not isinstance(listing_payload, dict):
            return {
                "status": "failure",
                "error": "prepare_interview requires task['job_listing'] payload",
                "agent_version": self.VERSION,
            }

        listing = JobListing(
            listing_id=str(listing_payload.get("listing_id", "manual-listing")),
            source=str(listing_payload.get("source", "manual")),
            external_id=str(listing_payload.get("external_id", "manual")),
            url=str(listing_payload.get("url", "")),
            title=str(listing_payload.get("title", "Unknown Role")),
            company=str(listing_payload.get("company", "Unknown Company")),
            location=str(listing_payload.get("location", "")),
            required_skills=list(listing_payload.get("required_skills", [])),
            technology_stack=list(listing_payload.get("technology_stack", [])),
            description=str(listing_payload.get("description", "")),
            posted_at=str(listing_payload.get("posted_at", "")),
            discovered_at=str(listing_payload.get("discovered_at", utc_now_iso())),
            metadata=dict(listing_payload.get("metadata", {})),
        )

        prep = await self.interview_preparer.prepare(profile=profile, listing=listing)
        return {
            "status": "success",
            "command": "prepare_interview",
            "preparation": prep,
            "agent_version": self.VERSION,
        }

    async def _request_workflow_context(
        self,
        *,
        task_id: str,
        profile: CandidateProfile,
        strategy: StrategySnapshot,
    ) -> dict[str, Any]:
        payload = {
            "task_id": f"workflow-{task_id}",
            "query": (
                "Coordinate job-discovery-to-application pipeline and suggest step sequencing "
                "for autonomous execution."
            ),
            "context": {
                "domain": "job_pipeline_orchestration",
                "candidate_name": profile.name,
                "target_roles": profile.preferences.target_roles,
                "scan_interval_hours": strategy.scan_interval_hours,
                "min_match_threshold": strategy.min_match_threshold,
                "daily_application_limit": strategy.daily_application_limit,
            },
            "enable_council": True,
        }
        result = await self.gateway.orchestrate_pipeline(payload)
        return {
            "status": result.status,
            "error": result.error,
            "response": result.payload,
        }

    def _load_strategy(self, task: dict[str, Any]) -> StrategySnapshot:
        latest, _ = self.database.load_latest_strategy_snapshot()
        base = latest or StrategySnapshot.from_dict(self._default_strategy.to_dict())

        overrides = dict(task.get("strategy_override", {})) if isinstance(task.get("strategy_override"), dict) else {}
        if "scan_interval_hours" in task:
            overrides.setdefault("scan_interval_hours", task.get("scan_interval_hours"))
        if "min_match_threshold" in task:
            overrides.setdefault("min_match_threshold", task.get("min_match_threshold"))
        if "daily_application_limit" in task:
            overrides.setdefault("daily_application_limit", task.get("daily_application_limit"))

        if not overrides:
            return base

        payload = base.to_dict()
        payload.update(overrides)
        return StrategySnapshot.from_dict(payload)

    @staticmethod
    def _find_listing_for_update(
        update: dict[str, Any],
        listings: list[JobListing],
    ) -> JobListing | None:
        company = str(update.get("company", "")).strip().lower()
        title = str(update.get("job_title", "")).strip().lower()

        for listing in listings:
            if listing.company.strip().lower() != company:
                continue
            if title and listing.title.strip().lower() != title:
                continue
            return listing
        return None

    @staticmethod
    def _configure_logging(logs_dir: Path) -> None:
        """Configure file logging for job-agent modules without overriding global config."""
        log_path = (logs_dir / "job_agent.log").resolve()

        targets: list[logging.Logger] = []
        for logger_name in ("agents.job_agent", "imperium.agents.job_agent"):
            target = logging.getLogger(logger_name)
            if any(
                isinstance(existing, RotatingFileHandler)
                and getattr(existing, "baseFilename", "") == str(log_path)
                for existing in target.handlers
            ):
                continue
            targets.append(target)

        if not targets:
            return

        formatter = logging.Formatter(
            fmt="%(asctime)s %(levelname)s %(name)s - %(message)s",
        )
        handler = RotatingFileHandler(
            filename=str(log_path),
            maxBytes=2_000_000,
            backupCount=3,
            encoding="utf-8",
        )
        handler.setFormatter(formatter)

        for target in targets:
            target.addHandler(handler)
            target.setLevel(logging.INFO)
            target.propagate = True
