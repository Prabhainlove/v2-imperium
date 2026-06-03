from __future__ import annotations

import re


class CommandValidator:
    def __init__(self) -> None:
        self._blocked_patterns = [
            re.compile(r"\brm\s+-rf\b", re.IGNORECASE),
            re.compile(r"\bformat\b", re.IGNORECASE),
            re.compile(r"\bshutdown\b", re.IGNORECASE),
            re.compile(r"\bdel\s+/f\b", re.IGNORECASE),
        ]
        self._allowed_prefixes = {
            "python",
            "pip",
            "pytest",
            "git",
            "npm",
            "pnpm",
            "node",
            "echo",
        }

    def validate(self, command: str) -> tuple[bool, str]:
        candidate = command.strip()
        if not candidate:
            return (False, "Command cannot be empty")

        for pattern in self._blocked_patterns:
            if pattern.search(candidate):
                return (False, "Command violated security policy")

        prefix = candidate.split(maxsplit=1)[0].lower()
        if prefix not in self._allowed_prefixes:
            return (False, f"Command prefix '{prefix}' is not allowed")

        return (True, "ok")

    def add_allowed_prefix(self, prefix: str) -> None:
        normalized = prefix.strip().lower()
        if normalized:
            self._allowed_prefixes.add(normalized)
