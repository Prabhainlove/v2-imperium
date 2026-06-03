from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass
from hashlib import sha1
from time import perf_counter
from typing import Any, Iterable, Literal

from ..models import CandidateProfile, JobListing, MatchBreakdown, MatchResult, RawJobPosting, StrategySnapshot, normalize_str_list
from .llm_client import OpenAICompatibleLLMClient


logger = logging.getLogger(__name__)

DecisionSource = Literal["llm", "heuristic_fallback"]


@dataclass(slots=True)
class JobDescriptionAnalysis:
    key_responsibilities: list[str]
    required_qualifications: list[str]
    preferred_qualifications: list[str]
    cultural_indicators: list[str]
    urgency_signals: list[str]
    red_flags: list[str]
    company_stage: str
    team_size_estimate: str
    work_culture_type: str
    growth_opportunity_signals: list[str]
    compensation_confidence: str
    remote_flexibility_level: str


@dataclass(slots=True)
class CompanyCultureAnalysis:
    culture_keywords: list[str]
    work_life_balance_signals: list[str]
    innovation_indicators: list[str]
    bureaucracy_indicators: list[str]
    diversity_commitment_signals: list[str]
    sustainability_signals: list[str]
    tech_stack_modernity: str
    estimated_culture_fit_score: float


