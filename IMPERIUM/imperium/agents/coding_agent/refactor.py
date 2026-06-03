from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


@dataclass(slots=True)
class RefactorEngine:
    """Applies safe structural cleanups to changed files."""

    def refine_files(self, files: Iterable[str | Path]) -> list[dict[str, Any]]:
        changes: list[dict[str, Any]] = []

        for raw_path in files:
            path = Path(raw_path)
            if not path.exists() or not path.is_file():
                continue

            try:
                original = path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue

            updated = original
            updated = self._normalize_whitespace(updated)
            updated = self._squash_blank_lines(updated)
            updated = self._dedupe_adjacent_duplicate_lines(updated)

            if updated == original:
                continue

            path.write_text(updated, encoding="utf-8")
            changes.append(
                {
                    "path": str(path),
                    "change_type": "refactor_cleanup",
                }
            )

        return changes

    def _normalize_whitespace(self, content: str) -> str:
        lines = [line.rstrip() for line in content.splitlines()]
        output = "\n".join(lines)
        if content.endswith("\n"):
            output += "\n"
        return output

    def _squash_blank_lines(self, content: str, max_blank_lines: int = 2) -> str:
        lines = content.splitlines()
        normalized: list[str] = []
        blank_count = 0

        for line in lines:
            if line.strip() == "":
                blank_count += 1
                if blank_count > max_blank_lines:
                    continue
            else:
                blank_count = 0
            normalized.append(line)

        output = "\n".join(normalized)
        if content.endswith("\n"):
            output += "\n"
        return output

    def _dedupe_adjacent_duplicate_lines(self, content: str) -> str:
        lines = content.splitlines()
        normalized: list[str] = []

        for line in lines:
            if normalized and normalized[-1] == line:
                # Avoid removing repeated bracket-only lines or repeated single-character lines.
                if re.fullmatch(r"[\]\[\{\}\(\)]", line.strip()):
                    normalized.append(line)
                    continue
                if len(line.strip()) <= 1:
                    normalized.append(line)
                    continue
                continue
            normalized.append(line)

        output = "\n".join(normalized)
        if content.endswith("\n"):
            output += "\n"
        return output
