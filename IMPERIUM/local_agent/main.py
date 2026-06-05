"""
Imperium Local Automation Agent — pure-stdlib offline edition.

No FastAPI, no Pydantic, no compiled deps. Works on Python 3.14 on a clean
Windows machine without Rust / MSVC / Build Tools.

Endpoints (default http://127.0.0.1:8000):
    GET  /health                 -> { ok, chrome, runs }
    POST /apply                  -> { job_id }   body: { job_url, profile? }
    POST /approve                -> { ok }       body: { job_id }
    POST /reject                 -> { ok }       body: { job_id }
    GET  /status/{job_id}        -> full run + events
    GET  /events/{job_id}        -> { events, status, progress }
    GET  /runs                   -> list of all runs (most recent first)

Run:
    pip install -r requirements.txt
    python main.py
"""
from __future__ import annotations

import json
import os
import sys
import threading
import time
import traceback
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:  # noqa: BLE001
    pass

try:
    import undetected_chromedriver as uc
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.common.exceptions import (
        NoSuchElementException,
        TimeoutException,
        WebDriverException,
    )
    SELENIUM_OK = True
except ImportError as exc:  # noqa: BLE001
    print(f"[agent] selenium missing ({exc}). Run: pip install -r requirements.txt", file=sys.stderr)
    SELENIUM_OK = False


HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8000"))
HEADLESS = os.environ.get("HEADLESS", "0") == "1"
STATE_FILE = Path(os.environ.get("STATE_FILE", "./agent_state.json"))

# Chrome profile reuse. Set CHROME_USER_DATA_DIR to your real Chrome "User Data"
# folder to reuse logged-in sessions (LinkedIn, Google, etc.).
#   Windows: C:\Users\<you>\AppData\Local\Google\Chrome\User Data
#   macOS:   /Users/<you>/Library/Application Support/Google/Chrome
#   Linux:   /home/<you>/.config/google-chrome
# CHROME_PROFILE_DIR is the sub-folder (e.g. "Default", "Profile 1").
# IMPORTANT: fully close your normal Chrome before starting the agent, or
# Chrome will refuse to open the profile twice.
def _default_chrome_user_data_dir() -> str:
    home = Path.home()
    if os.name == "nt":
        p = home / "AppData" / "Local" / "Google" / "Chrome" / "User Data"
    elif sys.platform == "darwin":
        p = home / "Library" / "Application Support" / "Google" / "Chrome"
    else:
        p = home / ".config" / "google-chrome"
    return str(p)

CHROME_USER_DATA_DIR = os.environ.get("CHROME_USER_DATA_DIR", _default_chrome_user_data_dir())
CHROME_PROFILE_DIR = os.environ.get("CHROME_PROFILE_DIR", "Default")
USE_DEFAULT_CHROME = os.environ.get("USE_DEFAULT_CHROME", "1") == "1"


# --------------------------- in-memory state ----------------------------

_lock = threading.RLock()
_runs: Dict[str, Dict[str, Any]] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_state() -> None:
    if not STATE_FILE.exists():
        return
    try:
        data = json.loads(STATE_FILE.read_text("utf-8"))
        if isinstance(data, dict):
            _runs.update(data)
            print(f"[agent] restored {len(_runs)} runs from {STATE_FILE}")
    except Exception as exc:  # noqa: BLE001
        print(f"[agent] could not read state file: {exc}", file=sys.stderr)


def _save_state() -> None:
    try:
        STATE_FILE.write_text(json.dumps(_runs, indent=2), "utf-8")
    except Exception as exc:  # noqa: BLE001
        print(f"[agent] could not write state file: {exc}", file=sys.stderr)


def _new_run(job_url: str, profile: Dict[str, Any]) -> str:
    job_id = str(uuid.uuid4())
    with _lock:
        _runs[job_id] = {
            "id": job_id,
            "job_url": job_url,
            "profile": profile,
            "status": "queued",
            "progress": 0,
            "current_step": "queued",
            "current_action": "Waiting to start",
            "current_url": "",
            "approved": None,
            "error": "",
            "created_at": _now(),
            "updated_at": _now(),
            "events": [],
        }
        _save_state()
    return job_id


def _update(job_id: str, **fields: Any) -> None:
    with _lock:
        run = _runs.get(job_id)
        if not run:
            return
        run.update(fields)
        run["updated_at"] = _now()
        _save_state()


def emit(job_id: str, step: str, action: str, *, level: str = "info", url: str = "") -> None:
    with _lock:
        run = _runs.get(job_id)
        if run is None:
            return
        run["events"].append(
            {
                "ts": _now(),
                "step": step,
                "action": action,
                "level": level,
                "url": url,
            }
        )
        run["updated_at"] = _now()
        _save_state()
    print(f"[{level:>7}] {job_id[:8]} {step}: {action}")


