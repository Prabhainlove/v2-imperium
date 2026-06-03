from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from hashlib import sha1
from typing import Any, Iterable
from uuid import uuid4


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def today_iso() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def normalize_str_list(values: Iterable[str] | None) -> list[str]:
    normalized: list[str] = []
    if values is None:
        return normalized

    seen: set[str] = set()
    for value in values:
        item = str(value).strip()
        if not item:
            continue
        key = item.lower()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(item)
    return normalized


class JobSource(str, Enum):
    LINKEDIN = "linkedin"
    INDEED = "indeed"
    GLASSDOOR = "glassdoor"
    WELLFOUND = "wellfound"
    REMOTE_BOARD = "remote_board"
    STARTUP_BOARD = "startup_board"
    COMPANY_CAREER = "company_career"
    GOVERNMENT_PORTAL = "government_portal"
    OTHER = "other"


class ApplicationStatus(str, Enum):
    APPLIED = "Applied"
    UNDER_REVIEW = "Under Review"
    INTERVIEW_SCHEDULED = "Interview Scheduled"
    REJECTED = "Rejected"
    OFFER_RECEIVED = "Offer Received"
    MANUAL_REVIEW = "Manual Review"


class NotificationChannel(str, Enum):
    EMAIL = "email"
    MESSAGING_APP = "messaging_app"
    MOBILE = "mobile"
    IMPERIUM_DASHBOARD = "imperium_dashboard"


@dataclass(slots=True)
class ContactInfo:
    email: str
    phone: str = ""
    location: str = ""
    website: str = ""

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "ContactInfo":
        return cls(
            email=str(payload.get("email", "")).strip(),
            phone=str(payload.get("phone", "")).strip(),
            location=str(payload.get("location", "")).strip(),
            website=str(payload.get("website", "")).strip(),
        )


@dataclass(slots=True)
class CandidatePreferences:
    target_roles: list[str] = field(default_factory=list)
    preferred_locations: list[str] = field(default_factory=list)
    remote_only: bool = False
    salary_min: float | None = None
    salary_max: float | None = None
    career_direction: str = ""

    def __post_init__(self) -> None:
        self.target_roles = normalize_str_list(self.target_roles)
        self.preferred_locations = normalize_str_list(self.preferred_locations)
        self.career_direction = self.career_direction.strip()

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "CandidatePreferences":
        return cls(
            target_roles=list(payload.get("target_roles", [])),
            preferred_locations=list(payload.get("preferred_locations", [])),
            remote_only=bool(payload.get("remote_only", False)),
            salary_min=payload.get("salary_min"),
            salary_max=payload.get("salary_max"),
            career_direction=str(payload.get("career_direction", "")).strip(),
        )


@dataclass(slots=True)
class WorkExperience:
    title: str
    company: str
    start_date: str = ""
    end_date: str = ""
    years_experience: float | None = None
    achievements: list[str] = field(default_factory=list)
    technologies: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        self.title = self.title.strip()
        self.company = self.company.strip()
        self.achievements = normalize_str_list(self.achievements)
        self.technologies = normalize_str_list(self.technologies)

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "WorkExperience":
        return cls(
            title=str(payload.get("title", "")).strip(),
            company=str(payload.get("company", "")).strip(),
            start_date=str(payload.get("start_date", "")).strip(),
            end_date=str(payload.get("end_date", "")).strip(),
            years_experience=payload.get("years_experience"),
            achievements=list(payload.get("achievements", [])),
            technologies=list(payload.get("technologies", [])),
        )


@dataclass(slots=True)
class EducationRecord:
    institution: str
    degree: str
    field_of_study: str = ""
    start_date: str = ""
    end_date: str = ""

    def __post_init__(self) -> None:
        self.institution = self.institution.strip()
        self.degree = self.degree.strip()
        self.field_of_study = self.field_of_study.strip()

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "EducationRecord":
        return cls(
            institution=str(payload.get("institution", "")).strip(),
            degree=str(payload.get("degree", "")).strip(),
            field_of_study=str(payload.get("field_of_study", "")).strip(),
            start_date=str(payload.get("start_date", "")).strip(),
            end_date=str(payload.get("end_date", "")).strip(),
        )


