"""
IMPERIUM — Production Backend API
FastAPI + Uvicorn | SQLite | Multi-Agent OS
"""
from __future__ import annotations

import asyncio
import logging
import os
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# ----------------------------------------------------------------
# Path bootstrap
# ----------------------------------------------------------------
IMPERIUM_ROOT = Path(__file__).resolve().parent / "imperium"
sys.path.insert(0, str(IMPERIUM_ROOT))

from core.kernel.imperium_kernel import ImperiumKernel  # noqa: E402
from core.common import AgentDescriptor  # noqa: E402

# ----------------------------------------------------------------
# Logging
# ----------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("imperium.api")

# ----------------------------------------------------------------
# App
# ----------------------------------------------------------------
app = FastAPI(
    title="IMPERIUM API",
    version="2.0.0",
    description="Production AI Job Application Platform",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ----------------------------------------------------------------
# CORS — tighten in production by setting IMPERIUM_ALLOWED_ORIGINS
# ----------------------------------------------------------------
_raw_origins = os.getenv("IMPERIUM_ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS: list[str] = (
    [o.strip() for o in _raw_origins.split(",") if o.strip()]
    if _raw_origins
    else [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# ----------------------------------------------------------------
# Static assets (built frontend)
# ----------------------------------------------------------------
_frontend_dist = IMPERIUM_ROOT / "frontend" / "dist"
if (_frontend_dist / "assets").exists():
    app.mount(
        "/assets",
        StaticFiles(directory=str(_frontend_dist / "assets")),
        name="frontend-assets",
    )

# ----------------------------------------------------------------
# Global state
# ----------------------------------------------------------------
kernel: ImperiumKernel | None = None
task_results: dict[str, dict[str, Any]] = {}


# ----------------------------------------------------------------
# Pydantic models
# ----------------------------------------------------------------

class TaskRequest(BaseModel):
    task: str = Field(..., min_length=1, description="Task description")
    priority: int = Field(default=3, ge=1, le=5)
    requested_agents: list[str] = Field(default_factory=list)


class TaskResponse(BaseModel):
    task_id: str
    status: str
    message: str


class StatusResponse(BaseModel):
    task_id: str
    status: str
    result: dict[str, Any] | None = None


class AgentInfo(BaseModel):
    name: str
    capabilities: list[str]
    skills: list[str]
    status: str


class HealthResponse(BaseModel):
    status: str
    kernel_running: bool
    agents_count: int
    version: str


class ProfileUpdateRequest(BaseModel):
    name: str = Field(default="Candidate")
    email: str = Field(default="candidate@example.com")
    phone: str = Field(default="")
    location: str = Field(default="")
    skills: list[str] = Field(default_factory=list)
    linkedin_profile: str = Field(default="")
    github_repositories: list[str] = Field(default_factory=list)
    target_roles: list[str] = Field(default_factory=list)
    preferred_locations: list[str] = Field(default_factory=list)
    remote_only: bool = Field(default=False)
    salary_min: float | None = None
    salary_max: float | None = None


# ----------------------------------------------------------------
# Error handler — always return JSON
# ----------------------------------------------------------------

@app.exception_handler(Exception)
async def global_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled exception: %s %s — %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)},
    )


# ----------------------------------------------------------------
# Lifecycle
# ----------------------------------------------------------------

@app.on_event("startup")
async def startup_event() -> None:
    global kernel
    logger.info("IMPERIUM API starting up …")
    try:
        kernel = ImperiumKernel(workspace_root=IMPERIUM_ROOT)
        result = kernel.start()
        logger.info("Kernel ready: %s | agents: %d", result["status"], len(kernel.list_agents()))
    except Exception as exc:
        logger.error("Kernel start failed: %s", exc, exc_info=True)
        raise


@app.on_event("shutdown")
async def shutdown_event() -> None:
    global kernel
    if kernel:
        logger.info("Shutting down kernel …")
        kernel.shutdown()


# ----------------------------------------------------------------
# Root — serve built frontend or friendly HTML
# ----------------------------------------------------------------