# --------------------------- form filling -------------------------------

PROFILE_FIELD_MAP = {
    "first":     ["first name", "given name"],
    "last":      ["last name", "surname", "family name"],
    "name":      ["full name", "your name", "name"],
    "email":     ["email", "e-mail"],
    "phone":     ["phone", "mobile", "telephone"],
    "location":  ["location", "city", "address"],
    "linkedin":  ["linkedin"],
    "github":    ["github"],
    "portfolio": ["portfolio", "website"],
    "summary":   ["summary", "about you", "cover letter"],
}


def _label_for(el) -> str:
    for attr in ("aria-label", "placeholder", "name", "id"):
        v = el.get_attribute(attr) or ""
        if v.strip():
            return v.strip().lower()
    try:
        return (el.text or "").strip().lower()
    except Exception:  # noqa: BLE001
        return ""


def _profile_value(label: str, profile: Dict[str, Any], name_parts: Dict[str, str]) -> Optional[str]:
    label = label.lower()
    for key, needles in PROFILE_FIELD_MAP.items():
        if any(n in label for n in needles):
            if key == "first": return name_parts.get("first")
            if key == "last":  return name_parts.get("last")
            if key == "name":  return profile.get("name")
            if key == "linkedin":  return profile.get("linkedin_url") or profile.get("linkedin")
            if key == "github":    return profile.get("github_url") or profile.get("github")
            if key == "portfolio": return profile.get("portfolio_url") or profile.get("portfolio")
            return profile.get(key)
    return None


def fill_application(driver, job_id: str, profile: Dict[str, Any]) -> int:
    full_name = (profile.get("name") or "").strip()
    parts = full_name.split(" ", 1)
    name_parts = {"first": parts[0] if parts else "", "last": parts[1] if len(parts) > 1 else ""}

    inputs = driver.find_elements(By.CSS_SELECTOR, "input, textarea")
    emit(job_id, "scan", f"Found {len(inputs)} input fields", url=driver.current_url)

    filled = 0
    for el in inputs:
        try:
            t = (el.get_attribute("type") or "text").lower()
            if t in {"hidden", "submit", "button", "checkbox", "radio", "file"}:
                continue
            if not el.is_displayed() or not el.is_enabled():
                continue
            label = _label_for(el)
            val = _profile_value(label, profile, name_parts)
            if not val:
                continue
            el.clear()
            el.send_keys(val)
            emit(job_id, "fill", f"Filled '{label}' = {val}", level="success")
            filled += 1
            time.sleep(0.15)
        except WebDriverException as exc:
            emit(job_id, "fill", f"Skipped a field: {exc.msg}", level="warn")
    return filled


# --------------------------- run executor -------------------------------

def run_job(job_id: str) -> None:
    if not SELENIUM_OK:
        _update(job_id, status="failed", error="Selenium not installed")
        emit(job_id, "error", "Selenium is not installed on this machine", level="error")
        return

    run = _runs.get(job_id)
    if not run:
        return
    url = run["job_url"]
    profile = run.get("profile") or {}

    _update(job_id, status="running", progress=5, current_step="boot", current_action="Starting Chrome")
    emit(job_id, "boot", "Launching local Chrome with Selenium")

    opts = uc.ChromeOptions()
    if HEADLESS:
        opts.add_argument("--headless=new")
    opts.add_argument("--window-size=1280,860")
    if USE_DEFAULT_CHROME and CHROME_USER_DATA_DIR:
        opts.add_argument(f"--user-data-dir={CHROME_USER_DATA_DIR}")
        if CHROME_PROFILE_DIR:
            opts.add_argument(f"--profile-directory={CHROME_PROFILE_DIR}")
        emit(job_id, "profile", f"Using Chrome profile: {CHROME_PROFILE_DIR} ({CHROME_USER_DATA_DIR})")

    driver = None
    try:
        driver = uc.Chrome(options=opts)
        _update(job_id, progress=20, current_step="navigate", current_action=f"Opening {url}", current_url=url)
        emit(job_id, "navigate", f"Opening {url}", url=url)
        driver.get(url)
        WebDriverWait(driver, 20).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        time.sleep(1.5)
        _update(job_id, progress=40, current_step="loaded", current_action="Page loaded", current_url=driver.current_url)
        emit(job_id, "loaded", "Page loaded", level="success", url=driver.current_url)

        filled = fill_application(driver, job_id, profile)
        _update(job_id, progress=70, current_step="filled", current_action=f"Filled {filled} fields")
        emit(job_id, "filled", f"Auto-filled {filled} field(s). Awaiting your approval to submit.", level="success")

        _update(job_id, status="awaiting_approval", progress=80, current_step="approval", current_action="Waiting for human approval")
        emit(job_id, "approval", "Click Approve or Reject in the web app.", level="warn")

        deadline = time.time() + 600
        decision: Optional[str] = None
        while time.time() < deadline:
            time.sleep(1)
            r = _runs.get(job_id) or {}
            if r.get("status") == "cancelled":
                emit(job_id, "cancel", "Cancelled", level="warn")
                return
            if r.get("approved") is True:
                decision = "approve"
                break
            if r.get("approved") is False:
                decision = "reject"
                break

        if decision == "approve":
            submit = None
            for sel in ["button[type='submit']", "input[type='submit']"]:
                try:
                    submit = driver.find_element(By.CSS_SELECTOR, sel)
                    break
                except NoSuchElementException:
                    continue
            if submit:
                emit(job_id, "submit", "Clicking submit", level="success")
                submit.click()
                time.sleep(3)
                _update(job_id, status="submitted", progress=100, current_step="submitted", current_action="Application submitted")
                emit(job_id, "submitted", "Application submitted", level="success")
            else:
                _update(job_id, status="failed", error="No submit button found")
                emit(job_id, "submit", "Could not find a submit button", level="error")
        elif decision == "reject":
            _update(job_id, status="rejected", current_step="rejected", current_action="Rejected by user")
            emit(job_id, "reject", "Rejected before submit", level="warn")
        else:
            _update(job_id, status="failed", error="Approval timeout")
            emit(job_id, "timeout", "Timed out waiting for approval", level="error")

    except TimeoutException as exc:
        _update(job_id, status="failed", error=f"Timeout: {exc.msg}")
        emit(job_id, "error", f"Page timed out: {exc.msg}", level="error")
    except Exception as exc:  # noqa: BLE001
        _update(job_id, status="failed", error=str(exc))
        emit(job_id, "error", f"Unhandled error: {exc}", level="error")
        traceback.print_exc()
    finally:
        if driver:
            try: driver.quit()
            except Exception: pass