class NLPIntelligenceEngine:
    def __init__(self) -> None:
        self.red_flag_patterns = [
            "fast-paced environment",
            "wear many hats",
            "startup mentality",
            "family atmosphere",
            "rockstar",
            "ninja",
            "guru",
            "work hard play hard",
        ]

        self.urgency_patterns = [
            "immediately",
            "asap",
            "urgent",
            "start date: now",
            "hiring fast",
        ]

        self.culture_positive = [
            "work-life balance",
            "flexible hours",
            "remote-friendly",
            "professional development",
            "mentorship",
            "learning budget",
        ]

    def analyze_job_description(self, description: str, title: str, company: str) -> JobDescriptionAnalysis:
        desc_lower = description.lower()

        responsibilities = self._extract_responsibilities(description)
        required = self._extract_required_qualifications(description)
        preferred = self._extract_preferred_qualifications(description)

        cultural_signals = [keyword for keyword in self.culture_positive if keyword in desc_lower]
        flags = [pattern for pattern in self.red_flag_patterns if pattern.lower() in desc_lower]
        urgency = [pattern for pattern in self.urgency_patterns if pattern.lower() in desc_lower]

        company_stage = self._estimate_company_stage(desc_lower, company)
        culture_type = self._infer_work_culture(desc_lower)
        growth_signals = self._detect_growth_opportunities(desc_lower)
        remote_level = self._assess_remote_flexibility(desc_lower)
        comp_confidence = self._assess_compensation_transparency(desc_lower)
        team_size = self._estimate_team_size(desc_lower)

        return JobDescriptionAnalysis(
            key_responsibilities=responsibilities[:8],
            required_qualifications=required[:10],
            preferred_qualifications=preferred[:10],
            cultural_indicators=cultural_signals,
            urgency_signals=urgency,
            red_flags=flags,
            company_stage=company_stage,
            team_size_estimate=team_size,
            work_culture_type=culture_type,
            growth_opportunity_signals=growth_signals,
            compensation_confidence=comp_confidence,
            remote_flexibility_level=remote_level,
        )

    def analyze_company_culture(
        self,
        job_description: str,
        company_description: str | None = None,
        reviews: list[str] | None = None,
    ) -> CompanyCultureAnalysis:
        combined_text = job_description.lower()
        if company_description:
            combined_text += " " + company_description.lower()

        culture_keywords = self._extract_culture_keywords(combined_text)
        wlb_signals = self._extract_work_life_balance_signals(combined_text)
        innovation = self._extract_innovation_signals(combined_text)
        bureaucracy = self._extract_bureaucracy_signals(combined_text)
        diversity = self._extract_diversity_signals(combined_text)
        sustainability = self._extract_sustainability_signals(combined_text)
        tech_modernity = self._assess_tech_stack_modernity(combined_text)

        positive_signals = len(wlb_signals) + len(innovation) + len(diversity)
        negative_signals = len(bureaucracy) * 2
        culture_fit_score = min(1.0, max(0.0, (positive_signals - negative_signals) / 15.0 + 0.5))

        return CompanyCultureAnalysis(
            culture_keywords=culture_keywords,
            work_life_balance_signals=wlb_signals,
            innovation_indicators=innovation,
            bureaucracy_indicators=bureaucracy,
            diversity_commitment_signals=diversity,
            sustainability_signals=sustainability,
            tech_stack_modernity=tech_modernity,
            estimated_culture_fit_score=culture_fit_score,
        )

    def _extract_responsibilities(self, text: str) -> list[str]:
        responsibilities = []
        lines = text.split("\n")
        for line in lines:
            line_lower = line.strip().lower()
            if any(
                verb in line_lower
                for verb in ["develop", "build", "lead", "manage", "design", "implement", "create", "analyze"]
            ):
                if 10 < len(line) < 200:
                    responsibilities.append(line.strip())
        return responsibilities[:8]

    def _extract_required_qualifications(self, text: str) -> list[str]:
        qualifications = []
        text_lower = text.lower()

        required_section_start = text_lower.find("required")
        if required_section_start == -1:
            required_section_start = text_lower.find("must have")

        if required_section_start != -1:
            section = text[required_section_start : required_section_start + 500]
            lines = section.split("\n")
            for line in lines[1:]:
                if 10 < len(line) < 200 and line.strip():
                    qualifications.append(line.strip())

        return qualifications[:10]

    def _extract_preferred_qualifications(self, text: str) -> list[str]:
        qualifications = []
        text_lower = text.lower()

        preferred_section_start = text_lower.find("preferred")
        if preferred_section_start == -1:
            preferred_section_start = text_lower.find("nice to have")

        if preferred_section_start != -1:
            section = text[preferred_section_start : preferred_section_start + 500]
            lines = section.split("\n")
            for line in lines[1:]:
                if 10 < len(line) < 200 and line.strip():
                    qualifications.append(line.strip())

        return qualifications[:10]

    def _estimate_company_stage(self, text: str, company: str) -> str:
        if any(term in text for term in ["startup", "seed", "series a", "founding team"]):
            return "startup"
        if any(term in text for term in ["scale", "growth", "expanding", "series b", "series c"]):
            return "growth"
        if any(term in text for term in ["enterprise", "fortune 500", "established", "leader in"]):
            return "enterprise"
        return "established"

    def _infer_work_culture(self, text: str) -> str:
        collaborative_score = sum(1 for term in ["collaboration", "teamwork", "cross-functional"] if term in text)
        autonomous_score = sum(1 for term in ["independent", "self-directed", "autonomy"] if term in text)
        competitive_score = sum(1 for term in ["competitive", "high-performer", "top talent"] if term in text)
        structured_score = sum(1 for term in ["process", "methodology", "framework", "governance"] if term in text)

        scores = {
            "collaborative": collaborative_score,
            "autonomous": autonomous_score,
            "competitive": competitive_score,
            "structured": structured_score,
        }

        return max(scores, key=scores.get) if any(scores.values()) else "balanced"

    def _detect_growth_opportunities(self, text: str) -> list[str]:
        signals = []
        growth_indicators = [
            "career growth",
            "professional development",
            "leadership opportunities",
            "training budget",
            "learning stipend",
            "mentorship",
        ]
        for indicator in growth_indicators:
            if indicator in text:
                signals.append(indicator)
        return signals

    def _assess_remote_flexibility(self, text: str) -> str:
        if "remote" in text and "hybrid" in text:
            return "hybrid"
        if "remote" in text:
            return "full_remote"
        if "hybrid" in text:
            return "hybrid"
        if "on-site" in text or "office" in text:
            return "office_only"
        return "unclear"

    def _assess_compensation_transparency(self, text: str) -> str:
        if any(term in text for term in ["salary", "$", "compensation"]):
            return "explicit"
        if "competitive pay" in text or "market rate" in text:
            return "implied"
        return "unclear"

    def _estimate_team_size(self, text: str) -> str:
        if "small team" in text or "lean team" in text:
            return "small"
        if "large team" in text or "enterprise team" in text:
            return "large"
        return "unknown"

    def _extract_culture_keywords(self, text: str) -> list[str]:
        keywords = []
        candidates = ["collaboration", "ownership", "innovation", "customer-first", "diversity", "inclusion"]
        for item in candidates:
            if item in text:
                keywords.append(item)
        return keywords

    def _extract_work_life_balance_signals(self, text: str) -> list[str]:
        signals = []
        for keyword in ["work-life balance", "flexible hours", "remote-friendly", "unlimited pto"]:
            if keyword in text:
                signals.append(keyword)
        return signals

    def _extract_innovation_signals(self, text: str) -> list[str]:
        return [keyword for keyword in ["innovation", "research", "experiment", "prototype"] if keyword in text]

    def _extract_bureaucracy_signals(self, text: str) -> list[str]:
        return [keyword for keyword in ["approval", "compliance", "governance", "process-heavy"] if keyword in text]

    def _extract_diversity_signals(self, text: str) -> list[str]:
        return [keyword for keyword in ["diversity", "inclusion", "equity"] if keyword in text]

    def _extract_sustainability_signals(self, text: str) -> list[str]:
        return [keyword for keyword in ["sustainability", "green", "climate"] if keyword in text]

    def _assess_tech_stack_modernity(self, text: str) -> str:
        if any(keyword in text for keyword in ["kubernetes", "microservices", "cloud-native"]):
            return "cutting_edge"
        if any(keyword in text for keyword in ["cloud", "containers", "devops"]):
            return "modern"
        if any(keyword in text for keyword in ["legacy", "mainframe", "monolith"]):
            return "legacy"
        return "mixed"


