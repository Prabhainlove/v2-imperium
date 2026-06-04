"""
Imperium Local Automation Agent.

Polls Supabase for queued `automation_runs`, drives a local Chromium
browser through the application flow, and streams screenshots + step
updates back to the same row. The frontend subscribes via Supabase
realtime and shows the live view on the /autopilot page.

Run:
    python main.py
"""
from __future__ import annotations

import asyncio
import base64
import os
import sys
import time
from typing import Any

from dotenv import load_dotenv

load_dotenv()

try:
    from supabase import Client, create_client
except ImportError:
    print("[agent] missing dep: pip install -r requirements.txt", file=sys.stderr)
    raise

try:
    from playwright.async_api import Page, async_playwright
except ImportError:
    print("[agent] missing dep: pip install -r requirements.txt && python -m playwright install chromium", file=sys.stderr)
    raise


SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
AGENT_TOKEN = os.environ.get("IMPERIUM_AGENT_TOKEN", "local-dev-token").strip()
HEADLESS = os.environ.get("HEADLESS", "false").lower() in ("1", "true", "yes")
POLL_INTERVAL = float(os.environ.get("POLL_INTERVAL", "2"))

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("[agent] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env", file=sys.stderr)
    sys.exit(1)

sb: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def log(msg: str) -> None:
    print(f"[agent {time.strftime('%H:%M:%S')}] {msg}", flush=True)


async def update_run(run_id: str, fields: dict[str, Any]) -> None:
    sb.table("automation_runs").update(fields).eq("id", run_id).execute()


async def add_event(run_id: str, user_id: str, *, step: str, action: str, url: str = "", level: str = "info", detail: str = "") -> None:
    sb.table("automation_events").insert({
        "run_id": run_id,
        "user_id": user_id,
        "step": step,
        "action": action,
        "url": url,
        "level": level,
        "detail": detail,
    }).execute()


async def snapshot(page: Page, run_id: str, *, step: str, action: str) -> None:
    try:
        png = await page.screenshot(type="jpeg", quality=55, full_page=False)
        b64 = base64.b64encode(png).decode("ascii")
    except Exception as e:
        b64 = None
        log(f"screenshot failed: {e}")
    await update_run(run_id, {
        "current_step": step,
        "current_action": action,
        "current_url": page.url,
        "screenshot_b64": b64,
    })


async def stream_loop(page: Page, run_id: str, stop_event: asyncio.Event) -> None:
    """Push a fresh screenshot every ~1s while the run is active."""
    while not stop_event.is_set():
        await snapshot(page, run_id, step="streaming", action="live view")
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=1.2)
        except asyncio.TimeoutError:
            continue


async def wait_for_approval(run_id: str, timeout_s: int = 600) -> bool | None:
    """Poll the row until the user approves or rejects."""
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        row = sb.table("automation_runs").select("approved,status").eq("id", run_id).single().execute()
        data = row.data or {}
        if data.get("approved") is True:
            return True
        if data.get("approved") is False or data.get("status") in ("rejected", "cancelled"):
            return False
        await asyncio.sleep(1.5)
    return None


