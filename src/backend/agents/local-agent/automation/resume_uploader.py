"""
automation/resume_uploader.py
=============================

Purpose
-------
Attach the candidate's resume PDF to any visible file input on the page.

Inputs
------
- Selenium driver.
- ``profile['resume_path']`` (or env ``RESUME_PATH``).
- An ``emit`` callback for logging.

Outputs
-------
- ``True`` if a file was uploaded, else ``False``.

Responsibility
--------------
File-input handling only. Does not click submit, does not navigate.
"""
from __future__ import annotations

import time
from typing import Any, Callable, Dict

from selenium.webdriver.common.by import By
from selenium.common.exceptions import WebDriverException

Emit = Callable[..., None]


def maybe_upload_resume(driver, emit: Emit, profile: Dict[str, Any], root=None) -> bool:
    path = profile.get("resume_path") or profile.get("resume_file")
    if not path:
        return False
    try:
        ups = (root or driver).find_elements(By.CSS_SELECTOR, "input[type='file']")
        for u in ups:
            try:
                name = (u.get_attribute("name") or u.get_attribute("id") or "").lower()
                if "resume" in name or "cv" in name or len(ups) == 1:
                    u.send_keys(path)
                    emit("upload", f"Uploaded resume: {path}", level="success")
                    time.sleep(1)
                    return True
            except WebDriverException:
                continue
    except WebDriverException:
        pass
    return False
