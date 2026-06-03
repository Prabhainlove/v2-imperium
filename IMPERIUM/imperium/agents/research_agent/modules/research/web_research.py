"""
Web Research Pipeline - Real Internet Search

Implements actual internet search using multiple search engines:
- Google Search (via API or scraping)
- Bing Search (via API)
- DuckDuckGo Search
- Brave Search
- SearXNG (meta-search)

Supports API keys via environment variables for production use.
"""

import asyncio
import logging
import os
import json
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from urllib.parse import quote_plus, urlparse
import hashlib

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    """Single search result."""
    title: str
    url: str
    snippet: str
    source: str  # Which search engine
    rank: int
    timestamp: str
    metadata: Dict[str, Any]


class WebResearchPipeline:
    """
    Real internet search implementation.
    
    Supports multiple search engines with fallback mechanisms.
    API keys loaded from environment variables.
    """
    
    def __init__(self):
        # API Keys (loaded from environment)
        self.google_api_key = os.getenv("GOOGLE_API_KEY")
        self.google_cx = os.getenv("GOOGLE_SEARCH_CX")
        self.bing_api_key = os.getenv("BING_SEARCH_KEY")
        self.brave_api_key = os.getenv("BRAVE_SEARCH_KEY")
        
        # Search engine availability
        self.engines = {
            "google": self.google_api_key and self.google_cx,
            "bing": self.bing_api_key is not None,
            "brave": self.brave_api_key is not None,
            "duckduckgo": True,  # No API key needed
        }
        
        self.results_cache: Dict[str, List[SearchResult]] = {}
        self.max_results_per_engine = 10
    
    async def search(
        self,
        query: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Search the internet using available search engines.
        
        Args:
            query: Search query
            context: Additional context
        
        Returns:
            List of search results as dictionaries
        """
        context = context or {}
        
        # Check cache
        cache_key = self._get_cache_key(query)
        if cache_key in self.results_cache:
            logger.info(f"Using cached results for: {query[:50]}")
            return [self._result_to_dict(r) for r in self.results_cache[cache_key]]
        
        # Execute searches across available engines
        search_tasks = []
        
        if self.engines["google"]:
            search_tasks.append(self._search_google(query))
        
        if self.engines["bing"]:
            search_tasks.append(self._search_bing(query))
        
        if self.engines["brave"]:
            search_tasks.append(self._search_brave(query))
        
        if self.engines["duckduckgo"]:
            search_tasks.append(self._search_duckduckgo(query))
        
        if not search_tasks:
            logger.warning("No search engines available, using fallback")
            return await self._fallback_search(query)
        
        # Execute searches in parallel
        results = await asyncio.gather(*search_tasks, return_exceptions=True)
        
        # Combine and deduplicate results
        all_results = []
        seen_urls = set()
        
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Search failed: {result}")
                continue
            
            if isinstance(result, list):
                for item in result:
                    if item.url not in seen_urls:
                        seen_urls.add(item.url)
                        all_results.append(item)
        
        # Sort by relevance (rank from each engine)
        all_results.sort(key=lambda x: x.rank)
        
        # Cache results
        self.results_cache[cache_key] = all_results[:50]
        
        # Convert to dictionaries
        return [self._result_to_dict(r) for r in all_results[:30]]
    
    async def _search_google(self, query: str) -> List[SearchResult]:
        """Search using Google Custom Search API."""
        if not (self.google_api_key and self.google_cx):
            return []
        
        try:
            import aiohttp
            
            url = "https://www.googleapis.com/customsearch/v1"
            params = {
                "key": self.google_api_key,
                "cx": self.google_cx,
                "q": query,
                "num": self.max_results_per_engine,
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        return self._parse_google_results(data)
                    else:
                        logger.error(f"Google search failed: {response.status}")
                        return []
        
        except ImportError:
            logger.warning("aiohttp not installed, skipping Google search")
            return []
        except Exception as e:
            logger.error(f"Google search error: {e}")
            return []
    
    async def _search_bing(self, query: str) -> List[SearchResult]:
        """Search using Bing Search API."""
        if not self.bing_api_key:
            return []
        
        try:
            import aiohttp
            
            url = "https://api.bing.microsoft.com/v7.0/search"
            headers = {"Ocp-Apim-Subscription-Key": self.bing_api_key}
            params = {"q": query, "count": self.max_results_per_engine}
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, params=params, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        return self._parse_bing_results(data)
                    else:
                        logger.error(f"Bing search failed: {response.status}")
                        return []
        
        except ImportError:
            logger.warning("aiohttp not installed, skipping Bing search")
            return []
        except Exception as e:
            logger.error(f"Bing search error: {e}")
            return []
    
    async def _search_brave(self, query: str) -> List[SearchResult]:
        """Search using Brave Search API."""
        if not self.brave_api_key:
            return []
        
        try:
            import aiohttp
            
            url = "https://api.search.brave.com/res/v1/web/search"
            headers = {
                "X-Subscription-Token": self.brave_api_key,
                "Accept": "application/json",
            }
            params = {"q": query, "count": self.max_results_per_engine}
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, params=params, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        return self._parse_brave_results(data)
                    else:
                        logger.error(f"Brave search failed: {response.status}")
                        return []
        
        except ImportError:
            logger.warning("aiohttp not installed, skipping Brave search")
            return []
        except Exception as e:
            logger.error(f"Brave search error: {e}")
            return []
    
    async def _search_duckduckgo(self, query: str) -> List[SearchResult]:
        """Search using DuckDuckGo (no API key needed)."""
        try:
            import aiohttp
            
            # DuckDuckGo instant answer API
            url = "https://api.duckduckgo.com/"
            params = {
                "q": query,
                "format": "json",
                "no_html": "1",
                "skip_disambig": "1",
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        return self._parse_duckduckgo_results(data, query)
                    else:
                        return []
        
        except ImportError:
            logger.warning("aiohttp not installed, using fallback")
            return []
        except Exception as e:
            logger.error(f"DuckDuckGo search error: {e}")
            return []
    
    def _parse_google_results(self, data: Dict[str, Any]) -> List[SearchResult]:
        """Parse Google Custom Search API response."""
        results = []
        items = data.get("items", [])
        
        for i, item in enumerate(items):
            results.append(SearchResult(
                title=item.get("title", ""),
                url=item.get("link", ""),
                snippet=item.get("snippet", ""),
                source="google",
                rank=i + 1,
                timestamp=self._get_timestamp(),
                metadata={"pagemap": item.get("pagemap", {})},
            ))
        
        return results
    
    def _parse_bing_results(self, data: Dict[str, Any]) -> List[SearchResult]:
        """Parse Bing Search API response."""
        results = []
        web_pages = data.get("webPages", {}).get("value", [])
        
        for i, item in enumerate(web_pages):
            results.append(SearchResult(
                title=item.get("name", ""),
                url=item.get("url", ""),
                snippet=item.get("snippet", ""),
                source="bing",
                rank=i + 1,
                timestamp=self._get_timestamp(),
                metadata={"dateLastCrawled": item.get("dateLastCrawled")},
            ))
        
        return results
    
    def _parse_brave_results(self, data: Dict[str, Any]) -> List[SearchResult]:
        """Parse Brave Search API response."""
        results = []
        web_results = data.get("web", {}).get("results", [])
        
        for i, item in enumerate(web_results):
            results.append(SearchResult(
                title=item.get("title", ""),
                url=item.get("url", ""),
                snippet=item.get("description", ""),
                source="brave",
                rank=i + 1,
                timestamp=self._get_timestamp(),
                metadata={"age": item.get("age")},
            ))
        
        return results
    
    def _parse_duckduckgo_results(self, data: Dict[str, Any], query: str) -> List[SearchResult]:
        """Parse DuckDuckGo API response."""
        results = []
        
        # Abstract (instant answer)
        if data.get("Abstract"):
            results.append(SearchResult(
                title=data.get("Heading", query),
                url=data.get("AbstractURL", ""),
                snippet=data.get("Abstract", ""),
                source="duckduckgo",
                rank=1,
                timestamp=self._get_timestamp(),
                metadata={"type": "abstract"},
            ))
        
        # Related topics
        for i, topic in enumerate(data.get("RelatedTopics", [])[:5]):
            if isinstance(topic, dict) and "FirstURL" in topic:
                results.append(SearchResult(
                    title=topic.get("Text", "")[:100],
                    url=topic.get("FirstURL", ""),
                    snippet=topic.get("Text", ""),
                    source="duckduckgo",
                    rank=i + 2,
                    timestamp=self._get_timestamp(),
                    metadata={"type": "related"},
                ))
        
        return results
    
    async def _fallback_search(self, query: str) -> List[Dict[str, Any]]:
        """Fallback search when no APIs available."""
        logger.warning("Using simulated search results (no API keys configured)")
        
        # Return simulated results that indicate API keys are needed
        return [
            {
                "title": f"Search result for: {query}",
                "url": "https://example.com/configure-api-keys",
                "snippet": "Configure search API keys (GOOGLE_API_KEY, BING_SEARCH_KEY, or BRAVE_SEARCH_KEY) to enable real internet search.",
                "source": "fallback",
                "rank": 1,
                "relevance_score": 0.5,
                "content_type": "web",
            }
        ]
    
    def _result_to_dict(self, result: SearchResult) -> Dict[str, Any]:
        """Convert SearchResult to dictionary."""
        return {
            "title": result.title,
            "url": result.url,
            "snippet": result.snippet,
            "source": result.source,
            "rank": result.rank,
            "timestamp": result.timestamp,
            "relevance_score": 1.0 / (result.rank + 1),  # Higher rank = higher score
            "content_type": "web",
            "metadata": result.metadata,
        }
    
    def _get_cache_key(self, query: str) -> str:
        """Generate cache key for query."""
        return hashlib.md5(query.lower().encode()).hexdigest()
    
    def _get_timestamp(self) -> str:
        """Get current timestamp."""
        from datetime import datetime, timezone
        return datetime.now(timezone.utc).isoformat()