@dataclass(slots=True)
class ProjectRecord:
    name: str
    description: str
    technologies: list[str] = field(default_factory=list)
    links: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        self.name = self.name.strip()
        self.description = self.description.strip()
        self.technologies = normalize_str_list(self.technologies)
        self.links = normalize_str_list(self.links)

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "ProjectRecord":
        return cls(
            name=str(payload.get("name", "")).strip(),
            description=str(payload.get("description", "")).strip(),
            technologies=list(payload.get("technologies", [])),
            links=list(payload.get("links", [])),
        )


@dataclass(slots=True)
class CertificationRecord:
    name: str
    issuer: str = ""
    date_obtained: str = ""

    def __post_init__(self) -> None:
        self.name = self.name.strip()
        self.issuer = self.issuer.strip()

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "CertificationRecord":
        return cls(
            name=str(payload.get("name", "")).strip(),
            issuer=str(payload.get("issuer", "")).strip(),
            date_obtained=str(payload.get("date_obtained", "")).strip(),
        )


@dataclass(slots=True)
class CandidateProfile:
    profile_id: str
    name: str
    contact: ContactInfo
    skills: list[str] = field(default_factory=list)
    work_experience: list[WorkExperience] = field(default_factory=list)
    education: list[EducationRecord] = field(default_factory=list)
    projects: list[ProjectRecord] = field(default_factory=list)
    certifications: list[CertificationRecord] = field(default_factory=list)
    portfolio_links: list[str] = field(default_factory=list)
    github_repositories: list[str] = field(default_factory=list)
    linkedin_profile: str = ""
    preferences: CandidatePreferences = field(default_factory=CandidatePreferences)
    created_at: str = field(default_factory=utc_now_iso)
    updated_at: str = field(default_factory=utc_now_iso)

    def __post_init__(self) -> None:
        self.profile_id = str(self.profile_id or uuid4()).strip()
        self.name = self.name.strip()
        self.skills = normalize_str_list(self.skills)
        self.portfolio_links = normalize_str_list(self.portfolio_links)
        self.github_repositories = normalize_str_list(self.github_repositories)
        self.linkedin_profile = self.linkedin_profile.strip()
        self.updated_at = utc_now_iso()

    def total_years_experience(self) -> float:
        years = 0.0
        for item in self.work_experience:
            if item.years_experience is not None:
                years += max(0.0, float(item.years_experience))
            else:
                years += 1.0
        return round(years, 2)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "CandidateProfile":
        return cls(
            profile_id=str(payload.get("profile_id") or uuid4()),
            name=str(payload.get("name", "")).strip(),
            contact=ContactInfo.from_dict(dict(payload.get("contact", {}))),
            skills=list(payload.get("skills", [])),
            work_experience=[
                WorkExperience.from_dict(dict(item))
                for item in list(payload.get("work_experience", []))
            ],
            education=[
                EducationRecord.from_dict(dict(item))
                for item in list(payload.get("education", []))
            ],
            projects=[
                ProjectRecord.from_dict(dict(item))
                for item in list(payload.get("projects", []))
            ],
            certifications=[
                CertificationRecord.from_dict(dict(item))
                for item in list(payload.get("certifications", []))
            ],
            portfolio_links=list(payload.get("portfolio_links", [])),
            github_repositories=list(payload.get("github_repositories", [])),
            linkedin_profile=str(payload.get("linkedin_profile", "")).strip(),
            preferences=CandidatePreferences.from_dict(dict(payload.get("preferences", {}))),
            created_at=str(payload.get("created_at", utc_now_iso())),
            updated_at=str(payload.get("updated_at", utc_now_iso())),
        )


@dataclass(slots=True)
class RawJobPosting:
    source: str
    external_id: str
    url: str
    payload: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.source = str(self.source).strip().lower() or JobSource.OTHER.value
        self.external_id = str(self.external_id).strip()
        self.url = str(self.url).strip()
        if not self.external_id:
            raw_identity = f"{self.source}|{self.url}|{self.payload.get('title', '')}|{self.payload.get('company', '')}"
            self.external_id = sha1(raw_identity.encode("utf-8")).hexdigest()[:20]