async def run_application(playwright_browser, run: dict) -> None:
    run_id = run["id"]
    user_id = run["user_id"]
    job_url = run.get("job_url") or "about:blank"

    log(f"picking up run {run_id} → {job_url}")
    await update_run(run_id, {"status": "running", "progress": 5, "error": None})
    await add_event(run_id, user_id, step="start", action="Launching browser", url=job_url, level="success")

    context = await playwright_browser.new_context(viewport={"width": 1280, "height": 800})
    page = await context.new_page()

    stop_streaming = asyncio.Event()
    streamer = asyncio.create_task(stream_loop(page, run_id, stop_streaming))

    try:
        # 1. Open job page
        await add_event(run_id, user_id, step="navigate", action=f"Opening {job_url}", url=job_url)
        await page.goto(job_url, wait_until="domcontentloaded", timeout=45000)
        await snapshot(page, run_id, step="job_page", action="Job page loaded")
        await update_run(run_id, {"progress": 25})

        # 2. Try to find & click an "Apply" button (best-effort, heuristic).
        await add_event(run_id, user_id, step="apply", action="Looking for Apply button")
        apply_selectors = [
            "text=/^\\s*Apply\\s*$/i",
            "text=/Apply now/i",
            "text=/Easy Apply/i",
            "a:has-text('Apply')",
            "button:has-text('Apply')",
        ]
        clicked = False
        for sel in apply_selectors:
            try:
                el = await page.wait_for_selector(sel, timeout=2500, state="visible")
                if el:
                    await el.click()
                    clicked = True
                    await add_event(run_id, user_id, step="apply", action=f"Clicked apply ({sel})", level="success")
                    break
            except Exception:
                continue
        if not clicked:
            await add_event(run_id, user_id, step="apply", action="No Apply button found — staying on page", level="warn")

        await page.wait_for_timeout(2000)
        await snapshot(page, run_id, step="form", action="Application form")
        await update_run(run_id, {"progress": 55})

        # 3. Best-effort fill of common name/email fields
        await add_event(run_id, user_id, step="fill", action="Filling personal details")
        summary = run.get("summary") or {}
        candidate = summary.get("candidate") or {}
        for label, value in [
            ("input[name*='first' i]", candidate.get("first_name") or candidate.get("name", "").split(" ")[0] if candidate.get("name") else ""),
            ("input[name*='last' i]", " ".join(candidate.get("name", "").split(" ")[1:]) if candidate.get("name") else ""),
            ("input[type='email']", candidate.get("email", "")),
            ("input[name*='phone' i],input[type='tel']", candidate.get("phone", "")),
        ]:
            if not value:
                continue
            try:
                await page.fill(label, value, timeout=2000)
            except Exception:
                pass

        await snapshot(page, run_id, step="review", action="Ready for approval")
        await update_run(run_id, {"progress": 80, "status": "awaiting_approval"})
        await add_event(run_id, user_id, step="approval", action="Waiting for user approval", level="warn")

        # 4. Block on approval
        approved = await wait_for_approval(run_id)
        if approved is None:
            await update_run(run_id, {"status": "failed", "error": "Approval timed out after 10 minutes"})
            await add_event(run_id, user_id, step="approval", action="Timed out", level="error")
            return
        if not approved:
            await update_run(run_id, {"status": "rejected"})
            await add_event(run_id, user_id, step="approval", action="User rejected submission", level="warn")
            return

        await add_event(run_id, user_id, step="submit", action="User approved — submitting", level="success")

        # 5. Try to click a submit button
        submit_selectors = ["button:has-text('Submit')", "button[type='submit']", "text=/Submit application/i"]
        submitted = False
        for sel in submit_selectors:
            try:
                el = await page.wait_for_selector(sel, timeout=2500, state="visible")
                if el:
                    await el.click()
                    submitted = True
                    break
            except Exception:
                continue

        await page.wait_for_timeout(2500)
        await snapshot(page, run_id, step="done", action="Submitted" if submitted else "No submit button — left as draft")
        await update_run(run_id, {
            "status": "submitted",
            "progress": 100,
        })
        await add_event(run_id, user_id, step="done", action="Application submitted" if submitted else "Submit button not found", level="success" if submitted else "warn")

    except Exception as e:
        log(f"run {run_id} failed: {e}")
        await update_run(run_id, {"status": "failed", "error": str(e)[:500]})
        await add_event(run_id, user_id, step="error", action="Run failed", level="error", detail=str(e)[:500])
    finally:
        stop_streaming.set()
        try:
            await streamer
        except Exception:
            pass
        try:
            await context.close()
        except Exception:
            pass


async def fetch_next_run() -> dict | None:
    q = sb.table("automation_runs").select("*").eq("status", "queued").eq("agent_token", AGENT_TOKEN).order("created_at").limit(1).execute()
    rows = q.data or []
    return rows[0] if rows else None


async def main() -> None:
    log("Imperium local automation agent started")
    log(f"polling automation_runs every {POLL_INTERVAL}s (headless={HEADLESS}, token={AGENT_TOKEN[:6]}…)")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=HEADLESS)
        try:
            while True:
                run = await fetch_next_run()
                if run:
                    await run_application(browser, run)
                else:
                    await asyncio.sleep(POLL_INTERVAL)
        finally:
            await browser.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log("shutdown")
