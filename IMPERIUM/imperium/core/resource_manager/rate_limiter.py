from __future__ import annotations

from dataclasses import dataclass
from threading import RLock
from time import monotonic


@dataclass(slots=True)
class TokenBucket:
    capacity: float
    refill_rate: float
    tokens: float
    last_refill: float


class RateLimiter:
    def __init__(self, *, default_capacity: int = 20, default_refill_rate: float = 5.0) -> None:
        self.default_capacity = float(max(1, default_capacity))
        self.default_refill_rate = float(max(0.1, default_refill_rate))
        self._buckets: dict[str, TokenBucket] = {}
        self._lock = RLock()

    def configure(self, key: str, *, capacity: int, refill_rate: float) -> None:
        normalized = key.strip().lower()
        if not normalized:
            raise ValueError("key cannot be empty")

        with self._lock:
            self._buckets[normalized] = TokenBucket(
                capacity=float(max(1, capacity)),
                refill_rate=float(max(0.1, refill_rate)),
                tokens=float(max(1, capacity)),
                last_refill=monotonic(),
            )

    def allow(self, key: str, *, cost: float = 1.0) -> bool:
        normalized = key.strip().lower()
        if not normalized:
            return False

        with self._lock:
            bucket = self._buckets.get(normalized)
            if bucket is None:
                bucket = TokenBucket(
                    capacity=self.default_capacity,
                    refill_rate=self.default_refill_rate,
                    tokens=self.default_capacity,
                    last_refill=monotonic(),
                )
                self._buckets[normalized] = bucket

            now = monotonic()
            elapsed = max(0.0, now - bucket.last_refill)
            if elapsed > 0:
                bucket.tokens = min(bucket.capacity, bucket.tokens + elapsed * bucket.refill_rate)
                bucket.last_refill = now

            if bucket.tokens < cost:
                return False

            bucket.tokens -= cost
            return True
