from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from threading import RLock

from core.common import utc_now


@dataclass(slots=True)
class StrategyOutcome:
    strategy_id: str
    task_id: str
    success: bool
    latency_seconds: float
    score: float
    timestamp: str


class StrategyMemory:
    def __init__(self) -> None:
        self._lock = RLock()
        self._outcomes: dict[str, list[StrategyOutcome]] = defaultdict(list)

    def record(self, strategy_id: str, task_id: str, success: bool, latency_seconds: float, score: float) -> StrategyOutcome:
        outcome = StrategyOutcome(
            strategy_id=strategy_id,
            task_id=task_id,
            success=bool(success),
            latency_seconds=max(0.0, float(latency_seconds)),
            score=max(0.0, min(1.0, float(score))),
            timestamp=utc_now().isoformat(),
        )

        with self._lock:
            self._outcomes[strategy_id].append(outcome)

        return outcome

    def best_strategies(self, *, limit: int = 5) -> list[dict[str, float | str]]:
        with self._lock:
            snapshot = {key: list(value) for key, value in self._outcomes.items()}

        ranked: list[dict[str, float | str]] = []
        for strategy_id, outcomes in snapshot.items():
            if not outcomes:
                continue

            successes = sum(1 for item in outcomes if item.success)
            success_rate = successes / len(outcomes)
            average_score = sum(item.score for item in outcomes) / len(outcomes)
            ranked.append(
                {
                    "strategy_id": strategy_id,
                    "success_rate": round(success_rate, 4),
                    "average_score": round(average_score, 4),
                    "samples": float(len(outcomes)),
                }
            )

        ranked.sort(key=lambda row: (row["success_rate"], row["average_score"]), reverse=True)
        return ranked[: max(1, limit)]
