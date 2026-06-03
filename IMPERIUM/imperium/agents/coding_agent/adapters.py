from __future__ import annotations

import asyncio
import contextlib
import io
import os
import re
import shlex
import shutil
import subprocess
from pathlib import Path
from typing import Any

from .models import CommandResult, WorkspaceSnapshot


_IGNORED_DIRS = {
    ".git",
    ".hg",
    ".svn",
    ".mypy_cache",
    ".pytest_cache",
    "__pycache__",
    "node_modules",
    "dist",
    "build",
    ".venv",
    "venv",
}


class OpenDevinSkillBridge:
    """Best-effort bridge to legacy OpenDevin skills.

    These skills are optional because some OpenDevin distributions ship them via
    extra packages. The coding agent uses them when present and falls back to
    built-in adapters otherwise.
    """

    def __init__(self, *, load_legacy: bool = True) -> None:
        self._repo_ops: dict[str, Any] = {}
        self._file_editor = None
        if load_legacy:
            self._load_repo_ops()
            self._load_file_editor()

    @property
    def repo_ops_available(self) -> bool:
        return bool(self._repo_ops)

    @property
    def file_editor_available(self) -> bool:
        return self._file_editor is not None

    def _load_repo_ops(self) -> None:
        try:
            from openhands.runtime.plugins.agent_skills.repo_ops import (  # type: ignore
                explore_tree_structure,
                get_entity_contents,
                search_code_snippets,
            )
        except Exception:
            return

        self._repo_ops = {
            "explore_tree_structure": explore_tree_structure,
            "get_entity_contents": get_entity_contents,
            "search_code_snippets": search_code_snippets,
        }

    def _load_file_editor(self) -> None:
        try:
            from openhands.runtime.plugins.agent_skills.file_editor import (  # type: ignore
                file_editor,
            )
        except Exception:
            return

        self._file_editor = file_editor

    def _capture_stdout(self, fn: Any, *args: Any, **kwargs: Any) -> str:
        buffer = io.StringIO()
        with contextlib.redirect_stdout(buffer):
            value = fn(*args, **kwargs)
        if value is not None:
            return str(value)
        return buffer.getvalue()

    def search_code_snippets(self, query: str, path: str) -> str | None:
        fn = self._repo_ops.get("search_code_snippets")
        if fn is None:
            return None

        signatures = [
            {"query": query, "path": path},
            {"search_query": query, "path": path},
            {"query": query, "repo_path": path},
        ]
        for kwargs in signatures:
            try:
                return self._capture_stdout(fn, **kwargs)
            except TypeError:
                continue
            except Exception:
                return None
        return None


class RepositoryExplorer:
    def __init__(self, workspace_root: Path, bridge: OpenDevinSkillBridge | None = None):
        self.workspace_root = workspace_root.resolve()
        self.bridge = bridge

    def _resolve_path(self, path: str | Path) -> Path:
        candidate = Path(path)
        if candidate.is_absolute():
            return candidate
        return (self.workspace_root / candidate).resolve()

    def snapshot(
        self,
        *,
        max_depth: int = 5,
        max_files: int = 2000,
        sample_count: int = 8,
    ) -> WorkspaceSnapshot:
        files = self.list_files(max_depth=max_depth, max_files=max_files)
        sampled_file_contents: dict[str, str] = {}
        for file_path in files[:sample_count]:
            text = self.read_text(file_path, start_line=1, end_line=120)
            sampled_file_contents[file_path] = text
        return WorkspaceSnapshot(
            root=self.workspace_root,
            files=files,
            sampled_file_contents=sampled_file_contents,
        )

    def list_files(
        self,
        *,
        max_depth: int = 5,
        max_files: int = 2000,
        include_hidden: bool = False,
    ) -> list[str]:
        discovered: list[str] = []
        root_depth = len(self.workspace_root.parts)

        for current_root, dirs, files in os.walk(self.workspace_root):
            current_path = Path(current_root)
            relative_parts = len(current_path.parts) - root_depth

            if relative_parts >= max_depth:
                dirs[:] = []

            pruned_dirs: list[str] = []
            for dirname in dirs:
                if dirname in _IGNORED_DIRS:
                    continue
                if not include_hidden and dirname.startswith("."):
                    continue
                pruned_dirs.append(dirname)
            dirs[:] = pruned_dirs

            for filename in files:
                if filename.startswith(".") and not include_hidden:
                    continue
                full_path = current_path / filename
                try:
                    rel = full_path.relative_to(self.workspace_root).as_posix()
                except Exception:
                    continue
                discovered.append(rel)
                if len(discovered) >= max_files:
                    return discovered

        return discovered

    def read_text(
        self,
        path: str | Path,
        *,
        start_line: int = 1,
        end_line: int = 240,
        encoding: str = "utf-8",
    ) -> str:
        resolved = self._resolve_path(path)
        if not resolved.exists() or not resolved.is_file():
            return ""

        start = max(1, int(start_line))
        end = max(start, int(end_line))

        output: list[str] = []
        try:
            with resolved.open("r", encoding=encoding, errors="ignore") as handle:
                for line_no, line in enumerate(handle, start=1):
                    if line_no < start:
                        continue
                    if line_no > end:
                        break
                    output.append(line.rstrip("\n"))
        except Exception:
            return ""

        return "\n".join(output)

    def search_text(
        self,
        query: str,
        *,
        max_results: int = 200,
        include_glob: str | None = None,
    ) -> list[dict[str, Any]]:
        query = query.strip()
        if not query:
            return []

        matches = self._search_with_ripgrep(
            query=query,
            max_results=max_results,
            include_glob=include_glob,
        )
        if matches:
            return matches

        return self._search_with_python(
            query=query,
            max_results=max_results,
            include_glob=include_glob,
        )

    def _search_with_ripgrep(
        self,
        *,
        query: str,
        max_results: int,
        include_glob: str | None,
    ) -> list[dict[str, Any]]:
        if shutil.which("rg") is None:
            return []

        command: list[str] = [
            "rg",
            "--line-number",
            "--no-heading",
            "--color",
            "never",
            "--max-count",
            str(max_results),
            query,
            str(self.workspace_root),
        ]
        if include_glob:
            command.extend(["--glob", include_glob])

        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=False,
            )
        except Exception:
            return []

        if result.returncode not in (0, 1):
            return []

        if not result.stdout.strip():
            return []

        parsed: list[dict[str, Any]] = []
        for line in result.stdout.splitlines():
            parts = line.split(":", maxsplit=2)
            if len(parts) != 3:
                continue
            file_path, line_number, text = parts
            parsed.append(
                {
                    "file": Path(file_path).as_posix(),
                    "line": int(line_number),
                    "text": text,
                }
            )
            if len(parsed) >= max_results:
                break
        return parsed

    def _search_with_python(
        self,
        *,
        query: str,
        max_results: int,
        include_glob: str | None,
    ) -> list[dict[str, Any]]:
        pattern = re.compile(re.escape(query), flags=re.IGNORECASE)
        matches: list[dict[str, Any]] = []

        files = self.list_files(max_depth=8, max_files=6000)
        for rel_path in files:
            if include_glob and not Path(rel_path).match(include_glob):
                continue
            full_path = self.workspace_root / rel_path
            try:
                with full_path.open("r", encoding="utf-8", errors="ignore") as handle:
                    for idx, line in enumerate(handle, start=1):
                        if not pattern.search(line):
                            continue
                        matches.append(
                            {
                                "file": rel_path,
                                "line": idx,
                                "text": line.rstrip("\n"),
                            }
                        )
                        if len(matches) >= max_results:
                            return matches
            except Exception:
                continue

        return matches