@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def root() -> HTMLResponse:
    dist_index = _frontend_dist / "index.html"
    if dist_index.exists():
        return HTMLResponse(content=dist_index.read_text(encoding="utf-8"))
    return HTMLResponse(content=_fallback_html())


# ----------------------------------------------------------------
# Health
# ----------------------------------------------------------------

@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check() -> HealthResponse:
    if not kernel:
        raise HTTPException(status_code=503, detail="Kernel not initialized")
    return HealthResponse(
        status="healthy",
        kernel_running=kernel._started,
        agents_count=len(kernel.list_agents()),
        version="2.0.0",
    )


# ----------------------------------------------------------------
# Agents
# ----------------------------------------------------------------

@app.get("/agents", response_model=list[AgentInfo], tags=["System"])
async def list_agents() -> list[AgentInfo]:
    if not kernel:
        raise HTTPException(status_code=503, detail="Kernel not initialized")
    return [
        AgentInfo(
            name=a.name,
            capabilities=a.capabilities,
            skills=a.skills,
            status=a.status,
        )
        for a in kernel.list_agents()
    ]


# ----------------------------------------------------------------
# System snapshot
# ----------------------------------------------------------------

@app.get("/snapshot", tags=["System"])
async def get_system_snapshot() -> dict[str, Any]:
    if not kernel:
        raise HTTPException(status_code=503, detail="Kernel not initialized")
    return kernel.snapshot()


# ----------------------------------------------------------------
# General task execution
# ----------------------------------------------------------------

@app.post("/task", response_model=TaskResponse, tags=["Tasks"])
async def create_task(request: TaskRequest) -> TaskResponse:
    if not kernel:
        raise HTTPException(status_code=503, detail="Kernel not initialized")

    task_id = str(uuid4())
    logger.info("Task accepted [%s]: %s", task_id, request.task[:80])

    asyncio.create_task(
        _execute_task_async(task_id, {
            "task_id": task_id,
            "query": request.task,
            "description": request.task,
            "priority": request.priority,
            "requested_agents": request.requested_agents,
        })
    )

    return TaskResponse(task_id=task_id, status="accepted", message="Task queued for execution")


@app.get("/status/{task_id}", response_model=StatusResponse, tags=["Tasks"])
async def get_task_status(task_id: str) -> StatusResponse:
    if not kernel:
        raise HTTPException(status_code=503, detail="Kernel not initialized")

    if task_id not in task_results:
        return StatusResponse(task_id=task_id, status="pending", result=None)

    result = task_results[task_id]
    raw = str(result.get("task_status", result.get("status", "unknown"))).lower()
    status = {"success": "completed", "completed": "completed", "failure": "failed",
              "failed": "failed", "error": "failed"}.get(raw, raw)
    return StatusResponse(task_id=task_id, status=status, result=result)


async def _execute_task_async(task_id: str, task_dict: dict[str, Any]) -> None:
    try:
        import concurrent.futures
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            result = await loop.run_in_executor(pool, kernel.execute_task, task_dict)
        task_results[task_id] = result
        logger.info("Task [%s] finished: %s", task_id, result.get("status"))
    except Exception as exc:
        logger.error("Task [%s] failed: %s", task_id, exc, exc_info=True)
        task_results[task_id] = {"status": "failure", "error": str(exc), "task_id": task_id}


# ----------------------------------------------------------------
# Job Agent — Profile
# ----------------------------------------------------------------

@app.get("/api/job-agent/profile", tags=["Job Agent"])
async def get_profile() -> dict[str, Any]:
    """Load the most recent candidate profile from the database."""
    db = _job_db()
    profile = db.load_latest_candidate_profile()
    if profile is None:
        return {"status": "not_found", "profile": None, "profile_health": None}

    health = db.load_profile_health(profile.profile_id) or _compute_and_cache_health(db, profile)
    return {"status": "ok", "profile": profile.to_dict(), "profile_health": health}


