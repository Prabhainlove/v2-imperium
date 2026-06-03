from __future__ import annotations

from collections import defaultdict
from threading import RLock


class PermissionManager:
    def __init__(self) -> None:
        self._lock = RLock()
        self._permissions: dict[str, set[str]] = defaultdict(set)

    def grant(self, principal: str, action: str) -> None:
        user = principal.strip().lower()
        permission = action.strip().lower()
        if not user or not permission:
            raise ValueError("principal and action are required")

        with self._lock:
            self._permissions[user].add(permission)

    def revoke(self, principal: str, action: str) -> None:
        user = principal.strip().lower()
        permission = action.strip().lower()
        if not user or not permission:
            return

        with self._lock:
            self._permissions[user].discard(permission)

    def has_permission(self, principal: str, action: str) -> bool:
        user = principal.strip().lower()
        permission = action.strip().lower()
        if not user or not permission:
            return False

        with self._lock:
            granted = self._permissions.get(user, set())
            return permission in granted or "*" in granted
