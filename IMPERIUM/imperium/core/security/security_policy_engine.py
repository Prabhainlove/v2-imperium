from __future__ import annotations

from dataclasses import dataclass, field
from threading import RLock
from typing import Any, Callable

PolicyPredicate = Callable[[dict[str, Any]], bool]


@dataclass(slots=True)
class SecurityPolicy:
    name: str
    predicate: PolicyPredicate
    message: str
    severity: str = "error"
    metadata: dict[str, Any] = field(default_factory=dict)


class SecurityPolicyEngine:
    def __init__(self) -> None:
        self._lock = RLock()
        self._policies: list[SecurityPolicy] = []

    def register_policy(
        self,
        *,
        name: str,
        predicate: PolicyPredicate,
        message: str,
        severity: str = "error",
        metadata: dict[str, Any] | None = None,
    ) -> None:
        policy = SecurityPolicy(
            name=name,
            predicate=predicate,
            message=message,
            severity=severity,
            metadata=dict(metadata or {}),
        )
        with self._lock:
            self._policies.append(policy)

    def evaluate(self, context: dict[str, Any]) -> tuple[bool, list[dict[str, Any]]]:
        violations: list[dict[str, Any]] = []
        with self._lock:
            policies = list(self._policies)

        for policy in policies:
            try:
                passed = bool(policy.predicate(context))
            except Exception:
                passed = False

            if not passed:
                violations.append(
                    {
                        "name": policy.name,
                        "message": policy.message,
                        "severity": policy.severity,
                        "metadata": dict(policy.metadata),
                    }
                )

        return (len(violations) == 0, violations)