@app.post("/api/job-agent/profile", tags=["Job Agent"])
async def save_profile(request: ProfileUpdateRequest) -> dict[str, Any]:
    """Save / update the candidate profile."""
    from agents.job_agent.services.profile import CandidateProfileManager

    db = _job_db()
    pm = CandidateProfileManager(db)

    payload: dict[str, Any] = {
        "name": request.name,
        "contact": {
            "email": request.email,
            "phone": request.phone,
            "location": request.location,
        },
        "skills": request.skills,
        "linkedin_profile": request.linkedin_profile,
        "github_repositories": request.github_repositories,
        "preferences": {
            "target_roles": request.target_roles,
            "preferred_locations": request.preferred_locations,
            "remote_only": request.remote_only,
            "salary_min": request.salary_min,
            "salary_max": request.salary_max,
        },
    }

    existing = db.load_latest_candidate_profile()
    if existing:
        payload["profile_id"] = existing.profile_id

    try:
        profile = pm.build_and_save(payload)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    health = _compute_and_cache_health(db, profile)
    return {"status": "saved", "profile": profile.to_dict(), "profile_health": health}


# ----------------------------------------------------------------
# Job Agent — Dashboard
# ----------------------------------------------------------------

@app.get("/api/job-agent/dashboard", tags=["Job Agent"])
async def get_job_agent_dashboard() -> dict[str, Any]:
    db = _job_db()
    metrics = db.get_application_metrics()
    recent_apps = [
        {
            "application_id": a.application_id,
            "company": a.company,
            "job_title": a.job_title,
            "date_applied": a.date_applied,
            "status": a.status,
            "match_score": a.match_score,
            "resume_path": a.resume_path,
            "cover_letter_path": a.cover_letter_path,
            "last_updated": a.last_updated,
        }
        for a in db.list_applications(limit=20)
    ]
    strategy_snapshot, strategy_metrics = db.load_latest_strategy_snapshot()
    notifications = db.list_recent_notifications(limit=10)
    activity = db.recent_activity(limit=30)

    return {
        "status": "ok",
        "metrics": metrics,
        "recent_applications": recent_apps,
        "strategy": strategy_snapshot.to_dict() if strategy_snapshot else None,
        "strategy_metrics": strategy_metrics,
        "notifications": notifications,
        "activity": activity,
        "timestamp": _utc_now(),
    }


# ----------------------------------------------------------------
# Job Agent — Applications
# ----------------------------------------------------------------

@app.get("/api/job-agent/applications", tags=["Job Agent"])
async def get_applications(
    status: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
) -> list[dict[str, Any]]:
    db = _job_db()
    apps = db.list_applications(status=status, limit=limit)
    return [
        {
            "application_id": a.application_id,
            "listing_id": a.listing_id,
            "company": a.company,
            "job_title": a.job_title,
            "date_applied": a.date_applied,
            "status": a.status,
            "match_score": a.match_score,
            "resume_path": a.resume_path,
            "cover_letter_path": a.cover_letter_path,
            "last_updated": a.last_updated,
            "notes": a.notes,
        }
        for a in apps
    ]


# ----------------------------------------------------------------
# Job Agent — Jobs (discovered listings)
# ----------------------------------------------------------------

@app.get("/api/job-agent/jobs", tags=["Job Agent"])
async def get_job_listings(
    limit: int = Query(default=200, ge=1, le=1000),
) -> list[dict[str, Any]]:
    db = _job_db()
    jobs = db.list_recent_job_listings(limit=limit)
    return [
        {
            "listing_id": j.listing_id,
            "source": j.source,
            "url": j.url,
            "title": j.title,
            "company": j.company,
            "location": j.location,
            "salary_min": j.salary_min,
            "salary_max": j.salary_max,
            "salary_currency": j.salary_currency,
            "required_skills": j.required_skills,
            "experience_years": j.experience_years,
            "technology_stack": j.technology_stack,
            "discovered_at": j.discovered_at,
            "posted_at": j.posted_at,
        }
        for j in jobs
    ]


# ----------------------------------------------------------------
# Job Agent — Activity Feed
# ----------------------------------------------------------------

@app.get("/api/job-agent/activity", tags=["Job Agent"])
async def get_activity(
    limit: int = Query(default=50, ge=1, le=500),
    task_id: str | None = Query(default=None),
) -> list[dict[str, Any]]:
    db = _job_db()
    return db.recent_activity(limit=limit, task_id=task_id)


# ----------------------------------------------------------------
# Job Agent — Notifications
# ----------------------------------------------------------------

