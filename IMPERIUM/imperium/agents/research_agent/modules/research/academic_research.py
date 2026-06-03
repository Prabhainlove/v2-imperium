"""
Academic Research Pipeline - Research Paper Search

Searches academic papers and scientific literature from:
- arXiv (physics, math, CS, etc.)
- PubMed (medical/biological)
- Semantic Scholar
- CrossRef
- Google Scholar (via API or scraping)
- CORE
"""

import asyncio
import logging
import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
import hashlib

logger = logging.getLogger(__name__)


@dataclass
class AcademicPaper:
    """Academic paper representation."""
    title: str
    authors: List[str]
    abstract: str
    url: str
    doi: Optional[str]
    publication_date: Optional[str]
    venue: Optional[str]  # Journal/Conference
    citations: int
    source: str  # Which database
    metadata: Dict[str, Any]


class AcademicResearchPipeline:
    """
    Academic research implementation.
    
    Searches multiple academic databases for research papers.
    """
    
    def __init__(self):
        # API keys (optional, many academic APIs are free)
        self.semantic_scholar_api_key = os.getenv("SEMANTIC_SCHOLAR_KEY")
        self.core_api_key = os.getenv("CORE_API_KEY")
        
        self.results_cache: Dict[str, List[AcademicPaper]] = {}
        self.max_results = 20
    
    async def search(
        self,
        query: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Search academic literature.
        
        Args:
            query: Search query
            context: Additional context
        
        Returns:
            List of academic papers
        """
        context = context or {}
        
        # Check cache
        cache_key = self._get_cache_key(query)
        if cache_key in self.results_cache:
            logger.info(f"Using cached academic results for: {query[:50]}")
            return [self._paper_to_dict(p) for p in self.results_cache[cache_key]]
        
        # Execute searches across academic databases
        search_tasks = [
            self._search_arxiv(query),
            self._search_semantic_scholar(query),
            self._search_pubmed(query),
            self._search_crossref(query),
        ]
        
        results = await asyncio.gather(*search_tasks, return_exceptions=True)
        
        # Combine results
        all_papers = []
        seen_titles = set()
        
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Academic search failed: {result}")
                continue
            
            if isinstance(result, list):
                for paper in result:
                    # Deduplicate by title
                    title_key = paper.title.lower()[:100]
                    if title_key not in seen_titles:
                        seen_titles.add(title_key)
                        all_papers.append(paper)
        
        # Sort by citations (more cited = more relevant)
        all_papers.sort(key=lambda p: p.citations, reverse=True)
        
        # Cache results
        self.results_cache[cache_key] = all_papers[:self.max_results]
        
        return [self._paper_to_dict(p) for p in all_papers[:self.max_results]]
    
    async def _search_arxiv(self, query: str) -> List[AcademicPaper]:
        """Search arXiv for papers."""
        try:
            import aiohttp
            from xml.etree import ElementTree as ET
            
            url = "http://export.arxiv.org/api/query"
            params = {
                "search_query": f"all:{query}",
                "start": 0,
                "max_results": 10,
                "sortBy": "relevance",
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, timeout=15) as response:
                    if response.status == 200:
                        xml_content = await response.text()
                        return self._parse_arxiv_results(xml_content)
                    else:
                        logger.error(f"arXiv search failed: {response.status}")
                        return []
        
        except ImportError:
            logger.warning("aiohttp not installed")
            return []
        except Exception as e:
            logger.error(f"arXiv search error: {e}")
            return []
    
    async def _search_semantic_scholar(self, query: str) -> List[AcademicPaper]:
        """Search Semantic Scholar."""
        try:
            import aiohttp
            
            url = "https://api.semanticscholar.org/graph/v1/paper/search"
            params = {
                "query": query,
                "limit": 10,
                "fields": "title,abstract,authors,url,citationCount,year,venue",
            }
            
            headers = {}
            if self.semantic_scholar_api_key:
                headers["x-api-key"] = self.semantic_scholar_api_key
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, headers=headers, timeout=15) as response:
                    if response.status == 200:
                        data = await response.json()
                        return self._parse_semantic_scholar_results(data)
                    else:
                        logger.error(f"Semantic Scholar failed: {response.status}")
                        return []
        
        except ImportError:
            return []
        except Exception as e:
            logger.error(f"Semantic Scholar error: {e}")
            return []
    
    async def _search_pubmed(self, query: str) -> List[AcademicPaper]:
        """Search PubMed for medical/biological papers."""
        try:
            import aiohttp
            from xml.etree import ElementTree as ET
            
            # Step 1: Search for IDs
            search_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
            search_params = {
                "db": "pubmed",
                "term": query,
                "retmax": 10,
                "retmode": "json",
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(search_url, params=search_params, timeout=15) as response:
                    if response.status == 200:
                        search_data = await response.json()
                        id_list = search_data.get("esearchresult", {}).get("idlist", [])
                        
                        if not id_list:
                            return []
                        
                        # Step 2: Fetch summaries
                        summary_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
                        summary_params = {
                            "db": "pubmed",
                            "id": ",".join(id_list),
                            "retmode": "json",
                        }
                        
                        async with session.get(summary_url, params=summary_params, timeout=15) as sum_response:
                            if sum_response.status == 200:
                                summary_data = await sum_response.json()
                                return self._parse_pubmed_results(summary_data)
                    
                    return []
        
        except ImportError:
            return []
        except Exception as e:
            logger.error(f"PubMed search error: {e}")
            return []
    
    async def _search_crossref(self, query: str) -> List[AcademicPaper]:
        """Search CrossRef for DOI-registered papers."""
        try:
            import aiohttp
            
            url = "https://api.crossref.org/works"
            params = {
                "query": query,
                "rows": 10,
                "sort": "relevance",
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, timeout=15) as response:
                    if response.status == 200:
                        data = await response.json()
                        return self._parse_crossref_results(data)
                    else:
                        return []
        
        except ImportError:
            return []
        except Exception as e:
            logger.error(f"CrossRef search error: {e}")
            return []
    
    def _parse_arxiv_results(self, xml_content: str) -> List[AcademicPaper]:
        """Parse arXiv XML response."""
        from xml.etree import ElementTree as ET
        
        papers = []
        try:
            root = ET.fromstring(xml_content)
            ns = {"atom": "http://www.w3.org/2005/Atom"}
            
            for entry in root.findall("atom:entry", ns):
                title = entry.find("atom:title", ns)
                summary = entry.find("atom:summary", ns)
                published = entry.find("atom:published", ns)
                link = entry.find("atom:id", ns)
                
                authors = []
                for author in entry.findall("atom:author", ns):
                    name = author.find("atom:name", ns)
                    if name is not None:
                        authors.append(name.text)
                
                if title is not None:
                    papers.append(AcademicPaper(
                        title=title.text.strip(),
                        authors=authors,
                        abstract=summary.text.strip() if summary is not None else "",
                        url=link.text if link is not None else "",
                        doi=None,
                        publication_date=published.text if published is not None else None,
                        venue="arXiv",
                        citations=0,  # arXiv doesn't provide citation count
                        source="arxiv",
                        metadata={},
                    ))
        
        except Exception as e:
            logger.error(f"Failed to parse arXiv results: {e}")
        
        return papers
    
    def _parse_semantic_scholar_results(self, data: Dict[str, Any]) -> List[AcademicPaper]:
        """Parse Semantic Scholar JSON response."""
        papers = []
        
        for item in data.get("data", []):
            authors = [a.get("name", "") for a in item.get("authors", [])]
            
            papers.append(AcademicPaper(
                title=item.get("title", ""),
                authors=authors,
                abstract=item.get("abstract", ""),
                url=item.get("url", ""),
                doi=None,
                publication_date=str(item.get("year", "")),
                venue=item.get("venue", ""),
                citations=item.get("citationCount", 0),
                source="semantic_scholar",
                metadata={"paperId": item.get("paperId")},
            ))
        
        return papers
    
    def _parse_pubmed_results(self, data: Dict[str, Any]) -> List[AcademicPaper]:
        """Parse PubMed JSON response."""
        papers = []
        result = data.get("result", {})
        
        for pmid, item in result.items():
            if pmid == "uids":
                continue
            
            authors = [a.get("name", "") for a in item.get("authors", [])]
            
            papers.append(AcademicPaper(
                title=item.get("title", ""),
                authors=authors,
                abstract="",  # Summary API doesn't include abstract
                url=f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                doi=item.get("elocationid", "").replace("doi: ", "") if "doi" in item.get("elocationid", "") else None,
                publication_date=item.get("pubdate", ""),
                venue=item.get("source", ""),
                citations=0,  # PubMed doesn't provide citation count in summary
                source="pubmed",
                metadata={"pmid": pmid},
            ))
        
        return papers
    
    def _parse_crossref_results(self, data: Dict[str, Any]) -> List[AcademicPaper]:
        """Parse CrossRef JSON response."""
        papers = []
        
        for item in data.get("message", {}).get("items", []):
            authors = []
            for author in item.get("author", []):
                given = author.get("given", "")
                family = author.get("family", "")
                authors.append(f"{given} {family}".strip())
            
            # Get publication date
            pub_date = None
            if "published-print" in item:
                date_parts = item["published-print"].get("date-parts", [[]])[0]
                if date_parts:
                    pub_date = "-".join(str(p) for p in date_parts)
            
            papers.append(AcademicPaper(
                title=item.get("title", [""])[0],
                authors=authors,
                abstract=item.get("abstract", ""),
                url=item.get("URL", ""),
                doi=item.get("DOI"),
                publication_date=pub_date,
                venue=item.get("container-title", [""])[0],
                citations=item.get("is-referenced-by-count", 0),
                source="crossref",
                metadata={"type": item.get("type")},
            ))
        
        return papers
    
    def _paper_to_dict(self, paper: AcademicPaper) -> Dict[str, Any]:
        """Convert AcademicPaper to dictionary."""
        return {
            "title": paper.title,
            "authors": paper.authors,
            "abstract": paper.abstract,
            "url": paper.url,
            "doi": paper.doi,
            "publication_date": paper.publication_date,
            "venue": paper.venue,
            "citations": paper.citations,
            "source": paper.source,
            "relevance_score": min(paper.citations / 100, 1.0),  # Normalize citations
            "content_type": "academic",
            "snippet": paper.abstract[:200] if paper.abstract else paper.title,
            "metadata": paper.metadata,
        }
    
    def _get_cache_key(self, query: str) -> str:
        """Generate cache key."""
        return hashlib.md5(query.lower().encode()).hexdigest()
