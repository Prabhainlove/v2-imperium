"""
Imperium Local Automation Agent — Selenium edition.

Polls Supabase `automation_runs` for queued rows belonging to your account
and drives a real, visible Chrome window through job applications. Every
field interaction is streamed back to `automation_events` so the web UI
can show live status on /autopilot in real time (no screenshots — just
structured live events).

Run locally:
    pip install -r requirements.txt
    cp .env.example .env   # fill in SUPABASE_URL + SERVICE_ROLE + AGENT_TOKEN
    python main.py

The agent opens Chrome visibly by default so you can watch it apply.
Set HEADLESS=1 in .env to run hidden.
"""
from __future__ import annotations

import os
import sys
import time
import traceback
from typing import Any, Optional

from dotenv import load_dotenv

load_dotenv()

try:
    from supabase import Client, create_client
except ImportError:
    print("[agent] missing deps. Run: pip install -r requirements.txt", file=sys.stderr)
    raise

try:
    import undetected_chromedriver as uc
    from selenium.webdriver.common.by import By
    from selenium.webdriver.common.keys import Keys
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.common.exceptions import (
        NoSuchElementException,
        TimeoutException,
        WebDriverException,
    )
except ImportError:
    print("[agent] selenium missing. Run: pip install -r requirements.txt", file=sys.stderr)
    raise


SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
AGENT_TOKEN = os.environ.get("IMPERIUM_AGENT_TOKEN", "local-dev-token")
HEADLESS = os.environ.get("HEADLESS", "0") == "1"
POLL_SECONDS = float(os.environ.get("POLL_SECONDS", "3"))