# --------------------------- HTTP server --------------------------------

class Handler(BaseHTTPRequestHandler):
    server_version = "ImperiumLocalAgent/3.0"

    # silence default noisy logging; we print our own events
    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
        return

    # ---- helpers ----

    def _send_json(self, status: int, payload: Any) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            data = json.loads(raw.decode("utf-8"))
        except Exception:
            return {}
        return data if isinstance(data, dict) else {}

    # ---- CORS preflight ----

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    # ---- routing ----

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path.rstrip("/") or "/"

        if path == "/health":
            return self._send_json(200, {
                "ok": True,
                "chrome": SELENIUM_OK,
                "headless": HEADLESS,
                "runs": len(_runs),
                "version": "3.0.0",
            })

        if path == "/runs":
            items = list(_runs.values())
            items.sort(key=lambda r: r.get("created_at", ""), reverse=True)
            return self._send_json(200, [
                {k: v for k, v in r.items() if k != "events"} for r in items
            ])

        if path.startswith("/status/"):
            job_id = path[len("/status/"):]
            run = _runs.get(job_id)
            if not run:
                return self._send_json(404, {"error": "job not found"})
            return self._send_json(200, run)

        if path.startswith("/events/"):
            job_id = path[len("/events/"):]
            run = _runs.get(job_id)
            if not run:
                return self._send_json(404, {"error": "job not found"})
            return self._send_json(200, {
                "events": run["events"],
                "status": run["status"],
                "progress": run["progress"],
            })

        self._send_json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path.rstrip("/") or "/"
        body = self._read_json()

        if path == "/apply":
            job_url = (body.get("job_url") or "").strip()
            if len(job_url) < 4:
                return self._send_json(400, {"error": "job_url is required"})
            profile = body.get("profile") or {}
            if not isinstance(profile, dict):
                return self._send_json(400, {"error": "profile must be an object"})
            job_id = _new_run(job_url, profile)
            emit(job_id, "queued", f"Queued application for {job_url}")
            threading.Thread(target=run_job, args=(job_id,), daemon=True).start()
            return self._send_json(200, {"job_id": job_id})

        if path in ("/approve", "/reject"):
            job_id = (body.get("job_id") or "").strip()
            if job_id not in _runs:
                return self._send_json(404, {"error": "job not found"})
            approved = path == "/approve"
            _update(job_id, approved=approved)
            emit(
                job_id,
                "approve" if approved else "reject",
                "User approved" if approved else "User rejected",
                level="success" if approved else "warn",
            )
            return self._send_json(200, {"ok": True})

        self._send_json(404, {"error": "not found"})


def main() -> None:
    _load_state()
    print(f"[agent] Imperium Local Agent (offline, stdlib) -- http://{HOST}:{PORT}")
    print(f"[agent] Chrome ready: {SELENIUM_OK} | headless={HEADLESS} | state={STATE_FILE}")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[agent] shutting down")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
