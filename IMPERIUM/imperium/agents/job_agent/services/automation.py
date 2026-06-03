from __future__ import annotations

import logging
import re
from dataclasses import asdict, dataclass, field
from enum import Enum
from pathlib import Path
from time import perf_counter
from typing import Any, Protocol

from ..models import ApplicationPackage, CandidateProfile, GeneratedDocument, JobListing, utc_now_iso
from .gateway import ImperiumAgentGateway
from .resume import PDFResumeGenerator


logger = logging.getLogger(__name__)


class ApplicationMode(str, Enum):
    MANUAL = "manual"
    SIMULATED = "simulated"
    REAL = "real"


@dataclass(slots=True)
class ApplicationSubmissionResult:
    """Truthful submission result."""

    status: str
    mode: str
    reason: str
    submitted: bool = False
    portal: str = ""
    application_url: str = ""
    attempted_at: str = field(default_factory=utc_now_iso)
    details: str = ""
    payload: dict[str, Any] = field(default_factory=dict)
    metrics: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class ApplicationExecutor(Protocol):
    async def execute(
        self,
        *,
        listing: JobListing,
        profile: CandidateProfile,
        package: ApplicationPackage,
        payload: dict[str, Any],
        reason: str,
    ) -> ApplicationSubmissionResult: ...


class ManualApplicationExecutor:
    async def execute(
        self,
        *,
        listing: JobListing,
        profile: CandidateProfile,
        package: ApplicationPackage,
        payload: dict[str, Any],
        reason: str,
    ) -> ApplicationSubmissionResult:
        return ApplicationSubmissionResult(
            status="manual_required",
            mode=ApplicationMode.MANUAL.value,
            reason=reason,
            submitted=False,
            portal=listing.source,
            application_url=listing.url,
            details=(
                "Manual mode: no submission attempted. Use the generated resume/cover letter files "
                "and the prepared automation payload to submit."
            ),
            payload=payload,
            metrics={"mode": ApplicationMode.MANUAL.value},
        )


class SimulatedApplicationExecutor:
    async def execute(
        self,
        *,
        listing: JobListing,
        profile: CandidateProfile,
        package: ApplicationPackage,
        payload: dict[str, Any],
        reason: str,
    ) -> ApplicationSubmissionResult:
        start = perf_counter()
        duration = round(perf_counter() - start, 6)
        return ApplicationSubmissionResult(
            status="simulated",
            mode=ApplicationMode.SIMULATED.value,
            reason=reason,
            submitted=False,
            portal=listing.source,
            application_url=listing.url,
            details=(
                "SIMULATED mode: no real submission attempted. This is a demo-only execution path "
                "to exercise pipeline + metrics."
            ),
            payload=payload,
            metrics={
                "mode": ApplicationMode.SIMULATED.value,
                "latency_seconds": duration,
                "timestamp": utc_now_iso(),
            },
        )


class RealApplicationExecutor:
    async def execute(
        self,
        *,
        listing: JobListing,
        profile: CandidateProfile,
        package: ApplicationPackage,
        payload: dict[str, Any],
        reason: str,
    ) -> ApplicationSubmissionResult:
        return ApplicationSubmissionResult(
            status="not_implemented",
            mode=ApplicationMode.REAL.value,
            reason=reason,
            submitted=False,
            portal=listing.source,
            application_url=listing.url,
            details=(
                "REAL mode stub: real job-site automation is intentionally not implemented in this "
                "prototype build. Use MANUAL or SIMULATED modes."
            ),
            payload=payload,
            metrics={"mode": ApplicationMode.REAL.value},
        )