class FileEditor:
    def __init__(self, workspace_root: Path):
        self.workspace_root = workspace_root.resolve()

    def _resolve_path(self, path: str | Path) -> Path:
        candidate = Path(path)
        if candidate.is_absolute():
            return candidate
        return (self.workspace_root / candidate).resolve()

    def write_file(self, path: str | Path, content: str) -> Path:
        resolved = self._resolve_path(path)
        resolved.parent.mkdir(parents=True, exist_ok=True)
        resolved.write_text(content, encoding="utf-8")
        return resolved

    def append_file(self, path: str | Path, content: str) -> Path:
        resolved = self._resolve_path(path)
        resolved.parent.mkdir(parents=True, exist_ok=True)
        with resolved.open("a", encoding="utf-8") as handle:
            handle.write(content)
        return resolved

    def str_replace(
        self,
        path: str | Path,
        old_str: str,
        new_str: str,
        *,
        require_unique: bool = True,
    ) -> tuple[Path, int]:
        resolved = self._resolve_path(path)
        content = resolved.read_text(encoding="utf-8")
        occurrences = content.count(old_str)

        if occurrences == 0:
            raise ValueError(f"Pattern not found in {resolved}")
        if require_unique and occurrences != 1:
            raise ValueError(
                f"Pattern in {resolved} is not unique; found {occurrences} occurrences"
            )

        updated = content.replace(old_str, new_str, 1 if require_unique else occurrences)
        resolved.write_text(updated, encoding="utf-8")
        return resolved, occurrences

    def insert(self, path: str | Path, line_number: int, text: str) -> Path:
        resolved = self._resolve_path(path)
        content = resolved.read_text(encoding="utf-8")
        lines = content.splitlines(keepends=True)

        idx = max(0, min(line_number, len(lines)))
        insertion = text
        if insertion and not insertion.endswith("\n"):
            insertion += "\n"
        lines.insert(idx, insertion)

        resolved.write_text("".join(lines), encoding="utf-8")
        return resolved

    def delete_file(self, path: str | Path) -> Path:
        resolved = self._resolve_path(path)
        if resolved.exists() and resolved.is_file():
            resolved.unlink()
        return resolved


class TerminalExecutor:
    def __init__(self, default_cwd: Path):
        self.default_cwd = default_cwd.resolve()

    async def run(
        self,
        command: str,
        *,
        cwd: str | Path | None = None,
        timeout: int = 120,
        extra_env: dict[str, str] | None = None,
    ) -> CommandResult:
        run_cwd = Path(cwd).resolve() if cwd else self.default_cwd
        env = os.environ.copy()
        if extra_env:
            env.update(extra_env)

        process = await asyncio.create_subprocess_shell(
            command,
            cwd=str(run_cwd),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )

        timed_out = False
        try:
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                process.communicate(),
                timeout=max(1, timeout),
            )
        except asyncio.TimeoutError:
            timed_out = True
            process.kill()
            stdout_bytes, stderr_bytes = await process.communicate()

        stdout = stdout_bytes.decode("utf-8", errors="replace") if stdout_bytes else ""
        stderr = stderr_bytes.decode("utf-8", errors="replace") if stderr_bytes else ""

        return CommandResult(
            command=command,
            cwd=str(run_cwd),
            return_code=process.returncode if process.returncode is not None else -1,
            stdout=stdout,
            stderr=stderr,
            timed_out=timed_out,
        )

    async def run_many(
        self,
        commands: list[str],
        *,
        cwd: str | Path | None = None,
        timeout_per_command: int = 120,
    ) -> list[CommandResult]:
        results: list[CommandResult] = []
        for command in commands:
            result = await self.run(command, cwd=cwd, timeout=timeout_per_command)
            results.append(result)
        return results


def shell_join(parts: list[str]) -> str:
    return " ".join(shlex.quote(part) for part in parts)