@dataclass(slots=True)
class JobParser:
    """Converts unstructured job postings into normalized structured listings."""

    known_skills: tuple[str, ...] = (
        "python",
        "java",
        "typescript",
        "javascript",
        "go",
        "rust",
        "sql",
        "postgresql",
        "mysql",
        "redis",
        "aws",
        "azure",
        "gcp",
        "docker",
        "kubernetes",
        "terraform",
        "machine learning",
        "deep learning",
        "llm",
        "nlp",
        "pytorch",
        "tensorflow",
        "react",
        "node.js",
        "fastapi",
        "django",
        "flask",
        "git",
        "ci/cd",
    )

    def parse_postings(self, postings: Iterable[RawJobPosting]) -> list[JobListing]:
        parsed: list[JobListing] = []
        for posting in postings:
            node = dict(posting.payload)
            description = str(node.get("description", "")).strip()
            title = str(node.get("title", "")).strip() or "Unknown Role"
            company = str(node.get("company", "")).strip() or "Unknown Company"
            location = str(node.get("location", "")).strip()
            posted_at = str(node.get("posted_at", "")).strip()

            salary_min, salary_max, currency = self._extract_salary(description, str(node.get("salary", "")))
            required_skills = self._extract_skills(description)
            experience_years = self._extract_experience_years(description)
            education_reqs = self._extract_education_requirements(description)
            technology_stack = normalize_str_list(required_skills)

            parsed.append(
                JobListing(
                    listing_id=self._build_listing_id(posting),
                    source=posting.source,
                    external_id=posting.external_id,
                    url=posting.url,
                    title=title,
                    company=company,
                    location=location,
                    salary_min=salary_min,
                    salary_max=salary_max,
                    salary_currency=currency,
                    required_skills=required_skills,
                    experience_years=experience_years,
                    education_requirements=education_reqs,
                    technology_stack=technology_stack,
                    description=description,
                    posted_at=posted_at,
                    metadata={"raw_payload": node},
                )
            )

        return parsed

    @staticmethod
    def _build_listing_id(posting: RawJobPosting) -> str:
        identity = f"{posting.source}:{posting.external_id}".strip(":")
        if not identity:
            identity = f"{posting.source}:{posting.url}"
        digest = sha1(identity.encode("utf-8")).hexdigest()
        return f"job-{digest[:24]}"

    def _extract_skills(self, description: str) -> list[str]:
        lower_text = description.lower()
        extracted: list[str] = []

        for skill in self.known_skills:
            if skill in lower_text:
                extracted.append(skill)

        if "c++" in lower_text:
            extracted.append("c++")
        if "c#" in lower_text:
            extracted.append("c#")

        return normalize_str_list(extracted)

    def _extract_experience_years(self, description: str) -> float | None:
        patterns = [
            r"(\d+)\+?\s+years?\s+of\s+experience",
            r"minimum\s+of\s+(\d+)\s+years?",
            r"(\d+)\s*\+\s*years?",
        ]
        lowered = description.lower()
        for pattern in patterns:
            match = re.search(pattern, lowered)
            if match:
                try:
                    return float(match.group(1))
                except ValueError:
                    return None
        return None

    def _extract_education_requirements(self, description: str) -> list[str]:
        lowered = description.lower()
        requirements: list[str] = []

        if "bachelor" in lowered:
            requirements.append("Bachelor's degree")
        if "master" in lowered:
            requirements.append("Master's degree")
        if "phd" in lowered or "doctorate" in lowered:
            requirements.append("PhD")

        return normalize_str_list(requirements)

    def _extract_salary(self, description: str, salary_hint: str) -> tuple[float | None, float | None, str]:
        text = f"{description} {salary_hint}".strip()
        if not text:
            return None, None, "USD"

        currency = "USD"
        if "eur" in text.lower() or "€" in text:
            currency = "EUR"
        elif "gbp" in text.lower() or "£" in text:
            currency = "GBP"

        money_pattern = re.compile(r"\$?([0-9]{2,3}(?:,[0-9]{3})+|[0-9]{4,6})")
        values: list[float] = []
        for raw in money_pattern.findall(text):
            normalized = raw.replace(",", "")
            try:
                values.append(float(normalized))
            except ValueError:
                continue

        if not values:
            return None, None, currency

        values.sort()
        if len(values) == 1:
            return values[0], values[0], currency
        return values[0], values[-1], currency