@app.get("/api/job-agent/notifications", tags=["Job Agent"])
async def get_notifications(
    limit: int = Query(default=50, ge=1, le=200),
) -> list[dict[str, Any]]:
    return _job_db().list_recent_notifications(limit=limit)


@app.post("/api/job-agent/notifications/{notification_id}/read", tags=["Job Agent"])
async def mark_notification_read(notification_id: str) -> dict[str, Any]:
    _job_db().mark_notification_read(notification_id)
    return {"status": "ok"}


# ----------------------------------------------------------------
# Job Agent — Artifact download (secure)
# ----------------------------------------------------------------

@app.get("/api/job-agent/artifact", tags=["Job Agent"])
async def get_artifact(path: str) -> FileResponse:
    artifacts_dir = IMPERIUM_ROOT / "agents" / "job_agent" / "data" / "artifacts"

    # Reject absolute paths from query params — always resolve relative to artifacts_dir
    requested = Path(path)
    if requested.is_absolute():
        raise HTTPException(status_code=400, detail="Absolute paths not accepted")

    file_path = (artifacts_dir / requested).resolve()

    if not file_path.is_relative_to(artifacts_dir.resolve()):
        raise HTTPException(status_code=403, detail="Access denied")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Artifact not found")

    media_type = "application/pdf" if file_path.suffix == ".pdf" else "text/plain"
    return FileResponse(path=str(file_path), media_type=media_type, filename=file_path.name)


# ----------------------------------------------------------------
# Job Agent — Search  (core endpoint)
# ----------------------------------------------------------------

