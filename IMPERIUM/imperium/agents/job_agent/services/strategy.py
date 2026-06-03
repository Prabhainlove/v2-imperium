from __future__ import annotations

from dataclasses import dataclass, field
from time import monotonic
from typing import Any

from ..models import JobListing, MatchResult, StrategySnapshot, today_iso, utc_now_iso
from ..storage.database import JobAgentDatabase


@dataclass(slots=True)
class StrategyOptimizationResult:
    strategy: StrategySnapshot
    notes: list[str]


class StrategyOptimizationEngine:
    """Learns from outcomes and updates search/application strategy."""

    def optimize(
        self,
        *,
        current_strategy: StrategySnapshot,
        metrics: dict[str, Any],
        recent_matches: list[MatchResult],
    ) -> StrategyOptimizationResult:
        strategy = StrategySnapshot.from_dict(current_strategy.to_dict())
        notes: list[str] = []

        applications_sent = int(metrics.get("applications_sent", 0))
        interview_rate = float(metrics.get("interview_rate", 0.0))
        offer_rate = float(metrics.get("offer_rate", 0.0))
        rejections = int(metrics.get("rejections", 0))

        if applications_sent < 5:
            strategy.scan_interval_hours = max(2, strategy.scan_interval_hours - 1)
            strategy.min_match_threshold = max(0.55, strategy.min_match_threshold - 0.03)
            notes.append("Low application volume detected; widened targeting and increased scan frequency.")

        if applications_sent >= 10 and interview_rate < 0.1:
            strategy.min_match_threshold = min(0.9, strategy.min_match_threshold + 0.04)
            notes.append("Interview rate is low; raising match threshold to prioritize stronger fit roles.")

        if rejections >= 8 and interview_rate < 0.15:
            strategy.keyword_blacklist = self._merge_lists(
                strategy.keyword_blacklist,
                ["unrelated", "entry-level", "internship"],
            )
            notes.append("High rejection trend detected; tightened irrelevant keyword filtering.")

        if offer_rate > 0.05:
            strategy.min_match_threshold = min(0.95, strategy.min_match_threshold + 0.02)
            notes.append("Offer conversion improving; reinforcing high-confidence targeting.")

        boosted_keywords = self._derive_keyword_boost(recent_matches)
        if boosted_keywords:
            strategy.keyword_boost = self._merge_lists(strategy.keyword_boost, boosted_keywords[:6])
            notes.append("Updated keyword boost list from top-scoring matches.")

        if not notes:
            notes.append("No major strategy adjustment required this cycle.")

        strategy.last_optimized_at = utc_now_iso()
        return StrategyOptimizationResult(strategy=strategy, notes=notes)

    @staticmethod
    def _derive_keyword_boost(recent_matches: list[MatchResult]) -> list[str]:
        weighted: dict[str, float] = {}
        for match in recent_matches[:30]:
            for skill in match.matched_skills:
                key = skill.strip().lower()
                if not key:
                    continue
                weighted[key] = weighted.get(key, 0.0) + match.score

        ranked = sorted(weighted.items(), key=lambda item: item[1], reverse=True)
        return [item[0] for item in ranked[:10]]

    @staticmethod
    def _merge_lists(existing: list[str], incoming: list[str]) -> list[str]:
        seen = {item.lower(): item for item in existing}
        merged = list(existing)
        for value in incoming:
            key = value.strip().lower()
            if not key or key in seen:
                continue
            seen[key] = value
            merged.append(value)
        return merged


@dataclass(slots=True)
class SafetyDecision:
    allowed: bool
    reason: str
    requires_manual_review: bool = False


@dataclass(slots=True)
class JobSafetyConfig:
    default_daily_limit: int = 20
    per_source_rate_limit_seconds: int = 20
    manual_review_mode: bool = False


class JobSafetyController:
    """Guards against duplicate or excessive job applications."""

    def __init__(self, database: JobAgentDatabase, config: JobSafetyConfig | None = None) -> None:
        self.database = database
        self.config = config or JobSafetyConfig()
        self._last_source_touch: dict[str, float] = {}

    def evaluate_application(
        self,
        listing: JobListing,
        strategy: StrategySnapshot,
        task_options: dict[str, Any] | None = None,
    ) -> SafetyDecision:
        options = dict(task_options or {})

        manual_review = bool(options.get("manual_review", self.config.manual_review_mode))
        if manual_review:
            return SafetyDecision(
                allowed=True,
                reason="Manual review mode is enabled for this cycle.",
                requires_manual_review=True,
            )

        if self.database.application_exists_for_listing(listing.listing_id):
            return SafetyDecision(
                allowed=False,
                reason="Duplicate application detected for this listing.",
            )

        daily_limit = int(
            options.get(
                "daily_application_limit",
                strategy.daily_application_limit or self.config.default_daily_limit,
            )
        )
        applied_today = self.database.count_applications_for_day(today_iso())
        if applied_today >= max(1, daily_limit):
            return SafetyDecision(
                allowed=False,
                reason=f"Daily application limit reached ({applied_today}/{daily_limit}).",
            )

        source_key = listing.source.strip().lower()
        if source_key:
            now = monotonic()
            last_touched = self._last_source_touch.get(source_key)
            if (
                last_touched is not None
                and now - last_touched < self.config.per_source_rate_limit_seconds
            ):
                return SafetyDecision(
                    allowed=False,
                    reason=(
                        f"Rate limit active for source '{listing.source}'. "
                        "Waiting before next submission."
                    ),
                )
            self._last_source_touch[source_key] = now

        return SafetyDecision(
            allowed=True,
            reason="Safety checks passed.",
        )