if not (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
    print("[agent] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env", file=sys.stderr)
    sys.exit(1)

sb: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


# ─────────────────────────── event streaming ────────────────────────────

def emit(run_id: str, user_id: str, step: str, action: str, *, level: str = "info", url: str = "") -> None:
    """Stream a structured live event back to Supabase Realtime."""
    try:
        sb.table("automation_events").insert(
            {
                "run_id": run_id,
                "user_id": user_id,
                "step": step,
                "action": action,
                "level": level,
                "url": url,
            }
        ).execute()
    except Exception as exc:  # noqa: BLE001
        print(f"[agent] emit failed: {exc}", file=sys.stderr)
    print(f"[{level:>7}] {step}: {action}")


def update_run(run_id: str, **fields: Any) -> None:
    try:
        sb.table("automation_runs").update(fields).eq("id", run_id).execute()
    except Exception as exc:  # noqa: BLE001
        print(f"[agent] update_run failed: {exc}", file=sys.stderr)


# ─────────────────────────── form filling ───────────────────────────────

PROFILE_FIELD_MAP = {
    # canonical label keyword → profile column
    "name": ["name", "full name", "your name"],
    "first": ["first name", "given name"],
    "last": ["last name", "surname", "family name"],
    "email": ["email", "e-mail"],
    "phone": ["phone", "mobile", "telephone"],
    "location": ["location", "city", "address"],
    "linkedin": ["linkedin"],
    "github": ["github"],
    "portfolio": ["portfolio", "website"],
    "summary": ["summary", "about you", "cover letter"],
}


def _label_for(el) -> str:
    """Best-effort label text for an input element."""
    for attr in ("aria-label", "placeholder", "name", "id"):
        v = el.get_attribute(attr) or ""
        if v.strip():
            return v.strip().lower()
    try:
        return (el.text or "").strip().lower()
    except Exception:  # noqa: BLE001
        return ""


def _profile_value(label: str, profile: dict, name_parts: dict) -> Optional[str]:
    label = label.lower()
    if any(k in label for k in PROFILE_FIELD_MAP["first"]):
        return name_parts.get("first")
    if any(k in label for k in PROFILE_FIELD_MAP["last"]):
        return name_parts.get("last")
    if any(k in label for k in PROFILE_FIELD_MAP["email"]):
        return profile.get("email")
    if any(k in label for k in PROFILE_FIELD_MAP["phone"]):
        return profile.get("phone")
    if any(k in label for k in PROFILE_FIELD_MAP["location"]):
        return profile.get("location")
    if any(k in label for k in PROFILE_FIELD_MAP["linkedin"]):
        return profile.get("linkedin_url")
    if any(k in label for k in PROFILE_FIELD_MAP["github"]):
        return profile.get("github_url")
    if any(k in label for k in PROFILE_FIELD_MAP["portfolio"]):
        return profile.get("portfolio_url")
    if any(k in label for k in PROFILE_FIELD_MAP["name"]):
        return profile.get("name")
    if any(k in label for k in PROFILE_FIELD_MAP["summary"]):
        return profile.get("summary")
    return None


def fill_application(driver, run: dict, profile: dict) -> None:
    run_id = run["id"]
    user_id = run["user_id"]
    full_name = (profile.get("name") or "").strip()
    parts = full_name.split(" ", 1)
    name_parts = {"first": parts[0] if parts else "", "last": parts[1] if len(parts) > 1 else ""}

    inputs = driver.find_elements(By.CSS_SELECTOR, "input, textarea")
    emit(run_id, user_id, "scan", f"Found {len(inputs)} input fields", url=driver.current_url)

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
            emit(run_id, user_id, "fill", f"Filled '{label}' = {val}", level="success")
            filled += 1
            time.sleep(0.15)  # so the human can see it happen
        except WebDriverException as exc:
            emit(run_id, user_id, "fill", f"Skipped a field: {exc.msg}", level="warn")

    update_run(run_id, progress=70, current_step="filled", current_action=f"Filled {filled} fields")
    emit(run_id, user_id, "filled", f"Auto-filled {filled} field(s). Awaiting your approval to submit.", level="success")


# ─────────────────────────── run executor ───────────────────────────────

def run_once(run: dict) -> None:
    run_id = run["id"]
    user_id = run["user_id"]
    url = (run.get("job_url") or "").strip()
    if not url:
        update_run(run_id, status="failed", error="No job_url provided")
        return

    update_run(run_id, status="running", progress=5, current_step="boot", current_action="Starting Chrome")
    emit(run_id, user_id, "boot", "Launching local Chrome with Selenium")

    profile_row = (
        sb.table("profiles")
        .select(
            "name,email,phone,location,headline,summary,"
            "linkedin_url,github_url,portfolio_url"
        )
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    profile = (profile_row.data or {}) if profile_row else {}

    opts = uc.ChromeOptions()
    if HEADLESS:
        opts.add_argument("--headless=new")
    opts.add_argument("--window-size=1280,860")

    driver = None
    try:
        driver = uc.Chrome(options=opts)
        update_run(run_id, progress=20, current_step="navigate", current_action=f"Opening {url}", current_url=url)
        emit(run_id, user_id, "navigate", f"Opening {url}", url=url)
        driver.get(url)
        WebDriverWait(driver, 20).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        time.sleep(1.5)
        update_run(run_id, progress=40, current_step="loaded", current_action="Page loaded", current_url=driver.current_url)
        emit(run_id, user_id, "loaded", "Page loaded", level="success", url=driver.current_url)

        fill_application(driver, run, profile)

        update_run(run_id, status="awaiting_approval", progress=80, current_step="approval", current_action="Waiting for human approval")
        emit(run_id, user_id, "approval", "Waiting for you to Approve & submit in the web app.", level="warn")

        # Poll for approve/reject up to 10 minutes
        deadline = time.time() + 600
        decision = None
        while time.time() < deadline:
            time.sleep(2)
            row = sb.table("automation_runs").select("approved,status").eq("id", run_id).single().execute()
            data = row.data or {}
            if data.get("status") == "cancelled":
                emit(run_id, user_id, "cancel", "Cancelled by user", level="warn")
                return
            if data.get("approved") is True:
                decision = "approve"
                break
            if data.get("approved") is False:
                decision = "reject"
                break

        if decision == "approve":
            try:
                submit = None
                for sel in [
                    "button[type='submit']",
                    "input[type='submit']",
                    "button:contains('Submit')",
                ]:
                    try:
                        submit = driver.find_element(By.CSS_SELECTOR, sel)
                        break
                    except NoSuchElementException:
                        continue
                if submit:
                    emit(run_id, user_id, "submit", "Clicking submit", level="success")
                    submit.click()
                    time.sleep(3)
                    update_run(run_id, status="submitted", progress=100, current_step="submitted", current_action="Application submitted")
                    emit(run_id, user_id, "submitted", "Application submitted ✓", level="success")
                else:
                    update_run(run_id, status="failed", error="No submit button found")
                    emit(run_id, user_id, "submit", "Could not find a submit button", level="error")
            except WebDriverException as exc:
                update_run(run_id, status="failed", error=str(exc))
                emit(run_id, user_id, "submit", f"Submit failed: {exc.msg}", level="error")
        elif decision == "reject":
            update_run(run_id, status="rejected", current_step="rejected", current_action="Rejected by user")
            emit(run_id, user_id, "reject", "User rejected the application before submit", level="warn")
        else:
            update_run(run_id, status="failed", error="Approval timeout")
            emit(run_id, user_id, "timeout", "Timed out waiting for approval", level="error")

    except TimeoutException as exc:
        update_run(run_id, status="failed", error=f"Timeout: {exc.msg}")
        emit(run_id, user_id, "error", f"Page timed out: {exc.msg}", level="error")
    except Exception as exc:  # noqa: BLE001
        update_run(run_id, status="failed", error=str(exc))
        emit(run_id, user_id, "error", f"Unhandled error: {exc}", level="error")
        traceback.print_exc()
    finally:
        if driver:
            try:
                driver.quit()
            except Exception:  # noqa: BLE001
                pass


# ─────────────────────────── poll loop ───────────────────────────────────

def main() -> None:
    print(f"[agent] Imperium Selenium agent running. token={AGENT_TOKEN!r} headless={HEADLESS}")
    print(f"[agent] Polling {SUPABASE_URL} every {POLL_SECONDS}s …")
    while True:
        try:
            rows = (
                sb.table("automation_runs")
                .select("*")
                .eq("status", "queued")
                .eq("agent_token", AGENT_TOKEN)
                .order("created_at")
                .limit(1)
                .execute()
            )
            run = (rows.data or [None])[0]
            if run:
                print(f"[agent] picked up run {run['id']} → {run.get('job_url')}")
                run_once(run)
            else:
                time.sleep(POLL_SECONDS)
        except KeyboardInterrupt:
            print("\n[agent] bye")
            return
        except Exception as exc:  # noqa: BLE001
            print(f"[agent] poll error: {exc}", file=sys.stderr)
            time.sleep(POLL_SECONDS * 2)


if __name__ == "__main__":
    main()
