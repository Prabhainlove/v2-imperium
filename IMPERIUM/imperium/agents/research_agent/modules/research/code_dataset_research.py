"""
Code Research Pipeline - GitHub and Repository Search

Searches code repositories from:
- GitHub (via API)
- GitLab
- Bitbucket
- SourceForge
- Stack Overflow (code snippets)
"""

import asyncio
import logging
import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
import hashlib

logger = logging.getLogger(__name__)


@dataclass
class CodeRepository:
    """Code repository representation."""
    name: str
    full_name: str
    description: str
    url: str
    language: str
    stars: int
    forks: int
    last_updated: str
    source: str
    metadata: Dict[str, Any]


class CodeResearchPipeline:
    """
    Code research implementation.
    
    Searches code repositories and snippets.
    """
    
    def __init__(self):
        self.github_token = os.getenv("GITHUB_TOKEN")
        self.gitlab_token = os.getenv("GITLAB_TOKEN")
        
        self.results_cache: Dict[str, List[CodeRepository]] = {}
        self.max_results = 15
    
    async def search(
        self,
        query: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Search code repositories.
        
        Args:
            query: Search query
            context: Additional context
        
        Returns:
            List of code repositories
        """
        context = context or {}
        
        # Check cache
        cache_key = self._get_cache_key(query)
        if cache_key in self.results_cache:
            logger.info(f"Using cached code results for: {query[:50]}")
            return [self._repo_to_dict(r) for r in self.results_cache[cache_key]]
        
        # Execute searches
        search_tasks = [
            self._search_github(query),
            self._search_github_code(query),  # Also search code content
        ]
        
        if self.gitlab_token:
            search_tasks.append(self._search_gitlab(query))
        
        results = await asyncio.gather(*search_tasks, return_exceptions=True)
        
        # Combine results
        all_repos = []
        seen_urls = set()
        
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Code search failed: {result}")
                continue
            
            if isinstance(result, list):
                for repo in result:
                    if repo.url not in seen_urls:
                        seen_urls.add(repo.url)
                        all_repos.append(repo)
        
        # Sort by stars (popularity)
        all_repos.sort(key=lambda r: r.stars, reverse=True)
        
        # Cache results
        self.results_cache[cache_key] = all_repos[:self.max_results]
        
        return [self._repo_to_dict(r) for r in all_repos[:self.max_results]]
    
    async def _search_github(self, query: str) -> List[CodeRepository]:
        """Search GitHub repositories."""
        try:
            import aiohttp
            
            url = "https://api.github.com/search/repositories"
            params = {
                "q": query,
                "sort": "stars",
                "order": "desc",
                "per_page": 10,
            }
            
            headers = {"Accept": "application/vnd.github.v3+json"}
            if self.github_token:
                headers["Authorization"] = f"token {self.github_token}"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, headers=headers, timeout=15) as response:
                    if response.status == 200:
                        data = await response.json()
                        return self._parse_github_repos(data)
                    else:
                        logger.error(f"GitHub search failed: {response.status}")
                        return []
        
        except ImportError:
            logger.warning("aiohttp not installed")
            return []
        except Exception as e:
            logger.error(f"GitHub search error: {e}")
            return []
    
    async def _search_github_code(self, query: str) -> List[CodeRepository]:
        """Search GitHub code content."""
        try:
            import aiohttp
            
            url = "https://api.github.com/search/code"
            params = {
                "q": query,
                "sort": "indexed",
                "order": "desc",
                "per_page": 10,
            }
            
            headers = {"Accept": "application/vnd.github.v3+json"}
            if self.github_token:
                headers["Authorization"] = f"token {self.github_token}"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, headers=headers, timeout=15) as response:
                    if response.status == 200:
                        data = await response.json()
                        return self._parse_github_code(data)
                    elif response.status == 403:
                        logger.warning("GitHub code search requires authentication")
                        return []
                    else:
                        logger.error(f"GitHub code search failed: {response.status}")
                        return []
        
        except ImportError:
            return []
        except Exception as e:
            logger.error(f"GitHub code search error: {e}")
            return []
    
    async def _search_gitlab(self, query: str) -> List[CodeRepository]:
        """Search GitLab repositories."""
        try:
            import aiohttp
            
            url = "https://gitlab.com/api/v4/projects"
            params = {
                "search": query,
                "order_by": "stars_count",
                "sort": "desc",
                "per_page": 10,
            }
            
            headers = {}
            if self.gitlab_token:
                headers["PRIVATE-TOKEN"] = self.gitlab_token
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, headers=headers, timeout=15) as response:
                    if response.status == 200:
                        data = await response.json()
                        return self._parse_gitlab_results(data)
                    else:
                        return []
        
        except ImportError:
            return []
        except Exception as e:
            logger.error(f"GitLab search error: {e}")
            return []
    
    def _parse_github_repos(self, data: Dict[str, Any]) -> List[CodeRepository]:
        """Parse GitHub repository search results."""
        repos = []
        
        for item in data.get("items", []):
            repos.append(CodeRepository(
                name=item.get("name", ""),
                full_name=item.get("full_name", ""),
                description=item.get("description", "") or "",
                url=item.get("html_url", ""),
                language=item.get("language", "") or "Unknown",
                stars=item.get("stargazers_count", 0),
                forks=item.get("forks_count", 0),
                last_updated=item.get("updated_at", ""),
                source="github",
                metadata={
                    "owner": item.get("owner", {}).get("login", ""),
                    "topics": item.get("topics", []),
                    "license": item.get("license", {}).get("name") if item.get("license") else None,
                },
            ))
        
        return repos
    
    def _parse_github_code(self, data: Dict[str, Any]) -> List[CodeRepository]:
        """Parse GitHub code search results."""
        repos = []
        seen_repos = set()
        
        for item in data.get("items", []):
            repo_data = item.get("repository", {})
            repo_full_name = repo_data.get("full_name", "")
            
            if repo_full_name and repo_full_name not in seen_repos:
                seen_repos.add(repo_full_name)
                
                repos.append(CodeRepository(
                    name=repo_data.get("name", ""),
                    full_name=repo_full_name,
                    description=repo_data.get("description", "") or "",
                    url=repo_data.get("html_url", ""),
                    language=item.get("language", "") or "Unknown",
                    stars=repo_data.get("stargazers_count", 0),
                    forks=repo_data.get("forks_count", 0),
                    last_updated=repo_data.get("updated_at", ""),
                    source="github_code",
                    metadata={
                        "file_path": item.get("path", ""),
                        "file_url": item.get("html_url", ""),
                    },
                ))
        
        return repos
    
    def _parse_gitlab_results(self, data: List[Dict[str, Any]]) -> List[CodeRepository]:
        """Parse GitLab search results."""
        repos = []
        
        for item in data:
            repos.append(CodeRepository(
                name=item.get("name", ""),
                full_name=item.get("path_with_namespace", ""),
                description=item.get("description", "") or "",
                url=item.get("web_url", ""),
                language="Unknown",  # GitLab API doesn't provide primary language in search
                stars=item.get("star_count", 0),
                forks=item.get("forks_count", 0),
                last_updated=item.get("last_activity_at", ""),
                source="gitlab",
                metadata={
                    "namespace": item.get("namespace", {}).get("name", ""),
                    "visibility": item.get("visibility", ""),
                },
            ))
        
        return repos
    
    def _repo_to_dict(self, repo: CodeRepository) -> Dict[str, Any]:
        """Convert CodeRepository to dictionary."""
        return {
            "title": repo.full_name,
            "name": repo.name,
            "description": repo.description,
            "url": repo.url,
            "language": repo.language,
            "stars": repo.stars,
            "forks": repo.forks,
            "last_updated": repo.last_updated,
            "source": repo.source,
            "relevance_score": min(repo.stars / 1000, 1.0),  # Normalize stars
            "content_type": "code",
            "snippet": repo.description[:200] if repo.description else repo.name,
            "metadata": repo.metadata,
        }
    
    def _get_cache_key(self, query: str) -> str:
        """Generate cache key."""
        return hashlib.md5(query.lower().encode()).hexdigest()


class DatasetResearchPipeline:
    """
    Dataset research implementation.
    
    Searches for datasets from various sources.
    """
    
    def __init__(self):
        self.kaggle_username = os.getenv("KAGGLE_USERNAME")
        self.kaggle_key = os.getenv("KAGGLE_KEY")
        
        self.results_cache: Dict[str, List[Dict[str, Any]]] = {}
        self.max_results = 10
    
    async def search(
        self,
        query: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Search for datasets.
        
        Args:
            query: Search query
            context: Additional context
        
        Returns:
            List of datasets
        """
        context = context or {}
        
        # Check cache
        cache_key = self._get_cache_key(query)
        if cache_key in self.results_cache:
            logger.info(f"Using cached dataset results for: {query[:50]}")
            return self.results_cache[cache_key]
        
        # Execute searches
        search_tasks = [
            self._search_kaggle(query),
            self._search_huggingface(query),
            self._search_google_dataset(query),
        ]
        
        results = await asyncio.gather(*search_tasks, return_exceptions=True)
        
        # Combine results
        all_datasets = []
        seen_urls = set()
        
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Dataset search failed: {result}")
                continue
            
            if isinstance(result, list):
                for dataset in result:
                    url = dataset.get("url", "")
                    if url and url not in seen_urls:
                        seen_urls.add(url)
                        all_datasets.append(dataset)
        
        # Cache results
        self.results_cache[cache_key] = all_datasets[:self.max_results]
        
        return all_datasets[:self.max_results]
    
    async def _search_kaggle(self, query: str) -> List[Dict[str, Any]]:
        """Search Kaggle datasets."""
        try:
            import aiohttp
            
            url = "https://www.kaggle.com/api/v1/datasets/list"
            params = {
                "search": query,
                "sortBy": "hotness",
                "page": 1,
            }
            
            auth = None
            if self.kaggle_username and self.kaggle_key:
                auth = aiohttp.BasicAuth(self.kaggle_username, self.kaggle_key)
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, auth=auth, timeout=15) as response:
                    if response.status == 200:
                        data = await response.json()
                        return self._parse_kaggle_results(data)
                    else:
                        logger.warning(f"Kaggle search failed: {response.status}")
                        return []
        
        except ImportError:
            return []
        except Exception as e:
            logger.error(f"Kaggle search error: {e}")
            return []
    
    async def _search_huggingface(self, query: str) -> List[Dict[str, Any]]:
        """Search Hugging Face datasets."""
        try:
            import aiohttp
            
            url = "https://huggingface.co/api/datasets"
            params = {
                "search": query,
                "limit": 10,
                "sort": "downloads",
                "direction": -1,
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, timeout=15) as response:
                    if response.status == 200:
                        data = await response.json()
                        return self._parse_huggingface_results(data)
                    else:
                        return []
        
        except ImportError:
            return []
        except Exception as e:
            logger.error(f"Hugging Face search error: {e}")
            return []
    
    async def _search_google_dataset(self, query: str) -> List[Dict[str, Any]]:
        """Search Google Dataset Search (fallback to web results)."""
        # Google Dataset Search API is not publicly available
        # Returning empty list - would need to implement web scraping
        return []
    
    def _parse_kaggle_results(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Parse Kaggle dataset results."""
        datasets = []
        
        for item in data:
            datasets.append({
                "title": item.get("title", ""),
                "url": f"https://www.kaggle.com/{item.get('ref', '')}",
                "description": item.get("subtitle", ""),
                "source": "kaggle",
                "size": item.get("totalBytes", 0),
                "downloads": item.get("downloadCount", 0),
                "last_updated": item.get("lastUpdated", ""),
                "content_type": "dataset",
                "relevance_score": 0.8,
                "snippet": item.get("subtitle", "")[:200],
                "metadata": {
                    "owner": item.get("ownerName", ""),
                    "license": item.get("licenseName", ""),
                },
            })
        
        return datasets
    
    def _parse_huggingface_results(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Parse Hugging Face dataset results."""
        datasets = []
        
        for item in data:
            datasets.append({
                "title": item.get("id", ""),
                "url": f"https://huggingface.co/datasets/{item.get('id', '')}",
                "description": item.get("description", "") or "",
                "source": "huggingface",
                "downloads": item.get("downloads", 0),
                "last_updated": item.get("lastModified", ""),
                "content_type": "dataset",
                "relevance_score": 0.8,
                "snippet": (item.get("description", "") or "")[:200],
                "metadata": {
                    "author": item.get("author", ""),
                    "tags": item.get("tags", []),
                },
            })
        
        return datasets
    
    def _get_cache_key(self, query: str) -> str:
        """Generate cache key."""
        return hashlib.md5(query.lower().encode()).hexdigest()
