from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from threading import RLock


@dataclass(slots=True)
class QuotaWindow:
    limit: int
    used: int
    window_date: date


class QuotaManager:
    def __init__(self, *, default_daily_quota: int = 500) -> None:
        self.default_daily_quota = max(1, int(default_daily_quota))
        self._limits: dict[str, int] = {}
        self._usage: dict[str, QuotaWindow] = {}
        self._lock = RLock()

    def configure(self, key: str, *, daily_quota: int) -> None:
        normalized = key.strip().lower()
        if not normalized:
            raise ValueError("key cannot be empty")

        with self._lock:
            self._limits[normalized] = max(1, int(daily_quota))

    def consume(self, key: str, amount: int = 1) -> bool:
        normalized = key.strip().lower()
        if not normalized:
            return False

        with self._lock:
            today = date.today()
            limit = self._limits.get(normalized, self.default_daily_quota)
            window = self._usage.get(normalized)
            if window is None or window.window_date != today:
                window = QuotaWindow(limit=limit, used=0, window_date=today)
                self._usage[normalized] = window

            if window.used + amount > window.limit:
                return False

            window.used += amount
            return True

    def remaining(self, key: str) -> int:
        normalized = key.strip().lower()
        if not normalized:
            return 0

        with self._lock:
            today = date.today()
            limit = self._limits.get(normalized, self.default_daily_quota)
            window = self._usage.get(normalized)
            if window is None or window.window_date != today:
                return limit
            return max(0, window.limit - window.used)