class ApplicationAutomationEngine:
    """Builds application packets and submits them through the Automation Agent."""

    def __init__(
        self,
        *,
        gateway: ImperiumAgentGateway,
        artifacts_dir: Path,
    ) -> None:
        self.gateway = gateway
        self.artifacts_dir = artifacts_dir.resolve()
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)
        self.pdf_generator = PDFResumeGenerator()
        self._executors: dict[ApplicationMode, ApplicationExecutor] = {
            ApplicationMode.MANUAL: ManualApplicationExecutor(),
            ApplicationMode.SIMULATED: SimulatedApplicationExecutor(),
            ApplicationMode.REAL: RealApplicationExecutor(),
        }

    def build_application_package(
        self,
        *,
        listing: JobListing,
        resume_text: str,
        cover_letter_text: str,
        profile: Any = None,
        match: Any = None,
    ) -> ApplicationPackage:
        listing_folder = self.artifacts_dir / f"{self._slug(listing.company)}_{self._slug(listing.title)}"
        listing_folder.mkdir(parents=True, exist_ok=True)

        if profile and match and self.pdf_generator.has_pdf:
            try:
                resume_path = self.pdf_generator.generate_resume(
                    profile=profile,
                    job_listing=listing,
                    match=match,
                    output_path=listing_folder / "resume",
                )
            except Exception:
                logger.warning("PDF generation failed; falling back to text", exc_info=True)
                resume_path = listing_folder / "resume.txt"
                resume_path.write_text(resume_text, encoding="utf-8")
        else:
            resume_path = listing_folder / "resume.txt"
            resume_path.write_text(resume_text, encoding="utf-8")

        cover_path = listing_folder / "cover_letter.txt"
        cover_path.write_text(cover_letter_text, encoding="utf-8")

        return ApplicationPackage(
            resume=GeneratedDocument(path=str(resume_path), content=resume_text),
            cover_letter=GeneratedDocument(path=str(cover_path), content=cover_letter_text),
            metadata={
                "generated_at": utc_now_iso(),
                "listing_id": listing.listing_id,
                "company": listing.company,
                "job_title": listing.title,
            },
        )

    async def submit_application(
        self,
        *,
        listing: JobListing,
        profile: CandidateProfile,
        package: ApplicationPackage,
        auto_apply: bool,
        manual_review: bool,
        mode: str | ApplicationMode | None = None,
    ) -> dict[str, Any]:
        payload = self._build_application_payload(
            listing=listing,
            profile=profile,
            package=package,
        )

        requested_mode = self._normalize_mode(mode)
        effective_mode = requested_mode
        reason = "Requested mode"

        if manual_review:
            effective_mode = ApplicationMode.MANUAL
            reason = "Safety policy requires manual review"
        elif not auto_apply:
            effective_mode = ApplicationMode.MANUAL
            reason = "Auto-apply disabled; preparing manual submission package"

        executor = self._executors.get(effective_mode, self._executors[ApplicationMode.MANUAL])
        result = await executor.execute(
            listing=listing,
            profile=profile,
            package=package,
            payload=payload,
            reason=reason,
        )
        return result.to_dict()

    @staticmethod
    def _build_application_payload(
        *,
        listing: JobListing,
        profile: CandidateProfile,
        package: ApplicationPackage,
    ) -> dict[str, Any]:
        return {
            "task_id": f"apply-{listing.listing_id}",
            "action": "apply_for_job",
            "parameters": {
                "portal": listing.source,
                "job_url": listing.url,
                "company": listing.company,
                "job_title": listing.title,
                "resume_path": package.resume.path,
                "cover_letter_path": package.cover_letter.path,
                "candidate_name": profile.name,
                "candidate_email": profile.contact.email,
            },
        }

    @staticmethod
    def _normalize_mode(mode: str | ApplicationMode | None) -> ApplicationMode:
        if isinstance(mode, ApplicationMode):
            return mode
        value = str(mode or "").strip().lower()
        if value == ApplicationMode.SIMULATED.value:
            return ApplicationMode.SIMULATED
        if value == ApplicationMode.REAL.value:
            return ApplicationMode.REAL
        return ApplicationMode.MANUAL

    @staticmethod
    def _slug(value: str) -> str:
        lowered = value.lower().strip()
        normalized = re.sub(r"[^a-z0-9]+", "_", lowered)
        return normalized.strip("_") or "job"
