from __future__ import annotations

from contextlib import contextmanager
from threading import BoundedSemaphore, RLock

from core.resource_manager.quota_manager import QuotaManager
from core.resource_manager.rate_limiter import RateLimiter


class ResourceManager:
    def __init__(
        self,
        *,
        rate_limiter: RateLimiter | None = None,
        quota_manager: QuotaManager | None = None,
        default_concurrency: int = 8,
    ) -> None:
        self.rate_limiter = rate_limiter or RateLimiter()
        self.quota_manager = quota_manager or QuotaManager()
        self.default_concurrency = max(1, int(default_concurrency))
        self._semaphores: dict[str, BoundedSemaphore] = {}
        self._lock = RLock()

    def allow(self, key: str, *, rate_cost: float = 1.0, quota_cost: int = 1) -> bool:
        return self.rate_limiter.allow(key, cost=rate_cost) and self.quota_manager.consume(key, amount=quota_cost)

    def set_concurrency_limit(self, key: str, limit: int) -> None:
        normalized = key.strip().lower()
        if not normalized:
            raise ValueError("key cannot be empty")

        with self._lock:
            self._semaphores[normalized] = BoundedSemaphore(value=max(1, int(limit)))

    @contextmanager
    def acquire(self, key: str):
        normalized = key.strip().lower()
        if not normalized:
            raise ValueError("key cannot be empty")

        with self._lock:
            semaphore = self._semaphores.get(normalized)
            if semaphore is None:
                semaphore = BoundedSemaphore(self.default_concurrency)
                self._semaphores[normalized] = semaphore

        semaphore.acquire()
        try:
            yield
        finally:
            semaphore.release()
