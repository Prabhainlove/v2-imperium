from __future__ import annotations

import os
import shlex
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from .adapters import TerminalExecutor
from .models import CommandResult


_BLOCKED_COMMAND_PATTERNS = [
    "git reset --hard",
    "git checkout --",
    "rm -rf /",
    "shutdown",
    "reboot",
    "format c:",
]


@dataclass(slots=True)
class ExecutionSandbox:
    """Executes commands with basic isolation and safety guards."""

    executor: TerminalExecutor

    async def run_commands(
        self,
        commands: Iterable[str],
        *,
        cwd: str | Path | None = None,
        timeout_per_command: int = 180,
    ) -> list[CommandResult]:
        results: list[CommandResult] = []
        for command in commands:
            sanitized = command.strip()
            if not sanitized:
                continue

            if self._is_blocked(sanitized):
                results.append(
                    CommandResult(
                        command=sanitized,
                        cwd=str(Path(cwd).resolve()) if cwd else str(self.executor.default_cwd),
                        return_code=126,
                        stdout="",
                        stderr="Blocked unsafe command by policy",
                        timed_out=False,
                    )
                )
                continue

            result = await self.executor.run(
                sanitized,
                cwd=cwd,
                timeout=timeout_per_command,
            )
            results.append(result)
        return results

    def build_python_compile_commands(self, files: Iterable[str | Path]) -> list[str]:
        commands: list[str] = []
        if os.name == 'nt':
            python_executable = f'"{sys.executable}"'
        else:
            python_executable = shlex.quote(sys.executable)

        for raw_path in files:
            path = Path(raw_path)
            if path.suffix != ".py":
                continue
            absolute_path = path.resolve()
            if os.name == 'nt':
                commands.append(
                    f'{python_executable} -m py_compile "{absolute_path}"'
                )
            else:
                commands.append(
                    f"{python_executable} -m py_compile {shlex.quote(str(absolute_path))}"
                )

        return commands

    def _is_blocked(self, command: str) -> bool:
        lowered = command.lower()
        return any(pattern in lowered for pattern in _BLOCKED_COMMAND_PATTERNS)
