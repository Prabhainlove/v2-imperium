from __future__ import annotations

import difflib
import re
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any

from .models import CodeIssue, CommandResult, DebugInsight

if TYPE_CHECKING:
    from .generator import CodeGenerator


@dataclass(slots=True)
class Debugger:
    """Extracts root causes and applies safe automatic fixes when possible."""

    def derive_insights(
        self,
        *,
        issues: list[CodeIssue],
        command_results: list[CommandResult],
    ) -> list[DebugInsight]:
        insights: list[DebugInsight] = []

        for issue in issues:
            if issue.severity not in {"error", "critical"}:
                continue
            insights.append(
                DebugInsight(
                    root_cause=f"Static analysis: {issue.category}",
                    confidence=0.8,
                    suggested_fix=issue.hint or issue.message,
                    target_file=issue.file_path,
                    target_line=issue.line,
                )
            )

        for result in command_results:
            combined = (result.stderr or "") + "\n" + (result.stdout or "")
            if not combined.strip():
                continue

            parsed = self._parse_runtime_error(combined)
            if parsed is None:
                continue
            insights.append(parsed)

        return insights

    def apply_automatic_fixes(
        self,
        *,
        insights: list[DebugInsight],
        generator: "CodeGenerator",
    ) -> list[dict[str, Any]]:
        applied: list[dict[str, Any]] = []

        for insight in insights:
            file_path = insight.target_file
            if not file_path:
                continue
            target = Path(file_path)
            if not target.exists() or not target.is_file():
                continue

            root_lower = insight.root_cause.lower()
            if "taberror" in root_lower or "indentation" in root_lower:
                fix = self._fix_indentation(target, generator)
                if fix:
                    applied.append(fix)
                continue

            if "nameerror" in root_lower:
                fix = self._fix_name_error(target, insight, generator)
                if fix:
                    applied.append(fix)
                continue

        return applied

    def _parse_runtime_error(self, text: str) -> DebugInsight | None:
        traceback_file, traceback_line = self._extract_traceback_location(text)

        if "TabError" in text:
            return DebugInsight(
                root_cause="TabError",
                confidence=0.9,
                suggested_fix="Normalize tabs to spaces and re-run validation",
                target_file=traceback_file,
                target_line=traceback_line,
            )

        if "IndentationError" in text:
            return DebugInsight(
                root_cause="IndentationError",
                confidence=0.9,
                suggested_fix="Fix inconsistent indentation near failing line",
                target_file=traceback_file,
                target_line=traceback_line,
            )

        name_error = re.search(r"NameError: name '([^']+)' is not defined", text)
        if name_error:
            missing_name = name_error.group(1)
            return DebugInsight(
                root_cause=f"NameError: {missing_name}",
                confidence=0.7,
                suggested_fix=(
                    f"Resolve undefined symbol '{missing_name}' by correction or declaration"
                ),
                target_file=traceback_file,
                target_line=traceback_line,
            )

        module_error = re.search(r"ModuleNotFoundError: No module named '([^']+)'", text)
        if module_error:
            missing_module = module_error.group(1)
            return DebugInsight(
                root_cause=f"ModuleNotFoundError: {missing_module}",
                confidence=0.85,
                suggested_fix=(
                    f"Install or vendor missing module '{missing_module}' and update imports"
                ),
                target_file=traceback_file,
                target_line=traceback_line,
            )

        syntax_error = re.search(r"SyntaxError: (.+)", text)
        if syntax_error:
            return DebugInsight(
                root_cause="SyntaxError",
                confidence=0.85,
                suggested_fix=f"Repair invalid syntax: {syntax_error.group(1)}",
                target_file=traceback_file,
                target_line=traceback_line,
            )

        return None

    def _extract_traceback_location(self, text: str) -> tuple[str | None, int | None]:
        matches = re.findall(r'File "([^"]+)", line (\d+)', text)
        if not matches:
            return None, None
        last_file, last_line = matches[-1]
        try:
            return last_file, int(last_line)
        except ValueError:
            return last_file, None

    def _fix_indentation(
        self,
        target: Path,
        generator: "CodeGenerator",
    ) -> dict[str, Any] | None:
        try:
            source = target.read_text(encoding="utf-8")
        except Exception:
            return None

        updated = source.replace("\t", "    ")
        if updated == source:
            return None

        generator.overwrite_file(str(target), updated)
        return {
            "type": "indentation_normalization",
            "path": str(target),
            "details": "Converted tab indentation to spaces",
        }

    def _fix_name_error(
        self,
        target: Path,
        insight: DebugInsight,
        generator: "CodeGenerator",
    ) -> dict[str, Any] | None:
        match = re.search(r"NameError: (.+)$", insight.root_cause)
        if not match:
            return None

        missing = match.group(1).strip()
        try:
            source = target.read_text(encoding="utf-8")
        except Exception:
            return None

        identifiers = set(re.findall(r"\b[A-Za-z_][A-Za-z0-9_]*\b", source))
        if missing not in identifiers:
            candidates = difflib.get_close_matches(missing, sorted(identifiers), n=1, cutoff=0.88)
            if not candidates:
                return None
            replacement = candidates[0]
        else:
            return None

        pattern = re.compile(rf"\b{re.escape(missing)}\b")
        occurrences = len(pattern.findall(source))
        if occurrences == 0 or occurrences > 3:
            return None

        updated = pattern.sub(replacement, source)
        if updated == source:
            return None

        generator.overwrite_file(str(target), updated)
        return {
            "type": "nameerror_symbol_correction",
            "path": str(target),
            "details": f"Replaced '{missing}' with '{replacement}'",
        }