@app.post("/api/job-agent/search", tags=["Job Agent"])
async def job_agent_search(
    role: str | None = Form(None),
    query: str | None = Form(None),
    location: str = Form("Remote"),
    resume: UploadFile | None = File(None),
    template: str = Form("modern"),
    name: str = Form("Candidate"),
    email: str = Form("candidate@example.com"),
    phone: str = Form(""),
    skills: str = Form(""),
    experience: str = Form(""),
    company: str = Form(""),
    application_mode: str = Form("manual"),
    max_applications: int = Form(8),
    max_results: int = Form(20),
    auto_apply: str = Form("false"),
    min_match_threshold: float = Form(0.35),
) -> dict[str, Any]:
    """
    Core endpoint: search for jobs and build application packages.

    - Accepts `role` or `query` for the target job title (frontend compatibility).
    - Resume upload is optional; profile fields are used as fallback.
    - Application mode defaults to 'manual' (safe — no real submission).
    - Returns matches with links to generated resume + cover letter.
    """
    if not kernel:
        raise HTTPException(status_code=503, detail="Kernel not initialized")

    # Accept `query` as alias for `role`
    role = (role or query or "").strip()
    if not role:
        raise HTTPException(status_code=422, detail="Field 'role' (or 'query') is required")

    temp_dir: Path | None = None
    # URL-safe task_id (no ':', '+' characters that break query-string round-trip)
    task_id = f"web-search-{uuid4().hex[:12]}"

    # Log activity start
    db = _job_db()
    db.log_activity(task_id=task_id, agent="JobAgent", action="search_started",
                    detail=f"role={role} location={location}")

    try:
        profile_data: dict[str, Any]

        # --- Build profile from resume file or form fields ---
        if resume is not None and resume.filename:
            temp_dir = Path(tempfile.mkdtemp())
            safe_name = Path(resume.filename).name
            resume_path = temp_dir / safe_name
            with resume_path.open("wb") as buf:
                shutil.copyfileobj(resume.file, buf)

            from agents.job_agent.services.profile import parse_resume
            profile_data = parse_resume(resume_path)
            db.log_activity(task_id=task_id, agent="JobAgent", action="resume_parsed",
                            detail=f"file={safe_name}")
        else:
            skill_list = _parse_skills(skills)
            profile_data = {
                "name": name.strip() or "Candidate",
                "contact": {
                    "email": email.strip() or "candidate@example.com",
                    "phone": phone.strip(),
                    "location": location.strip(),
                },
                "skills": skill_list or [role],
                "work_experience": [
                    {
                        "title": experience.strip() or role,
                        "company": company.strip() or "Current Company",
                        "years_experience": 1,
                        "achievements": [],
                        "technologies": skill_list[:8],
                    }
                ],
                "education": [],
                "projects": [],
                "certifications": [],
            }

        # --- Merge / override from form fields ---
        profile_data["name"] = str(profile_data.get("name") or name or "Candidate").strip()
        profile_data.setdefault("contact", {})
        profile_data["contact"]["email"] = str(
            profile_data["contact"].get("email") or email or "candidate@example.com"
        ).strip()
        profile_data["contact"]["phone"] = str(
            profile_data["contact"].get("phone") or phone or ""
        ).strip()
        profile_data["contact"]["location"] = str(
            profile_data["contact"].get("location") or location or ""
        ).strip()

        if not profile_data.get("skills"):
            profile_data["skills"] = _parse_skills(skills) or [role]

        if not profile_data.get("work_experience"):
            sl = list(profile_data.get("skills", []))
            profile_data["work_experience"] = [
                {
                    "title": experience.strip() or role,
                    "company": company.strip() or "Current Company",
                    "years_experience": 1,
                    "achievements": [],
                    "technologies": sl[:8],
                }
            ]

        profile_data["preferences"] = {
            "target_roles": [role],
            "preferred_locations": [location],
            "resume_template": template,
        }

        # --- Run the job agent ---
        db.log_activity(task_id=task_id, agent="JobAgent", action="discovery_started",
                        detail=f"mode={application_mode} max={max_applications}")

        from agents.job_agent.job_agent import JobAgent

        job_agent = JobAgent(workspace_root=IMPERIUM_ROOT)
        result = await job_agent.execute({
            "task_id": task_id,
            "command": "run_cycle",
            "candidate_profile": profile_data,
            "auto_apply": False,
            "manual_review": True,
            "application_mode": application_mode,
            "max_applications_per_cycle": max(1, min(int(max_applications), 20)),
        })

        if result.get("status") != "success":
            error_msg = result.get("error", "Job agent failed")
            logger.error("Job search failed [%s]: %s", task_id, error_msg)
            db.log_activity(task_id=task_id, agent="JobAgent", action="search_failed",
                            status="error", detail=error_msg[:500])
            return {
                "status": "error",
                "task_id": task_id,
                "error": error_msg,
                "summary": {},
                "matches": [],
            }

        # --- Build response ---
        summary = result.get("cycle_summary", {})
        applications = result.get("applications", [])
        apps_by_listing = {a.get("listing_id"): a for a in applications if a.get("listing_id")}

        matches = []
        for m in result.get("matches", [])[:40]:
            app = apps_by_listing.get(m.get("listing_id"))
            submission = app.get("submission", {}) if app else {}

            # Normalize artifact paths to relative (safe for download URLs)
            resume_path_raw = app.get("resume_path") if app else None
            cover_path_raw = app.get("cover_letter_path") if app else None

            matches.append({
                "listing_id": m.get("listing_id"),
                "title": m.get("job_title", ""),
                "company": m.get("company", ""),
                "location": m.get("location", ""),
                "source": m.get("source", "unknown"),
                "url": m.get("url", ""),
                "match_score": round(float(m.get("score", 0)), 4),
                "is_recent": bool(m.get("is_recent")),
                "matched_skills": list(m.get("matched_skills", [])),
                "missing_skills": list(m.get("missing_skills", [])),
                "resume_path": _safe_artifact_path(resume_path_raw),
                "cover_letter_path": _safe_artifact_path(cover_path_raw),
                "submission_status": submission.get("status"),
                "submitted": bool(submission.get("submitted")),
            })

        real_submissions = sum(
            1 for a in applications if a.get("submission", {}).get("submitted")
        )

        db.log_activity(
            task_id=task_id,
            agent="JobAgent",
            action="search_complete",
            detail=(
                f"found={summary.get('parsed_listings', 0)} "
                f"qualified={summary.get('qualified_matches', 0)} "
                f"packages={summary.get('applications_attempted', 0)}"
            ),
        )

        return {
            "status": "success",
            "task_id": task_id,
            "mode": "manual-safe",
            "message": "Jobs found; application packages prepared for manual review.",
            "profile_health": result.get("profile", {}).get("completeness"),
            "summary": {
                "jobs_found": summary.get("parsed_listings", 0),
                "qualified_matches": summary.get("qualified_matches", 0),
                "application_packages": summary.get("applications_attempted", 0),
                "real_submissions": real_submissions,
                "skipped": summary.get("skipped", 0),
                "duration_seconds": round(float(result.get("duration_seconds", 0)), 2),
            },
            "matches": matches,
            "skipped": result.get("skipped", [])[:20],
            "reflection": result.get("reflection"),
        }

    except Exception as exc:
        logger.error("Job search failed [%s]: %s", task_id, exc, exc_info=True)
        db.log_activity(task_id=task_id, agent="JobAgent", action="search_exception",
                        status="error", detail=str(exc)[:500])
        return {
            "status": "error",
            "task_id": task_id,
            "error": str(exc),
            "summary": {},
            "matches": [],
        }
    finally:
        if temp_dir is not None:
            shutil.rmtree(temp_dir, ignore_errors=True)


