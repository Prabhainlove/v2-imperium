from __future__ import annotations

import ast
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from .models import CodeIssue


@dataclass(slots=True)
class StaticAnalyzer:
    """Runs local static analysis for correctness, security, and quality."""

    max_file_length_warning: int = 1800

    def analyze_files(self, file_paths: Iterable[str | Path]) -> list[CodeIssue]:
        issues: list[CodeIssue] = []
        for raw_path in file_paths:
            path = Path(raw_path)
            if not path.exists() or not path.is_file():
                continue

            try:
                content = path.read_text(encoding="utf-8", errors="ignore")
            except Exception as exc:
                issues.append(
                    CodeIssue(
                        severity="error",
                        category="io",
                        message=f"Failed to read file: {exc}",
                        file_path=str(path),
                    )
                )
                continue

            if path.suffix == ".py":
                issues.extend(self._analyze_python(path, content))
            else:
                issues.extend(self._analyze_generic(path, content))

        return issues

    def _analyze_python(self, path: Path, content: str) -> list[CodeIssue]:
        issues: list[CodeIssue] = []

        syntax_issue = self._check_python_syntax(path, content)
        if syntax_issue is not None:
            issues.append(syntax_issue)
            # Subsequent AST checks are less reliable if syntax is broken.
            return issues

        issues.extend(self._check_security_patterns(path, content))
        issues.extend(self._check_performance_patterns(path, content))
        issues.extend(self._check_quality_patterns(path, content))

        line_count = content.count("\n") + 1
        if line_count > self.max_file_length_warning:
            issues.append(
                CodeIssue(
                    severity="warning",
                    category="maintainability",
                    message=(
                        f"File has {line_count} lines and may benefit from decomposition"
                    ),
                    file_path=str(path),
                    hint="Split very large modules into focused files/classes.",
                )
            )

        return issues

    def _analyze_generic(self, path: Path, content: str) -> list[CodeIssue]:
        issues: list[CodeIssue] = []
        if "TODO" in content:
            issues.append(
                CodeIssue(
                    severity="info",
                    category="quality",
                    message="File contains TODO markers",
                    file_path=str(path),
                )
            )
        return issues

    def _check_python_syntax(self, path: Path, content: str) -> CodeIssue | None:
        try:
            ast.parse(content)
        except SyntaxError as exc:
            return CodeIssue(
                severity="critical",
                category="syntax",
                message=f"Syntax error: {exc.msg}",
                file_path=str(path),
                line=exc.lineno,
                column=exc.offset,
                hint="Fix syntax before running runtime validation.",
            )
        return None

    def _check_security_patterns(self, path: Path, content: str) -> list[CodeIssue]:
        issues: list[CodeIssue] = []
        checks = [
            (
                r"\beval\s*\(",
                "critical",
                "security",
                "Use of eval() detected",
                "Prefer explicit parsing/dispatch logic over eval.",
            ),
            (
                r"\bexec\s*\(",
                "critical",
                "security",
                "Use of exec() detected",
                "Avoid dynamic code execution when handling task inputs.",
            ),
            (
                r"subprocess\.(run|Popen)\([^\)]*shell\s*=\s*True",
                "warning",
                "security",
                "subprocess call with shell=True detected",
                "Use argument lists and shell=False when possible.",
            ),
            (
                r"pickle\.loads\s*\(",
                "warning",
                "security",
                "Unsafe pickle deserialization pattern detected",
                "Do not deserialize untrusted pickle payloads.",
            ),
        ]

        for pattern, severity, category, message, hint in checks:
            for match in re.finditer(pattern, content):
                line = content.count("\n", 0, match.start()) + 1
                issues.append(
                    CodeIssue(
                        severity=severity,  # type: ignore[arg-type]
                        category=category,
                        message=message,
                        file_path=str(path),
                        line=line,
                        hint=hint,
                    )
                )

        return issues

    def _check_performance_patterns(self, path: Path, content: str) -> list[CodeIssue]:
        issues: list[CodeIssue] = []

        lines = content.splitlines()
        max_scan_distance = 60

        for index, line in enumerate(lines):
            stripped = line.lstrip()
            if not stripped.startswith('for '):
                continue

            outer_indent = len(line) - len(stripped)
            nested_found = False

            upper_bound = min(len(lines), index + max_scan_distance)
            for cursor in range(index + 1, upper_bound):
                candidate = lines[cursor]
                candidate_stripped = candidate.lstrip()
                if not candidate_stripped:
                    continue

                candidate_indent = len(candidate) - len(candidate_stripped)
                if candidate_indent <= outer_indent:
                    break

                if candidate_stripped.startswith('for '):
                    nested_found = True
                    break

            if nested_found:
                issues.append(
                    CodeIssue(
                        severity="info",
                        category="performance",
                        message="Nested loop detected; review time complexity for large inputs",
                        file_path=str(path),
                        line=index + 1,
                        hint="Consider indexing, caching, or vectorized operations where applicable.",
                    )
                )
                break

        return issues

    def _check_quality_patterns(self, path: Path, content: str) -> list[CodeIssue]:
        issues: list[CodeIssue] = []

        bare_except = re.finditer(r"except\s*:\s*", content)
        for match in bare_except:
            line = content.count("\n", 0, match.start()) + 1
            issues.append(
                CodeIssue(
                    severity="warning",
                    category="quality",
                    message="Bare except block detected",
                    file_path=str(path),
                    line=line,
                    hint="Catch specific exception types and preserve traceability.",
                )
            )

        return issues
