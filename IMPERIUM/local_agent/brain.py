"""
Local LLM brain for the Imperium agent.

Talks to a local Ollama server (default http://127.0.0.1:11434) using the
OpenAI-compatible /v1/chat/completions endpoint. If Ollama is not reachable
we silently fall back to heuristics so the agent still works.

Install once:
    https://ollama.com  -> `ollama pull qwen2.5:7b`  (or llama3.2:3b for low RAM)
"""
from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, List, Optional

try:
    import requests
except ImportError:  # noqa: BLE001
    requests = None  # type: ignore

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:7b")
LLM_TIMEOUT = float(os.environ.get("OLLAMA_TIMEOUT", "30"))


def llm_available() -> bool:
    if requests is None:
        return False
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=2)
        return r.ok
    except Exception:
        return False


def _chat(messages: List[Dict[str, str]], *, force_json: bool = False) -> Optional[str]:
    if requests is None:
        return None
    body: Dict[str, Any] = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": False,
        "options": {"temperature": 0.1},
    }
    if force_json:
        body["format"] = "json"
    try:
        r = requests.post(f"{OLLAMA_URL}/api/chat", json=body, timeout=LLM_TIMEOUT)
        if not r.ok:
            return None
        data = r.json()
        return (data.get("message") or {}).get("content") or ""
    except Exception:
        return None


def _parse_json(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


# -------------------- page classification --------------------

PAGE_KINDS = [
    "job_listing",       # search results, pick a card
    "job_detail",        # one job, has Apply / Easy Apply button
    "easy_apply_step",   # LinkedIn modal wizard step
    "external_form",     # generic application form (Greenhouse, Lever, etc.)
    "resume_upload",     # one-shot resume drop
    "success",           # submitted
    "captcha",
    "login_wall",
    "unknown",
]


def classify_page(snapshot: Dict[str, Any]) -> str:
    """Rule-first classifier. Falls back to LLM only when unsure."""
    url = (snapshot.get("url") or "").lower()
    title = (snapshot.get("title") or "").lower()
    text = (snapshot.get("body_text") or "").lower()[:4000]
    buttons = [b.lower() for b in snapshot.get("buttons", [])]

    if "checkpoint" in url or "captcha" in text or "verify you are human" in text:
        return "captcha"
    if "/uas/login" in url or "/login" in url or "sign in to linkedin" in text:
        return "login_wall"
    if "application submitted" in text or "your application was sent" in text \
       or "thanks for applying" in text or "we received your application" in text:
        return "success"

    # LinkedIn Easy Apply modal
    if any("easy apply" in b for b in buttons) and "linkedin.com" in url:
        if any(b in ("next", "review", "submit application", "continue") for b in buttons):
            return "easy_apply_step"
        return "job_detail"
    if "linkedin.com/jobs/search" in url or "linkedin.com/jobs/collections" in url:
        return "job_listing"
    if "linkedin.com/jobs/view" in url:
        return "job_detail"

    # External ATS
    host = url.split("/")[2] if "://" in url else url
    if any(d in host for d in ("greenhouse.io", "lever.co", "ashbyhq.com",
                                "workday", "smartrecruiters.com", "icims.com",
                                "bamboohr.com", "jobvite.com", "myworkdayjobs.com")):
        return "external_form"

    if snapshot.get("input_count", 0) >= 2:
        return "external_form"

    # Last resort: LLM
    out = _chat([
        {"role": "system", "content":
            "Classify the web page into exactly one label: " + ", ".join(PAGE_KINDS) +
            ". Return JSON: {\"kind\": \"...\"}."},
        {"role": "user", "content": json.dumps({
            "url": url, "title": title,
            "buttons": buttons[:20], "text": text[:1500],
        })},
    ], force_json=True)
    parsed = _parse_json(out or "")
    kind = (parsed or {}).get("kind", "unknown")
    return kind if kind in PAGE_KINDS else "unknown"


# -------------------- field answering --------------------

def answer_question(question: str, profile: Dict[str, Any],
                    job_context: str = "", choices: Optional[List[str]] = None) -> Optional[str]:
    """Answer a free-text or single-choice application question using the LLM."""
    if not llm_available():
        return _heuristic_answer(question, profile, choices)

    sys_prompt = (
        "You are filling out a job application on behalf of the candidate. "
        "Answer the question concisely and truthfully based on the candidate profile. "
        "If a list of CHOICES is given, return exactly one of them verbatim. "
        "Otherwise return a single short answer (max 2 sentences). "
        "Return JSON: {\"answer\": \"...\"}."
    )
    user = {
        "question": question,
        "candidate_profile": profile,
        "job_context": job_context[:1500],
        "choices": choices or [],
    }
    out = _chat(
        [{"role": "system", "content": sys_prompt},
         {"role": "user", "content": json.dumps(user)}],
        force_json=True,
    )
    parsed = _parse_json(out or "")
    if parsed and parsed.get("answer"):
        ans = str(parsed["answer"]).strip()
        if choices:
            # snap to closest choice
            low = ans.lower()
            for c in choices:
                if c.lower() == low or c.lower() in low or low in c.lower():
                    return c
            return choices[0]
        return ans
    return _heuristic_answer(question, profile, choices)


def _heuristic_answer(q: str, profile: Dict[str, Any], choices: Optional[List[str]]) -> Optional[str]:
    q = q.lower()
    if choices:
        # yes/no questions: prefer "Yes" unless about sponsorship / disability / felony
        neg = any(k in q for k in ("sponsor", "visa", "disabil", "felony", "convicted", "veteran"))
        for c in choices:
            cl = c.lower().strip()
            if not neg and cl in ("yes", "y", "true"): return c
            if neg and cl in ("no", "n", "false"): return c
        return choices[0]
    if "years" in q and "experience" in q:
        return "3"
    if "salary" in q or "compensation" in q:
        return "Negotiable"
    if "notice" in q or "start" in q:
        return "2 weeks"
    if "why" in q:
        return profile.get("summary") or "Excited about the role and a strong fit for my skills."
    return None