@dataclass(slots=True)
class JobListing:
    listing_id: str
    source: str
    external_id: str
    url: str
    title: str
    company: str
    location: str = ""
    salary_min: float | None = None
    salary_max: float | None = None
    salary_currency: str = "USD"
    required_skills: list[str] = field(default_factory=list)
    experience_years: float | None = None
    education_requirements: list[str] = field(default_factory=list)
    technology_stack: list[str] = field(default_factory=list)
    description: str = ""
    posted_at: str = ""
    discovered_at: str = field(default_factory=utc_now_iso)
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.listing_id = str(self.listing_id or uuid4())
        self.source = str(self.source).strip().lower() or JobSource.OTHER.value
        self.external_id = str(self.external_id).strip()
        self.url = str(self.url).strip()
        self.title = self.title.strip()
        self.company = self.company.strip()
        self.location = self.location.strip()
        self.required_skills = normalize_str_list(self.required_skills)
        self.education_requirements = normalize_str_list(self.education_requirements)
        self.technology_stack = normalize_str_list(self.technology_stack)
        self.description = self.description.strip()

    def dedupe_key(self) -> str:
        return f"{self.source}:{self.external_id}"


@dataclass(slots=True)
class MatchBreakdown:
    skill_overlap: float
    experience_fit: float
    salary_fit: float
    location_fit: float
    trajectory_fit: float


@dataclass(slots=True)
class MatchResult:
    listing_id: str
    company: str
    title: str
    score: float
    passed_threshold: bool
    breakdown: MatchBreakdown
    matched_skills: list[str] = field(default_factory=list)
    missing_skills: list[str] = field(default_factory=list)
    reasons: list[str] = field(default_factory=list)


@dataclass(slots=True)
class GeneratedDocument:
    path: str
    content: str
    mime_type: str = "text/plain"


@dataclass(slots=True)
class ApplicationPackage:
    resume: GeneratedDocument
    cover_letter: GeneratedDocument
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ApplicationRecord:
    application_id: str
    listing_id: str
    company: str
    job_title: str
    date_applied: str
    status: str
    match_score: float
    resume_path: str
    cover_letter_path: str
    last_updated: str = field(default_factory=utc_now_iso)
    notes: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class RecruiterEvent:
    event_id: str
    source: str
    company: str
    job_title: str
    message: str
    status_hint: str
    occurred_at: str = field(default_factory=utc_now_iso)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class NotificationEvent:
    notification_id: str
    title: str
    message: str
    channel: str
    priority: str = "normal"
    created_at: str = field(default_factory=utc_now_iso)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class StrategySnapshot:
    scan_interval_hours: int = 6
    min_match_threshold: float = 0.72
    daily_application_limit: int = 20
    target_roles: list[str] = field(default_factory=list)
    preferred_sources: list[str] = field(
        default_factory=lambda: [
            JobSource.LINKEDIN.value,
            JobSource.INDEED.value,
            JobSource.WELLFOUND.value,
            JobSource.REMOTE_BOARD.value,
        ]
    )
    keyword_blacklist: list[str] = field(default_factory=list)
    keyword_boost: list[str] = field(default_factory=list)
    last_optimized_at: str = field(default_factory=utc_now_iso)

    def __post_init__(self) -> None:
        self.scan_interval_hours = max(1, int(self.scan_interval_hours))
        self.min_match_threshold = max(0.0, min(1.0, float(self.min_match_threshold)))
        self.daily_application_limit = max(1, int(self.daily_application_limit))
        self.target_roles = normalize_str_list(self.target_roles)
        self.preferred_sources = normalize_str_list(self.preferred_sources)
        self.keyword_blacklist = normalize_str_list(self.keyword_blacklist)
        self.keyword_boost = normalize_str_list(self.keyword_boost)
        self.last_optimized_at = utc_now_iso()

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "StrategySnapshot":
        return cls(
            scan_interval_hours=payload.get("scan_interval_hours", 6),
            min_match_threshold=payload.get("min_match_threshold", 0.72),
            daily_application_limit=payload.get("daily_application_limit", 20),
            target_roles=list(payload.get("target_roles", [])),
            preferred_sources=list(payload.get("preferred_sources", [])),
            keyword_blacklist=list(payload.get("keyword_blacklist", [])),
            keyword_boost=list(payload.get("keyword_boost", [])),
            last_optimized_at=str(payload.get("last_optimized_at", utc_now_iso())),
        )
