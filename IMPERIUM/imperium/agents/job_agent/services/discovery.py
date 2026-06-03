from __future__ import annotations

import asyncio
import json
import logging
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from ..models import CandidateProfile, JobSource, RawJobPosting, StrategySnapshot
from .gateway import ImperiumAgentGateway


logger = logging.getLogger(__name__)


@dataclass(slots=True)
class JobDiscoveryConfig:
    scan_interval_hours: int = 6
    max_results_per_source: int = 40
    max_total_results: int = 220
    use_real_search: bool = True
    default_sources: list[str] = field(
        default_factory=lambda: [
            JobSource.LINKEDIN.value,
            JobSource.INDEED.value,
            JobSource.GLASSDOOR.value,
            JobSource.WELLFOUND.value,
            JobSource.REMOTE_BOARD.value,
            JobSource.STARTUP_BOARD.value,
            JobSource.COMPANY_CAREER.value,
            JobSource.GOVERNMENT_PORTAL.value,
        ]
    )
    rss_feeds: list[str] = field(default_factory=list)


class RealJobSearchEngine:
    def __init__(self) -> None:
        self.user_agent = (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
        )
        import os

        self.adzuna_app_id = os.getenv("ADZUNA_APP_ID", "")
        self.adzuna_api_key = os.getenv("ADZUNA_API_KEY", "")
        self.rapidapi_key = os.getenv("RAPIDAPI_KEY") or os.getenv("JSEARCH_API_KEY", "")

    def search_jobs(self, *, role: str, location: str = "Remote", max_results: int = 30) -> list[dict[str, Any]]:
        role = role.strip() or "Software Engineer"
        location = location.strip() or "Remote"
        max_results = max(1, int(max_results))

        providers = [
            ("remoteok", lambda: self._search_remoteok(role, max_results)),
            ("remotive", lambda: self._search_remotive(role, max_results)),
            ("arbeitnow", lambda: self._search_arbeitnow(role, location, max_results)),
            ("hackernews", lambda: self._search_hackernews(role, max_results)),
            ("adzuna", lambda: self._search_adzuna(role, location, max_results)),
            ("jsearch", lambda: self._search_jsearch(role, location, max_results)),
        ]

        jobs: list[dict[str, Any]] = []
        for name, provider in providers:
            try:
                found = provider()
                logger.info("Job source %s returned %s postings", name, len(found))
                jobs.extend(found)
            except Exception as exc:
                logger.warning("Job source %s failed: %s", name, str(exc)[:120])

        unique = self._deduplicate(jobs)
        unique.sort(key=lambda item: (not bool(item.get("is_recent")), str(item.get("posted_date", ""))), reverse=False)
        return unique[:max_results]

    def _get_json(self, url: str, headers: dict[str, str] | None = None, timeout: int = 18) -> Any:
        request_headers = {
            "User-Agent": self.user_agent,
            "Accept": "application/json,text/plain,*/*",
            **(headers or {}),
        }
        request = urllib.request.Request(url, headers=request_headers)
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8", errors="ignore"))

    def _search_remoteok(self, role: str, max_results: int) -> list[dict[str, Any]]:
        query = urllib.parse.quote(role)
        data = self._get_json(f"https://remoteok.com/api?tags={query}")
        jobs = []
        for item in data if isinstance(data, list) else []:
            if not isinstance(item, dict) or not item.get("position"):
                continue
            tags = item.get("tags") or []
            description = " ".join(str(tag) for tag in tags)
            jobs.append(
                self._normalize(
                    title=item.get("position"),
                    company=item.get("company"),
                    location=item.get("location") or "Remote",
                    url=item.get("url") or f"https://remoteok.com/remote-jobs/{item.get('id', '')}",
                    description=description,
                    source="remoteok",
                    external_id=str(item.get("id") or uuid4()),
                    posted_date=item.get("date"),
                )
            )
            if len(jobs) >= max_results:
                break
        return jobs

    def _search_remotive(self, role: str, max_results: int) -> list[dict[str, Any]]:
        query = urllib.parse.quote(role)
        data = self._get_json(f"https://remotive.com/api/remote-jobs?search={query}")
        jobs = []
        for item in data.get("jobs", [])[:max_results]:
            jobs.append(
                self._normalize(
                    title=item.get("title"),
                    company=item.get("company_name"),
                    location=item.get("candidate_required_location") or "Remote",
                    url=item.get("url"),
                    description=self._strip_html(item.get("description", "")),
                    source="remotive",
                    external_id=str(item.get("id") or uuid4()),
                    posted_date=item.get("publication_date"),
                )
            )
        return jobs

    def _search_arbeitnow(self, role: str, location: str, max_results: int) -> list[dict[str, Any]]:
        import re

        data = self._get_json("https://www.arbeitnow.com/api/job-board-api")
        role_words = {word for word in re.split(r"\W+", role.lower()) if len(word) > 2}
        location_lower = location.lower()
        jobs = []

        for item in data.get("data", []):
            title = str(item.get("title", ""))
            description = self._strip_html(str(item.get("description", "")))
            text = f"{title} {description}".lower()
            if role_words and not any(word in text for word in role_words):
                continue
            item_location = str(item.get("location") or "Remote")
            if location_lower not in {"remote", "anywhere"} and location_lower not in item_location.lower():
                continue
            jobs.append(
                self._normalize(
                    title=title,
                    company=item.get("company_name"),
                    location=item_location,
                    url=item.get("url"),
                    description=description,
                    source="arbeitnow",
                    external_id=str(item.get("slug") or item.get("url") or uuid4()),
                    posted_date=self._unix_to_iso(item.get("created_at")),
                )
            )
            if len(jobs) >= max_results:
                break
        return jobs

    def _search_hackernews(self, role: str, max_results: int) -> list[dict[str, Any]]:
        import re

        story_data = self._get_json("https://hn.algolia.com/api/v1/search?query=who%20is%20hiring&tags=story")
        hits = story_data.get("hits") or []
        if not hits:
            return []

        thread_id = hits[0].get("objectID")
        if not thread_id:
            return []

        thread = self._get_json(f"https://hn.algolia.com/api/v1/items/{thread_id}")
        role_words = {word for word in re.split(r"\W+", role.lower()) if len(word) > 2}
        jobs = []
        for child in thread.get("children", []):
            text = self._strip_html(str(child.get("text") or ""))
            lower_text = text.lower()
            if role_words and not any(word in lower_text for word in role_words):
                continue
            company = text.splitlines()[0][:80] if text.splitlines() else "HN company"
            jobs.append(
                self._normalize(
                    title=role,
                    company=company,
                    location="See posting",
                    url=f"https://news.ycombinator.com/item?id={child.get('id')}",
                    description=text[:1600],
                    source="hackernews",
                    external_id=str(child.get("id") or uuid4()),
                    posted_date=child.get("created_at"),
                )
            )
            if len(jobs) >= max_results:
                break
        return jobs

    def _search_adzuna(self, role: str, location: str, max_results: int) -> list[dict[str, Any]]:
        if not (self.adzuna_app_id and self.adzuna_api_key):
            return []

        country = "us"
        location_lower = location.lower()
        if any(token in location_lower for token in ["india", "hyderabad", "bangalore", "mumbai", "delhi"]):
            country = "in"
        elif any(token in location_lower for token in ["uk", "london", "england"]):
            country = "gb"

        query = urllib.parse.urlencode(
            {
                "app_id": self.adzuna_app_id,
                "app_key": self.adzuna_api_key,
                "results_per_page": max_results,
                "what": role,
                "where": "" if location_lower == "remote" else location,
                "content-type": "application/json",
            }
        )
        data = self._get_json(f"https://api.adzuna.com/v1/api/jobs/{country}/search/1?{query}")
        jobs = []
        for item in data.get("results", []):
            jobs.append(
                self._normalize(
                    title=item.get("title"),
                    company=(item.get("company") or {}).get("display_name"),
                    location=(item.get("location") or {}).get("display_name") or location,
                    url=item.get("redirect_url"),
                    description=self._strip_html(item.get("description", "")),
                    source="adzuna",
                    external_id=str(item.get("id") or uuid4()),
                    posted_date=item.get("created"),
                    salary_min=item.get("salary_min"),
                    salary_max=item.get("salary_max"),
                )
            )
        return jobs

    def _search_jsearch(self, role: str, location: str, max_results: int) -> list[dict[str, Any]]:
        if not self.rapidapi_key:
            return []

        query = urllib.parse.quote(f"{role} {location}")
        headers = {
            "X-RapidAPI-Key": self.rapidapi_key,
            "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
        }
        data = self._get_json(
            f"https://jsearch.p.rapidapi.com/search?query={query}&num_pages=1&date_posted=all",
            headers=headers,
        )
        jobs = []
        for item in data.get("data", [])[:max_results]:
            jobs.append(
                self._normalize(
                    title=item.get("job_title"),
                    company=item.get("employer_name"),
                    location=item.get("job_city") or item.get("job_country") or location,
                    url=item.get("job_apply_link"),
                    description=item.get("job_description", ""),
                    source="jsearch",
                    external_id=str(item.get("job_id") or uuid4()),
                    posted_date=item.get("job_posted_at_datetime_utc"),
                    salary_min=item.get("job_min_salary"),
                    salary_max=item.get("job_max_salary"),
                )
            )
        return jobs

    @staticmethod
    def _normalize(
        *,
        title: Any,
        company: Any,
        location: Any,
        url: Any,
        description: Any,
        source: str,
        external_id: str,
        posted_date: Any = "",
        salary_min: Any = None,
        salary_max: Any = None,
    ) -> dict[str, Any]:
        posted = str(posted_date or "")
        return {
            "title": str(title or "Untitled role").strip(),
            "company": str(company or "Unknown company").strip(),
            "location": str(location or "Remote").strip(),
            "url": str(url or "").strip(),
            "description": str(description or "").strip(),
            "source": source,
            "external_id": str(external_id or uuid4()),
            "posted_date": posted,
            "salary_min": salary_min,
            "salary_max": salary_max,
            "is_recent": "202" in posted,
        }

    @staticmethod
    def _strip_html(text: str) -> str:
        import re
        from html import unescape

        cleaned = re.sub(r"<[^>]+>", " ", text or "")
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        return unescape(cleaned)

    @staticmethod
    def _unix_to_iso(value: Any) -> str:
        from datetime import datetime, timezone

        try:
            timestamp = int(value)
        except Exception:
            return ""
        return datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat()

    @staticmethod
    def _deduplicate(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        seen: set[str] = set()
        unique: list[dict[str, Any]] = []
        for item in items:
            key = f"{item.get('source')}::{item.get('external_id')}::{item.get('url')}"
            if key in seen:
                continue
            seen.add(key)
            unique.append(item)
        return unique


class JobDiscoveryEngine:
    """Continuously discovers jobs from multi-source internet channels."""

    def __init__(self, gateway: ImperiumAgentGateway, config: JobDiscoveryConfig | None = None) -> None:
        self.gateway = gateway
        self.config = config or JobDiscoveryConfig()
        self.real_search = RealJobSearchEngine()

    async def discover_jobs(
        self,
        *,
        profile: CandidateProfile,
        strategy: StrategySnapshot,
        task_id: str | None = None,
    ) -> list[RawJobPosting]:
        if self.config.use_real_search:
            return await self._discover_jobs_real(profile=profile, strategy=strategy, task_id=task_id)

        sources = strategy.preferred_sources or list(self.config.default_sources)
        queries = self._build_queries(profile, strategy)
        discovery_tasks: list[asyncio.Task[list[RawJobPosting]]] = []

        for source in sources:
            discovery_tasks.append(
                asyncio.create_task(
                    self._discover_from_source(
                        source=source,
                        queries=queries,
                        profile=profile,
                        task_id=task_id or str(uuid4()),
                    )
                )
            )

        if self.config.rss_feeds:
            discovery_tasks.append(asyncio.create_task(self._discover_from_rss()))

        discovered: list[RawJobPosting] = []
        for result in await asyncio.gather(*discovery_tasks, return_exceptions=True):
            if isinstance(result, Exception):
                continue
            discovered.extend(result)

        unique: list[RawJobPosting] = []
        seen: set[str] = set()
        for posting in discovered:
            key = f"{posting.source}:{posting.external_id}"
            if key in seen:
                continue
            seen.add(key)
            unique.append(posting)
            if len(unique) >= self.config.max_total_results:
                break

        return unique

    async def _discover_jobs_real(
        self,
        *,
        profile: CandidateProfile,
        strategy: StrategySnapshot,
        task_id: str | None = None,
    ) -> list[RawJobPosting]:
        target_roles = strategy.target_roles or profile.preferences.target_roles or ["Software Engineer"]
        locations = profile.preferences.preferred_locations or ["Remote"]

        all_jobs: list[dict[str, Any]] = []

        for role in target_roles[:3]:
            for location in locations[:2]:
                try:
                    jobs = await asyncio.to_thread(
                        self.real_search.search_jobs,
                        role=role,
                        location=location,
                        max_results=self.config.max_results_per_source // 2,
                    )
                    all_jobs.extend(jobs)
                except Exception as exc:
                    logger.warning("Real search failed for %s in %s: %s", role, location, exc)

        postings: list[RawJobPosting] = []
        seen: set[str] = set()

        for job in all_jobs:
            job_id = job.get("id", str(uuid4())[:12])
            source = job.get("source", "other")
            key = f"{source}:{job_id}"

            if key in seen:
                continue
            seen.add(key)

            postings.append(
                RawJobPosting(
                    source=source,
                    external_id=job_id,
                    url=job.get("url", ""),
                    payload={
                        "title": job.get("title", ""),
                        "company": job.get("company", ""),
                        "location": job.get("location", ""),
                        "description": job.get("description", ""),
                        "salary": f"${job.get('salary_min', 0)}-${job.get('salary_max', 0)}"
                        if job.get("salary_min")
                        else "",
                        "posted_at": "",
                        "raw": job,
                    },
                )
            )

            if len(postings) >= self.config.max_total_results:
                break

        logger.info("Found %s real jobs", len(postings))
        return postings

    async def _discover_from_source(
        self,
        *,
        source: str,
        queries: list[str],
        profile: CandidateProfile,
        task_id: str,
    ) -> list[RawJobPosting]:
        aggregated: list[RawJobPosting] = []
        for query in queries:
            context = {
                "task_id": task_id,
                "domain": "job_discovery",
                "source": source,
                "max_results": self.config.max_results_per_source,
                "candidate_name": profile.name,
                "target_roles": profile.preferences.target_roles,
                "locations": profile.preferences.preferred_locations,
            }
            result = await self.gateway.discover_jobs(query=query, context=context)
            if result.status != "completed":
                continue

            extracted = self._extract_from_agent_payload(
                source=source,
                payload=result.payload,
            )
            aggregated.extend(extracted)

            if len(aggregated) >= self.config.max_results_per_source:
                break

        return aggregated[: self.config.max_results_per_source]

    async def _discover_from_rss(self) -> list[RawJobPosting]:
        return await asyncio.to_thread(self._read_rss_feeds)

    def _read_rss_feeds(self) -> list[RawJobPosting]:
        postings: list[RawJobPosting] = []
        for feed_url in self.config.rss_feeds:
            try:
                with urllib.request.urlopen(feed_url, timeout=12) as response:
                    payload = response.read().decode("utf-8", errors="ignore")
            except Exception:
                continue

            try:
                root = ET.fromstring(payload)
            except ET.ParseError:
                continue

            for item in root.findall(".//item"):
                title = (item.findtext("title") or "").strip()
                link = (item.findtext("link") or "").strip()
                summary = (item.findtext("description") or "").strip()
                if not title and not link:
                    continue

                postings.append(
                    RawJobPosting(
                        source=JobSource.OTHER.value,
                        external_id="",
                        url=link,
                        payload={
                            "title": title,
                            "description": summary,
                            "company": "",
                            "location": "",
                            "raw_rss": True,
                            "source_feed": feed_url,
                        },
                    )
                )

        return postings

    def _build_queries(self, profile: CandidateProfile, strategy: StrategySnapshot) -> list[str]:
        role_seeds = strategy.target_roles or profile.preferences.target_roles or ["Software Engineer"]
        location_seeds = profile.preferences.preferred_locations or ["Remote"]

        query_candidates: list[str] = []
        for role in role_seeds[:4]:
            for location in location_seeds[:3]:
                base = f"{role} {location}"
                query_candidates.append(base.strip())
                for keyword in strategy.keyword_boost[:5]:
                    query_candidates.append(f"{base} {keyword}".strip())

        deduped: list[str] = []
        seen: set[str] = set()
        for query in query_candidates:
            normalized = query.lower().strip()
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            deduped.append(query)
        return deduped

    @staticmethod
    def _extract_from_agent_payload(source: str, payload: dict[str, Any]) -> list[RawJobPosting]:
        results: list[RawJobPosting] = []

        nodes = payload.get("results") or payload.get("jobs") or payload.get("listings")
        if isinstance(nodes, list):
            for node in nodes:
                if not isinstance(node, dict):
                    continue
                results.append(
                    RawJobPosting(
                        source=source,
                        external_id=str(node.get("id") or uuid4()),
                        url=str(node.get("url") or ""),
                        payload=node,
                    )
                )

        return results