@dataclass(slots=True)
class JobMatcherConfig:
    min_match_threshold: float = 0.72
    weight_skill_overlap: float = 0.35
    weight_experience_fit: float = 0.20
    weight_salary_fit: float = 0.15
    weight_location_fit: float = 0.15
    weight_trajectory_fit: float = 0.15


class JobMatchingEngine:
    """Computes profile-job compatibility scores and match explanations."""

    def __init__(self, config: JobMatcherConfig | None = None) -> None:
        self.config = config or JobMatcherConfig()

    def match(
        self,
        *,
        profile: CandidateProfile,
        listing: JobListing,
        strategy: StrategySnapshot,
    ) -> MatchResult:
        profile_skills = {skill.strip().lower() for skill in profile.skills if skill.strip()}
        job_skills = {skill.strip().lower() for skill in listing.required_skills if skill.strip()}

        if not job_skills:
            skill_overlap = 0.55
            matched_skills = []
            missing_skills = []
        else:
            intersection = sorted(profile_skills.intersection(job_skills))
            missing = sorted(job_skills.difference(profile_skills))
            skill_overlap = len(intersection) / max(1, len(job_skills))
            matched_skills = intersection
            missing_skills = missing

        candidate_years = profile.total_years_experience()
        required_years = float(listing.experience_years or 0.0)
        if required_years <= 0:
            experience_fit = 1.0
        else:
            experience_fit = min(1.0, candidate_years / required_years)

        salary_fit = self._salary_fit(profile, listing)
        location_fit = self._location_fit(profile, listing)
        trajectory_fit = self._trajectory_fit(profile, listing)

        score = (
            skill_overlap * self.config.weight_skill_overlap
            + experience_fit * self.config.weight_experience_fit
            + salary_fit * self.config.weight_salary_fit
            + location_fit * self.config.weight_location_fit
            + trajectory_fit * self.config.weight_trajectory_fit
        )
        score = round(max(0.0, min(1.0, score)), 4)

        threshold = max(0.0, min(1.0, float(strategy.min_match_threshold)))
        passed_threshold = score >= threshold

        reasons = [
            f"Skill overlap: {round(skill_overlap, 3)}",
            f"Experience fit: {round(experience_fit, 3)}",
            f"Salary fit: {round(salary_fit, 3)}",
            f"Location fit: {round(location_fit, 3)}",
            f"Career trajectory fit: {round(trajectory_fit, 3)}",
        ]

        return MatchResult(
            listing_id=listing.listing_id,
            company=listing.company,
            title=listing.title,
            score=score,
            passed_threshold=passed_threshold,
            breakdown=MatchBreakdown(
                skill_overlap=round(skill_overlap, 4),
                experience_fit=round(experience_fit, 4),
                salary_fit=round(salary_fit, 4),
                location_fit=round(location_fit, 4),
                trajectory_fit=round(trajectory_fit, 4),
            ),
            matched_skills=matched_skills,
            missing_skills=missing_skills,
            reasons=reasons,
        )

    def rank_jobs(
        self,
        *,
        profile: CandidateProfile,
        listings: list[JobListing],
        strategy: StrategySnapshot,
    ) -> list[MatchResult]:
        matches = [self.match(profile=profile, listing=listing, strategy=strategy) for listing in listings]
        return sorted(matches, key=lambda item: item.score, reverse=True)

    def _salary_fit(self, profile: CandidateProfile, listing: JobListing) -> float:
        pref_min = profile.preferences.salary_min
        pref_max = profile.preferences.salary_max

        if pref_min is None and pref_max is None:
            return 0.8

        listing_min = listing.salary_min
        listing_max = listing.salary_max
        if listing_min is None and listing_max is None:
            return 0.6

        floor = listing_min if listing_min is not None else listing_max
        ceiling = listing_max if listing_max is not None else listing_min
        if floor is None or ceiling is None:
            return 0.6

        if pref_min is not None and ceiling < pref_min:
            return 0.2
        if pref_max is not None and floor > pref_max:
            return 0.5
        return 1.0

    def _location_fit(self, profile: CandidateProfile, listing: JobListing) -> float:
        preferred_locations = {
            location.strip().lower()
            for location in profile.preferences.preferred_locations
            if location.strip()
        }
        listing_location = listing.location.strip().lower()

        if profile.preferences.remote_only:
            if "remote" in listing_location:
                return 1.0
            return 0.2

        if not preferred_locations:
            return 0.75
        if not listing_location:
            return 0.5
        if any(location in listing_location for location in preferred_locations):
            return 1.0
        if "remote" in listing_location:
            return 0.8
        return 0.3

    def _trajectory_fit(self, profile: CandidateProfile, listing: JobListing) -> float:
        title_lower = listing.title.lower()
        target_roles = [item.lower() for item in profile.preferences.target_roles]

        if not target_roles:
            return 0.75
        for role in target_roles:
            if role and role in title_lower:
                return 1.0
        return 0.4