# ----------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------

def _job_db():
    """Return a fresh JobAgentDatabase pointing at the standard path."""
    from agents.job_agent.storage.database import JobAgentDatabase

    db_path = (
        Path(os.getenv("IMPERIUM_JOB_AGENT_DB", ""))
        if os.getenv("IMPERIUM_JOB_AGENT_DB")
        else IMPERIUM_ROOT / "agents" / "job_agent" / "data" / "job_agent.db"
    )
    db = JobAgentDatabase(db_path=db_path)
    db.initialize()
    return db


def _compute_and_cache_health(db: Any, profile: Any) -> dict[str, Any]:
    from agents.job_agent.services.profile import CandidateProfileManager

    pm = CandidateProfileManager(db)
    health = pm.profile_completeness(profile)
    db.save_profile_health(
        profile.profile_id,
        health["score"],
        health.get("missing", []),
    )
    return health


def _parse_skills(raw: str) -> list[str]:
    return [s.strip() for s in raw.replace("\n", ",").split(",") if s.strip()]


def _safe_artifact_path(path: str | None) -> str | None:
    """Convert absolute artifact path to a relative path safe for URL encoding."""
    if not path:
        return None
    artifacts_dir = IMPERIUM_ROOT / "agents" / "job_agent" / "data" / "artifacts"
    try:
        return str(Path(path).resolve().relative_to(artifacts_dir.resolve()))
    except ValueError:
        return None  # outside artifacts dir — do not expose


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _fallback_html() -> str:
    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>IMPERIUM</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f5f7fb; color: #16212f;
           display: grid; place-items: center; min-height: 100vh; margin: 0; }
    .card { background: #fff; border: 1px solid #d8dee8; border-radius: 12px;
            padding: 32px 40px; max-width: 480px; width: 100%; }
    h1 { margin: 0 0 8px; font-size: 1.6rem; }
    p { color: #627084; margin: 0 0 16px; }
    a { color: #1769e0; font-weight: 700; text-decoration: none; }
    code { background: #f0f4ff; padding: 2px 6px; border-radius: 4px;
           font-family: monospace; }
  </style>
</head>
<body>
  <div class="card">
    <p style="color:#1769e0;font-size:.76rem;font-weight:800;text-transform:uppercase;margin-bottom:4px">
      Imperium
    </p>
    <h1>Backend is running</h1>
    <p>Start the frontend development server:</p>
    <code>cd imperium/frontend &amp;&amp; npm run dev</code>
    <p style="margin-top:16px">Or build &amp; serve statically:</p>
    <code>npm run build</code>
    <p style="margin-top:16px"><a href="/docs">View API docs →</a></p>
  </div>
</body>
</html>"""


# ----------------------------------------------------------------
# Dev entry-point
# ----------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=os.getenv("IMPERIUM_HOST", "0.0.0.0"),
        port=int(os.getenv("IMPERIUM_PORT", "8000")),
        reload=os.getenv("IMPERIUM_RELOAD", "true").lower() == "true",
        log_level="info",
    )
