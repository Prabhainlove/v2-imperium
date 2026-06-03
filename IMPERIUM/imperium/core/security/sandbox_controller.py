from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, TimeoutError
from typing import Any, Callable


class SandboxController:
    def __init__(self, *, max_workers: int = 4, default_timeout_seconds: int = 30) -> None:
        self._executor = ThreadPoolExecutor(max_workers=max_workers)
        self.default_timeout_seconds = max(1, int(default_timeout_seconds))

    def run(
        self,
        action: Callable[..., Any],
        *args: Any,
        timeout_seconds: int | None = None,
        **kwargs: Any,
    ) -> tuple[bool, Any]:
        timeout = timeout_seconds or self.default_timeout_seconds
        future = self._executor.submit(action, *args, **kwargs)

        try:
            result = future.result(timeout=timeout)
            return (True, result)
        except TimeoutError:
            future.cancel()
            return (False, "Action timed out in sandbox")
        except Exception as exc:
            return (False, str(exc))

    def shutdown(self) -> None:
        self._executor.shutdown(wait=True, cancel_futures=True)
