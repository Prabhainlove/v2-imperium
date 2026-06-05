"""
automation/selenium_driver.py
=============================

Purpose
-------
Owns Chrome lifecycle. Resolves which user-data directory to use, clears
stale Chrome singleton-locks, builds the ``undetected_chromedriver`` options,
and launches a Selenium driver.

Inputs
------
- ``HEADLESS``, ``USE_REAL_CHROME``, ``CHROME_USER_DATA_DIR``,
  ``CHROME_PROFILE_DIR`` environment variables.

Outputs
-------
- A live Selenium ``WebDriver`` instance from ``build_driver()``.
- A human-readable description of the profile in use.

Responsibility
--------------
Browser bootstrap only. Does not navigate, fill forms, or know about LinkedIn.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Tuple

try:
    import undetected_chromedriver as uc
    SELENIUM_OK = True
except ImportError as exc:  # noqa: BLE001
    print(f"[agent] selenium missing ({exc}). Run: pip install -r requirements.txt",
          file=sys.stderr)
    uc = None  # type: ignore
    SELENIUM_OK = False


HEADLESS = os.environ.get("HEADLESS", "0") == "1"
USE_REAL_CHROME = (
    os.environ.get("USE_REAL_CHROME", "0") == "1"
    or os.environ.get("USE_DEFAULT_CHROME") == "1"
)


def _real_chrome_user_data_dir() -> str:
    home = Path.home()
    if os.name == "nt":
        p = home / "AppData" / "Local" / "Google" / "Chrome" / "User Data"
    elif sys.platform == "darwin":
        p = home / "Library" / "Application Support" / "Google" / "Chrome"
    else:
        p = home / ".config" / "google-chrome"
    return str(p)


def _dedicated_chrome_user_data_dir() -> str:
    """Persistent profile owned by the agent; never collides with real Chrome."""
    return str(Path.home() / ".imperium_chrome_profile")


CHROME_USER_DATA_DIR = os.environ.get(
    "CHROME_USER_DATA_DIR",
    _real_chrome_user_data_dir() if USE_REAL_CHROME else _dedicated_chrome_user_data_dir(),
)
CHROME_PROFILE_DIR = os.environ.get("CHROME_PROFILE_DIR", "Default")


def clear_singleton_locks(user_data_dir: str) -> None:
    """Remove stale Chrome lock files that block a fresh launch."""
    try:
        base = Path(user_data_dir)
        if not base.exists():
            base.mkdir(parents=True, exist_ok=True)
            return
        for name in ("SingletonLock", "SingletonCookie", "SingletonSocket"):
            for p in base.glob(name):
                try:
                    p.unlink()
                except Exception:
                    pass
    except Exception as exc:  # noqa: BLE001
        print(f"[agent] could not clear singleton locks: {exc}", file=sys.stderr)


def build_driver() -> Tuple[object, str]:
    """Launch Chrome and return (driver, profile_description)."""
    if not SELENIUM_OK or uc is None:
        raise RuntimeError("Selenium is not installed on this machine")

    opts = uc.ChromeOptions()
    if HEADLESS:
        opts.add_argument("--headless=new")
    opts.add_argument("--window-size=1280,860")
    opts.add_argument("--no-first-run")
    opts.add_argument("--no-default-browser-check")

    profile_desc = ""
    if CHROME_USER_DATA_DIR:
        clear_singleton_locks(CHROME_USER_DATA_DIR)
        opts.add_argument(f"--user-data-dir={CHROME_USER_DATA_DIR}")
        if CHROME_PROFILE_DIR:
            opts.add_argument(f"--profile-directory={CHROME_PROFILE_DIR}")
        kind = "REAL Chrome profile" if USE_REAL_CHROME else "dedicated agent profile"
        profile_desc = f"Using {kind}: {CHROME_PROFILE_DIR} ({CHROME_USER_DATA_DIR})"

    driver = uc.Chrome(options=opts)
    return driver, profile_desc
