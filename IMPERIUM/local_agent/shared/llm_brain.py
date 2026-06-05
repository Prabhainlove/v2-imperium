"""
shared/llm_brain.py
===================

Purpose
-------
Thin client for a locally-running Ollama server. Provides three primitives
used by the rest of the agent:

- ``llm_available()`` — is the local model reachable?
- ``classify_page(snapshot)`` — what kind of page are we on?
- ``answer_question(question, profile, ...)`` — answer a form field.

If Ollama is not installed/running, every call silently falls back to
deterministic heuristics so the agent keeps working offline.

Inputs
------
- ``OLLAMA_URL`` (default http://127.0.0.1:11434)
- ``OLLAMA_MODEL`` (default qwen2.5:7b)
- DOM ``snapshot`` dict produced by ``automation/form_parser.page_snapshot``.

Outputs
-------
- A string label (one of ``PAGE_KINDS``) for ``classify_page``.
- A short string or ``None`` for ``answer_question``.

Responsibility
--------------
LLM I/O only. No Selenium, no state mutation.
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
    """Rule-first classifier. Hard URL/page-structure rules beat the LLM."""
    url = (snapshot.get("url") or "").lower()
    title = (snapshot.get("title") or "").lower()
    text = (snapshot.get("body_text") or "").lower()[:4000]
    dialog_text = (snapshot.get("dialog_text") or "").lower()[:3000]
    buttons = [b.lower() for b in snapshot.get("buttons", [])]
    has_dialog = bool(snapshot.get("has_dialog"))
    job_cards = int(snapshot.get("job_cards") or 0)

    if "checkpoint" in url or "captcha" in text or "verify you are human" in text:
        return "captcha"
    if "/uas/login" in url or "/login" in url or "sign in to linkedin" in text:
        return "login_wall"
    if any(s in text for s in (
        "application submitted", "your application was sent",
        "thanks for applying", "we received your application",
    )):
        return "success"

    if "linkedin.com" in url:
        modal_source = dialog_text if has_dialog else ""
        has_modal = bool(modal_source) and any(s in modal_source for s in (
            "submit application", "review your application",
            "save this application", "contact info",
        ))
        has_wizard_button = any(
            b in ("next", "review", "submit application", "continue to next step")
            or "continue to next step" in b
            or "review your application" in b
            or "submit application" in b
            for b in buttons
        )
        if has_modal and has_wizard_button:
            return "easy_apply_step"
        if "linkedin.com/jobs/view" in url:
            return "job_detail"

    is_linkedin_jobs_search = (
        "linkedin.com/jobs/search" in url
        or "linkedin.com/jobs/collections" in url
        or ("linkedin.com/jobs" in url and job_cards >= 2 and not has_dialog)
        or ("linkedin.com/jobs" in url
            and any(q in url for q in ("keywords=", "f_al=", "geoid=", "currentjobid=", "start="))
            and not has_dialog)
    )
    if is_linkedin_jobs_search:
        return "job_listing"

    host = url.split("/")[2] if "://" in url else url
    if any(d in host for d in (
        "greenhouse.io", "lever.co", "ashbyhq.com", "workday",
        "smartrecruiters.com", "icims.com", "bamboohr.com",
        "jobvite.com", "myworkdayjobs.com",
    )):
        return "external_form"

    if snapshot.get("input_count", 0) >= 2:
        return "external_form"

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
    """Answer a free-text or single-choice application question."""
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
            low = ans.lower()
            for c in choices:
                if c.lower() == low or c.lower() in low or low in c.lower():
                    return c
            return choices[0]
        return ans
    return _heuristic_answer(question, profile, choices)


def _heuristic_answer(q: str, profile: Dict[str, Any],
                      choices: Optional[List[str]]) -> Optional[str]:
    q = q.lower()
    if choices:
        neg = any(k in q for k in ("sponsor", "visa", "disabil", "felony", "convicted", "veteran"))
        for c in choices:
            cl = c.lower().strip()
            if not neg and cl in ("yes", "y", "true"):
                return c
            if neg and cl in ("no", "n", "false"):
                return c
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