@dataclass(slots=True)
class RankedMatch:
    match: MatchResult
    score: float


class JobRanker:
    def rank(self, *, matches: list[MatchResult], decisions_by_listing: dict[str, Any] | None = None) -> list[RankedMatch]:
        scored: list[RankedMatch] = []
        decision_map = decisions_by_listing or {}

        for match in matches:
            decision = decision_map.get(match.listing_id)
            weight = 0.7
            if decision is not None:
                weight = 0.55 + (float(getattr(decision, "confidence", 0.5)) * 0.35)

            decision_score = float(getattr(decision, "score", match.score)) if decision is not None else match.score
            combined_score = (match.score * (1 - weight)) + (decision_score * weight)
            scored.append(RankedMatch(match=match, score=round(combined_score, 4)))

        return sorted(scored, key=lambda item: item.score, reverse=True)


@dataclass(slots=True)
class ApplicationDecision:
    should_apply: bool
    score: float
    confidence: float
    decision_reason: str
    strengths: list[str]
    risks: list[str]
    missing_skills: list[str]
    recommended_customizations: list[str]
    explanation: str
    predicted_success_probability: float
    opportunity_score: float
    source: DecisionSource
    raw: dict[str, Any] | None = None
    duration_ms: int | None = None


class AdvancedReasoningEngine:
    """Job-application decision engine (LLM-first, heuristic fallback)."""

    def __init__(self, llm_client: OpenAICompatibleLLMClient | None = None) -> None:
        self.reasoning_history: list[ApplicationDecision] = []
        self._llm = llm_client or OpenAICompatibleLLMClient()
        import os

        concurrency = max(1, int(os.getenv("IMPERIUM_LLM_CONCURRENCY", "3")))
        self._llm_semaphore = asyncio.Semaphore(concurrency)

    async def evaluate_application(
        self,
        *,
        profile: CandidateProfile,
        listing: JobListing,
        match: MatchResult,
        resume_text: str | None = None,
        market_context: dict[str, Any] | None = None,
    ) -> ApplicationDecision:
        started = perf_counter()
        market_context = market_context or {}

        if self._llm.enabled:
            try:
                async with self._llm_semaphore:
                    decision = await self._evaluate_with_llm(
                        profile=profile,
                        listing=listing,
                        match=match,
                        resume_text=resume_text,
                        market_context=market_context,
                    )
                decision.duration_ms = int((perf_counter() - started) * 1000)
                self.reasoning_history.append(decision)
                return decision
            except Exception as exc:
                logger.warning(
                    "LLM reasoning failed; using heuristic fallback. company=%s title=%s error=%s",
                    listing.company,
                    listing.title,
                    exc,
                )

        decision = self._evaluate_with_heuristics(
            profile=profile,
            listing=listing,
            match=match,
            market_context=market_context,
        )
        decision.duration_ms = int((perf_counter() - started) * 1000)
        self.reasoning_history.append(decision)
        return decision

    async def _evaluate_with_llm(
        self,
        *,
        profile: CandidateProfile,
        listing: JobListing,
        match: MatchResult,
        resume_text: str | None,
        market_context: dict[str, Any],
    ) -> ApplicationDecision:
        profile_summary = {
            "name": profile.name,
            "years_experience": profile.total_years_experience(),
            "skills": profile.skills[:60],
            "target_roles": profile.preferences.target_roles,
            "preferred_locations": profile.preferences.preferred_locations,
            "remote_only": profile.preferences.remote_only,
            "salary_min": profile.preferences.salary_min,
            "salary_max": profile.preferences.salary_max,
        }
        listing_summary = {
            "company": listing.company,
            "title": listing.title,
            "location": listing.location,
            "salary_min": listing.salary_min,
            "salary_max": listing.salary_max,
            "currency": listing.salary_currency,
            "required_skills": listing.required_skills[:30],
            "technology_stack": listing.technology_stack[:30],
            "url": listing.url,
            "description_excerpt": (listing.description or "")[:2000],
        }
        match_summary = {
            "match_score": match.score,
            "matched_skills": match.matched_skills[:25],
            "missing_skills": match.missing_skills[:25],
            "breakdown": {
                "skill_overlap": match.breakdown.skill_overlap,
                "experience_fit": match.breakdown.experience_fit,
                "salary_fit": match.breakdown.salary_fit,
                "location_fit": match.breakdown.location_fit,
                "trajectory_fit": match.breakdown.trajectory_fit,
            },
        }

        resume_excerpt = (resume_text or "").strip()
        if resume_excerpt:
            resume_excerpt = resume_excerpt[:2000]

        system = (
            "You are a strict job-application decision engine. "
            "Use ONLY the provided profile, listing, match, and resume excerpt. "
            "Return ONLY a single valid JSON object. No markdown."
        )
        user = (
            "Decide whether the candidate should apply. Output JSON with these keys:\n"
            "- should_apply (bool)\n"
            "- score (number 0..1; overall attractiveness)\n"
            "- confidence (number 0..1)\n"
            "- decision_reason (string; 1 sentence)\n"
            "- strengths (array of 3-6 strings)\n"
            "- risks (array of 2-6 strings)\n"
            "- missing_skills (array of strings; prefer from match data)\n"
            "- recommended_customizations (array of 3-6 strings)\n"
            "- explanation (string; 2-4 sentences, concise, no chain-of-thought)\n"
            "- predicted_success_probability (number 0..1)\n"
            "- opportunity_score (number 0..1)\n\n"
            f"PROFILE:\n{profile_summary}\n\n"
            f"LISTING:\n{listing_summary}\n\n"
            f"MATCH:\n{match_summary}\n\n"
            f"RESUME_EXCERPT:\n{resume_excerpt}\n\n"
            f"MARKET_CONTEXT:\n{market_context}\n"
        )

        def _call_llm() -> dict[str, Any]:
            return self._llm.chat_json(
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                max_tokens=900,
                temperature=0.1,
            )

        payload = await asyncio.to_thread(_call_llm)
        return self._decision_from_llm_payload(
            payload=payload,
            profile=profile,
            listing=listing,
            match=match,
        )

    def _decision_from_llm_payload(
        self,
        *,
        payload: dict[str, Any],
        profile: CandidateProfile,
        listing: JobListing,
        match: MatchResult,
    ) -> ApplicationDecision:
        should_apply = bool(payload.get("should_apply"))
        score = _clamp01(payload.get("score", match.score))
        confidence = _clamp01(payload.get("confidence", (score + match.score) / 2.0))

        decision_reason = str(payload.get("decision_reason", "")).strip() or ("Apply" if should_apply else "Skip")

        strengths = _as_str_list(payload.get("strengths"), limit=6)
        risks = _as_str_list(payload.get("risks"), limit=8)

        missing_skills = _as_str_list(payload.get("missing_skills"), limit=25)
        if not missing_skills and match.missing_skills:
            missing_skills = list(match.missing_skills[:25])

        recommended_customizations = _as_str_list(payload.get("recommended_customizations"), limit=8)
        if not recommended_customizations:
            recommended_customizations = self._generate_customizations(
                profile=profile,
                listing=listing,
                match=match,
                critical_gaps=self._identify_critical_gaps(listing=listing, match=match),
            )

        explanation = str(payload.get("explanation", "")).strip()
        if not explanation:
            explanation = (
                f"Match={match.score:.2f}. Skill overlap={match.breakdown.skill_overlap:.2f}, "
                f"experience fit={match.breakdown.experience_fit:.2f}."
            )

        predicted_success_probability = _clamp01(payload.get("predicted_success_probability", score))
        opportunity_score = _clamp01(payload.get("opportunity_score", score))

        return ApplicationDecision(
            should_apply=should_apply,
            score=score,
            confidence=confidence,
            decision_reason=decision_reason,
            strengths=strengths,
            risks=risks,
            missing_skills=missing_skills,
            recommended_customizations=recommended_customizations,
            explanation=explanation,
            predicted_success_probability=predicted_success_probability,
            opportunity_score=opportunity_score,
            source="llm",
            raw=payload,
        )

    def _evaluate_with_heuristics(
        self,
        *,
        profile: CandidateProfile,
        listing: JobListing,
        match: MatchResult,
        market_context: dict[str, Any],
    ) -> ApplicationDecision:
        missing_critical = self._identify_critical_gaps(listing=listing, match=match)

        trajectory_score = match.breakdown.trajectory_fit
        salary_fit = match.breakdown.salary_fit
        market_competitiveness = float(market_context.get("market_competitiveness", 0.5))

        risks: list[str] = []
        if missing_critical:
            risks.append(f"Missing critical skills: {', '.join(missing_critical[:4])}")
        if salary_fit < 0.4:
            risks.append("Compensation fit is low")
        if trajectory_score < 0.4:
            risks.append("Career trajectory fit is weak")
        if market_competitiveness > 0.7 and match.score < 0.7:
            risks.append("Highly competitive market for this role")

        strengths = []
        if match.matched_skills:
            strengths.append(f"Matched skills: {', '.join(match.matched_skills[:4])}")
        if match.breakdown.experience_fit >= 0.8:
            strengths.append("Experience aligns with role expectations")

        should_apply = match.score >= 0.7 and not missing_critical
        score = max(0.0, min(1.0, match.score))
        confidence = max(0.4, min(0.85, score + 0.1))

        decision_reason = "Strong overall match" if should_apply else "Insufficient fit for priority application"

        recommended_customizations = self._generate_customizations(
            profile=profile,
            listing=listing,
            match=match,
            critical_gaps=missing_critical,
        )

        predicted_success_probability = max(0.2, min(0.85, score - (0.1 if missing_critical else 0)))

        return ApplicationDecision(
            should_apply=should_apply,
            score=score,
            confidence=confidence,
            decision_reason=decision_reason,
            strengths=strengths[:6],
            risks=risks[:6],
            missing_skills=list(match.missing_skills),
            recommended_customizations=recommended_customizations,
            explanation="Heuristic decision based on skill overlap, experience fit, and market competitiveness.",
            predicted_success_probability=predicted_success_probability,
            opportunity_score=score,
            source="heuristic_fallback",
        )

    @staticmethod
    def _identify_critical_gaps(listing: JobListing, match: MatchResult) -> list[str]:
        critical_keywords = {"security", "leadership", "kubernetes", "aws", "ml"}
        return [skill for skill in match.missing_skills if skill.lower() in critical_keywords]

    @staticmethod
    def _generate_customizations(
        *,
        profile: CandidateProfile,
        listing: JobListing,
        match: MatchResult,
        critical_gaps: list[str],
    ) -> list[str]:
        actions = []
        if critical_gaps:
            actions.append(f"Address critical gaps: {', '.join(critical_gaps[:3])}")
        if match.missing_skills:
            actions.append(f"Highlight transferable skills for {', '.join(match.missing_skills[:3])}")
        if listing.required_skills:
            actions.append(f"Emphasize experience with {', '.join(listing.required_skills[:4])}")
        if profile.projects:
            actions.append("Reference the most relevant project outcomes in the summary.")
        return actions[:6]


def _clamp01(value: Any) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except Exception:
        return 0.0


def _as_str_list(value: Any, *, limit: int = 6) -> list[str]:
    if not isinstance(value, list):
        return []
    cleaned = [str(item).strip() for item in value if str(item).strip()]
    return cleaned[:limit]
